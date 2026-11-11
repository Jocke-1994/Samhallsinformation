namespace Samhallsinformation.Tests;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Sources;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Xunit;

/// <summary>
/// V3-18 (E4#12): DELETE /api/admin/sources/{id} ska inte lämna föräldralösa händelser efter sig,
/// och får inte radera seedade/dedikerade källor (Program.cs återskapar dem vid nästa start).
/// Riktig relationsdatabas (SQLite via <see cref="TestDb"/>) — kaskader och FK-fel måste vara på riktigt.
/// </summary>
public class DeleteSourceTests
{
    private sealed class FakeIngestor : IIngestor
    {
        public Source Source { get; }
        public FakeIngestor(Source source) { Source = source; }
        public Task<List<CanonicalEvent>> FetchEventsAsync() => Task.FromResult(new List<CanonicalEvent>());
    }

    private static SourcesController NewController(AppDbContext db, params IIngestor[] dedicated)
    {
        // Riktiga aktivitetsloggtjänsten (skriver till samma db) så testet ser raden som faktiskt hamnar i databasen.
        var log = new AktivitetsloggService(db, Substitute.For<IHttpContextAccessor>());
        return new SourcesController(db, dedicated, Substitute.For<IHttpClientFactory>(), log);
    }

    private static Source AddSource(AppDbContext db, string name, string? url = "https://rss.test/feed")
    {
        var s = new Source
        {
            Name = name,
            ShortName = name,
            BaseUrl = "https://rss.test",
            Url = url,
            Type = SourceType.RSS,
            IsActive = true,
            IsPublished = true,
        };
        db.Sources.Add(s);
        db.SaveChanges();
        return s;
    }

    private static User AddUser(AppDbContext db, string email)
    {
        var u = new User { Email = email, Name = email };
        db.Users.Add(u);
        db.SaveChanges();
        return u;
    }

    private static CanonicalEvent AddEvent(AppDbContext db, Source source, string ext)
    {
        var e = new CanonicalEvent
        {
            SourceId = source.Id,
            ExternalId = ext,
            Title = ext,
            PublishedAt = DateTime.UtcNow,
        };
        db.Events.Add(e);
        db.SaveChanges();
        return e;
    }

    /// <summary>En källa med 2 händelser, sparade händelser, delningar, körloggar och prenumerationer.</summary>
    private static (Source Source, List<CanonicalEvent> Events) SeedFullSource(AppDbContext db, string name, User u1, User u2)
    {
        var src = AddSource(db, name);
        var events = new List<CanonicalEvent> { AddEvent(db, src, name + "-a"), AddEvent(db, src, name + "-b") };
        db.UserSavedEvents.Add(new UserSavedEvent { UserId = u1.Id, EventId = events[0].Id });
        db.UserSavedEvents.Add(new UserSavedEvent { UserId = u2.Id, EventId = events[0].Id });
        db.UserSavedEvents.Add(new UserSavedEvent { UserId = u1.Id, EventId = events[1].Id });
        db.EventShareLogs.Add(new EventShareLog { EventId = events[0].Id, UserId = u1.Id });
        db.EventShareLogs.Add(new EventShareLog { EventId = events[1].Id, UserId = null });
        db.IngestorRunLogs.Add(new IngestorRunLog { SourceId = src.Id, Success = true, EventsInserted = 2 });
        db.IngestorRunLogs.Add(new IngestorRunLog { SourceId = src.Id, Success = false, ErrorMessage = "fel" });
        db.UserSourcePreferences.Add(new UserSourcePreference { UserId = u1.Id, SourceId = src.Id });
        db.UserSourcePreferences.Add(new UserSourcePreference { UserId = u2.Id, SourceId = src.Id });
        db.UserNotificationSettings.Add(new UserNotificationSetting { UserId = u1.Id, SourceId = src.Id, PushEnabled = true });
        db.SaveChanges();
        return (src, events);
    }

