namespace Samhallsinformation.Controllers;

using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

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
        {
            var fromUtc = UtcDateTime.Ensure(from.Value);
            query = query.Where(e => e.PublishedAt >= fromUtc);
        }

        if (to.HasValue)
        {
            var toUtc = UtcDateTime.Ensure(to.Value);
            query = query.Where(e => e.PublishedAt <= toUtc);
        }

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

    // Publik sök-endpoint byggd för kundtjänstbotens "fråga om skarpa
    // händelser"-funktion (deras issue #237, full spec i
    // docs/vault/Ideer/Kundtjanstbot-handelse-sok-api.md). Samma fuzzy
    // geography/fritext-mönster som AdminEventSearchController, men
    // skopad till bara publicerade källor och utan admin-auth — därför
    // en egen, snävare rate-limit-policy istället för adminens
    // rollskydd (anropas per chattmeddelande, inte per sidladdning).
    //
    // sourcesSearched svarar ärligt på "vilka källor kollades faktiskt"
    // — API:et kan aldrig lova "bekräftat inget hänt", bara "inga
    // träffar bland dessa källor" (samma källkravsprincip som resten
    // av produkten).
    [HttpGet("search-public")]
    [EnableRateLimiting("eventssearch")]
    public async Task<IActionResult> SearchPublic(
        [FromQuery] string? geography = null,
        [FromQuery] string? sokord = null,
        [FromQuery] string? eventType = null,
        [FromQuery] string? shortName = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        if (pageSize > 100) pageSize = 100;
        if (page < 1) page = 1;

        var publishedSources = await _db.Sources
            .Where(s => s.IsPublished)
            .Select(s => new { s.Id, s.ShortName })
            .ToListAsync();

        var candidateSources = publishedSources.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(shortName))
            candidateSources = candidateSources.Where(s => s.ShortName == shortName);

        var sourcesSearched = candidateSources.Select(s => s.ShortName).Distinct().OrderBy(n => n).ToList();
        var sourceIds       = candidateSources.Select(s => s.Id).ToList();
        var sourceNameById  = publishedSources.ToDictionary(s => s.Id, s => s.ShortName);

        var query = _db.Events.Where(e => sourceIds.Contains(e.SourceId)).AsQueryable();

        if (!string.IsNullOrWhiteSpace(geography))
            query = query.Where(e => e.Geography != null && EF.Functions.Like(e.Geography, $"%{geography}%"));

        if (!string.IsNullOrWhiteSpace(eventType))
            query = query.Where(e => e.EventType == eventType);

        if (!string.IsNullOrWhiteSpace(sokord))
            query = query.Where(e => EF.Functions.Like(e.Title, $"%{sokord}%") || EF.Functions.Like(e.Content, $"%{sokord}%"));

        if (from.HasValue)
        {
            var fromUtc = UtcDateTime.Ensure(from.Value);
            query = query.Where(e => e.PublishedAt >= fromUtc);
        }

        if (to.HasValue)
        {
            var toUtc = UtcDateTime.Ensure(to.Value);
            query = query.Where(e => e.PublishedAt <= toUtc);
        }

        var total = await query.CountAsync();
        var events = await query
            .OrderByDescending(e => e.PublishedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var result = events.Select(e => new
        {
            title      = e.Title,
            content    = e.Content,
            sourceName = sourceNameById.GetValueOrDefault(e.SourceId, "Okänd källa"),
            sourceUrl  = e.Url,
            location   = e.Geography,
            timestamp  = e.PublishedAt,
        });

        return Ok(new { total, page, pageSize, sourcesSearched, events = result });
    }

    // Kollar reaktivt om en händelses källänk fortfarande lever, t.ex. efter
    // "Läs mer"-klick på en händelse. Ingen schemalagd bakgrundskoll — bara
    // vid faktiskt klick, så trafiken mot källan hålls minimal.
    //
    // Tre lägen (status):
    //   "alive"   — källan svarade 2xx.
    //   "dead"    — källan svarade ENTYDIGT 404 eller 410 (sidan är borta).
    //   "unknown" — allt annat: timeout, nätverks-/TLS-fel, 403 (många
    //               myndighetssajter blockerar bottar), 429, 5xx, 3xx utan mål.
    //               Ett sådant svar säger ingenting om huruvida sidan finns, så
    //               klienten får aldrig tolka det som "borta".
    // "alive" (bool) behålls bara för äldre klienter (cachade PWA-versioner) som
    // läser det fältet: den är false ENDAST vid "dead", aldrig vid "unknown".
    [HttpGet("{id:guid}/link-status")]
    public async Task<IActionResult> GetLinkStatus(Guid id)
    {
        var evt = await _db.Events.FindAsync(id);
        if (evt is null) return NotFound();

        var client = _httpClientFactory.CreateClient("linkcheck");
        string status;
        try
        {
            using var request  = new HttpRequestMessage(HttpMethod.Get, evt.Url);
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            status = response.StatusCode switch
            {
                HttpStatusCode.NotFound or HttpStatusCode.Gone => "dead",
                _ when response.IsSuccessStatusCode            => "alive",
                _                                              => "unknown",
            };
        }
        catch
        {
            // Timeout (klientens korta timeout ger TaskCanceledException),
            // DNS-/TLS-/nätverksfel eller ogiltig URL — vet inte, alltså "unknown".
            status = "unknown";
        }

        return Ok(new { status, alive = status != "dead" });
    }

    // Ren analytics — loggas vid varje klick på "Dela" (NewsItem.tsx), oavsett
    // om delningen faktiskt fullföljs eller avbryts i webbläsarens/OS:ets egen
    // delningsmeny. Ingen [Authorize] (delning ska funka utloggad också), men
    // UseAuthentication populerar ändå User-claims om en inloggad användare
    // råkade skicka med sin token — då sparas UserId, annars null.
    [HttpPost("{id:guid}/share")]
    public async Task<IActionResult> LogShare(Guid id)
    {
        Guid? userId = null;
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claim != null && Guid.TryParse(claim, out var parsed)) userId = parsed;

        _db.EventShareLogs.Add(new EventShareLog { EventId = id, UserId = userId });
        await _db.SaveChangesAsync();
        return Ok();
    }
}
