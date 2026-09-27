namespace Samhallsinformation.Tests;

using Microsoft.AspNetCore.Mvc;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

/// <summary>
/// V4-1b (E4#11): ingestor-sammanfattningen ("Ingestor-körningar/Fel/Varningar" och
/// tidsfiltren i Aktivitetslogg) begränsades tidigare av <c>Take(1000)</c> — med ~10
/// källor per 5-minuterscykel motsvarar 1000 rader bara ~8 timmar, oavsett vilket
/// tidsfilter (från/till) som faktiskt valdes ("30 dagar" gav i praktiken samma ~8
/// timmar, tyst avkortat). Fönstret styrs nu av från/till, radtaket är bara ett
/// kraftigt höjt skyddsnät (10 000).
/// </summary>
public class AdminActivityLogIngestorWindowTests
{
    private static async Task<object> SammanfattningAsync(AppDbContext db, DateTime från, DateTime? till = null)
    {
        var controller = new AdminActivityLogController(db);
        var result = Assert.IsType<OkObjectResult>(
            await controller.GetLog(aktörTyp: null, typ: null, sök: null, från: från, till: till, gräns: 8));
        return result.Value!.GetType().GetProperty("Sammanfattning")!.GetValue(result.Value)!;
    }

    private static int IngestorAntal(object sammanfattning) =>
        (int)sammanfattning.GetType().GetProperty("Ingestor")!.GetValue(sammanfattning)!;

    [Fact]
    public async Task GetLog_FlerAn1000RaderInomFonstret_RaknarAllaIngenAvkortning()
    {
        // Regression för den gamla buggen: Take(1000) gjorde att "7 dagar"/"30 dagar"
        // i praktiken bara visade de senaste ~8 timmarna om fler än 1000 ingestor-rader
        // fanns inom fönstret. 1500 distinkta cykler, alla inom fönstret, ska alla räknas.
        using var db = TestDb.Create();
        var fönsterStart = DateTime.UtcNow.AddHours(-3);
        for (var i = 0; i < 1500; i++)
        {
            db.IngestorRunLogs.Add(new IngestorRunLog
            {
                SourceId = 1,
                RunAt = fönsterStart.AddSeconds(i),
                Success = true,
                EventsInserted = 0,
            });
        }
        await db.SaveChangesAsync();

        var sammanfattning = await SammanfattningAsync(db, från: fönsterStart.AddMinutes(-1));

        Assert.Equal(1500, IngestorAntal(sammanfattning));
    }

    [Fact]
    public async Task GetLog_RaderUtanforFonstret_ExkluderasFranSammanfattningen()
    {
        using var db = TestDb.Create();
        var nu = DateTime.UtcNow;
        var innanförStart = nu.AddHours(-1);
        for (var i = 0; i < 5; i++)
        {
            db.IngestorRunLogs.Add(new IngestorRunLog
            {
                SourceId = 1, RunAt = innanförStart.AddMinutes(i), Success = true, EventsInserted = 0,
            });
        }
        // Långt utanför det efterfrågade fönstret — ska INTE räknas med.
        for (var i = 0; i < 5; i++)
        {
            db.IngestorRunLogs.Add(new IngestorRunLog
            {
                SourceId = 1, RunAt = nu.AddDays(-10).AddMinutes(i), Success = true, EventsInserted = 0,
            });
        }
        await db.SaveChangesAsync();

        var sammanfattning = await SammanfattningAsync(db, från: nu.AddHours(-2));

        Assert.Equal(5, IngestorAntal(sammanfattning));
    }

    [Fact]
    public async Task GetLog_FelInomFonstret_RaknasAvenBortomGamlaRadtaket()
    {
        // Precis som "Ingestor"-räknaren fick "Fel" samma avkortningsbugg — bevisa att
        // felräkningen också ser bortom den gamla 1000-radsgränsen.
        using var db = TestDb.Create();
        // En Source med LastFetchError satt gör att den misslyckade cykeln räknas som
        // "Fel" (fortfarande trasig) istället för "Varning" (självläkt vid retry) —
        // se IngestorCykelTillDto.
        db.Sources.Add(new Source
        {
            Id = 1, Name = "Testkälla", ShortName = "T", BaseUrl = "https://example.test",
            Type = SourceType.WebAPI, IsActive = true, IsPublished = false, LastFetchError = "Trasig källa",
        });
        await db.SaveChangesAsync();
        var fönsterStart = DateTime.UtcNow.AddHours(-4);
        for (var i = 0; i < 1100; i++)
        {
            db.IngestorRunLogs.Add(new IngestorRunLog
            {
                SourceId = 1,
                RunAt = fönsterStart.AddSeconds(i),
                Success = i != 50, // exakt en misslyckad cykel, långt bak i fönstret
                EventsInserted = 0,
                ErrorMessage = i == 50 ? "Trasig källa" : null,
            });
        }
        await db.SaveChangesAsync();

        var sammanfattning = await SammanfattningAsync(db, från: fönsterStart.AddMinutes(-1));

        Assert.Equal(1100, IngestorAntal(sammanfattning));
        var felAntal = (int)sammanfattning.GetType().GetProperty("Fel")!.GetValue(sammanfattning)!;
        Assert.Equal(1, felAntal);
    }
}
