namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

[ApiController]
[Route("api/[controller]")]
public class SourcesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IEnumerable<IIngestor> _dedicatedIngestors;
    private readonly IHttpClientFactory _httpClientFactory;

    public SourcesController(AppDbContext db, IEnumerable<IIngestor> dedicatedIngestors, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _dedicatedIngestors = dedicatedIngestors;
        _httpClientFactory = httpClientFactory;
    }

    [HttpGet]
    public async Task<IActionResult> GetSources()
    {
        var sources = await _db.Sources.Where(s => s.IsPublished).ToListAsync();
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
            s.IsPublished,
            s.LastFetchedAt,
            s.LastFetchError,
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
            Type        = req.Type,
            IsActive    = false,
            IsPublished = false,
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
        if (req.IsActive.HasValue)    source.IsActive    = req.IsActive.Value;
        if (req.IsPublished.HasValue) source.IsPublished = req.IsPublished.Value;

        await _db.SaveChangesAsync();
        return Ok(source);
    }

    // Kör om källans ingestor och skriver över redan sparade händelser (matchar ExternalId)
    // med nyss hämtad data — för att se ingestor-ändringar (t.ex. formatfixar) slå igenom
    // på data som redan ligger i databasen, utan att vänta på att nya händelser dyker upp.
    [HttpPost("/api/admin/sources/{id}/resync")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResyncSource(int id)
    {
        var source = await _db.Sources.FindAsync(id);
        if (source == null) return NotFound();

        var ingestor = _dedicatedIngestors.FirstOrDefault(i => i.Source.Id == id);
        if (ingestor == null)
        {
            if (source.Type != SourceType.RSS || string.IsNullOrWhiteSpace(source.Url))
                return BadRequest(new { error = "Källan har ingen dedikerad ingestor och stöds inte av generisk RSS-resync" });

            ingestor = new GenericRssIngestor(_httpClientFactory.CreateClient(), source);
        }

        try
        {
            var (inserted, updated) = await EventSync.SyncAsync(_db, ingestor, overwriteExisting: true);
            source.LastFetchedAt  = DateTime.UtcNow;
            source.LastFetchError = null;
            await _db.SaveChangesAsync();
            return Ok(new { inserted, updated });
        }
        catch (Exception ex)
        {
            source.LastFetchError = ex.Message.Length > 500 ? ex.Message[..500] : ex.Message;
            await _db.SaveChangesAsync();
            return BadRequest(new { error = ex.Message });
        }
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
    bool? IsActive,
    bool? IsPublished
);
