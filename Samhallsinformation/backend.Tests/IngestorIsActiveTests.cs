namespace Samhallsinformation.Tests;

using System.Net;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

/// <summary>
/// V2-5 (E3#6, E4#4 ingest-halvan): Source.IsActive=false ska stoppa hämtningen både för de
/// dedikerade ingestorerna (som annars alltid kördes) och för manuell omkörning. IsPublished
/// ska INTE påverka hämtningen (sandlådekällor hämtas fortfarande).
/// </summary>
public class IngestorIsActiveTests
{
    private const string RssXml =
        "<?xml version=\"1.0\"?><rss version=\"2.0\"><channel><title>t</title></channel></rss>";

    private sealed class FakeIngestor : IIngestor
    {
        public Source Source { get; }
        public int Calls { get; private set; }
        public FakeIngestor(Source source) { Source = source; }

        public Task<List<CanonicalEvent>> FetchEventsAsync()
        {
            Calls++;
            return Task.FromResult(new List<CanonicalEvent>());
        }
    }

    private sealed class CountingHandler : HttpMessageHandler
    {
        public int Requests { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(RssXml, Encoding.UTF8, "application/rss+xml"),
            });
        }
    }

    private static DbContextOptions<AppDbContext> NewOptions() =>
        new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

    private static Source NewSource(string name, bool isActive, bool isPublished = true, SourceType type = SourceType.RSS, string? url = null) =>
        new()
        {
            Name = name,
            ShortName = name,
            BaseUrl = "https://example.test",
            Url = url,
            Type = type,
            IsActive = isActive,
            IsPublished = isPublished,
        };

    // Kör en riktig ingest-cykel mot en delad in-memory-databas. Den dedikerade ingestorns
    // in-code-Source speglar produktion (hårdkodat IsActive=true) medan DB-raden styr.
    private static async Task<(AppDbContext Db, FakeIngestor Dedicated, CountingHandler Http)> RunCycleAsync(
        bool dedicatedRowActive, bool dedicatedRowPublished = true, Source? extraSource = null, bool removeDedicatedRow = false)
    {
        var options = NewOptions();
        var http = new CountingHandler();

        using (var seed = new AppDbContext(options))
        {
            var row = NewSource("Dedikerad", dedicatedRowActive, dedicatedRowPublished, SourceType.WebAPI);
            seed.Sources.Add(row);
            if (extraSource != null) seed.Sources.Add(extraSource);
            await seed.SaveChangesAsync();

            var dedicated = new FakeIngestor(new Source
            {
                Id = row.Id,
                Name = row.Name,
                ShortName = row.ShortName,
                BaseUrl = row.BaseUrl,
                Type = SourceType.WebAPI,
                IsActive = true,
                IsPublished = true,
            });

            if (removeDedicatedRow)
            {
                seed.Sources.Remove(row);
                await seed.SaveChangesAsync();
            }

            var httpFactory = Substitute.For<IHttpClientFactory>();
            httpFactory.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient(http, disposeHandler: false));

            var services = new ServiceCollection();
            services.AddScoped(_ => new AppDbContext(options));
            services.AddSingleton(Substitute.For<IPushNotificationService>());
            services.AddSingleton<IIngestor>(dedicated);
            var provider = services.BuildServiceProvider();

            var svc = new IngestorBackgroundService(
                provider.GetRequiredService<IServiceScopeFactory>(),
                httpFactory,
                NullLogger<IngestorBackgroundService>.Instance,
                new ConfigurationBuilder().Build());

            await svc.IngestAsync(CancellationToken.None);

            return (new AppDbContext(options), dedicated, http);
        }
    }

    [Fact]
    public async Task IngestAsync_ActiveDedicatedSource_IsFetchedAndLogged()
    {
        var (db, dedicated, _) = await RunCycleAsync(dedicatedRowActive: true);
        using var _ = db;

        Assert.Equal(1, dedicated.Calls);
        var log = Assert.Single(db.IngestorRunLogs);
        Assert.True(log.Success);
    }

    [Fact]
    public async Task IngestAsync_InactiveDedicatedSource_IsNotFetched_AndWritesNoErrorOrRunLog()
    {
        var (db, dedicated, _) = await RunCycleAsync(dedicatedRowActive: false);
        using var _ = db;

        Assert.Equal(0, dedicated.Calls);
        Assert.Empty(db.IngestorRunLogs);
        var row = await db.Sources.SingleAsync();
        Assert.Null(row.LastFetchError);
        Assert.Null(row.LastFetchedAt);
    }

    [Fact]
    public async Task IngestAsync_UnpublishedButActiveDedicatedSource_IsStillFetched()
    {
        // Sandlåda: IsActive=true, IsPublished=false ska hämtas så källan kan testas.
        var (db, dedicated, _) = await RunCycleAsync(dedicatedRowActive: true, dedicatedRowPublished: false);
        using var _ = db;

        Assert.Equal(1, dedicated.Calls);
    }

    [Fact]
    public async Task IngestAsync_DedicatedSourceWithoutDbRow_IsFetchedAsBefore()
    {
        // Dokumenterat undantagsläge: saknas Source-raden hämtas ingestorn som förut.
        var (db, dedicated, _) = await RunCycleAsync(dedicatedRowActive: false, removeDedicatedRow: true);
        using var _ = db;

        Assert.Equal(1, dedicated.Calls);
    }

    [Fact]
    public async Task IngestAsync_InactiveGenericRssSource_IsStillSkipped()
    {
        var inactiveRss = NewSource("Generisk pausad", isActive: false, url: "https://rss.test/feed");
        var (db, _, http) = await RunCycleAsync(dedicatedRowActive: true, extraSource: inactiveRss);
        using var _ = db;

        Assert.Equal(0, http.Requests);
    }

    [Fact]
    public async Task IngestAsync_ActiveGenericRssSource_IsFetched()
    {
        var activeRss = NewSource("Generisk aktiv", isActive: true, url: "https://rss.test/feed");
        var (db, _, http) = await RunCycleAsync(dedicatedRowActive: true, extraSource: activeRss);
        using var _ = db;

        Assert.Equal(1, http.Requests);
    }

    // ---- Manuell körning (SourcesController.ResyncSource) ----

    private static (SourcesController Controller, IAktivitetsloggService Log, CountingHandler Http) NewController(
        AppDbContext db, params IIngestor[] dedicated)
    {
        var http = new CountingHandler();
        var httpFactory = Substitute.For<IHttpClientFactory>();
        httpFactory.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient(http, disposeHandler: false));
        var log = Substitute.For<IAktivitetsloggService>();
        return (new SourcesController(db, dedicated, httpFactory, log), log, http);
    }

    [Fact]
    public async Task ResyncSource_InactiveDedicatedSource_IsRejected_AndNotFetched()
    {
        using var db = new AppDbContext(NewOptions());
        var row = NewSource("Dedikerad", isActive: false, type: SourceType.WebAPI);
        db.Sources.Add(row);
        await db.SaveChangesAsync();
        var dedicated = new FakeIngestor(row);
        var (controller, log, _) = NewController(db, dedicated);

        var result = await controller.ResyncSource(row.Id);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, dedicated.Calls);
        Assert.Null((await db.Sources.SingleAsync()).LastFetchError);
        await log.DidNotReceiveWithAnyArgs().LogAsync("", "", "", "");
    }

    [Fact]
    public async Task ResyncSource_InactiveGenericRssSource_IsRejected_AndNotFetched()
    {
        using var db = new AppDbContext(NewOptions());
        var row = NewSource("Generisk", isActive: false, url: "https://rss.test/feed");
        db.Sources.Add(row);
        await db.SaveChangesAsync();
        var (controller, _, http) = NewController(db);

        var result = await controller.ResyncSource(row.Id);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, http.Requests);
    }

    [Fact]
    public async Task ResyncSource_ActiveButUnpublishedSource_IsStillRun()
    {
        using var db = new AppDbContext(NewOptions());
        var row = NewSource("Sandlåda", isActive: true, isPublished: false, type: SourceType.WebAPI);
        db.Sources.Add(row);
        await db.SaveChangesAsync();
        var dedicated = new FakeIngestor(row);
        var (controller, _, _) = NewController(db, dedicated);

        var result = await controller.ResyncSource(row.Id);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, dedicated.Calls);
    }
}
