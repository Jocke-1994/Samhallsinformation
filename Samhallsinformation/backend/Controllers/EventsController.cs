namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

[ApiController]
[Route("api/[controller]")]
public class EventsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;

    public EventsController(AppDbContext db, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
    }

    [HttpGet]
    public async Task<IActionResult> GetEvents(
        [FromQuery] string? geography,
        [FromQuery] string? shortName,
        [FromQuery] string? source,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] bool? national,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (pageSize > 100) pageSize = 100;
        if (page < 1) page = 1;

        var publishedSourceIds = await _db.Sources
            .Where(s => s.IsPublished)
            .Select(s => s.Id)
            .ToListAsync();

        var query = _db.Events
            .Where(e => publishedSourceIds.Contains(e.SourceId))
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(geography))
            query = query.Where(e => e.Geography == geography);

        if (!string.IsNullOrWhiteSpace(shortName))
        {
            // Ny frontend: filtrera per myndighetsgrupp (alla feeds med samma shortName)
            var idsForGroup = await _db.Sources
                .Where(s => s.ShortName == shortName && publishedSourceIds.Contains(s.Id))
                .Select(s => s.Id)
                .ToListAsync();
            query = query.Where(e => idsForGroup.Contains(e.SourceId));
        }
        else if (!string.IsNullOrWhiteSpace(source))
        {
            // Gammal frontend: filtrera per enskilt sourceId (bakåtkompatibilitet)
            query = query.Where(e => e.SourceId.ToString() == source);
        }

        if (from.HasValue)
            query = query.Where(e => e.PublishedAt >= from.Value);

        if (to.HasValue)
            query = query.Where(e => e.PublishedAt <= to.Value);

        if (national.HasValue)
            query = query.Where(e => e.IsNational == national.Value);

        var total = await query.CountAsync();
        var events = await query
            .OrderByDescending(e => e.PublishedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new { total, page, pageSize, events });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetEvent(Guid id)
    {
        var evt = await _db.Events.FindAsync(id);
        if (evt is null) return NotFound();
        return Ok(evt);
    }

    // Kollar reaktivt om en händelses källänk fortfarande lever, t.ex. innan
    // "Läs mer"-klick på en sparad händelse öppnas i en ny flik. Ingen
    // schemalagd bakgrundskoll — bara vid faktiskt klick, så trafiken mot
    // källan hålls minimal.
    [HttpGet("{id:guid}/link-status")]
    public async Task<IActionResult> GetLinkStatus(Guid id)
    {
        var evt = await _db.Events.FindAsync(id);
        if (evt is null) return NotFound();

        var client = _httpClientFactory.CreateClient("linkcheck");
        bool alive;
        try
        {
            using var request  = new HttpRequestMessage(HttpMethod.Get, evt.Url);
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            alive = response.IsSuccessStatusCode;
        }
        catch
        {
            alive = false;
        }

        return Ok(new { alive });
    }
}
