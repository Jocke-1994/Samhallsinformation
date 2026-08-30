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
        // Fullständigt Name, inte ShortName — flera källor delar medvetet
        // ShortName för sidomenyns gruppering (t.ex. "Polisen" och "Polisen
        // Efterlysningar" delar "Polisen"), vilket gör en ingestor-radrubrik
        // som "Polisen misslyckades" tvetydig om man inte vet vilket av de
        // två flödena som faktiskt är trasigt.
        var sourceNames   = await _db.Sources.ToDictionaryAsync(s => s.Id, s => s.Name);
        var aktuellaFel   = await _db.Sources.Where(s => s.LastFetchError != null).Select(s => s.Id).ToListAsync();

        // En rad per ingestor-CYKEL, inte en rad per källa — annars fyller en
        // enda 5-minuterskörning (8+ källor) hela "Senaste händelser" på
        // Översikt (visar bara 8 rader totalt) utan att en enda riktig
        // admin/system-händelse syns. RunAt är en delad tidsstämpel per cykel
        // sedan IngestorBackgroundService satte den explicit (se där).
        var ingestorDtosAlla = ingestorRader
            .GroupBy(r => r.RunAt)
            .Select(g => IngestorCykelTillDto(g.Key, g.ToList(), sourceNames, aktuellaFel))
            .ToList();

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

    // En hel ingestor-cykel (alla källor som kördes i samma
    // IngestorBackgroundService-tick, delad RunAt) mappas till EN rad —
    // tidigare en rad per källa, vilket dränkte riktig admin/system-aktivitet
    // i rutinmässiga "Ingestor-körning — X"-rader så fort fler än en källa
    // fanns. En lyckad retry (samma källa senare OK igen) räknas som Varning,
    // inte Fel, om felet självläkt (samma "Kvarstår"/"OK vid retry"-logik som
    // AdminIngestorLogController.GetRecent).
    private static LoggPostDto IngestorCykelTillDto(
        DateTime runAt, List<IngestorRunLog> rader, Dictionary<int, string> sourceNames, List<int> aktuellaFel)
    {
        string Namn(int sourceId) => sourceNames.GetValueOrDefault(sourceId, "Okänd källa");

        var uppdaterade = rader
            .Where(r => r.Success && r.EventsInserted > 0)
            .Select(r => $"{Namn(r.SourceId)} (+{r.EventsInserted})")
            .ToList();
        var misslyckade = rader.Where(r => !r.Success).ToList();

        // Uppdateringarna är huvudsaken och leder alltid raden — ett fel är en
        // kort flagga på SLUTET, inte tvärtom. Annars leder en enda kroniskt
        // trasig källa varenda rad med "X misslyckades" för evigt och begraver
        // riktiga uppdateringar i en bisats (upptäckt via en skärmdump: en rad
        // med "Polisen (+151)" såg ut som ett rent fel eftersom en helt annan,
        // redan trasig källa råkade misslyckas i samma cykel).
        // Radar aldrig upp namnen på fler än en trasig källa i rubriken — blir
        // för långt och klipps mitt i ett namn i den smala Översikts-widgeten.
        // Namnen finns redan i Detalj (klicka för att öppna raden), samma
        // expanderbara mönster som Aktivitetslogg redan använder.
        var rubrikDelar = new List<string> { uppdaterade.Count > 0 ? string.Join(", ", uppdaterade) : "inga nya händelser" };
        if (misslyckade.Count > 0)
        {
            rubrikDelar.Add(misslyckade.Count == 1
                ? $"{Namn(misslyckade[0].SourceId)} misslyckades"
                : $"{misslyckade.Count} källor misslyckades");
        }
        var rubrik = $"Ingestor-körning — {string.Join(" · ", rubrikDelar)}";

        var detaljDelar = new List<string>
        {
            uppdaterade.Count > 0 ? $"Uppdaterade: {string.Join(", ", uppdaterade)}" : "Inga nya händelser i denna körning",
        };
        if (misslyckade.Count > 0)
        {
            detaljDelar.Add("Fel: " + string.Join(", ", misslyckade.Select(r => $"{Namn(r.SourceId)} ({r.ErrorMessage ?? "okänt fel"})")));
        }

        var någotFortfarandeTrasigt = misslyckade.Any(r => aktuellaFel.Contains(r.SourceId));
        var status = misslyckade.Count == 0 ? "OK" : (någotFortfarandeTrasigt ? "Fel" : "Varning");
        var typ    = misslyckade.Count == 0 ? LoggTyper.Ingestor : LoggTyper.Fel;

        return new LoggPostDto(
            rader[0].Id, runAt, AktörTyper.System, AktörTyper.System, typ, rubrik, string.Join(" · ", detaljDelar), status, false, null,
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
