namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

[ApiController]
public class StatsController : ControllerBase
{
    private readonly AppDbContext _db;

    public StatsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("/api/admin/stats")]
    public async Task<IActionResult> GetStats()
    {
        var now         = DateTime.UtcNow;
        var since24h    = now.AddHours(-24);
        var since7days  = now.AddDays(-7).Date;

        var totalEvents    = await _db.Events.CountAsync();
        var eventsLast24h  = await _db.Events.CountAsync(e => e.PublishedAt >= since24h);
        var activeSources  = await _db.Sources.CountAsync(s => s.IsActive);

        var eventsByDay = await _db.Events
            .Where(e => e.PublishedAt >= since7days)
            .GroupBy(e => e.PublishedAt.Date)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .OrderBy(x => x.Date)
            .ToListAsync();

        var sources = await _db.Sources.ToListAsync();
        var eventsBySource = await _db.Events
            .GroupBy(e => e.SourceId)
            .Select(g => new { SourceId = g.Key, Count = g.Count() })
            .ToListAsync();

        var eventsBySourceNamed = eventsBySource
            .Select(x => new {
                SourceId   = x.SourceId,
                SourceName = sources.FirstOrDefault(s => s.Id == x.SourceId)?.Name ?? "Okänd",
                Count      = x.Count,
            })
            .OrderByDescending(x => x.Count)
            .ToList();

        var eventsBySeverity = await _db.Events
            .GroupBy(e => e.Severity)
            .Select(g => new { Severity = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToListAsync();

        var last7Days = Enumerable.Range(0, 7)
            .Select(i => since7days.AddDays(i))
            .Select(d => new {
                Date  = d.ToString("yyyy-MM-dd"),
                Count = eventsByDay.FirstOrDefault(x => x.Date == d)?.Count ?? 0,
            })
            .ToList();

        return Ok(new {
            TotalEvents       = totalEvents,
            EventsLast24h     = eventsLast24h,
            ActiveSources     = activeSources,
            EventsByDay       = last7Days,
            EventsBySource    = eventsBySourceNamed,
            EventsBySeverity  = eventsBySeverity,
        });
    }
}
