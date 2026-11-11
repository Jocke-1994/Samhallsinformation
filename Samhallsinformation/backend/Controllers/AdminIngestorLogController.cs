namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

// Riktig ingestor-körningshistorik — ersätter mockdatan i Rapporters
// "Fel senaste 7 dagarna"/"Fel i datainsamling" och Aktivitetsloggens
// Ingestor/Fel-rader. Bygger på IngestorRunLog, en rad per käll-försök i
// varje ingestor-cykel (se IngestorBackgroundService).
[ApiController]
[Route("api/admin/ingestor-log")]
[Authorize(Roles = "Admin")]
public class AdminIngestorLogController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminIngestorLogController(AppDbContext db) => _db = db;

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int days = 7)
    {
        if (days > 30) days = 30;
        // -(days - 1) så fönstret inkluderar idag — annars blir "senaste 7
        // dagarna" av misstag 7 dagar som slutar igår.
        var sedan = DateTime.UtcNow.AddDays(-(days - 1)).Date;

        var rader = await _db.IngestorRunLogs.Where(l => l.RunAt >= sedan).ToListAsync();

        var perDag = Enumerable.Range(0, days)
            .Select(i => sedan.AddDays(i))
            .Select(d => new
            {
                Date = d.ToString("yyyy-MM-dd"),
                Count = rader.Count(r => !r.Success && r.RunAt.Date == d),
            })
            .ToList();

        // "Kritiska" = källor med fel i fönstret som fortfarande inte har
        // återhämtat sig (Source.LastFetchError fortfarande satt) — skiljer
        // ett fel som självläkte vid nästa körning från ett som kvarstår.
        var felKällor = rader.Where(r => !r.Success).Select(r => r.SourceId).Distinct().ToList();
        var kritiska = await _db.Sources.CountAsync(s => felKällor.Contains(s.Id) && s.LastFetchError != null);

        return Ok(new
        {
            TotaltFel = rader.Count(r => !r.Success),
            Kritiska = kritiska,
            PerDag = perDag,
        });
    }

    [HttpGet("recent")]
    public async Task<IActionResult> GetRecent([FromQuery] int limit = 50, [FromQuery] bool onlyErrors = false)
    {
        if (limit > 200) limit = 200;

        var query = _db.IngestorRunLogs.AsQueryable();
        if (onlyErrors) query = query.Where(l => !l.Success);

        var rader = await query
            .OrderByDescending(l => l.RunAt)
            .Take(limit)
            .ToListAsync();

        var sourceNames = await _db.Sources.ToDictionaryAsync(s => s.Id, s => s.ShortName);
        var aktuellaFel = await _db.Sources.Where(s => s.LastFetchError != null).Select(s => s.Id).ToListAsync();

        var result = rader.Select(r => new
        {
            r.Id,
            r.RunAt,
            r.Success,
            r.EventsInserted,
            r.ErrorMessage,
            SourceName = sourceNames.GetValueOrDefault(r.SourceId, "Okänd källa"),
            ÅterförsökLyckades = !r.Success ? !aktuellaFel.Contains(r.SourceId) : (bool?)null,
        });

        return Ok(result);
    }
}
