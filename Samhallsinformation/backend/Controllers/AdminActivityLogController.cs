namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// POST är öppen för Admin+Support (klassattributet) eftersom kontoåtgärder
// (Sparat: tillagd/borttagen) triggas från Användarhantering/Händelsesök,
// som båda är Support-åtkomliga sidor. GET/undo smalnas ytterligare av till
// Admin-only per metod — [Authorize]-attribut ANDas, så en metod kan göra
// klassens tillåtna roller striktare (men aldrig bredare, se
// AdminUserDetailsController-mönstret).
[ApiController]
[Route("api/admin/activity-log")]
[Authorize(Roles = "Admin,Support")]
public class AdminActivityLogController : ControllerBase
{
    // Slår ihop AdminActivityLogs (skrivna av admin/system-write-sites, se
    // AktivitetsloggService) med IngestorRunLog (systemets ingestor-cykler,
    // egen tabell, rörs inte) VID LÄSNING — inte en riktig DB-nivå UNION,
    // utan ett fönstrat urval från var sida som slås ihop och sorteras i
    // minnet. Pragmatiskt: datavolymen i den här adminpanelen är liten,
      // se #491 wave 1-scopningen.
    private const int MaxFönster = 1000;

    private readonly AppDbContext _db;

    public AdminActivityLogController(AppDbContext db) => _db = db;

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetLog(
        [FromQuery] string? aktörTyp,
        [FromQuery] string? typ,
        [FromQuery] string? sök,
        [FromQuery] DateTime? från,
        [FromQuery] DateTime? till,
        [FromQuery] int gräns = 8,
        [FromQuery] bool visaArkiverade = false,
        [FromQuery] bool visaTest = false)
    {
        if (gräns > 500) gräns = 500;
        if (gräns < 1)   gräns = 1;

        var adminQuery = _db.AdminActivityLogs.AsQueryable();
        if (!visaArkiverade) adminQuery = adminQuery.Where(l => !l.Arkiverad);
        if (!visaTest)       adminQuery = adminQuery.Where(l => !l.Test);
        if (!string.IsNullOrWhiteSpace(aktörTyp)) adminQuery = adminQuery.Where(l => l.AktörTyp == aktörTyp);
        if (!string.IsNullOrWhiteSpace(typ))      adminQuery = adminQuery.Where(l => l.Typ == typ);
        if (från != null) adminQuery = adminQuery.Where(l => l.Tid >= från);
        if (till != null) adminQuery = adminQuery.Where(l => l.Tid <= till);
        if (!string.IsNullOrWhiteSpace(sök))
            adminQuery = adminQuery.Where(l => l.Rubrik.Contains(sök) || l.Detalj.Contains(sök));

        var adminTotalt = await adminQuery.CountAsync();
        var adminRader  = await adminQuery.OrderByDescending(l => l.Tid).Take(MaxFönster).ToListAsync();
        var adminDtos   = adminRader.Select(ToDto).ToList();

        // Ingestor-körningar (System) hämtas alltid i ett fönster (oavsett
        // aktörTyp/typ/sök) — dels för sammanfattningskorten, som liksom
        // tidigare (Aktivitetslogg.tsx innan #491) alltid visar systemets
        // helhetsbild oavsett aktivt filter, dels som underlag för det
        // faktiskt filtrerade urvalet som slås ihop med adminraderna nedan.
        var ingestorQuery = _db.IngestorRunLogs.AsQueryable();
        if (från != null) ingestorQuery = ingestorQuery.Where(l => l.RunAt >= från);
        if (till != null) ingestorQuery = ingestorQuery.Where(l => l.RunAt <= till);

        var ingestorRader = await ingestorQuery.OrderByDescending(l => l.RunAt).Take(MaxFönster).ToListAsync();
        var sourceNames   = await _db.Sources.ToDictionaryAsync(s => s.Id, s => s.ShortName);
        var aktuellaFel   = await _db.Sources.Where(s => s.LastFetchError != null).Select(s => s.Id).ToListAsync();
        var ingestorDtosAlla = ingestorRader.Select(r => IngestorTillDto(r, sourceNames, aktuellaFel)).ToList();

        var ingestorMedI = string.IsNullOrWhiteSpace(aktörTyp) || aktörTyp == AktörTyper.System
            ? ingestorDtosAlla
                .Where(d => string.IsNullOrWhiteSpace(typ) || d.Typ == typ)
                .Where(d => string.IsNullOrWhiteSpace(sök)
                    || d.Rubrik.Contains(sök, StringComparison.OrdinalIgnoreCase)
                    || d.Detalj.Contains(sök, StringComparison.OrdinalIgnoreCase))
                .ToList()
            : [];

        var alla   = adminDtos.Concat(ingestorMedI).OrderByDescending(d => d.Tid).ToList();
        var totalt = adminTotalt + ingestorMedI.Count;

        return Ok(new
        {
            Rader = alla.Take(gräns),
            Totalt = totalt,
            Sammanfattning = new
            {
                Ingestor  = ingestorDtosAlla.Count(d => d.Typ == LoggTyper.Ingestor),
                Fel       = ingestorDtosAlla.Count(d => d.Status == "Fel"),
                Varningar = ingestorDtosAlla.Count(d => d.Status == "Varning"),
            },
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateLogEntry([FromBody] CreateActivityLogRequest req)
    {
        // Namnet hämtas ur JWT:n (riktig identitet) — tidigare låg det som en
        // hårdkodad mock-konstant ("Joakim Rehn") oavsett vem som faktiskt var
        // inloggad. AktivVy (Admin/Support/Användare-vyn admin/support just då
        // tittar som) är fortfarande klientens eget val, inte JWT:ns roll —
        // rollväljaren låter en Admin bläddra "som" en lägre roll.
        var namn = User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Email) ?? "Okänd";

        var post = new AdminActivityLog
        {
            Vem    = $"{namn} ({req.AktivVy}-läge)",
            Typ    = req.Typ,
            Rubrik = req.Rubrik,
            Detalj = req.Detalj,

            AngraAnvandareId = req.ÅngraData?.AnvandareId,
            AngraEventId     = req.ÅngraData?.Handelse.EventId,
            AngraTitle       = req.ÅngraData?.Handelse.Title,
            AngraSourceName  = req.ÅngraData?.Handelse.SourceName,
            AngraPublishedAt = req.ÅngraData?.Handelse.PublishedAt,
            AngraSparadDatum = req.ÅngraData?.Handelse.SparadDatum,
            AngraUndoAction  = req.ÅngraData?.UndoAction,
        };

        _db.AdminActivityLogs.Add(post);
        await _db.SaveChangesAsync();
        return Ok(ToDto(post));
    }

    [HttpPut("{id:guid}/undo")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> MarkUndone(Guid id)
    {
        var post = await _db.AdminActivityLogs.FindAsync(id);
        if (post == null) return NotFound();

        post.Ångrad = true;
        await _db.SaveChangesAsync();
        return Ok(ToDto(post));
    }

    private static LoggPostDto ToDto(AdminActivityLog p) => new(
        p.Id, p.Tid, p.Vem, p.AktörTyp, p.Typ, p.Rubrik, p.Detalj, "OK", p.Ångrad,
        p.AngraAnvandareId == null ? null : new ÅngraDataDto(
            p.AngraAnvandareId,
            new SparadHandelseMiniDto(p.AngraEventId!, p.AngraTitle!, p.AngraSourceName!, p.AngraPublishedAt!, p.AngraSparadDatum!),
            p.AngraUndoAction!
        ),
        p.Ip, p.Enhet, p.GammaltVärde, p.NyttVärde, p.Arkiverad, p.Test
    );

    // Ingestor-körningar (IngestorRunLog) mappas till samma radform som
    // AdminActivityLog-poster — en lyckad retry (samma källa senare OK igen)
    // visas som Varning, inte Fel, eftersom felet självläkte (samma
    // "Kvarstår"/"OK vid retry"-logik som AdminIngestorLogController.GetRecent).
    private static LoggPostDto IngestorTillDto(IngestorRunLog r, Dictionary<int, string> sourceNames, List<int> aktuellaFel)
    {
        var sourceName = sourceNames.GetValueOrDefault(r.SourceId, "Okänd källa");
        var typ    = r.Success ? LoggTyper.Ingestor : LoggTyper.Fel;
        var rubrik = r.Success ? $"Ingestor-körning — {sourceName}" : $"Fel — {sourceName}";
        var detalj = r.Success ? $"{r.EventsInserted} nya händelser hämtade" : (r.ErrorMessage ?? "Okänt fel");
        var status = r.Success ? "OK" : (aktuellaFel.Contains(r.SourceId) ? "Fel" : "Varning");

        return new LoggPostDto(
            r.Id, r.RunAt, AktörTyper.System, AktörTyper.System, typ, rubrik, detalj, status, false, null,
            null, null, null, null, false, false);
    }
}

public record CreateActivityLogRequest(string Typ, string Rubrik, string Detalj, string AktivVy, ÅngraDataRequest? ÅngraData);
public record ÅngraDataRequest(string AnvandareId, SparadHandelseMiniRequest Handelse, string UndoAction);
public record SparadHandelseMiniRequest(string EventId, string Title, string SourceName, string PublishedAt, string SparadDatum);

public record LoggPostDto(
    Guid Id, DateTime Tid, string Vem, string AktörTyp, string Typ, string Rubrik, string Detalj, string Status,
    bool Ångrad, ÅngraDataDto? ÅngraData,
    string? Ip, string? Enhet, string? GammaltVärde, string? NyttVärde, bool Arkiverad, bool Test);
public record ÅngraDataDto(string AnvandareId, SparadHandelseMiniDto Handelse, string UndoAction);
public record SparadHandelseMiniDto(string EventId, string Title, string SourceName, string PublishedAt, string SparadDatum);
