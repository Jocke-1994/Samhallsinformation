namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Samhallsinformation.Application.Sources;
using Samhallsinformation.Models;
using Xunit;

/// <summary>
/// V4-1a (E2#5): ID-kollision mellan hårdkodade ingestor-ID:n och admin-skapade källor. Kollisionsvakten i
/// <see cref="IngestorSourceSeeder"/> (riktig SQLite) och sekvens-steget <see cref="SourceIdSequence"/>
/// (SQL-byggare som ren strängtest; leverantörsvalet via fejkad executor eftersom PostgreSQL inte finns här).
/// </summary>
public class SourceIdCollisionTests
{
    private static Source Ingestor(int id, string name = "Polisen", string shortName = "Polisen",
        string baseUrl = "https://polisen.se", string url = "https://polisen.se/rss", SourceType type = SourceType.RSS,
        string? category = "Nationell", bool published = true) =>
        new() { Id = id, Name = name, ShortName = shortName, BaseUrl = baseUrl, Url = url, Type = type,
                Category = category, IsActive = true, IsPublished = published };

    // ---- kollisionsvakten -----------------------------------------------------------------------------------

    [Fact]
    public async Task Seed_AdminKällaMedIngestorsId_SkrivsInteÖver_WarningLoggas()
    {
        using var db = TestDb.Create();
        db.Sources.Add(new Source
        {
            Id = 7, Name = "Adminens Blogg", ShortName = "Blogg", BaseUrl = "https://blogg.example.se",
            Url = "https://blogg.example.se/feed", Type = SourceType.RSS, IsActive = true, IsPublished = true,
        });
        await db.SaveChangesAsync();
        var logger = new CapturingLogger();

        var skipped = await IngestorSourceSeeder.SeedAsync(db,
            new[] { Ingestor(7, name: "Ny ingestor", shortName: "NyIngestor", baseUrl: "https://ny.example.se",
                             url: "https://ny.example.se/api", type: SourceType.WebAPI) }, logger);

        Assert.Equal(1, skipped);
        using var fresh = TestDb.CreateSecondContext(db);
        var row = await fresh.Sources.SingleAsync(s => s.Id == 7);
        Assert.Equal("Adminens Blogg", row.Name);
        Assert.Equal("Blogg", row.ShortName);
        Assert.Equal("https://blogg.example.se/feed", row.Url);
        Assert.Equal(SourceType.RSS, row.Type);

        var warning = Assert.Single(logger.Messages(LogLevel.Warning));
        Assert.Contains("7", warning);
        Assert.Contains("Adminens Blogg", warning);
        Assert.Contains("Ny ingestor", warning);
    }

    [Fact]
    public async Task Seed_SammaIdentitet_UppdaterasSomFörut_OchIsPublishedBevaras()
    {
        using var db = TestDb.Create();
        db.Sources.Add(Ingestor(1, name: "Gammalt namn", url: "https://polisen.se/gammal-rss", published: false, category: null));
        await db.SaveChangesAsync();
        var logger = new CapturingLogger();

        // Samma ShortName/Type/BaseUrl, ny Url och nytt namn i koden = legitim uppdatering.
        var skipped = await IngestorSourceSeeder.SeedAsync(db,
            new[] { Ingestor(1, name: "Polisen", url: "https://polisen.se/nytt-flode", published: true) }, logger);

        Assert.Equal(0, skipped);
        Assert.Empty(logger.Messages(LogLevel.Warning));
        using var fresh = TestDb.CreateSecondContext(db);
        var row = await fresh.Sources.SingleAsync(s => s.Id == 1);
        Assert.Equal("Polisen", row.Name);
        Assert.Equal("https://polisen.se/nytt-flode", row.Url);
        Assert.Equal("Nationell", row.Category);
        Assert.False(row.IsPublished); // admin-ändring (avpublicerad) överlever omstart
    }

    [Fact]
    public async Task Seed_SammaIdentitet_MedAnnanBaseUrlMenSammaUrl_ÄrFortfarandeSammaKälla()
    {
        using var db = TestDb.Create();
        db.Sources.Add(Ingestor(4, name: "Trafikverket", shortName: "Trafikverket",
            baseUrl: "https://trafikverket.se", url: "https://api.example.se/v1/", type: SourceType.WebAPI));
        await db.SaveChangesAsync();

        var skipped = await IngestorSourceSeeder.SeedAsync(db,
            new[] { Ingestor(4, name: "Trafikverket", shortName: "trafikverket",
                baseUrl: "https://www.trafikverket.se", url: "https://api.example.se/v1", type: SourceType.WebAPI) },
            new CapturingLogger());

        Assert.Equal(0, skipped);
        using var fresh = TestDb.CreateSecondContext(db);
        Assert.Equal("https://www.trafikverket.se", (await fresh.Sources.SingleAsync(s => s.Id == 4)).BaseUrl);
    }

