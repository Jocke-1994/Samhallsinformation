namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.FeatureFlags;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/feature-flags")]
public class FeatureFlagsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAktivitetsloggService _aktivitetslogg;

    public FeatureFlagsController(AppDbContext db, IAktivitetsloggService aktivitetslogg)
    {
        _db = db;
        _aktivitetslogg = aktivitetslogg;
    }

    // Publikt — alla besökare (inloggade eller inte) behöver samma globala
    // flaggtillstånd. Returnerar bara flaggor som avviker från kodens eget
    // default; frontend slår ihop med FLAG_DEFINITIONER precis som tidigare.
    [HttpGet]
    public async Task<IActionResult> GetOverrides()
    {
        var overrides = await _db.FeatureFlagOverrides.ToDictionaryAsync(f => f.Key, f => f.Value);
        return Ok(overrides);
    }

    [HttpPut("/api/admin/feature-flags/{key}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetOverride(string key, [FromBody] SetFlagRequest req)
    {
        var existing = await FeatureFlagActivation.GetOrCreateOverrideAsync(_db, key);
        var ärNy     = _db.Entry(existing).State == EntityState.Added;
        var gammalt  = ärNy ? (bool?)null : existing.Value;
        existing.Value = req.Value;
        // En flagga som slås på direkt via den här vanliga på/av-brytaren
        // (utan att gå via schemaläggningsflödet) ska inte lämna en
        // föråldrad "redo att lanseras"-markering kvar — annars återkommer
        // ✓-badgen ospärrat om flaggan senare stängs av igen (code
        // review-fynd, PR #590).
        if (req.Value) existing.RedoAttLanseras = false;

        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"Feature flag ändrad — {key}",
            $"Satt till {(req.Value ? "på" : "av")}",
            gammaltVärde: gammalt?.ToString(), nyttVärde: req.Value.ToString());
        return Ok();
    }

    // Admins fulla vy av overrides, inkl. RedoAttLanseras — till skillnad
    // från den publika GET ovan (bara Key→Value) behöver Uppdateringars
    // schemaläggningsflöde (välj bland "redo"-flaggade, ej aktiva flaggor)
    // se hela raden.
    [HttpGet("/api/admin/feature-flags")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAdminOverrides()
    {
        var overrides = await _db.FeatureFlagOverrides
            .Select(f => new { f.Key, f.Value, f.RedoAttLanseras })
            .ToListAsync();
        return Ok(overrides);
    }

    // Skiljs medvetet från SetOverride (Value) — en admin ska kunna
    // markera/avmarkera "redo att lanseras" utan att av misstag slå på
    // flaggan för alla besökare. Upsertar raden om den saknas, rör aldrig
    // Value. Samma automatik triggas av AdminFeatureIdeaController.SetStage
    // när en kopplad idés Stage blir "lanseringsklar".
    [HttpPut("/api/admin/feature-flags/{key}/redo")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetRedoAttLanseras(string key, [FromBody] SetRedoRequest req)
    {
        var existing = await FeatureFlagActivation.GetOrCreateOverrideAsync(_db, key);
        existing.RedoAttLanseras = req.RedoAttLanseras;

        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"Flagga markerad {(req.RedoAttLanseras ? "redo att lanseras" : "ej redo")} — {key}", "");
        return Ok();
    }

    [HttpDelete("/api/admin/feature-flags")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResetOverrides()
    {
        var antal = await _db.FeatureFlagOverrides.CountAsync();
        _db.FeatureFlagOverrides.RemoveRange(_db.FeatureFlagOverrides);
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            "Alla feature flag-overrides återställda", $"{antal} overrides borttagna");
        return NoContent();
    }
}

public record SetFlagRequest(bool Value);
public record SetRedoRequest(bool RedoAttLanseras);
