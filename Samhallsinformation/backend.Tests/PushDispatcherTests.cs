namespace Samhallsinformation.Tests;

using System.Net;
using System.Net.Http;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using WebPush;
using Xunit;

public class PushDispatcherTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    // Källa som medvetet INTE heter "Polisen" och har ett Id skilt från 1 —
    // PushDispatcher grenar på PolisenHandelserSourceId (=1, PolisenRssIngestor.
    // Source.Id i produktion) till bevaknings-matchad utskick (se
    // SeedPolisenSubscriber/PolisenEventsTests nedan för det). Utan ett explicit
    // Id här skulle EF Core InMemory-providern auto-tilldela 1 ändå (första/enda
    // Source i en fräsch testdatabas), vilket oavsiktligt skulle trigga samma
    // gren — explicit Id håller de generiska testerna genuint utanför den.
    private static (User User, Source Source, UserDevice Device) SeedSubscriber(
        AppDbContext db, bool pushNyaHandelser = true, bool sourceActive = true, bool sourcePublished = true)
    {
        var user = new User
        {
            Name = "Ada",
            Email = $"{Guid.NewGuid()}@example.com",
            PasswordHash = "x",
            PushNyaHandelser = pushNyaHandelser,
        };
        var source = new Source { Id = 2, Name = "Krisinformation", ShortName = "Krisinformation", BaseUrl = "https://example.com", IsPublished = sourcePublished };
        db.Users.Add(user);
        db.Sources.Add(source);
        db.SaveChanges();

        db.UserSourcePreferences.Add(new UserSourcePreference
        {
            UserId = user.Id,
            SourceId = source.Id,
            IsActive = sourceActive,
            SortOrder = 0,
        });
        var device = new UserDevice
        {
            UserId = user.Id,
            Endpoint = "https://push.example/ep1",
            P256dh = "p256dh-key",
            Auth = "auth-secret",
        };
        db.UserDevices.Add(device);
        db.SaveChanges();

        return (user, source, device);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_ActiveSubscriberWithDevice_SendsPushAndLogsSent()
    {
        using var db = NewDb();
        var (_, source, device) = SeedSubscriber(db);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 3, insertedEvents: []);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(),
            Arg.Is<string>(b => b!.Contains('3') && b.Contains("Krisinformation")),
            Arg.Any<string?>(),
            Arg.Any<Guid?>(),
            Arg.Any<PushGrupp?>(),
            Arg.Any<CancellationToken>());

        var log = Assert.Single(db.NotificationDeliveryLogs);
        Assert.Equal("sent", log.Status);
        Assert.Equal("push", log.Channel);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_NyaHandelserMuted_SendsNothing()
    {
        using var db = NewDb();
        var (_, source, _) = SeedSubscriber(db, pushNyaHandelser: false);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1, insertedEvents: []);

        await push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default, default);
        Assert.Empty(db.NotificationDeliveryLogs);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_SourceNotActiveForUser_SendsNothing()
    {
        using var db = NewDb();
        var (_, source, _) = SeedSubscriber(db, sourceActive: false);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1, insertedEvents: []);

        await push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default, default);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_NoNewEvents_SendsNothing()
    {
        using var db = NewDb();
        var (_, source, _) = SeedSubscriber(db);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 0, insertedEvents: []);

        await push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default, default);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_ExpiredSubscription_RemovesDeviceAndLogsExpired()
    {
        using var db = NewDb();
        var (_, source, device) = SeedSubscriber(db);
        var push = Substitute.For<IPushNotificationService>();

        var subscription = new PushSubscription(device.Endpoint, device.P256dh, device.Auth);
        var goneException = new WebPushException("gone", subscription, new HttpResponseMessage(HttpStatusCode.Gone));
        push.SendAsync(Arg.Any<UserDevice>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(goneException));

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1, insertedEvents: []);

        Assert.Empty(db.UserDevices);
        var log = Assert.Single(db.NotificationDeliveryLogs);
        Assert.Equal("expired", log.Status);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_OtherSendFailure_KeepsDeviceAndLogsFailed()
    {
        using var db = NewDb();
        var (_, source, device) = SeedSubscriber(db);
        var push = Substitute.For<IPushNotificationService>();

        push.SendAsync(Arg.Any<UserDevice>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("boom")));

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1, insertedEvents: []);

        Assert.Single(db.UserDevices);
        Assert.Equal(device.Id, db.UserDevices.Single().Id);
        var log = Assert.Single(db.NotificationDeliveryLogs);
        Assert.Equal("failed", log.Status);
    }

    // Källans Id är medvetet satt till 1 (= PolisenRssIngestor.Source.Id i
    // produktion) — det är vad som triggar PushDispatchers bevaknings-gren
    // sedan fixen för Polisen Efterlysningar-matchningen, inte längre bara
    // ShortName (jfr SeedSubscriber ovan, som medvetet undviker namnet för
    // de generiska testerna, och SeedPolisenEfterlysningarSubscriber nedan).
    private static (User User, Source Source, UserDevice Device) SeedPolisenSubscriber(
        AppDbContext db, bool sourcePublished = true)
    {
        var user = new User
        {
            Name = "Berit",
            Email = $"{Guid.NewGuid()}@example.com",
            PasswordHash = "x",
            PushNyaHandelser = true,
        };
        var source = new Source { Id = 1, Name = "Polisen", ShortName = "Polisen", BaseUrl = "https://example.com", IsPublished = sourcePublished };
        db.Users.Add(user);
        db.Sources.Add(source);
        db.SaveChanges();

        db.UserSourcePreferences.Add(new UserSourcePreference { UserId = user.Id, SourceId = source.Id, IsActive = true, SortOrder = 0 });
        var device = new UserDevice { UserId = user.Id, Endpoint = "https://push.example/polisen-ep", P256dh = "p256dh-key", Auth = "auth-secret" };
        db.UserDevices.Add(device);
        db.SaveChanges();

        return (user, source, device);
    }

    // Samma ShortName ("Polisen") som huvudkällan ovan, men ett ANNAT Id — precis
    // som riktiga "Polisen Efterlysningar" (DatabaseBootstrapper). Ska INTE gå via
    // bevaknings-matchningen, se testet nedan.
    private static (User User, Source Source, UserDevice Device) SeedPolisenEfterlysningarSubscriber(AppDbContext db)
    {
        var user = new User
        {
            Name = "Berit",
            Email = $"{Guid.NewGuid()}@example.com",
            PasswordHash = "x",
            PushNyaHandelser = true,
        };
        var source = new Source { Id = 99, Name = "Polisen Efterlysningar", ShortName = "Polisen", BaseUrl = "https://example.com", IsPublished = true };
        db.Users.Add(user);
        db.Sources.Add(source);
        db.SaveChanges();

        db.UserSourcePreferences.Add(new UserSourcePreference { UserId = user.Id, SourceId = source.Id, IsActive = true, SortOrder = 0 });
        var device = new UserDevice { UserId = user.Id, Endpoint = "https://push.example/efterlysning-ep", P256dh = "p256dh-key", Auth = "auth-secret" };
        db.UserDevices.Add(device);
        db.SaveChanges();

        return (user, source, device);
    }

    // Titeln har medvetet ett datumprefix (samma format som skarp Polisen-data,
    // "14 augusti 13.05, Trafikolycka, Göteborg") — inte "Trafikolycka, Göteborg"
    // rakt av. Matchningen sker mot eventType (redan strukturerat fält), inte
    // title, så ett realistiskt datumprefix bevisar att fixen faktiskt biter.
    private static CanonicalEvent MakeEvent(int sourceId, string? geography, string? eventType) => new()
    {
        SourceId = sourceId,
        ExternalId = Guid.NewGuid().ToString(),
        Title = $"14 augusti 13.05, {eventType}, {geography}",
        Content = "",
        Url = "https://polisen.se/x",
        RawData = "",
        Geography = geography,
        EventType = eventType,
        PublishedAt = DateTime.UtcNow,
    };

    // Djuplänk (2026-11-03): en push om exakt en händelse länkar till just den,
    // så att appen kan scrolla fram och fälla ut den. Upptäckt via en riktig
    // Efterlysningar-push som bara landade på startsidan.
    [Fact]
    public async Task DispatchNewEventsAsync_EnHändelseGenerisk_LänkenPekarPåHändelsen()
    {
        using var db = NewDb();
        var (_, source, device) = SeedPolisenEfterlysningarSubscriber(db);
        var ev = MakeEvent(source.Id, null, null);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local/", source.Id, insertedCount: 1, insertedEvents: [ev]);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(), Arg.Any<string>(),
            Arg.Is<string?>(u => u == $"https://test.local/?shortName=Polisen&handelse={ev.Id}"),
            Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchNewEventsAsync_FleraHändelser_LänkenPekarPåKällflödet()
    {
        using var db = NewDb();
        var (_, source, device) = SeedPolisenEfterlysningarSubscriber(db);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 2,
            insertedEvents: [MakeEvent(source.Id, null, null), MakeEvent(source.Id, null, null)]);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(), Arg.Any<string>(),
            Arg.Is<string?>(u => u == "https://test.local/?shortName=Polisen"),
            Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    // Polisen-vägen: det som räknas är hur många händelser som matchar JUST
    // den här mottagarens bevakningar, inte hur många som infogades totalt.
    [Fact]
    public async Task DispatchNewEventsAsync_PolisenEnMatchandeAvFlera_LänkenPekarPåDenMatchande()
    {
        using var db = NewDb();
        var (user, source, device) = SeedPolisenSubscriber(db);
        db.PolisenBevakningar.Add(new PolisenBevakning
        {
            UserId = user.Id,
            KategorierJson = System.Text.Json.JsonSerializer.Serialize(new[] { "Trafikolycka" }),
            OmradenJson = null,
        });
        db.SaveChanges();
        var träff = MakeEvent(source.Id, "Göteborg", "Trafikolycka");
        var annan = MakeEvent(source.Id, "Malmö", "Brand");
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 2, insertedEvents: [träff, annan]);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(), Arg.Any<string>(),
            Arg.Is<string?>(u => u!.EndsWith($"&handelse={träff.Id}")),
            Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    // Notisspam efter att datorn varit avstängd (Discord-feedback 2026-11-14):
    // varje push bär en grupp per källa så att service workern kan slå ihop dem
    // till EN notis med summerat antal. Länken i gruppen är alltid källflödet,
    // eftersom en sammanslagen notis gäller fler än en händelse.
    [Fact]
    public async Task DispatchNewEventsAsync_Generisk_SkickarGruppPerKälla()
    {
        using var db = NewDb();
        var (_, source, device) = SeedSubscriber(db);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1,
            insertedEvents: [MakeEvent(source.Id, null, null)]);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<Guid?>(),
            Arg.Is<PushGrupp?>(g => g == new PushGrupp(
                $"kalla-{source.Id}", 1, "från Krisinformation", "https://test.local/?shortName=Krisinformation")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchNewEventsAsync_Polisen_GruppensAntalÄrMatchandeInteInfogade()
    {
        using var db = NewDb();
        var (user, source, device) = SeedPolisenSubscriber(db);
        db.PolisenBevakningar.Add(new PolisenBevakning
        {
            UserId = user.Id,
            KategorierJson = System.Text.Json.JsonSerializer.Serialize(new[] { "Trafikolycka" }),
            OmradenJson = null,
        });
        db.SaveChanges();
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 3, insertedEvents:
            [MakeEvent(source.Id, "Göteborg", "Trafikolycka"), MakeEvent(source.Id, "Lund", "Trafikolycka"), MakeEvent(source.Id, "Malmö", "Brand")]);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<Guid?>(),
            Arg.Is<PushGrupp?>(g => g!.Tag == $"kalla-{source.Id}" && g.Antal == 2 && g.Etikett == "matchar dina bevakningar"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchNewEventsAsync_PolisenNoBevakningar_SendsAllLikeBefore()
    {
        using var db = NewDb();
        var (_, source, device) = SeedPolisenSubscriber(db);
        var events = new List<CanonicalEvent> { MakeEvent(source.Id, "Göteborg", "Trafikolycka") };
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1, insertedEvents: events);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchNewEventsAsync_PolisenBevakningMatchesOneEvent_MessageIncludesTypAndOmrade()
    {
        using var db = NewDb();
        var (user, source, device) = SeedPolisenSubscriber(db);
        db.PolisenBevakningar.Add(new PolisenBevakning
        {
            UserId = user.Id,
            KategorierJson = System.Text.Json.JsonSerializer.Serialize(new[] { "Trafikolycka" }),
            OmradenJson = null,
        });
        db.SaveChanges();
        var events = new List<CanonicalEvent> { MakeEvent(source.Id, "Göteborg", "Trafikolycka") };
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1, insertedEvents: events);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(),
            Arg.Is<string>(b => b!.Contains("Trafikolycka") && b.Contains("Göteborg")),
            Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchNewEventsAsync_PolisenBevakningDoesNotMatch_SendsNothing()
    {
        using var db = NewDb();
        var (user, source, _) = SeedPolisenSubscriber(db);
        db.PolisenBevakningar.Add(new PolisenBevakning
        {
            UserId = user.Id,
            KategorierJson = System.Text.Json.JsonSerializer.Serialize(new[] { "Skjutning" }),
            OmradenJson = null,
        });
        db.SaveChanges();
        var events = new List<CanonicalEvent> { MakeEvent(source.Id, "Göteborg", "Trafikolycka") };
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1, insertedEvents: events);

        await push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default, default);
    }

    // Sammanfattningar taggas av Polisen med ett helt LÄN som Geography, inte
    // en kommun — den enda bevakningen som NÅGONSIN kan matcha en sådan är en
    // utan områdesbegränsning (annars matchar en kommunlista aldrig ett
    // länsnamn). Det gav sammanfattningar från hela Sverige i push, upptäckt
    // 2026-09-12 — nu medvetet avslaget som push-standard oavsett bevakning.
    [Fact]
    public async Task DispatchNewEventsAsync_PolisenSammanfattning_NeverPushesEvenWithMatchingBevakning()
    {
        using var db = NewDb();
        var (user, source, _) = SeedPolisenSubscriber(db);
        db.PolisenBevakningar.Add(new PolisenBevakning
        {
            UserId = user.Id,
            KategorierJson = System.Text.Json.JsonSerializer.Serialize(new[] { "Sammanfattning natt" }),
            OmradenJson = null,
        });
        db.SaveChanges();
        var events = new List<CanonicalEvent> { MakeEvent(source.Id, "Jönköpings län", "Sammanfattning natt") };
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1, insertedEvents: events);

        await push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default, default);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_PolisenMixOfSammanfattningAndRealEvent_OnlyPushesReal()
    {
        using var db = NewDb();
        var (_, source, device) = SeedPolisenSubscriber(db);
        var events = new List<CanonicalEvent>
        {
            MakeEvent(source.Id, "Jönköpings län", "Sammanfattning natt"),
            MakeEvent(source.Id, "Göteborg", "Trafikolycka"),
        };
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 2, insertedEvents: events);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(),
            Arg.Is<string>(b => b!.Contains("Trafikolycka") && !b.Contains("Sammanfattning")),
            Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchNewEventsAsync_PolisenMultipleMatches_UsesGenericCountMessage()
    {
        using var db = NewDb();
        var (user, source, device) = SeedPolisenSubscriber(db);
        db.PolisenBevakningar.Add(new PolisenBevakning
        {
            UserId = user.Id,
            KategorierJson = null,
            OmradenJson = System.Text.Json.JsonSerializer.Serialize(new[] { "Göteborg" }),
        });
        db.SaveChanges();
        var events = new List<CanonicalEvent>
        {
            MakeEvent(source.Id, "Göteborg", "Trafikolycka"),
            MakeEvent(source.Id, "Göteborg", "Misshandel"),
        };
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 2, insertedEvents: events);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(),
            Arg.Is<string>(b => b!.Contains('2') && b.Contains("bevakningar")),
            Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    // Regressionstest för bevaknings-matchningsbuggen (kodgranskning V4-5,
    // 2026-09-27): "Polisen Efterlysningar" delar ShortName "Polisen" med
    // huvudkällan men har ett ANNAT Id och saknar EventType/Geography.
    // PolisenBevakningMatcher.Matches tolkar null EventType/Geography som
    // "matchar allt" — innan fixen (gate på ShortName) gick Efterlysningar
    // via samma per-användare-bevaknings-gren som riktiga Polisen-händelser,
    // och fick en missvisande "matchar dina bevakningar"-text trots att
    // bevakningen inte filtrerat bort något alls. Efter fixen (gate på Id)
    // ska Efterlysningar gå via den vanliga generiska batch-pushen, precis
    // som alla andra källor.
    [Fact]
    public async Task DispatchNewEventsAsync_PolisenEfterlysningarDelarShortNameMenInteId_AnvanderGeneriskBatchtext()
    {
        using var db = NewDb();
        var (user, source, device) = SeedPolisenEfterlysningarSubscriber(db);
        db.PolisenBevakningar.Add(new PolisenBevakning
        {
            UserId = user.Id,
            KategorierJson = System.Text.Json.JsonSerializer.Serialize(new[] { "Skjutning" }),
            OmradenJson = System.Text.Json.JsonSerializer.Serialize(new[] { "Kungälv" }),
        });
        db.SaveChanges();
        var events = new List<CanonicalEvent>
        {
            MakeEvent(source.Id, geography: null, eventType: null),
            MakeEvent(source.Id, geography: null, eventType: null),
        };
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 2, insertedEvents: events);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(),
            Arg.Is<string>(b => b!.Contains("Polisen Efterlysningar") && !b.Contains("bevakning")),
            Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchNewVersionAsync_OptedInUser_SendsPushAndReturnsCount()
    {
        using var db = NewDb();
        var (_, _, device) = SeedSubscriber(db); // PushNyVersion defaultar till true
        var push = Substitute.For<IPushNotificationService>();

        var sent = await PushDispatcher.DispatchNewVersionAsync(db, push, "https://test.local", "1.2.0", "Nya källor och buggfixar");

        Assert.Equal(1, sent);
        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Is<string>(t => t!.Contains("1.2.0")),
            Arg.Is<string>(b => b == "Nya källor och buggfixar"),
            Arg.Any<string?>(),
            Arg.Any<Guid?>(),
            Arg.Any<PushGrupp?>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchNewVersionAsync_UserOptedOut_SendsNothing()
    {
        using var db = NewDb();
        SeedSubscriber(db);
        db.Users.Single().PushNyVersion = false;
        db.SaveChanges();
        var push = Substitute.For<IPushNotificationService>();

        var sent = await PushDispatcher.DispatchNewVersionAsync(db, push, "https://test.local", "1.2.0", "Nya källor och buggfixar");

        Assert.Equal(0, sent);
        await push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default, default);
    }

    private static (User Admin, UserDevice Device) SeedAdminWithDevice(AppDbContext db, bool pushEnabled = true, string role = "Admin")
    {
        var admin = new User
        {
            Name = "Joakim",
            Email = $"{Guid.NewGuid()}@example.com",
            PasswordHash = "x",
            Role = role,
            PushEnabled = pushEnabled,
        };
        db.Users.Add(admin);
        db.SaveChanges();

        var device = new UserDevice
        {
            UserId = admin.Id,
            Endpoint = "https://push.example/admin-ep",
            P256dh = "p256dh-key",
            Auth = "auth-secret",
        };
        db.UserDevices.Add(device);
        db.SaveChanges();

        return (admin, device);
    }

    private static SupportTicket NewTicket(string channel = "arendehantering") => new()
    {
        TicketNumber = 1,
        Subject = "Testärende",
        Category = "Tekniskt fel",
        Channel = channel,
    };

    [Fact]
    public async Task DispatchNewTicketAsync_AdminWithDevice_SendsPush()
    {
        using var db = NewDb();
        var (_, device) = SeedAdminWithDevice(db);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewTicketAsync(db, push, "https://test.local", NewTicket());

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchNewTicketAsync_AdminHasPushMuted_SendsNothing()
    {
        using var db = NewDb();
        SeedAdminWithDevice(db, pushEnabled: false);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewTicketAsync(db, push, "https://test.local", NewTicket());

        await push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default, default);
    }

    [Fact]
    public async Task DispatchNewTicketAsync_RegularUserOnly_SendsNothing()
    {
        using var db = NewDb();
        var (user, _, _) = SeedSubscriber(db);
        db.UserDevices.Add(new UserDevice { UserId = user.Id, Endpoint = "https://push.example/user-ep", P256dh = "p", Auth = "a" });
        db.SaveChanges();
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewTicketAsync(db, push, "https://test.local", NewTicket());

        await push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default, default);
    }

    [Fact]
    public async Task DispatchNewTicketAsync_AdminWithTwoDevices_SharesOneClaimAcrossBothDevices()
    {
        using var db = NewDb();
        var (admin, _) = SeedAdminWithDevice(db);
        db.UserDevices.Add(new UserDevice { UserId = admin.Id, Endpoint = "https://push.example/admin-ep-2", P256dh = "p", Auth = "a" });
        db.SaveChanges();
        var push = Substitute.For<IPushNotificationService>();
        var claimIds = new System.Collections.Concurrent.ConcurrentBag<Guid?>();
        push.SendAsync(Arg.Any<UserDevice>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(),
                Arg.Do<Guid?>(id => claimIds.Add(id)), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        await PushDispatcher.DispatchNewTicketAsync(db, push, "https://test.local", NewTicket());

        Assert.Equal(2, claimIds.Count);
        var distinct = claimIds.Distinct().ToList(); // båda enheterna delar ETT claimId
        var first = Assert.Single(distinct);
        Assert.NotNull(first);
        var claim = Assert.Single(db.PushDispatchClaims);
        Assert.Equal(admin.Id, claim.UserId);
        Assert.Equal(first, claim.Id);
    }

    [Fact]
    public async Task DispatchNewTicketAsync_FeedbackChannel_UsesFeedbackTitle()
    {
        using var db = NewDb();
        SeedAdminWithDevice(db);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewTicketAsync(db, push, "https://test.local", NewTicket(channel: "feedback"));

        await push.Received(1).SendAsync(
            Arg.Any<UserDevice>(),
            Arg.Is<string>(t => t!.Contains("feedback", StringComparison.OrdinalIgnoreCase)),
            Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    // ── V2-4: mottagarfilter (IsActive / DeletedAt / spärr / radering / IsPublished) ──
    //
    // Varje "orättmätigt" kontotillstånd som inte ska ge push. IsActive=false är
    // den spärrade användaren; DeletedAt är ett GDPR-raderat (anonymiserat) konto;
    // SuspendedAt/DeletionScheduledAt är tidsstämplarna som sätts tillsammans med
    // IsActive=false idag men kontrolleras var för sig så en framtida väg inte
    // läcker push till ett konto på väg bort.
    public static IEnumerable<object[]> IneligibleStates => new[]
    {
        new object[] { "inactive" },
        new object[] { "deleted" },
        new object[] { "suspendedAt" },
        new object[] { "deletionScheduled" },
    };

    private static void MakeIneligible(AppDbContext db, User user, string state)
    {
        switch (state)
        {
            case "inactive": user.IsActive = false; break;
            case "deleted": user.DeletedAt = DateTime.UtcNow; break;
            case "suspendedAt": user.SuspendedAt = DateTime.UtcNow; break;
            case "deletionScheduled": user.DeletionScheduledAt = DateTime.UtcNow.AddHours(24); break;
            default: throw new ArgumentOutOfRangeException(nameof(state), state, null);
        }
        db.SaveChanges();
    }

    private static Task AssertNoPushAsync(IPushNotificationService push) =>
        push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default, default);

    // -- Väg 1: nya händelser --

    [Theory]
    [MemberData(nameof(IneligibleStates))]
    public async Task DispatchNewEventsAsync_IneligibleSubscriber_SendsNothing(string state)
    {
        using var db = NewDb();
        var (user, source, _) = SeedSubscriber(db);
        MakeIneligible(db, user, state);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 2, insertedEvents: []);

        await AssertNoPushAsync(push);
        Assert.Empty(db.NotificationDeliveryLogs);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_UnpublishedSource_SendsNothing()
    {
        using var db = NewDb();
        var (_, source, _) = SeedSubscriber(db, sourcePublished: false);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 2, insertedEvents: []);

        await AssertNoPushAsync(push);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_OnlyEligibleSubscriberOfTwo_GetsPush()
    {
        using var db = NewDb();
        var (suspended, source, _) = SeedSubscriber(db);
        MakeIneligible(db, suspended, "inactive");

        var active = new User { Name = "Bo", Email = $"{Guid.NewGuid()}@example.com", PasswordHash = "x" };
        db.Users.Add(active);
        db.SaveChanges();
        db.UserSourcePreferences.Add(new UserSourcePreference { UserId = active.Id, SourceId = source.Id, IsActive = true, SortOrder = 0 });
        var activeDevice = new UserDevice { UserId = active.Id, Endpoint = "https://push.example/active-ep", P256dh = "p", Auth = "a" };
        db.UserDevices.Add(activeDevice);
        db.SaveChanges();
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1, insertedEvents: []);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == activeDevice.Id),
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
        await push.ReceivedWithAnyArgs(1).SendAsync(default!, default!, default!, default, default, default);
    }

    // Polisen-grenen (bevakningsmatchad) bygger på samma recipientIds — filtret ska
    // gälla även där, inte bara i den generiska grenen.
    [Theory]
    [MemberData(nameof(IneligibleStates))]
    public async Task DispatchNewEventsAsync_PolisenIneligibleSubscriber_SendsNothing(string state)
    {
        using var db = NewDb();
        var (user, source, _) = SeedPolisenSubscriber(db);
        MakeIneligible(db, user, state);
        var events = new List<CanonicalEvent> { MakeEvent(source.Id, "Göteborg", "Trafikolycka") };
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1, insertedEvents: events);

        await AssertNoPushAsync(push);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_PolisenUnpublishedSource_SendsNothing()
    {
        using var db = NewDb();
        var (_, source, _) = SeedPolisenSubscriber(db, sourcePublished: false);
        var events = new List<CanonicalEvent> { MakeEvent(source.Id, "Göteborg", "Trafikolycka") };
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1, insertedEvents: events);

        await AssertNoPushAsync(push);
    }

    // -- Väg 2: ny version --

    [Theory]
    [MemberData(nameof(IneligibleStates))]
    public async Task DispatchNewVersionAsync_IneligibleUser_SendsNothing(string state)
    {
        using var db = NewDb();
        var (user, _, _) = SeedSubscriber(db); // PushNyVersion defaultar till true
        MakeIneligible(db, user, state);
        var push = Substitute.For<IPushNotificationService>();

        var sent = await PushDispatcher.DispatchNewVersionAsync(db, push, "https://test.local", "1.2.0", "Nya källor");

        Assert.Equal(0, sent);
        await AssertNoPushAsync(push);
    }

    // -- Väg 3-5: personalnotiser (nytt ärende, ärendesvar, ny användare) --

    [Theory]
    [MemberData(nameof(IneligibleStates))]
    public async Task DispatchNewTicketAsync_IneligibleStaff_SendsNothing(string state)
    {
        using var db = NewDb();
        var (admin, _) = SeedAdminWithDevice(db);
        MakeIneligible(db, admin, state);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewTicketAsync(db, push, "https://test.local", NewTicket());

        await AssertNoPushAsync(push);
    }

    [Theory]
    [MemberData(nameof(IneligibleStates))]
    public async Task DispatchTicketReplyAsync_IneligibleStaff_SendsNothing(string state)
    {
        using var db = NewDb();
        var (admin, _) = SeedAdminWithDevice(db, role: "Support");
        MakeIneligible(db, admin, state);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchTicketReplyAsync(db, push, "https://test.local", NewTicket());

        await AssertNoPushAsync(push);
    }

    [Theory]
    [MemberData(nameof(IneligibleStates))]
    public async Task DispatchNewUserAsync_IneligibleStaff_SendsNothing(string state)
    {
        using var db = NewDb();
        var (admin, _) = SeedAdminWithDevice(db);
        MakeIneligible(db, admin, state);
        var push = Substitute.For<IPushNotificationService>();
        var newUser = new User { Name = "Ny Person", Email = "ny@example.com", PasswordHash = "x" };

        await PushDispatcher.DispatchNewUserAsync(db, push, "https://test.local", newUser);

        // Kärnan i E3 #5: en avstängd admin ska inte få namn + e-post på nya användare.
        await AssertNoPushAsync(push);
    }

    [Fact]
    public async Task DispatchNewUserAsync_ActiveAdmin_StillGetsPush()
    {
        using var db = NewDb();
        var (_, device) = SeedAdminWithDevice(db);
        var push = Substitute.For<IPushNotificationService>();
        var newUser = new User { Name = "Ny Person", Email = "ny@example.com", PasswordHash = "x" };

        await PushDispatcher.DispatchNewUserAsync(db, push, "https://test.local", newUser);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(),
            Arg.Is<string>(b => b!.Contains("Ny Person") && b.Contains("ny@example.com")),
            Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DispatchTicketReplyAsync_ActiveSupport_StillGetsPush()
    {
        using var db = NewDb();
        var (_, device) = SeedAdminWithDevice(db, role: "Support");
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchTicketReplyAsync(db, push, "https://test.local", NewTicket());

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }
}
