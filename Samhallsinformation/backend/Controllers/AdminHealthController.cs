namespace Samhallsinformation.Controllers;

using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

// Riktiga hälsokontroller för Felsökningssidans "Systemhälsa"-kort — ersätter
// den tidigare mockade "pinga och slumpa fram OK"-simuleringen. Ingen egen
// ingestor-körningslogg finns ännu (separat mock-kategori, inte löst här),
// så Ingestor-hälsan härleds ur Source.LastFetchedAt/LastFetchError — samma
// fält Källhantering redan visar per källa, bara aggregerat här.
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminHealthController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminHealthController(AppDbContext db) => _db = db;

    // Ingestorn kör var 5:e minut (se schemaläggningen i Program.cs) —
    // 15 minuter ger generös marginal innan vi flaggar den som helt tyst.
    private static readonly TimeSpan IngestorStaleThreshold = TimeSpan.FromMinutes(15);

    [HttpGet("health")]
    public async Task<IActionResult> GetHealth()
    {
        var sw = Stopwatch.StartNew();
        var dbOk = await _db.Database.CanConnectAsync();
        sw.Stop();

        var aktivaKällor = await _db.Sources.Where(s => s.IsActive).ToListAsync();
        var senasteLyckade = aktivaKällor
            .Where(s => s.LastFetchedAt != null)
            .Select(s => s.LastFetchedAt!.Value)
            .DefaultIfEmpty()
            .Max();
        var källorMedFel  = aktivaKällor.Count(s => s.LastFetchError != null);
        var ingestorTyst  = senasteLyckade == default || DateTime.UtcNow - senasteLyckade > IngestorStaleThreshold;
        var ingestorStatus =
            ingestorTyst      ? "Nere" :
            källorMedFel > 0  ? "Varning" :
                                 "OK";

        var sedan24h = DateTime.UtcNow.AddHours(-24);
        var notisLogg  = await _db.NotificationDeliveryLogs.Where(l => l.SentAt >= sedan24h).ToListAsync();
        var notisFel   = notisLogg.Count(l => l.Status != "sent");
        var notisStatus =
            notisLogg.Count == 0        ? "OK" :
            notisFel == 0                ? "OK" :
            notisFel == notisLogg.Count  ? "Nere" :
                                            "Varning";

        return Ok(new
        {
            Api = new { Status = "OK", LatencyMs = 0 },
            Db  = new { Status = dbOk ? "OK" : "Nere", LatencyMs = sw.ElapsedMilliseconds },
            Ingestor = new
            {
                Status        = ingestorStatus,
                LastFetchedAt = senasteLyckade == default ? (DateTime?)null : senasteLyckade,
                AktivaKällor  = aktivaKällor.Count,
                KällorMedFel  = källorMedFel,
            },
            Notifieringar = new
            {
                Status           = notisStatus,
                FelSenaste24h    = notisFel,
                TotaltSenaste24h = notisLogg.Count,
            },
        });
    }
}