    private static async Task<int[]> CountsForSourceAsync(AppDbContext db, int sourceId, IEnumerable<Guid> eventIds)
    {
        var ids = eventIds.ToList();
        return new[]
        {
            await db.Sources.CountAsync(s => s.Id == sourceId),
            await db.Events.CountAsync(e => e.SourceId == sourceId),
            await db.UserSavedEvents.CountAsync(s => ids.Contains(s.EventId)),
            await db.EventShareLogs.CountAsync(l => ids.Contains(l.EventId)),
            await db.IngestorRunLogs.CountAsync(r => r.SourceId == sourceId),
            await db.UserSourcePreferences.CountAsync(p => p.SourceId == sourceId),
            await db.UserNotificationSettings.CountAsync(n => n.SourceId == sourceId),
        };
    }

    [Fact]
    public async Task Delete_RegularSource_RemovesEventsAndAllDependentRows()
    {
        using var db = TestDb.Create();
        var u1 = AddUser(db, "a@test.se"); var u2 = AddUser(db, "b@test.se");
        var (src, events) = SeedFullSource(db, "Vanlig", u1, u2);
        Assert.Equal(new[] { 1, 2, 3, 2, 2, 2, 1 }, await CountsForSourceAsync(db, src.Id, events.Select(e => e.Id)));

        var result = await NewController(db).DeleteSource(src.Id);

        Assert.IsType<NoContentResult>(result);
        using var fresh = TestDb.CreateSecondContext(db); // tom change tracker — det som faktiskt ligger i databasen
        Assert.All(await CountsForSourceAsync(fresh, src.Id, events.Select(e => e.Id)), c => Assert.Equal(0, c));
    }

    [Fact]
    public async Task Delete_RegularSource_LeavesNoOrphanedEventsOrSavedRows()
    {
        using var db = TestDb.Create();
        var u1 = AddUser(db, "a@test.se"); var u2 = AddUser(db, "b@test.se");
        var (src, _) = SeedFullSource(db, "Vanlig", u1, u2);
        SeedFullSource(db, "Annan", u1, u2);

        await NewController(db).DeleteSource(src.Id);

        // Globalt: varje händelse/prenumeration/körlogg/delning pekar på något som finns kvar.
        var sourceIds = await db.Sources.Select(s => s.Id).ToListAsync();
        var eventIds = await db.Events.Select(e => e.Id).ToListAsync();
        Assert.DoesNotContain(await db.Events.ToListAsync(), e => !sourceIds.Contains(e.SourceId));
        Assert.DoesNotContain(await db.IngestorRunLogs.ToListAsync(), r => !sourceIds.Contains(r.SourceId));
        Assert.DoesNotContain(await db.UserSourcePreferences.ToListAsync(), p => !sourceIds.Contains(p.SourceId));
        Assert.DoesNotContain(await db.UserNotificationSettings.ToListAsync(), n => !sourceIds.Contains(n.SourceId));
        Assert.DoesNotContain(await db.UserSavedEvents.ToListAsync(), s => !eventIds.Contains(s.EventId));
        Assert.DoesNotContain(await db.EventShareLogs.ToListAsync(), l => !eventIds.Contains(l.EventId));
    }

    [Fact]
    public async Task Delete_RegularSource_LeavesOtherSourcesDataUntouched()
    {
        using var db = TestDb.Create();
        var u1 = AddUser(db, "a@test.se"); var u2 = AddUser(db, "b@test.se");
        var (src, _) = SeedFullSource(db, "Vanlig", u1, u2);
        var (other, otherEvents) = SeedFullSource(db, "Annan", u1, u2);

        await NewController(db).DeleteSource(src.Id);

        Assert.Equal(new[] { 1, 2, 3, 2, 2, 2, 1 },
            await CountsForSourceAsync(db, other.Id, otherEvents.Select(e => e.Id)));
    }

