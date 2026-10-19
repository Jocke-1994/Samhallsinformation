namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.FeatureFlags;
using Samhallsinformation.Application.Uppdateringar;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/[controller]")]
public class UppdateringarController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAktivitetsloggService _aktivitetslogg;

    public UppdateringarController(AppDbContext db, IAktivitetsloggService aktivitetslogg)
    {
        _db = db;
        _aktivitetslogg = aktivitetslogg;
    }

    // Publik, men synlighetsstyrd: anonyma får bara punkter med Synlighet="alla",
    // inloggade (giltig JWT skickad) får även "inloggade". Ingen [Authorize] —
    // UseAuthentication fyller User om en giltig token följer med (en
    // ogiltig/utgången token ger bara en anonym User, inte 401). En release
    // som blir utan synliga punkter släpps helt. Admin ser allt via
    // /api/admin/uppdateringar. Punkter med okänd Synlighet (gamla rader)
    // räknas som ej "alla" och döljs därmed för anonyma.
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetUppdateringar()
    {
        var inloggad = User.Identity?.IsAuthenticated == true;

        var releaser = await _db.Uppdateringar
            .Where(u => u.Publicerad)
            .OrderByDescending(u => u.Datum)
            .ToListAsync();

        var dtos = MedAnnonseringsteaser(await ByggDtoAsync(releaser));
        if (inloggad) return Ok(dtos);

        var synliga = dtos
            .Select(u => u with { Punkter = u.Punkter
                .Where(p => p.Synlighet == UppdateringsVärden.SynlighetAlla).ToList() })
            .Where(u => u.Punkter.Count > 0)
            .ToList();
        return Ok(synliga);
    }

    [HttpGet("/api/admin/uppdateringar")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAdminUppdateringar()
    {
        var releaser = await _db.Uppdateringar
            .OrderByDescending(u => u.Datum)
            .ToListAsync();

        return Ok(await ByggDtoAsync(releaser));
    }

    [HttpPost("/api/admin/uppdateringar")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateUppdatering([FromBody] UppdateringRequest req)
    {
        req = NormaliseraTider(req);
        var fel = ValideraPunkter(req);
        if (fel != null) return BadRequest(new { error = fel });

        var uppdatering = new Uppdatering
        {
            Titel = req.Titel, Datum = req.Datum,
            SkickaPush = req.SkickaPush, PushVersion = req.PushVersion?.Trim(), PushMeddelande = req.PushMeddelande?.Trim(),
            VisaBanderoll = req.VisaBanderoll,
            AnnonseringUtc = req.AnnonseringUtc, PushSkickaVid = req.PushSkickaVid,
        };
        _db.Uppdateringar.Add(uppdatering);
        LäggTillPunkter(uppdatering.Id, req.Punkter);

        // Ny post har inget tidigare väntande schema att ta hänsyn till.
        var förfallet = await ApplySchemaOchPubliceringAsync(uppdatering, req, tidigareVäntandeFlaggor: []);
        await _db.SaveChangesAsync();

        var status = uppdatering.SchemalagdPubliceringUtc != null
            ? $"schemalagd till {uppdatering.SchemalagdPubliceringUtc:yyyy-MM-dd HH:mm} UTC"
            : (uppdatering.Publicerad ? (förfallet ? "publicerad (schema redan passerat)" : "publicerad") : "utkast");
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"Uppdatering skapad — {uppdatering.Titel}", status);
        return Ok((await ByggDtoAsync(new List<Uppdatering> { uppdatering })).Single());
    }

    [HttpPut("/api/admin/uppdateringar/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateUppdatering(Guid id, [FromBody] UppdateringRequest req)
    {
        req = NormaliseraTider(req);
        var fel = ValideraPunkter(req);
        if (fel != null) return BadRequest(new { error = fel });

        var uppdatering = await _db.Uppdateringar.FindAsync(id);
        if (uppdatering == null) return NotFound();

        var publiceradFörut = uppdatering.Publicerad;
        // Flaggor som redan låg och väntade på DEN HÄR posten innan vi
        // skriver över den — så att en manuell publicering (tabellens
        // snabbknapp, eller att kryssa ur "Schemalägg" och spara) aktiverar
        // dem nu istället för att tyst tappa bort dem (code review-fynd,
        // PR #590: manuell publicering nollställde schemat utan att någon
        // faktiskt aktiverade de flaggor det skulle ha satt).
        var väntandeFlaggorFörut = uppdatering.SchemalagdPubliceringUtc != null
            ? FeatureFlagActivation.DeserialiseraFlaggor(uppdatering.SchemalagdaFlaggorJson)
            : new List<string>();

        // Byter admin annonseringsdatumet (eller tar bort/lägger till det) räknas
        // det som en helt ny fas 1 att vänta på — annars skulle en redan körd
        // annonsering aldrig köras om trots ett medvetet nytt datum.
        if (req.AnnonseringUtc != uppdatering.AnnonseringUtc)
            uppdatering.AnnonseradUtc = null;

        uppdatering.Titel          = req.Titel;
        uppdatering.Datum          = req.Datum;
        uppdatering.UpdatedAt      = DateTime.UtcNow;
        uppdatering.SkickaPush     = req.SkickaPush;
        uppdatering.PushVersion    = req.PushVersion?.Trim();
        uppdatering.PushMeddelande = req.PushMeddelande?.Trim();
        uppdatering.VisaBanderoll  = req.VisaBanderoll;
        uppdatering.AnnonseringUtc = req.AnnonseringUtc;
        uppdatering.PushSkickaVid  = req.PushSkickaVid;

        // Ersätter hela punkter-listan — samma helobjekt-PUT-UX som FAQ,
        // slipper spåra per-punkt-ID:n genom formuläret.
        var gamla = await _db.UppdateringsPunkter.Where(p => p.UppdateringId == id).ToListAsync();
        _db.UppdateringsPunkter.RemoveRange(gamla);
        LäggTillPunkter(id, req.Punkter);

        await ApplySchemaOchPubliceringAsync(uppdatering, req, väntandeFlaggorFörut);
        await _db.SaveChangesAsync();

        var detalj = publiceradFörut != uppdatering.Publicerad
            ? (uppdatering.Publicerad ? "Publicerad" : "Avpublicerad")
            : "Innehåll redigerat";
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"Uppdatering redigerad — {uppdatering.Titel}", detalj);
        return Ok((await ByggDtoAsync(new List<Uppdatering> { uppdatering })).Single());
    }

    // Central invariant: en manuell publicering (req.Publicerad=true) vinner
    // ALLTID över ett väntande schema — aktiverar dess flaggor direkt istället
    // för att tyst tappa bort dem. Ett schema vars tidpunkt redan passerat
    // (t.ex. ett gammalt öppet formulär som sparas efter att bakgrund-
    // stjänsten redan bearbetat det på riktigt) körs direkt här också,
    // istället för att lagras som "väntande" och riskera att bearbetas två
    // gånger. Returnerar om det senare inträffade (för loggtexten).
    private async Task<bool> ApplySchemaOchPubliceringAsync(Uppdatering uppdatering, UppdateringRequest req, List<string> tidigareVäntandeFlaggor)
    {
        var förfallet = req.SchemalagdPubliceringUtc.HasValue && req.SchemalagdPubliceringUtc.Value <= DateTime.UtcNow;
        var flaggorAttAktiveraNu = req.Publicerad
            ? tidigareVäntandeFlaggor
            : (förfallet ? (req.SchemalagdaFlaggor ?? []) : []);

        if (flaggorAttAktiveraNu.Count > 0)
        {
            var kontext = req.Publicerad && tidigareVäntandeFlaggor.Count > 0
                ? $"Manuellt publicerad före schemat: {req.Titel}"
                : $"Del av schemalagd lansering: {req.Titel}";
            await FeatureFlagActivation.ActivateFlagsAsync(_db, _aktivitetslogg, flaggorAttAktiveraNu, kontext, AktörTyper.Admin);
        }

        if (req.Publicerad || förfallet)
        {
            uppdatering.Publicerad = req.Publicerad || req.Punkter.Count > 0;
            uppdatering.SchemalagdPubliceringUtc = null;
            uppdatering.SchemalagdaFlaggorJson   = null;
            // En manuell publicering (eller ett redan förfallet schema) hoppar
            // rakt till "lanserad" — ingen kvarvarande annonseringsfas att vänta på.
            uppdatering.AnnonseringUtc = null;
            uppdatering.AnnonseradUtc  = null;
        }
        else
        {
            uppdatering.Publicerad = false;
            uppdatering.SchemalagdPubliceringUtc = req.SchemalagdPubliceringUtc;
            uppdatering.SchemalagdaFlaggorJson   = FeatureFlagActivation.SerialiseraFlaggor(req.SchemalagdaFlaggor);
        }

        return förfallet;
    }

    [HttpDelete("/api/admin/uppdateringar/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteUppdatering(Guid id)
    {
        var uppdatering = await _db.Uppdateringar.FindAsync(id);
        if (uppdatering == null) return NotFound();

        var titel = uppdatering.Titel;
        _db.Uppdateringar.Remove(uppdatering); // punkter tas bort via ON DELETE CASCADE
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"Uppdatering borttagen — {titel}", "");
        return NoContent();
    }

    // V3-6: en JSON-sträng utan "Z" ger Kind=Unspecified, som Npgsql vägrar mot timestamptz.
    private static UppdateringRequest NormaliseraTider(UppdateringRequest req) => req with
    {
        Datum = UtcDateTime.Ensure(req.Datum),
        SchemalagdPubliceringUtc = UtcDateTime.Ensure(req.SchemalagdPubliceringUtc),
        AnnonseringUtc = UtcDateTime.Ensure(req.AnnonseringUtc),
    };

    private static string? ValideraPunkter(UppdateringRequest req)
    {
        var punktFel = UppdateringsVärden.ValideraPunkter(
            (req.Punkter ?? []).Select(p => ((string?)p.Typ, (string?)p.Synlighet)));
        if (punktFel != null) return punktFel;

        // Del 2 (Beslut 2026-10-08): en banderoll har ingenting att visa utan
        // innehåll, och en push utan version/text skulle skicka en tom notis.
        if (req.VisaBanderoll && (req.Punkter?.Count ?? 0) == 0)
            return "Banderoll kräver minst en innehållsrad.";
        if (req.SkickaPush && string.IsNullOrWhiteSpace(req.PushVersion))
            return "Version krävs för att skicka push.";
        if (req.SkickaPush && string.IsNullOrWhiteSpace(req.PushMeddelande))
            return "Meddelande krävs för att skicka push.";

        // Del 3: annonsering i förväg kräver en riktig lanseringstidpunkt att
        // annonsera MOT, och måste ligga före den.
        if (req.AnnonseringUtc != null && req.SchemalagdPubliceringUtc == null)
            return "Annonsering i förväg kräver att lansering är schemalagd.";
        if (req.AnnonseringUtc != null && req.SchemalagdPubliceringUtc != null && req.AnnonseringUtc >= req.SchemalagdPubliceringUtc)
            return "Annonseringsdatumet måste vara före lanseringsdatumet.";
        if (!GiltigaPushSkickaVid.Contains(req.PushSkickaVid))
            return "Ogiltigt värde för 'Skicka vid'.";

        return null;
    }

    private static readonly string[] GiltigaPushSkickaVid = ["Annonsering", "Lansering", "Båda"];

    private void LäggTillPunkter(Guid uppdateringId, List<PunktRequest> punkter)
    {
        for (var i = 0; i < punkter.Count; i++)
        {
            var p = punkter[i];
            _db.UppdateringsPunkter.Add(new UppdateringsPunkt
            {
                UppdateringId = uppdateringId,
                Typ           = p.Typ,
                Plats         = p.Plats,
                Text          = p.Text,
                Synlighet     = p.Synlighet,
                Ordning       = i,
            });
        }
    }

    private async Task<List<UppdateringDto>> ByggDtoAsync(List<Uppdatering> releaser)
    {
        var ids = releaser.Select(u => u.Id).ToList();
        var punkter = await _db.UppdateringsPunkter
            .Where(p => ids.Contains(p.UppdateringId))
            .OrderBy(p => p.Ordning)
            .ToListAsync();

        return releaser.Select(u => new UppdateringDto(
            u.Id, u.Titel, u.Datum, u.Publicerad,
            punkter.Where(p => p.UppdateringId == u.Id)
                   .Select(p => new PunktDto(p.Id, p.Typ, p.Plats, p.Text, p.Synlighet))
                   .ToList(),
            u.SchemalagdPubliceringUtc,
            FeatureFlagActivation.DeserialiseraFlaggor(u.SchemalagdaFlaggorJson),
            u.SkickaPush, u.PushVersion, u.PushMeddelande, u.VisaBanderoll,
            u.AnnonseringUtc, u.AnnonseradUtc, u.PushSkickaVid, u.CreatedAt
        )).ToList();
    }

    // Del 3 (Beslut 2026-10-08): mellan fas 1 (annonsering) och fas 2
    // (lansering) ska PUBLIKA läsare (inloggade som anonyma) se en enda
    // teaser-punkt ("Kommer snart" / "Släpps X") i stället för de riktiga
    // punkterna — admin ser alltid det verkliga innehållet (den här
    // transformen körs bara i GetUppdateringar, aldrig i GetAdminUppdateringar).
    private static List<UppdateringDto> MedAnnonseringsteaser(List<UppdateringDto> dtos) =>
        dtos.Select(u => u.AnnonseradUtc != null && u.SchemalagdPubliceringUtc != null
            ? u with { Punkter = [new PunktDto(
                Guid.Empty, UppdateringsVärden.TypKommerSnart, "Allmänt",
                $"Släpps {SvenskDatum.FormateraDag(u.SchemalagdPubliceringUtc.Value)}",
                UppdateringsVärden.SynlighetAlla)] }
            : u).ToList();
}

public record PunktDto(Guid Id, string Typ, string Plats, string Text, string Synlighet);
public record UppdateringDto(
    Guid Id, string Titel, DateTime Datum, bool Publicerad, List<PunktDto> Punkter,
    DateTime? SchemalagdPubliceringUtc, List<string> SchemalagdaFlaggor,
    bool SkickaPush, string? PushVersion, string? PushMeddelande, bool VisaBanderoll,
    DateTime? AnnonseringUtc, DateTime? AnnonseradUtc, string PushSkickaVid, DateTime CreatedAt);

public record PunktRequest(string Typ, string Plats, string Text, string Synlighet);
public record UppdateringRequest(
    string Titel, DateTime Datum, bool Publicerad, List<PunktRequest> Punkter,
    DateTime? SchemalagdPubliceringUtc = null, List<string>? SchemalagdaFlaggor = null,
    bool SkickaPush = false, string? PushVersion = null, string? PushMeddelande = null,
    bool VisaBanderoll = false, DateTime? AnnonseringUtc = null, string PushSkickaVid = "Lansering");