    [Fact]
    public async Task Seed_SammaShortNameMenAnnanTyp_ÄrKollision()
    {
        using var db = TestDb.Create();
        db.Sources.Add(Ingestor(5, name: "Adminens Polisenflöde", type: SourceType.RSS));
        await db.SaveChangesAsync();

        var skipped = await IngestorSourceSeeder.SeedAsync(db,
            new[] { Ingestor(5, name: "Ingestor", type: SourceType.WebAPI) }, new CapturingLogger());

        Assert.Equal(1, skipped);
        using var fresh = TestDb.CreateSecondContext(db);
        Assert.Equal("Adminens Polisenflöde", (await fresh.Sources.SingleAsync(s => s.Id == 5)).Name);
    }

    [Fact]
    public async Task Seed_SaknasId_InfogasOchKollisionHoppasÖverUtanAttStoppaDeÖvriga()
    {
        using var db = TestDb.Create();
        db.Sources.Add(new Source { Id = 7, Name = "Admin", ShortName = "Admin", BaseUrl = "https://a.se",
                                    Url = "https://a.se/f", Type = SourceType.RSS, IsActive = true });
        await db.SaveChangesAsync();

        var skipped = await IngestorSourceSeeder.SeedAsync(db, new[]
        {
            Ingestor(7, name: "Kolliderar", shortName: "Annan", baseUrl: "https://x.se", url: "https://x.se/f",
                     type: SourceType.WebAPI),
            Ingestor(10, name: "SMHI", shortName: "SMHI", baseUrl: "https://www.smhi.se", url: "https://smhi.se/api",
                     type: SourceType.WebAPI, published: false),
        }, new CapturingLogger());

        Assert.Equal(1, skipped);
        using var fresh = TestDb.CreateSecondContext(db);
        Assert.Equal("Admin", (await fresh.Sources.SingleAsync(s => s.Id == 7)).Name);
        var ny = await fresh.Sources.SingleAsync(s => s.Id == 10);
        Assert.Equal("SMHI", ny.Name);
        Assert.False(ny.IsPublished);
    }

    // ---- sekvens-steget ---------------------------------------------------------------------------------------

    [Fact]
    public void BuildSetvalSql_ÄrRättFormad()
    {
        var sql = SourceIdSequence.BuildSetvalSql();

        Assert.Equal(
            @"SELECT setval(COALESCE(pg_get_serial_sequence('""Sources""', 'Id'), '""Sources_Id_seq""'), " +
            @"COALESCE((SELECT MAX(""Id"") FROM ""Sources""), 1))",
            sql);
    }

    [Fact]
    public async Task Sequence_Npgsql_KörSqlEnGång()
    {
        var kört = new List<string>();

        var ok = await SourceIdSequence.EnsureAsync(true,
            (sql, _) => { kört.Add(sql); return Task.CompletedTask; }, new CapturingLogger());

        Assert.True(ok);
        Assert.Equal(new[] { SourceIdSequence.BuildSetvalSql() }, kört);
    }

    [Fact]
    public async Task Sequence_IckeNpgsql_KörInget()
    {
        var kört = new List<string>();

        var ok = await SourceIdSequence.EnsureAsync(false,
            (sql, _) => { kört.Add(sql); return Task.CompletedTask; }, new CapturingLogger());

        Assert.False(ok);
        Assert.Empty(kört);
    }

    [Fact]
    public async Task Sequence_SqlFelKastarAldrig_LoggarError()
    {
        var logger = new CapturingLogger();

        var ok = await SourceIdSequence.EnsureAsync(true,
            (_, _) => throw new InvalidOperationException("relation saknas"), logger);

        Assert.False(ok);
        var entry = Assert.Single(logger.Entries, e => e.Level == LogLevel.Error);
        Assert.IsType<InvalidOperationException>(entry.Exception);
    }

    [Fact]
    public async Task Sequence_MotSqliteKontext_HoppasÖver_UtanFelEllerLogg()
    {
        using var db = TestDb.Create();
        var logger = new CapturingLogger();

        var ok = await SourceIdSequence.EnsureAsync(db, logger);

        Assert.False(ok);
        Assert.Empty(logger.Entries); // körde SQL:en hade SQLite kastat och en Error hade loggats
    }
}
