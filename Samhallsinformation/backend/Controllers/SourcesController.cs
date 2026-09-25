namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
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
    private readonly IAktivitetsloggService _aktivitetslogg;

    public SourcesController(AppDbContext db, IEnumerable<IIngestor> dedicatedIngestors, IHttpClientFactory httpClientFactory, IAktivitetsloggService aktivitetslogg)
    {
        _db = db;
        _dedicatedIngestors = dedicatedIngestors;
        _httpClientFactory = httpClientFactory;
        _aktivitetslogg = aktivitetslogg;
    }

    [HttpGet]
    public async Task<IActionResult> GetSources()
    {
        // Publik DTO — bara det frontend läser (sidomeny, Mina källor, onboarding).
        // Aldrig LastFetchError/LastFetchedAt/Url/BaseUrl/Type/IsPublished utåt;
        // de finns kvar i /api/admin/sources.
        var sources = await _db.Sources
            .Where(s => s.IsPublished)
            .Select(s => new PublicSourceDto(s.Id, s.Name, s.ShortName, s.IsActive))
            .ToListAsync();
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
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"Källa skapad — {source.Name}", $"{source.ShortName}, typ {source.Type}");
        return Ok(source);
    }

    [HttpPatch("/api/admin/sources/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateSource(int id, [FromBody] UpdateSourceRequest req)
    {
        var source = await _db.Sources.FindAsync(id);
        if (source == null) return NotFound();

        var ändringar = new List<string>();
        if (req.Name      != null && req.Name      != source.Name)      { ändringar.Add($"Namn: {source.Name} → {req.Name}"); source.Name = req.Name; }
        if (req.ShortName != null && req.ShortName != source.ShortName) { ändringar.Add($"Kortnamn: {source.ShortName} → {req.ShortName}"); source.ShortName = req.ShortName; }
        if (req.Url       != null && req.Url       != source.Url)       { ändringar.Add($"URL: {source.Url} → {req.Url}"); source.Url = req.Url; }
        if (req.Category  != null && req.Category  != source.Category) { ändringar.Add($"Kategori: {source.Category} → {req.Category}"); source.Category = req.Category; }
        if (req.IsActive.HasValue    && req.IsActive.Value    != source.IsActive)    { ändringar.Add($"Aktiv: {source.IsActive} → {req.IsActive.Value}"); source.IsActive = req.IsActive.Value; }
        if (req.IsPublished.HasValue && req.IsPublished.Value != source.IsPublished) { ändringar.Add($"Publicerad: {source.IsPublished} → {req.IsPublished.Value}"); source.IsPublished = req.IsPublished.Value; }

        await _db.SaveChangesAsync();
        if (ändringar.Count > 0)
            await _aktivitetslogg.LogAsync(
                AktörTyper.Admin, LoggTyper.Konfiguration,
                $"Källa redigerad — {source.Name}", string.Join(", ", ändringar));
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
            var (inserted, updated, _) = await EventSync.SyncAsync(_db, ingestor, overwriteExisting: true);
            source.LastFetchedAt  = DateTime.UtcNow;
            source.LastFetchError = null;
            await _db.SaveChangesAsync();
            await _aktivitetslogg.LogAsync(
                AktörTyper.Admin, LoggTyper.Konfiguration,
                $"Källa omsynkad — {source.Name}", $"{inserted} nya, {updated} uppdaterade");
            return Ok(new { inserted, updated });
        }
        catch (Exception ex)
        {
            source.LastFetchError = ex.Message.Length > 500 ? ex.Message[..500] : ex.Message;
            await _db.SaveChangesAsync();
            await _aktivitetslogg.LogAsync(
                AktörTyper.Admin, LoggTyper.Konfiguration,
                $"Källa omsynk misslyckades — {source.Name}", ex.Message);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("/api/admin/sources/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSource(int id)
    {
        var source = await _db.Sources.FindAsync(id);
        if (source == null) return NotFound();

        var namn = source.Name;
        _db.Sources.Remove(source);
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"Källa borttagen — {namn}", $"Id {id}");
        return NoContent();
    }
}

// IsActive behålls: Sidebar och useUnreadSourceIds filtrerar på s.isActive.
public record PublicSourceDto(int Id, string Name, string ShortName, bool IsActive);

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
