namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
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
        var existing = await _db.FeatureFlagOverrides.FindAsync(key);
        var gammalt  = existing?.Value;
        if (existing == null)
            _db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = key, Value = req.Value });
        else
            existing.Value = req.Value;

        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"Feature flag ändrad — {key}",
            $"Satt till {(req.Value ? "på" : "av")}",
            gammaltVärde: gammalt?.ToString(), nyttVärde: req.Value.ToString());
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
