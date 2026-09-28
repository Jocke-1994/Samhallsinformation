namespace Samhallsinformation.Tests;

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

/// <summary>
/// V3-3 (E3#3): varje källa i en ingest-cykel körs i egen DI-scope/egen AppDbContext. Före
/// fixen delade alla källor EN kontext — ett misslyckat SaveChanges (här: NOT NULL-brott i
/// SQLite) lämnade den ogiltiga entiteten kvar i trackern, catch-blockets egen SaveChanges
/// sväljdes tyst och ALLA följande källor föll på samma sätt utan LastFetchError/IngestorRunLog.
/// Testerna kör mot en riktig SQLite-databas (en delad öppen anslutning, ny kontext per scope).
/// </summary>
public class IngestorIsolationTests : IDisposable
{
    private readonly SqliteConnection _conn;
    private readonly DbContextOptions<AppDbContext> _options;

    // Kan sättas per test för att få en kontext att kasta vid SaveChanges (simulerar ett fel
    // som databasen/tabellen ger för just den operationen).
    private Action<AppDbContext>? _beforeSave;

    public IngestorIsolationTests()
    {
        _conn = new SqliteConnection("Data Source=:memory:");
        _conn.Open();
        _options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options;
        using var db = new AppDbContext(_options);
        db.Database.EnsureCreated();
    }

    public void Dispose() => _conn.Dispose();

    private sealed class FlakyDb : AppDbContext
    {
        private readonly Action<AppDbContext>? _beforeSave;
        public FlakyDb(DbContextOptions<AppDbContext> options, Action<AppDbContext>? beforeSave) : base(options)
            => _beforeSave = beforeSave;

