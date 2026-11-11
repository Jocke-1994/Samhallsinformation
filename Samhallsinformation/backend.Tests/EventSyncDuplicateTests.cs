namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

/// <summary>
/// V3-1 (E3#1): EventSync ska tåla dubbletter. Före fixen kastade ToDictionaryAsync
/// ArgumentException så fort databasen hade två rader med samma (SourceId, ExternalId),
/// och en hämtning med samma ExternalId två gånger skapade två rader. Kör mot SQLite
/// (TestDb) eftersom unika index inte finns än (V3-2) och vi vill bevisa riktig databas.
/// </summary>
public class EventSyncDuplicateTests
{
    private sealed class FakeIngestor : IIngestor
    {
        public Source Source { get; }
        public List<CanonicalEvent> Events { get; set; } = new();
        public FakeIngestor(Source source) { Source = source; }
        public Task<List<CanonicalEvent>> FetchEventsAsync() => Task.FromResult(Events.ToList());
    }

    private sealed class ListLogger : ILogger
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => Entries.Add((logLevel, formatter(state, exception)));
    }

    private static async Task<Source> SeedSourceAsync(AppDbContext db, string name = "Testkälla")
    {
        var source = new Source
        {
            Name = name,
            ShortName = name,
            BaseUrl = "https://example.test",
            Type = SourceType.WebAPI,
            IsActive = true,
            IsPublished = false,
        };
        db.Sources.Add(source);
        await db.SaveChangesAsync();
        return source;
    }

    private static CanonicalEvent Ev(int sourceId, string? externalId, string title = "Titel") => new()
    {
        SourceId = sourceId,
        ExternalId = externalId!,
        Title = title,
        PublishedAt = DateTime.UtcNow,
    };

    private static async Task<(int Inserted, int Updated)> RunAsync(
        AppDbContext db, FakeIngestor ingestor, bool overwrite = false, ILogger? logger = null)
    {
        var (inserted, updated, _) = await EventSync.SyncAsync(db, ingestor, overwrite, CancellationToken.None, logger);
        await db.SaveChangesAsync();
        return (inserted, updated);
    }

    [Fact]
    public async Task SyncAsync_TwoDbRowsWithSameExternalId_DoesNotThrow_AndProcessesRestOfBatch()
    {
        using var db = TestDb.Create();
        TestDb.DropEventsUniqueIndex(db); // databasformen före V3-2 (produktionen innan indexet skapas)
        var source = await SeedSourceAsync(db);
        db.Events.Add(Ev(source.Id, "dup", "Rad 1"));
        db.Events.Add(Ev(source.Id, "dup", "Rad 2"));
        await db.SaveChangesAsync();
        var ingestor = new FakeIngestor(source)
        {
            Events = { Ev(source.Id, "dup"), Ev(source.Id, "ny-1"), Ev(source.Id, "ny-2") },
        };

        var (inserted, updated) = await RunAsync(db, ingestor);

        Assert.Equal(2, inserted);
        // V4-1b (E3#10): den överlevande dubblettraden ("Rad 1"/"Rad 2", vilken det nu
        // är beror på dedupen ovan) får ett annat innehåll än den inkommande posten
        // (default-titeln "Titel") och uppdateras därför — samma "uppdatera vid ändrat
        // innehåll"-logik som gäller normala, icke-dubblerade rader.
        Assert.Equal(1, updated);
        Assert.Equal(4, await db.Events.CountAsync());
        Assert.Equal(2, await db.Events.CountAsync(e => e.ExternalId == "dup"));
    }

    [Fact]
    public async Task SyncAsync_TwoDbRowsWithSameExternalId_RepeatedCycles_NeverThrow()
    {
        using var db = TestDb.Create();
        TestDb.DropEventsUniqueIndex(db);
        var source = await SeedSourceAsync(db);
        db.Events.Add(Ev(source.Id, "dup"));
        db.Events.Add(Ev(source.Id, "dup"));
        await db.SaveChangesAsync();
        var ingestor = new FakeIngestor(source) { Events = { Ev(source.Id, "dup") } };

        for (var i = 0; i < 3; i++)
        {
            var (inserted, _) = await RunAsync(db, ingestor);
            Assert.Equal(0, inserted);
        }
        Assert.Equal(2, await db.Events.CountAsync());
    }

    [Fact]
    public async Task SyncAsync_TwoDbRowsWithSameExternalId_LogsOneWarningWithSourceAndCount()
    {
        using var db = TestDb.Create();
        TestDb.DropEventsUniqueIndex(db);
        var source = await SeedSourceAsync(db, "Dubblettkällan");
        db.Events.Add(Ev(source.Id, "dup"));
        db.Events.Add(Ev(source.Id, "dup"));
        db.Events.Add(Ev(source.Id, "dup"));
        await db.SaveChangesAsync();
        var ingestor = new FakeIngestor(source) { Events = { Ev(source.Id, "dup") } };
        var logger = new ListLogger();

        await RunAsync(db, ingestor, logger: logger);

        var warning = Assert.Single(logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains("Dubblettkällan", warning.Message);
        Assert.Contains("2", warning.Message); // 3 rader, 1 nyckel => 2 överskott
    }

    [Fact]
    public async Task SyncAsync_Overwrite_WithDbDuplicates_UpdatesOldestRowOnly_Deterministically()
    {
        using var db = TestDb.Create();
        TestDb.DropEventsUniqueIndex(db);
        var source = await SeedSourceAsync(db);
        var oldest = Ev(source.Id, "dup", "Äldst");
        oldest.IngestedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var newer = Ev(source.Id, "dup", "Nyare");
        newer.IngestedAt = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        db.Events.AddRange(newer, oldest);
        await db.SaveChangesAsync();
        var ingestor = new FakeIngestor(source) { Events = { Ev(source.Id, "dup", "Uppdaterad") } };

        var (inserted, updated) = await RunAsync(db, ingestor, overwrite: true);

        Assert.Equal(0, inserted);
        Assert.Equal(1, updated);
        using var check = TestDb.CreateSecondContext(db);
        Assert.Equal("Uppdaterad", (await check.Events.SingleAsync(e => e.Id == oldest.Id)).Title);
        Assert.Equal("Nyare", (await check.Events.SingleAsync(e => e.Id == newer.Id)).Title);
    }

    [Fact]
    public async Task SyncAsync_SameExternalIdTwiceInBatch_CreatesOneRow_LastWins()
    {
        using var db = TestDb.Create();
        var source = await SeedSourceAsync(db);
        var ingestor = new FakeIngestor(source)
        {
            Events = { Ev(source.Id, "x", "Första"), Ev(source.Id, "y", "Annan"), Ev(source.Id, "x", "Sista") },
        };

        var (inserted, _, insertedEvents) = await EventSync.SyncAsync(db, ingestor, false);
        await db.SaveChangesAsync();

        Assert.Equal(2, inserted);
        Assert.Equal(2, insertedEvents.Count);
        Assert.Equal(2, await db.Events.CountAsync());
        Assert.Equal("Sista", (await db.Events.SingleAsync(e => e.ExternalId == "x")).Title);
    }

    [Fact]
    public async Task SyncAsync_SameExternalIdTwiceInBatch_NextCycleDoesNotThrow()
    {
        // Före fixen: två rader skapades, nästa cykel kastade ArgumentException för alltid.
        using var db = TestDb.Create();
        var source = await SeedSourceAsync(db);
        var ingestor = new FakeIngestor(source)
        {
            Events = { Ev(source.Id, "x"), Ev(source.Id, "x") },
        };

        await RunAsync(db, ingestor);
        var (inserted, _) = await RunAsync(db, ingestor);

        Assert.Equal(0, inserted);
        Assert.Equal(1, await db.Events.CountAsync());
    }

    [Fact]
    public async Task SyncAsync_BatchDuplicate_LogsWarning()
    {
        using var db = TestDb.Create();
        var source = await SeedSourceAsync(db, "Batchkällan");
        var ingestor = new FakeIngestor(source) { Events = { Ev(source.Id, "x"), Ev(source.Id, "x") } };
        var logger = new ListLogger();

        await RunAsync(db, ingestor, logger: logger);

        var warning = Assert.Single(logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains("Batchkällan", warning.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task SyncAsync_BlankExternalId_IsSkipped_AndDoesNotCreateRowEveryCycle(string? blank)
    {
        using var db = TestDb.Create();
        var source = await SeedSourceAsync(db);
        var ingestor = new FakeIngestor(source)
        {
            Events = { Ev(source.Id, blank, "Utan nyckel"), Ev(source.Id, "ok-1", "Med nyckel") },
        };

        var first = await RunAsync(db, ingestor);
        var second = await RunAsync(db, ingestor);

        Assert.Equal(1, first.Inserted);
        Assert.Equal(0, second.Inserted);
        Assert.Equal(1, await db.Events.CountAsync());
        Assert.Equal("ok-1", (await db.Events.SingleAsync()).ExternalId);
    }

    [Fact]
    public async Task SyncAsync_BlankExternalId_LogsWarningWithSource_AndOverwriteModeAlsoSkips()
    {
        using var db = TestDb.Create();
        var source = await SeedSourceAsync(db, "Nyckellösa");
        var ingestor = new FakeIngestor(source) { Events = { Ev(source.Id, ""), Ev(source.Id, null) } };
        var logger = new ListLogger();

        var (inserted, updated) = await RunAsync(db, ingestor, overwrite: true, logger: logger);

        Assert.Equal(0, inserted);
        Assert.Equal(0, updated);
        Assert.Empty(db.Events);
        var warning = Assert.Single(logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains("Nyckellösa", warning.Message);
        Assert.Contains("2", warning.Message);
    }

    [Fact]
    public async Task SyncAsync_Normal_NewEventsCreated_UnchangedExistingRowUntouched()
    {
        // V4-1b (E3#10): identiskt innehåll (samma Title/Content/övriga fält) ska inte
        // röra raden alls — varken UpdatedAt eller Updated-räknaren.
        using var db = TestDb.Create();
        var source = await SeedSourceAsync(db);
        var existing = Ev(source.Id, "finns", "Samma titel");
        db.Events.Add(existing);
        await db.SaveChangesAsync();
        var ingestor = new FakeIngestor(source)
        {
            Events = { Ev(source.Id, "finns", "Samma titel"), Ev(source.Id, "ny", "Helt ny") },
        };
        var logger = new ListLogger();

        var (inserted, updated) = await RunAsync(db, ingestor, logger: logger);

        Assert.Equal(1, inserted);
        Assert.Equal(0, updated);
        var rad = await db.Events.SingleAsync(e => e.ExternalId == "finns");
        Assert.Equal("Samma titel", rad.Title);
        Assert.Null(rad.UpdatedAt);
        Assert.Equal(2, await db.Events.CountAsync());
        Assert.DoesNotContain(logger.Entries, e => e.Level == LogLevel.Warning);
    }

    [Fact]
    public async Task SyncAsync_Normal_ChangedExistingRow_IsUpdated_PublishedAtUntouched_UpdatedAtSet()
    {
        // V4-1b (E3#10): Trafikverket/SMHI kan skicka en ändrad version av en redan sparad
        // post (samma ExternalId, ny text/allvarlighetsgrad). Normal bakgrundskörning
        // (overwrite=false) ska nu uppdatera raden istället för att hoppa över den —
        // men PublishedAt (den ursprungliga publiceringstiden) rörs aldrig.
        using var db = TestDb.Create();
        var source = await SeedSourceAsync(db);
        var originalPublishedAt = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
        var existing = Ev(source.Id, "finns", "Gammal titel");
        existing.PublishedAt = originalPublishedAt;
        existing.Content = "Gammalt innehåll";
        existing.Severity = "Bra att veta";
        db.Events.Add(existing);
        await db.SaveChangesAsync();

        var incoming = Ev(source.Id, "finns", "Ny titel");
        incoming.Content = "Nytt innehåll";
        incoming.Severity = "Kritisk";
        incoming.PublishedAt = new DateTime(2026, 3, 3, 10, 0, 0, DateTimeKind.Utc); // ska ignoreras
        var ingestor = new FakeIngestor(source) { Events = { incoming } };

        var (inserted, updated) = await RunAsync(db, ingestor);

        Assert.Equal(0, inserted);
        Assert.Equal(1, updated);
        var rad = await db.Events.SingleAsync(e => e.ExternalId == "finns");
        Assert.Equal("Ny titel", rad.Title);
        Assert.Equal("Nytt innehåll", rad.Content);
        Assert.Equal("Kritisk", rad.Severity);
        Assert.Equal(originalPublishedAt, rad.PublishedAt);
        Assert.NotNull(rad.UpdatedAt);
    }

    [Fact]
    public async Task SyncAsync_Normal_ChangedExistingRow_DoesNotAffectDedupOrInsertCounters()
    {
        // Ändrad-post-uppdateringen (E3#10) får inte krocka med dubblett-tåligheten (V3-1):
        // en batch med både en ändrad känd post och en helt ny post ska ge exakt en insert
        // och en update, ingen krasch.
        using var db = TestDb.Create();
        var source = await SeedSourceAsync(db);
        db.Events.Add(Ev(source.Id, "finns", "Gammal"));
        await db.SaveChangesAsync();
        var ingestor = new FakeIngestor(source)
        {
            Events = { Ev(source.Id, "finns", "Ändrad"), Ev(source.Id, "helt-ny", "Ny post") },
        };

        var (inserted, updated) = await RunAsync(db, ingestor);

        Assert.Equal(1, inserted);
        Assert.Equal(1, updated);
        Assert.Equal(2, await db.Events.CountAsync());
    }

    [Fact]
    public async Task SyncAsync_Normal_OverwriteUpdatesExistingRow()
    {
        using var db = TestDb.Create();
        var source = await SeedSourceAsync(db);
        db.Events.Add(Ev(source.Id, "finns", "Gammal titel"));
        await db.SaveChangesAsync();
        var ingestor = new FakeIngestor(source) { Events = { Ev(source.Id, "finns", "Ny titel") } };

        var (inserted, updated) = await RunAsync(db, ingestor, overwrite: true);

        Assert.Equal(0, inserted);
        Assert.Equal(1, updated);
        Assert.Equal("Ny titel", (await db.Events.SingleAsync()).Title);
    }

    [Fact]
    public async Task SyncAsync_SameExternalIdInOtherSource_IsNotTreatedAsExisting()
    {
        using var db = TestDb.Create();
        var a = await SeedSourceAsync(db, "A");
        var b = await SeedSourceAsync(db, "B");
        db.Events.Add(Ev(a.Id, "delat"));
        await db.SaveChangesAsync();
        var ingestor = new FakeIngestor(b) { Events = { Ev(b.Id, "delat") } };

        var (inserted, _) = await RunAsync(db, ingestor);

        Assert.Equal(1, inserted);
        Assert.Equal(2, await db.Events.CountAsync());
    }
}
