namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/[controller]")]
public class SourcesController : ControllerBase
{
    private readonly AppDbContext _db;

    public SourcesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetSources()
    {
        var sources = await _db.Sources.ToListAsync();
        return Ok(sources);
    }

    [HttpGet("/api/admin/sources")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAdminSources()
    {
        var sources = await _db.Sources.ToListAsync();

        var counts = await _db.Events
            .GroupBy(e => e.SourceId)
            .Select(g => new { SourceId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.SourceId, x => x.Count);

        var result = sources.Select(s => new
        {
            s.Id,
            s.Name,
            s.ShortName,
            s.BaseUrl,
            s.Url,
            s.Category,
            s.Type,
            s.IsActive,
            EventCount = counts.TryGetValue(s.Id, out var c) ? c : 0,
        });

        return Ok(result);
    }

    [HttpPost("/api/admin/sources")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateSource([FromBody] CreateSourceRequest req)
    {
        var source = new Source
        {
            Name      = req.Name,
            ShortName = req.ShortName,
            BaseUrl   = req.BaseUrl,
            Url       = req.Url,
            Category  = req.Category,
            Type      = req.Type,
            IsActive  = true,
        };

        _db.Sources.Add(source);
        await _db.SaveChangesAsync();
        return Ok(source);
    }

    [HttpPatch("/api/admin/sources/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateSource(int id, [FromBody] UpdateSourceRequest req)
    {
        var source = await _db.Sources.FindAsync(id);
        if (source == null) return NotFound();

        if (req.Name     != null) source.Name     = req.Name;
        if (req.ShortName!= null) source.ShortName= req.ShortName;
        if (req.Url      != null) source.Url      = req.Url;
        if (req.Category != null) source.Category = req.Category;
        if (req.IsActive.HasValue) source.IsActive = req.IsActive.Value;

        await _db.SaveChangesAsync();
        return Ok(source);
    }

    [HttpDelete("/api/admin/sources/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSource(int id)
    {
        var source = await _db.Sources.FindAsync(id);
        if (source == null) return NotFound();

        _db.Sources.Remove(source);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record CreateSourceRequest(
    string Name,
    string ShortName,
    string BaseUrl,
    string? Url,
    string? Category,
    SourceType Type
);

public record UpdateSourceRequest(
    string? Name,
    string? ShortName,
    string? Url,
    string? Category,
    bool? IsActive
);