        public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken ct = default)
        {
            _beforeSave?.Invoke(this);
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, ct);
        }
    }

    private sealed class FakeIngestor : IIngestor
    {
        public Source Source { get; }
        public Func<List<CanonicalEvent>> Fetch { get; set; } = () => new();
        public int Calls { get; private set; }
        public FakeIngestor(Source source) { Source = source; }

        public Task<List<CanonicalEvent>> FetchEventsAsync()
        {
            Calls++;
            return Task.FromResult(Fetch());
        }
    }

    private AppDbContext NewDb() => new(_options);

    private async Task<FakeIngestor> SeedSourceAsync(string name, bool isPublished = false, string? lastFetchError = null)
    {
        using var db = NewDb();
        var row = new Source
        {
            Name = name, ShortName = name, BaseUrl = "https://example.test",
            Type = SourceType.WebAPI, IsActive = true, IsPublished = isPublished,
            LastFetchError = lastFetchError,
        };
        db.Sources.Add(row);
        await db.SaveChangesAsync();
        return new FakeIngestor(new Source
        {
            Id = row.Id, Name = row.Name, ShortName = row.ShortName, BaseUrl = row.BaseUrl,
            Type = SourceType.WebAPI, IsActive = true, IsPublished = isPublished,
        });
    }

    private static CanonicalEvent GoodEvent(int sourceId, string externalId) => new()
    {
        SourceId = sourceId, ExternalId = externalId, Title = "Titel", PublishedAt = DateTime.UtcNow,
    };

    // Bryter NOT NULL på Events.Title vid SaveChanges — en post som passerar EventSync (giltigt
    // ExternalId) men som databasen vägrar. Den ogiltiga entiteten blir kvar i trackern.
    private static CanonicalEvent ConstraintBreakingEvent(int sourceId, string externalId) => new()
    {
        SourceId = sourceId, ExternalId = externalId, Title = null!, PublishedAt = DateTime.UtcNow,
    };

    private static void MakeBroken(FakeIngestor ingestor) =>
        ingestor.Fetch = () => [GoodEvent(ingestor.Source.Id, "ok-1"), ConstraintBreakingEvent(ingestor.Source.Id, "bad-1")];

    private static void MakeHealthy(FakeIngestor ingestor) =>
        ingestor.Fetch = () => [GoodEvent(ingestor.Source.Id, "a-1"), GoodEvent(ingestor.Source.Id, "a-2")];

    private IngestorBackgroundService NewService(
        IEnumerable<IIngestor> ingestors, IPushNotificationService? push = null)
    {
        var httpFactory = Substitute.For<IHttpClientFactory>();
        httpFactory.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient());

        var services = new ServiceCollection();
        services.AddScoped<AppDbContext>(_ => new FlakyDb(_options, _beforeSave));
        services.AddSingleton(push ?? Substitute.For<IPushNotificationService>());
        foreach (var i in ingestors) services.AddSingleton<IIngestor>(i);
        var provider = services.BuildServiceProvider();

        return new IngestorBackgroundService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            httpFactory,
            NullLogger<IngestorBackgroundService>.Instance,
            new ConfigurationBuilder().Build());
    }

    [Fact]
    public async Task BrokenSource_DoesNotStopNextSourceFromBeingFetchedAndSaved()
    {
        var broken = await SeedSourceAsync("Trasig");
        var healthy = await SeedSourceAsync("Frisk");
        MakeBroken(broken);
        MakeHealthy(healthy);

        await NewService([broken, healthy]).IngestAsync(CancellationToken.None);

        using var db = NewDb();
        Assert.Equal(1, healthy.Calls);
        Assert.Equal(2, await db.Events.CountAsync(e => e.SourceId == healthy.Source.Id));
        // Den trasiga källans poster sparades inte (hela SaveChanges rullades tillbaka).
        Assert.Equal(0, await db.Events.CountAsync(e => e.SourceId == broken.Source.Id));
    }

    [Fact]
    public async Task BrokenSource_WritesLastFetchErrorAndFailedRunLog()
    {
        var broken = await SeedSourceAsync("Trasig");
        MakeBroken(broken);

        await NewService([broken]).IngestAsync(CancellationToken.None);

        using var db = NewDb();
        var row = await db.Sources.SingleAsync(s => s.Id == broken.Source.Id);
        Assert.False(string.IsNullOrWhiteSpace(row.LastFetchError));
        Assert.Null(row.LastFetchedAt);

        var log = await db.IngestorRunLogs.SingleAsync(l => l.SourceId == broken.Source.Id);
        Assert.False(log.Success);
        Assert.Equal(0, log.EventsInserted);
        Assert.Equal(row.LastFetchError, log.ErrorMessage);
    }

    [Fact]
    public async Task BrokenSourceFirst_DoesNotPoisonTrackerForTheNextSource_WhichGetsSuccessStatus()
    {
        // Före fixen föll även den friska källan på den kvarlämnade ogiltiga entiteten.
        var broken = await SeedSourceAsync("Trasig");
        var healthy = await SeedSourceAsync("Frisk");
        MakeBroken(broken);
        MakeHealthy(healthy);

        await NewService([broken, healthy]).IngestAsync(CancellationToken.None);

        using var db = NewDb();
        var healthyRow = await db.Sources.SingleAsync(s => s.Id == healthy.Source.Id);
        Assert.Null(healthyRow.LastFetchError);
        Assert.NotNull(healthyRow.LastFetchedAt);
        var log = await db.IngestorRunLogs.SingleAsync(l => l.SourceId == healthy.Source.Id);
        Assert.True(log.Success);
        Assert.Equal(2, log.EventsInserted);
    }

    [Fact]
    public async Task ThrowingFetch_IsRecordedAndNextSourceContinues()
    {
        var throwing = await SeedSourceAsync("Kastar");
        var healthy = await SeedSourceAsync("Frisk");
        throwing.Fetch = () => throw new InvalidOperationException("Källan svarade med HTML");
        MakeHealthy(healthy);

        await NewService([throwing, healthy]).IngestAsync(CancellationToken.None);

        using var db = NewDb();
        var row = await db.Sources.SingleAsync(s => s.Id == throwing.Source.Id);
        Assert.Equal("Källan svarade med HTML", row.LastFetchError);
        var log = await db.IngestorRunLogs.SingleAsync(l => l.SourceId == throwing.Source.Id);
        Assert.False(log.Success);
        Assert.Equal("Källan svarade med HTML", log.ErrorMessage);
        Assert.Equal(2, await db.Events.CountAsync(e => e.SourceId == healthy.Source.Id));
    }

    [Fact]
    public async Task LongErrorMessage_IsTruncatedTo500Chars()
    {
        var throwing = await SeedSourceAsync("Kastar");
        throwing.Fetch = () => throw new InvalidOperationException(new string('x', 900));

        await NewService([throwing]).IngestAsync(CancellationToken.None);

        using var db = NewDb();
        var row = await db.Sources.SingleAsync();
        Assert.Equal(500, row.LastFetchError!.Length);
    }

    [Fact]
    public async Task FailureLoggingThatItselfThrows_DoesNotStopTheLoop()
    {
        var broken = await SeedSourceAsync("Trasig");
        var healthy = await SeedSourceAsync("Frisk");
        broken.Fetch = () => throw new InvalidOperationException("fel");
        MakeHealthy(healthy);

        // Varje sparning av en felrad kastar (t.ex. databasen otillgänglig för just loggningen).
        _beforeSave = ctx =>
        {
            if (ctx.ChangeTracker.Entries<IngestorRunLog>().Any(e => e.State == EntityState.Added && !e.Entity.Success))
                throw new DbUpdateException("felloggningen fallerar");
        };

        var ex = await Record.ExceptionAsync(() => NewService([broken, healthy]).IngestAsync(CancellationToken.None));

        Assert.Null(ex);
        using var db = NewDb();
        Assert.Equal(2, await db.Events.CountAsync(e => e.SourceId == healthy.Source.Id));
        Assert.True((await db.IngestorRunLogs.SingleAsync(l => l.SourceId == healthy.Source.Id)).Success);
    }

    [Fact]
    public async Task HealthySourceAfterBroken_DoesNotClearTheBrokenSourcesError()
    {
        var broken = await SeedSourceAsync("Trasig");
        var healthy = await SeedSourceAsync("Frisk", lastFetchError: "gammalt fel på den friska");
        MakeBroken(broken);
        MakeHealthy(healthy);

        await NewService([broken, healthy]).IngestAsync(CancellationToken.None);

        using var db = NewDb();
        Assert.False(string.IsNullOrWhiteSpace((await db.Sources.SingleAsync(s => s.Id == broken.Source.Id)).LastFetchError));
        // Lyckad hämtning nollställer felet — men bara på den egna källan.
        Assert.Null((await db.Sources.SingleAsync(s => s.Id == healthy.Source.Id)).LastFetchError);
    }

    [Fact]
    public async Task PushSaveChangesFailure_DoesNotMarkFetchAsFailed_NorAffectNextSource()
    {
        var first = await SeedSourceAsync("Först", isPublished: true);
        var second = await SeedSourceAsync("Sist");
        MakeHealthy(first);
        MakeHealthy(second);

        // En prenumerant med enhet så att PushDispatcher når claim-SaveChanges för första källan.
        using (var seed = NewDb())
        {
            var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x", PushNyaHandelser = true };
            seed.Users.Add(user);
            await seed.SaveChangesAsync();
            seed.UserSourcePreferences.Add(new UserSourcePreference { UserId = user.Id, SourceId = first.Source.Id, IsActive = true });
            seed.UserDevices.Add(new UserDevice { UserId = user.Id, Endpoint = "https://push.example/ep", P256dh = "k", Auth = "a" });
            await seed.SaveChangesAsync();
        }

        var claimSaveAttempts = 0;
        _beforeSave = ctx =>
        {
            if (ctx.ChangeTracker.Entries<PushDispatchClaim>().Any(e => e.State == EntityState.Added))
            {
                claimSaveAttempts++;
                throw new DbUpdateException("push-claim kunde inte sparas");
            }
        };

        await NewService([first, second]).IngestAsync(CancellationToken.None);

        Assert.Equal(1, claimSaveAttempts); // push nåddes faktiskt och föll
        using var db = NewDb();
        var firstRow = await db.Sources.SingleAsync(s => s.Id == first.Source.Id);
        Assert.Null(firstRow.LastFetchError);
        Assert.NotNull(firstRow.LastFetchedAt);
        Assert.True((await db.IngestorRunLogs.SingleAsync(l => l.SourceId == first.Source.Id)).Success);
        Assert.Equal(2, await db.Events.CountAsync(e => e.SourceId == first.Source.Id));
        // Nästa källa opåverkad.
        Assert.Equal(2, await db.Events.CountAsync(e => e.SourceId == second.Source.Id));
        Assert.True((await db.IngestorRunLogs.SingleAsync(l => l.SourceId == second.Source.Id)).Success);
    }

    [Fact]
    public async Task AllRunLogRowsInACycle_ShareTheSameRunAt()
    {
        // AdminActivityLogController grupperar på RunAt — semantiken får inte ändras.
        var broken = await SeedSourceAsync("Trasig");
        var healthy = await SeedSourceAsync("Frisk");
        MakeBroken(broken);
        MakeHealthy(healthy);

        await NewService([broken, healthy]).IngestAsync(CancellationToken.None);

        using var db = NewDb();
        var runAts = await db.IngestorRunLogs.Select(l => l.RunAt).Distinct().ToListAsync();
        Assert.Single(runAts);
        Assert.Equal(2, await db.IngestorRunLogs.CountAsync());
    }

    [Fact]
    public async Task Cancellation_PropagatesAndIsNotRecordedAsSourceFailure()
    {
        var source = await SeedSourceAsync("Avbruten");
        using var cts = new CancellationTokenSource();
        source.Fetch = () =>
        {
            cts.Cancel();
            throw new OperationCanceledException(cts.Token);
        };

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => NewService([source]).IngestAsync(cts.Token));

        using var db = NewDb();
        Assert.Empty(db.IngestorRunLogs);
        Assert.Null((await db.Sources.SingleAsync()).LastFetchError);
    }

    [Fact]
    public async Task LegacySharedContextPattern_PoisonsNextSource_WhichIsWhyScopesAreIsolated()
    {
        // Dokumenterar felet som fixades: samma kontext för två källor. Efter att den första
        // källans SaveChanges fallerat ligger den ogiltiga posten kvar och nästa källas
        // SaveChanges faller på den (inte på sina egna, giltiga poster).
        var broken = await SeedSourceAsync("Trasig");
        var healthy = await SeedSourceAsync("Frisk");
        MakeBroken(broken);
        MakeHealthy(healthy);

        using var shared = NewDb();
        await EventSync.SyncAsync(shared, broken, overwriteExisting: false);
        await Assert.ThrowsAsync<DbUpdateException>(() => shared.SaveChangesAsync());

        await EventSync.SyncAsync(shared, healthy, overwriteExisting: false);
        await Assert.ThrowsAsync<DbUpdateException>(() => shared.SaveChangesAsync());

        using var fresh = NewDb();
        Assert.Equal(0, await fresh.Events.CountAsync(e => e.SourceId == healthy.Source.Id));
    }
}