    [Fact]
    public async Task Delete_SourceWithoutEvents_Works()
    {
        using var db = TestDb.Create();
        var src = AddSource(db, "Tom");

        var result = await NewController(db).DeleteSource(src.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(db.Sources);
    }

    [Fact]
    public async Task Delete_UnknownId_Returns404()
    {
        using var db = TestDb.Create();

        var result = await NewController(db).DeleteSource(999);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Delete_DedicatedIngestorSource_Returns400_AndDeletesNothing()
    {
        using var db = TestDb.Create();
        var u1 = AddUser(db, "a@test.se"); var u2 = AddUser(db, "b@test.se");
        var (src, events) = SeedFullSource(db, "Polisen", u1, u2);
        var ingestor = new FakeIngestor(new Source { Id = src.Id, Name = "Polisen" }); // matchas på hårdkodat Id, som Program.cs

        var result = await NewController(db, ingestor).DeleteSource(src.Id);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("inaktiveras men inte raderas", bad.Value!.ToString());
        Assert.Equal(new[] { 1, 2, 3, 2, 2, 2, 1 }, await CountsForSourceAsync(db, src.Id, events.Select(e => e.Id)));
        Assert.Empty(db.AdminActivityLogs); // inget "borttagen" loggat
    }

    [Theory]
    [InlineData(SeededSources.SmhiNyheterUrl)]
    [InlineData(SeededSources.PolisenEfterlysningarUrl)]
    public async Task Delete_SeededRssSource_Returns400_AndDeletesNothing(string seededUrl)
    {
        using var db = TestDb.Create();
        var src = AddSource(db, "Seedad", seededUrl);
        AddEvent(db, src, "x");

        var result = await NewController(db).DeleteSource(src.Id);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(1, await db.Sources.CountAsync());
        Assert.Equal(1, await db.Events.CountAsync());
    }

    [Fact]
    public async Task Delete_SeededSource_CanStillBeDeactivatedInstead()
    {
        // Rätt väg för dedikerade källor: IsActive=false (V2-5 respekterar den) — PATCH ska fungera.
        using var db = TestDb.Create();
        var src = AddSource(db, "Polisen");
        var controller = NewController(db, new FakeIngestor(new Source { Id = src.Id }));

        var result = await controller.UpdateSource(src.Id, new UpdateSourceRequest(null, null, null, null, false, null));

        Assert.IsType<OkObjectResult>(result);
        Assert.False((await db.Sources.SingleAsync()).IsActive);
    }

    [Fact]
    public async Task Delete_WhenSomethingFails_RollsBackEverything()
    {
        using var db = TestDb.Create();
        var u1 = AddUser(db, "a@test.se"); var u2 = AddUser(db, "b@test.se");
        var (src, events) = SeedFullSource(db, "Vanlig", u1, u2);
        // Källraden raderas SIST — när den nekas har händelser, loggar m.m. redan raderats i transaktionen.
        await db.Database.ExecuteSqlRawAsync(
            "CREATE TRIGGER fail_source_delete BEFORE DELETE ON Sources BEGIN SELECT RAISE(ABORT, 'boom'); END;");

        await Assert.ThrowsAnyAsync<Exception>(() => NewController(db).DeleteSource(src.Id));

        using var fresh = TestDb.CreateSecondContext(db);
        Assert.Equal(new[] { 1, 2, 3, 2, 2, 2, 1 }, await CountsForSourceAsync(fresh, src.Id, events.Select(e => e.Id)));
        Assert.Empty(fresh.AdminActivityLogs);
    }

    [Fact]
    public async Task Delete_WritesActivityLogWithCounts()
    {
        using var db = TestDb.Create();
        var u1 = AddUser(db, "a@test.se"); var u2 = AddUser(db, "b@test.se");
        var (src, _) = SeedFullSource(db, "Vanlig", u1, u2);

        await NewController(db).DeleteSource(src.Id);

        var row = Assert.Single(db.AdminActivityLogs);
        Assert.Equal(LoggTyper.Konfiguration, row.Typ);
        Assert.Contains("Källa borttagen — Vanlig", row.Rubrik);
        Assert.Contains("2 händelser", row.Detalj);
        Assert.Contains("3 prenumerationer", row.Detalj);   // 2 källpreferenser + 1 notisinställning
        Assert.Contains("3 sparade händelser", row.Detalj);
        Assert.Contains("2 delningsloggar", row.Detalj);
        Assert.Contains("2 körloggar", row.Detalj);
    }

    [Fact]
    public async Task SourceDeletion_ReturnsCountsPerTable()
    {
        using var db = TestDb.Create();
        var u1 = AddUser(db, "a@test.se"); var u2 = AddUser(db, "b@test.se");
        var (src, _) = SeedFullSource(db, "Vanlig", u1, u2);

        var r = await SourceDeletion.DeleteAsync(db, src.Id);

        Assert.Equal(new SourceDeletionResult(Events: 2, SavedEvents: 3, ShareLogs: 2, RunLogs: 2, Subscriptions: 3), r);
    }
}
