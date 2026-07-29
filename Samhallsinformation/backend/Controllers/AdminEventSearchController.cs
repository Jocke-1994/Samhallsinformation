namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

// Historisk händelsesökning för admin och support (källa/tid/plats/datum) —
// söker mot ALLA källor (även opublicerade/deprecated), till skillnad från
// den publika EventsController som bara visar publicerade källor.
[ApiController]
[Authorize(Roles = "Admin,Support")]
public class AdminEventSearchController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminEventSearchController(AppDbContext db)
    {
        _db = db;
    }

    // Lättviktig källista för filter-dropdownen — inte samma som
    // /api/admin/sources (Admin-only, mer detaljerad, till Källhantering)
    [HttpGet("/api/admin/events/sources")]
    public async Task<IActionResult> Sources()
    {
        var sources = await _db.Sources
            .OrderBy(s => s.Name)
            .Select(s => new { s.Id, s.Name, s.ShortName })
            .ToListAsync();

        return Ok(sources);
    }

    // Kända händelsetyper för filter-dropdownen — bara källor som fått sin
    // EventType extraherad (idag Polisen, PR #373) har något att välja här.
    [HttpGet("/api/admin/events/types")]
    public async Task<IActionResult> Types()
    {
        var types = await _db.Events
            .Where(e => e.EventType != null)
            .Select(e => e.EventType!)
            .Distinct()
            .OrderBy(t => t)
            .ToListAsync();

        return Ok(types);
    }

    [HttpGet("/api/admin/events/search")]
    public async Task<IActionResult> Search(
        [FromQuery] int? sourceId,
        [FromQuery] string? geography,
        [FromQuery] string? eventType,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (pageSize > 100) pageSize = 100;
        if (page < 1) page = 1;

        var query = _db.Events.AsQueryable();

        if (sourceId.HasValue)
            query = query.Where(e => e.SourceId == sourceId.Value);

        if (!string.IsNullOrWhiteSpace(geography))
            query = query.Where(e => e.Geography != null && EF.Functions.Like(e.Geography, $"%{geography}%"));

        if (!string.IsNullOrWhiteSpace(eventType))
            query = query.Where(e => e.EventType == eventType);

        if (from.HasValue)
            query = query.Where(e => e.PublishedAt >= from.Value);

        if (to.HasValue)
            query = query.Where(e => e.PublishedAt <= to.Value);

        var total = await query.CountAsync();
        var events = await query
            .OrderByDescending(e => e.PublishedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var sourceNames = await _db.Sources.ToDictionaryAsync(s => s.Id, s => s.ShortName);

        var result = events.Select(e => new
        {
            e.Id,
            e.Title,
            e.Content,
            e.Url,
            e.Geography,
            e.Severity,
            e.EventType,
            e.IsNational,
            e.PublishedAt,
            e.SourceId,
            SourceName = sourceNames.GetValueOrDefault(e.SourceId, "Okänd källa"),
        });

        return Ok(new { total, page, pageSize, events = result });
    }
}
