namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/[controller]")]
public class PreferencesController : ControllerBase
{
    private readonly AppDbContext _db;

    public PreferencesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("{userId}")]
    public async Task<IActionResult> GetPreferences(string userId)
    {
        var prefs = await _db.UserPreferences
            .Where(p => p.UserId == userId)
            .ToListAsync();

        return Ok(prefs);
    }

    [HttpPost]
    public async Task<IActionResult> CreatePreference([FromBody] UserPreference preference)
    {
        preference.Id = Guid.NewGuid();
        _db.UserPreferences.Add(preference);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetPreferences),
            new { userId = preference.UserId }, preference);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdatePreference(Guid id, [FromBody] UserPreference updated)
    {
        var existing = await _db.UserPreferences.FindAsync(id);
        if (existing is null) return NotFound();

        existing.GeographyFilter = updated.GeographyFilter;
        existing.SourceFilter = updated.SourceFilter;
        existing.SeverityFilter = updated.SeverityFilter;
        existing.IsActive = updated.IsActive;

        await _db.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeletePreference(Guid id)
    {
        var existing = await _db.UserPreferences.FindAsync(id);
        if (existing is null) return NotFound();

        _db.UserPreferences.Remove(existing);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
