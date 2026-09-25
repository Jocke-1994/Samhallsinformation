namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

        var dtos = await ByggDtoAsync(releaser);
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
        var fel = ValideraPunkter(req);
        if (fel != null) return BadRequest(new { error = fel });

        var uppdatering = new Uppdatering { Titel = req.Titel, Datum = req.Datum };
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

        uppdatering.Titel     = req.Titel;
        uppdatering.Datum     = req.Datum;
        uppdatering.UpdatedAt = DateTime.UtcNow;

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

    private static string? ValideraPunkter(UppdateringRequest req) =>
        UppdateringsVärden.ValideraPunkter(
            (req.Punkter ?? []).Select(p => ((string?)p.Typ, (string?)p.Synlighet)));

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
            FeatureFlagActivation.DeserialiseraFlaggor(u.SchemalagdaFlaggorJson)
        )).ToList();
    }
}

public record PunktDto(Guid Id, string Typ, string Plats, string Text, string Synlighet);
public record UppdateringDto(
    Guid Id, string Titel, DateTime Datum, bool Publicerad, List<PunktDto> Punkter,
    DateTime? SchemalagdPubliceringUtc, List<string> SchemalagdaFlaggor);

public record PunktRequest(string Typ, string Plats, string Text, string Synlighet);
public record UppdateringRequest(
    string Titel, DateTime Datum, bool Publicerad, List<PunktRequest> Punkter,
    DateTime? SchemalagdPubliceringUtc = null, List<string>? SchemalagdaFlaggor = null);
