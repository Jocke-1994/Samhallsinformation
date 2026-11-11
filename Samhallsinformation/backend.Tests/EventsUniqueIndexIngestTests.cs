namespace Samhallsinformation.Tests;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

/// <summary>
/// V3-2: när en samtidig körning hinner spara samma händelse mellan EventSyncs läsning och SaveChanges ger det unika
/// indexet ett DbUpdateException. Det är "redan sparad" — inget källfel, inget LastFetchError, ingen felrad i
/// körloggen, inget Error-larm. Racet simuleras genom att en annan kontext på samma databas sätter in den
/// krockande raden precis före SaveChanges.
/// </summary>
public class EventsUniqueIndexIngestTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly DbContextOptions<AppDbContext> _options;
    private Action? _raceBeforeSave;

    public EventsUniqueIndexIngestTests()
    {
        _conn = new SqliteConnection("Data Source=:memory:");
        _conn.Open();
        _options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options;
        using var db = new AppDbContext(_options);
        db.Database.EnsureCreated(); // modellen ger det unika indexet
    }

    public void Dispose() => _conn.Dispose();

    private sealed class RacyDb : AppDbContext
    {
        private readonly Func<Action?> _race;
        public RacyDb(DbContextOptions<AppDbContext> o, Func<Action?> race) : base(o) => _race = race;
        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken ct = default)
        {
            var race = _race();
            if (race != null && ChangeTracker.Entries<CanonicalEvent>().Any(e => e.State == EntityState.Added))
                race();
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, ct);
        }
    }

    private sealed class FakeIngestor : IIngestor
    {
        public Source Source { get; }
        public List<CanonicalEvent> Events { get; set; } = new();
        public FakeIngestor(Source source) { Source = source; }
        public Task<List<CanonicalEvent>> FetchEventsAsync() => Task.FromResult(Events.ToList());
    }

    private sealed class ListLogger<T> : ILogger<T>
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => Entries.Add((logLevel, formatter(state, exception)));
    }

    private async Task<FakeIngestor> SeedSourceAsync()
    {
        using var db = new AppDbContext(_options);
        var row = new Source
        {
            Name = "Källa",
            ShortName = "K",
            BaseUrl = "https://example.test",
            Type = SourceType.WebAPI,
            IsActive = true,
            IsPublished = false,
        };
        db.Sources.Add(row);
        await db.SaveChangesAsync();
        return new FakeIngestor(new Source
        {
            Id = row.Id,
            Name = row.Name,
            ShortName = row.ShortName,
            BaseUrl = row.BaseUrl,
            Type = SourceType.WebAPI,
            IsActive = true,
            IsPublished = false,
        });
    }

    // Sätter in den krockande raden EN gång, precis före första SaveChanges som innehåller nya händelser.
    private void ArmRace(int sourceId, string externalId)
    {
        var fired = false;
        _raceBeforeSave = () =>
        {
            if (fired) return;
            fired = true;
            using var other = new AppDbContext(_options);
            other.Events.Add(new CanonicalEvent
            {
                SourceId = sourceId,
                ExternalId = externalId,
                Title = "Från den andra körningen",
                PublishedAt = DateTime.UtcNow,
            });
            other.SaveChanges();
        };
    }

    private (IngestorBackgroundService Service, ListLogger<IngestorBackgroundService> Log) NewService(IIngestor ingestor)
    {
        var httpFactory = Substitute.For<IHttpClientFactory>();
        httpFactory.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient());
        var services = new ServiceCollection();
        services.AddScoped<AppDbContext>(_ => new RacyDb(_options, () => _raceBeforeSave));
        services.AddSingleton(Substitute.For<IPushNotificationService>());
        services.AddSingleton(ingestor);
        var provider = services.BuildServiceProvider();
        var log = new ListLogger<IngestorBackgroundService>();
        return (new IngestorBackgroundService(
            provider.GetRequiredService<IServiceScopeFactory>(), httpFactory, log, new ConfigurationBuilder().Build()), log);
    }

    [Fact]
    public async Task Ingest_UniqueViolationFromConcurrentRun_IsNotASourceError()
    {
        var ingestor = await SeedSourceAsync();
        ingestor.Events = [new CanonicalEvent { SourceId = ingestor.Source.Id, ExternalId = "race", Title = "Min", PublishedAt = DateTime.UtcNow }];
        ArmRace(ingestor.Source.Id, "race");
        var (service, log) = NewService(ingestor);

        await service.IngestAsync(CancellationToken.None);

        using var db = new AppDbContext(_options);
        var source = await db.Sources.SingleAsync();
        Assert.Null(source.LastFetchError);                                   // inget källfel
        Assert.Empty(db.IngestorRunLogs);                                     // ingen felrad (och ingen lyckad rad heller — synkas om)
        Assert.DoesNotContain(log.Entries, e => e.Level == LogLevel.Error);   // inget larm
        Assert.Contains(log.Entries, e => e.Level == LogLevel.Warning && e.Message.Contains("Samtidig körning"));
        var events = await db.Events.ToListAsync();
        Assert.Single(events);                                                // exakt en rad, den andra körningens
        Assert.Equal("Från den andra körningen", events[0].Title);
    }

    [Fact]
    public async Task Ingest_AfterConcurrentRace_NextCycleSyncsNormally()
    {
        var ingestor = await SeedSourceAsync();
        ingestor.Events =
        [
            new CanonicalEvent { SourceId = ingestor.Source.Id, ExternalId = "race", Title = "Min", PublishedAt = DateTime.UtcNow },
            new CanonicalEvent { SourceId = ingestor.Source.Id, ExternalId = "ny", Title = "Ny", PublishedAt = DateTime.UtcNow },
        ];
        ArmRace(ingestor.Source.Id, "race");
        var (service, _) = NewService(ingestor);

        await service.IngestAsync(CancellationToken.None); // krock: hela batchen rullas tillbaka
        await service.IngestAsync(CancellationToken.None); // nästa cykel: "race" känns igen, "ny" sparas

        using var db = new AppDbContext(_options);
        Assert.Equal(["ny", "race"], await db.Events.OrderBy(e => e.ExternalId).Select(e => e.ExternalId).ToListAsync());
        Assert.Null((await db.Sources.SingleAsync()).LastFetchError);
        Assert.Single(db.IngestorRunLogs, r => r.Success);
    }

    [Fact]
    public async Task Ingest_OtherDbUpdateException_IsStillASourceError()
    {
        var ingestor = await SeedSourceAsync();
        ingestor.Events = [new CanonicalEvent { SourceId = ingestor.Source.Id, ExternalId = "bad", Title = null!, PublishedAt = DateTime.UtcNow }];
        var (service, log) = NewService(ingestor);

        await service.IngestAsync(CancellationToken.None);

        using var db = new AppDbContext(_options);
        Assert.NotNull((await db.Sources.SingleAsync()).LastFetchError);
        Assert.Single(db.IngestorRunLogs, r => !r.Success);
        Assert.Contains(log.Entries, e => e.Level == LogLevel.Error);
    }

    [Fact]
    public async Task Resync_UniqueViolationFromConcurrentRun_Returns409_WithoutMarkingSourceAsFailed()
    {
        var ingestor = await SeedSourceAsync();
        ingestor.Events = [new CanonicalEvent { SourceId = ingestor.Source.Id, ExternalId = "race", Title = "Min", PublishedAt = DateTime.UtcNow }];
        ArmRace(ingestor.Source.Id, "race");
        using var db = new RacyDb(_options, () => _raceBeforeSave);
        var log = new AktivitetsloggService(db, Substitute.For<IHttpContextAccessor>());
        var controller = new SourcesController(db, [ingestor], Substitute.For<IHttpClientFactory>(), log);

        var result = await controller.ResyncSource(ingestor.Source.Id);

        Assert.IsType<ConflictObjectResult>(result);
        using var check = new AppDbContext(_options);
        Assert.Null((await check.Sources.SingleAsync()).LastFetchError);
        Assert.Single(await check.Events.ToListAsync());
    }
}
