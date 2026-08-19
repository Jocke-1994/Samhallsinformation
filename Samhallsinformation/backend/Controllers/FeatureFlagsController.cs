namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/feature-flags")]
public class FeatureFlagsController : ControllerBase
{
    private readonly AppDbContext _db;

    public FeatureFlagsController(AppDbContext db) => _db = db;

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
        if (existing == null)
            _db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = key, Value = req.Value });
        else
            existing.Value = req.Value;

        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("/api/admin/feature-flags")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResetOverrides()
    {
        _db.FeatureFlagOverrides.RemoveRange(_db.FeatureFlagOverrides);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record SetFlagRequest(bool Value);
