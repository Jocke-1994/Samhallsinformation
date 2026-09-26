namespace Samhallsinformation.Tests;

using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Samhallsinformation.Application.Feed;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

// V3-11 (beslut D2): Mitt flöde och Sparat filtreras på servern. SQLite via TestDb
// eftersom unika index (Events, SourceId+ExternalId) och FK:er ska vara på riktigt.
public class UserFeedTests
{
    private static readonly DateTime Nu = DateTime.UtcNow;

    private static UserFeedService NewService(AppDbContext db) => new(db, TimeProvider.System);

    private static async Task<User> NewUser(AppDbContext db)
    {
        var user = new User { Name = "Test", Email = $"{Guid.NewGuid()}@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private static async Task<Source> NewSource(AppDbContext db, string shortName, bool published = true)
    {
        var source = new Source { Name = shortName, ShortName = shortName, BaseUrl = "https://example.com", IsActive = true, IsPublished = published };
        db.Sources.Add(source);
        await db.SaveChangesAsync();
        return source;
    }

    private static async Task Prenumerera(AppDbContext db, User user, Source source, bool active = true)
    {
        db.UserSourcePreferences.Add(new UserSourcePreference { UserId = user.Id, SourceId = source.Id, IsActive = active });
        await db.SaveChangesAsync();
    }

    private static CanonicalEvent Ev(Source s, DateTime publishedAt, string? eventType = null, string? geography = null, string? title = null) => new()
    {
        SourceId = s.Id, ExternalId = Guid.NewGuid().ToString(), Title = title ?? $"{s.ShortName} {publishedAt:O}",
        Content = "x", Url = "https://example.com/x", RawData = "", PublishedAt = publishedAt,
        EventType = eventType, Geography = geography,
    };

    private static async Task<List<CanonicalEvent>> Lagg(AppDbContext db, params CanonicalEvent[] events)
    {
        db.Events.AddRange(events);
        await db.SaveChangesAsync();
        return events.ToList();
    }

    private static async Task Bevaka(AppDbContext db, User user, string[]? kategorier, string[]? omraden)
    {
        db.PolisenBevakningar.Add(new PolisenBevakning
        {
            UserId = user.Id,
            KategorierJson = kategorier == null ? null : JsonSerializer.Serialize(kategorier),
            OmradenJson = omraden == null ? null : JsonSerializer.Serialize(omraden),
        });
        await db.SaveChangesAsync();
    }

    private static DateTime Min(int minutesAgo) => Nu.AddMinutes(-minutesAgo);

    // ---------------------------------------------------------------- källfilter

    [Fact]
    public async Task Mitt_OnlySubscribedSourcesEvents()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var a = await NewSource(db, "A"); var b = await NewSource(db, "B");
        await Prenumerera(db, user, a);
        var ea = await Lagg(db, Ev(a, Min(5)), Ev(a, Min(10)));
        await Lagg(db, Ev(b, Min(1)));

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        Assert.Equal(ea.Select(e => e.Id).ToHashSet(), sida.Events.Select(e => e.Id).ToHashSet());
        Assert.Equal(2, sida.Total);
    }

    [Fact]
    public async Task Mitt_UnpublishedSource_IsExcluded_EvenIfSubscribed()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var oppen = await NewSource(db, "Oppen"); var sandlada = await NewSource(db, "Sandlada", published: false);
        await Prenumerera(db, user, oppen); await Prenumerera(db, user, sandlada);
        await Lagg(db, Ev(oppen, Min(5)), Ev(sandlada, Min(1)));

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        var e = Assert.Single(sida.Events);
        Assert.Equal(oppen.Id, e.SourceId);
    }

    [Fact]
    public async Task Mitt_InactivePreference_IsExcluded()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var a = await NewSource(db, "A"); var b = await NewSource(db, "B");
        await Prenumerera(db, user, a, active: true); await Prenumerera(db, user, b, active: false);
        await Lagg(db, Ev(a, Min(5)), Ev(b, Min(1)));

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        Assert.Equal(a.Id, Assert.Single(sida.Events).SourceId);
    }

    [Fact]
    public async Task Mitt_NoSubscriptions_IsEmptyAndExact()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var a = await NewSource(db, "A");
        await Lagg(db, Ev(a, Min(5)));

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        Assert.Empty(sida.Events);
        Assert.Equal(0, sida.Total);
        Assert.False(sida.HasMore);
        Assert.True(sida.TotalExakt);
    }

    [Fact]
    public async Task Mitt_OtherUsersPreferencesDoNotLeak()
    {
        using var db = TestDb.Create();
        var jag = await NewUser(db); var annan = await NewUser(db);
        var a = await NewSource(db, "A"); var b = await NewSource(db, "B");
        await Prenumerera(db, jag, a); await Prenumerera(db, annan, b);
        await Lagg(db, Ev(a, Min(5)), Ev(b, Min(1)));

        var sida = await NewService(db).GetMittFlodeAsync(jag.Id, 1, 20);

        Assert.Equal(a.Id, Assert.Single(sida.Events).SourceId);
    }

    // Kärnbuggen (E5#1): en sällsynt källa vars händelser ligger utanför de 50 senaste
    // överallt (klienten hämtade bara en sida om 50 från alla källor) syns ändå.
    [Fact]
    public async Task Mitt_RareSourceOutsideNewest50_IsStillShown()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var stor = await NewSource(db, "Stor"); var sallsynt = await NewSource(db, "Sallsynt");
        await Prenumerera(db, user, sallsynt);
        await Lagg(db, Enumerable.Range(0, 120).Select(i => Ev(stor, Min(i + 1))).ToArray());
        var rara = await Lagg(db, Ev(sallsynt, Min(500)), Ev(sallsynt, Min(600)), Ev(sallsynt, Min(700)));

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 50);

        Assert.Equal(rara.Select(e => e.Id).ToHashSet(), sida.Events.Select(e => e.Id).ToHashSet());
        Assert.Equal(3, sida.Total);
    }

    // ---------------------------------------------------------------- Polisen-bevakningar

    [Fact]
    public async Task Mitt_PolisenWithBevakning_MatchesTypeAndArea_ExcludesTheRest()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var polisen = await NewSource(db, "Polisen");
        await Prenumerera(db, user, polisen);
        await Bevaka(db, user, ["Stöld"], ["Uppsala"]);
        var traff = (await Lagg(db, Ev(polisen, Min(5), "Stöld, försök", "Uppsala")))[0];
        await Lagg(db,
            Ev(polisen, Min(6), "Stöld", "Göteborg"),        // fel område
            Ev(polisen, Min(7), "Misshandel", "Uppsala"),    // fel typ
            Ev(polisen, Min(8), "Misshandel", "Göteborg"));  // båda fel

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        Assert.Equal(traff.Id, Assert.Single(sida.Events).Id);
    }

    [Fact]
    public async Task Mitt_PolisenMatchingIsOrAcrossBevakningar_AndAndWithinOne()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var polisen = await NewSource(db, "Polisen");
        await Prenumerera(db, user, polisen);
        await Bevaka(db, user, ["Stöld"], ["Uppsala"]);
        await Bevaka(db, user, ["Brand"], null);
        var stoldUppsala = Ev(polisen, Min(1), "Stöld", "Uppsala");
        var brandGbg = Ev(polisen, Min(2), "Brand", "Göteborg");
        var stoldGbg = Ev(polisen, Min(3), "Stöld", "Göteborg");
        await Lagg(db, stoldUppsala, brandGbg, stoldGbg);

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        Assert.Equal(new[] { stoldUppsala.Id, brandGbg.Id }, sida.Events.Select(e => e.Id).ToArray());
    }

    // Läns-medveten matchning av Polisens sammanfattningar (geografi = ett helt län),
    // samma som klientens matcharLän gjorde och som admins ExplainEvent använder.
    [Fact]
    public async Task Mitt_PolisenSammanfattning_MatchesViaLan()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var polisen = await NewSource(db, "Polisen");
        await Prenumerera(db, user, polisen);
        await Bevaka(db, user, null, ["Uppsala"]);
        var uppsalaLan = Ev(polisen, Min(1), "Sammanfattning natt", "Uppsala län");
        var skaneLan = Ev(polisen, Min(2), "Sammanfattning natt", "Skåne län");
        await Lagg(db, uppsalaLan, skaneLan);

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        Assert.Equal(uppsalaLan.Id, Assert.Single(sida.Events).Id);
    }

    [Fact]
    public async Task Mitt_PolisenWithoutBevakningar_ShowsAllPolisen_EvenOld()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var polisen = await NewSource(db, "Polisen");
        await Prenumerera(db, user, polisen);
        await Lagg(db,
            Ev(polisen, Min(5), "Stöld", "Uppsala"),
            Ev(polisen, Min(6), "Brand", "Göteborg"),
            Ev(polisen, Nu.AddDays(-90), "Rån", "Malmö")); // äldre än bevakningsfönstret, men inget filter gäller

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        Assert.Equal(3, sida.Total);
        Assert.Equal(3, sida.Events.Count);
    }

    [Fact]
    public async Task Mitt_BevakningOnlyFiltersPolisen_OtherSourcesUnaffected()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var polisen = await NewSource(db, "Polisen"); var krisen = await NewSource(db, "Krisinformation");
        await Prenumerera(db, user, polisen); await Prenumerera(db, user, krisen);
        await Bevaka(db, user, ["Brand"], ["Uppsala"]);
        var kris = Ev(krisen, Min(10), null, "Malmö");
        await Lagg(db, kris, Ev(polisen, Min(5), "Stöld", "Malmö"));

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        Assert.Equal(kris.Id, Assert.Single(sida.Events).Id);
    }

    [Fact]
    public async Task Mitt_BevakningButPolisenNotSubscribed_ShowsNoPolisen()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var polisen = await NewSource(db, "Polisen"); var krisen = await NewSource(db, "Krisinformation");
        await Prenumerera(db, user, krisen);
        await Bevaka(db, user, null, null);
        await Lagg(db, Ev(polisen, Min(1), "Stöld", "Uppsala"), Ev(krisen, Min(2)));

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        Assert.Equal(krisen.Id, Assert.Single(sida.Events).SourceId);
    }

    [Fact]
    public async Task Mitt_OtherUsersBevakningarDoNotAffectMe()
    {
        using var db = TestDb.Create();
        var jag = await NewUser(db); var annan = await NewUser(db);
        var polisen = await NewSource(db, "Polisen");
        await Prenumerera(db, jag, polisen);
        await Bevaka(db, annan, ["Brand"], ["Uppsala"]);
        await Lagg(db, Ev(polisen, Min(1), "Stöld", "Malmö"));

        var sida = await NewService(db).GetMittFlodeAsync(jag.Id, 1, 20);

        Assert.Single(sida.Events); // jag har inga bevakningar -> all Polisen
    }

    [Fact]
    public async Task Mitt_BevakningMode_PolisenOlderThanWindow_IsNotMatched()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var polisen = await NewSource(db, "Polisen");
        await Prenumerera(db, user, polisen);
        await Bevaka(db, user, ["Stöld"], null);
        var ny = Ev(polisen, Nu.AddDays(-(UserFeedService.PolisenFonsterDagar - 1)), "Stöld", "Malmö");
        await Lagg(db, ny, Ev(polisen, Nu.AddDays(-(UserFeedService.PolisenFonsterDagar + 1)), "Stöld", "Malmö"));

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        Assert.Equal(ny.Id, Assert.Single(sida.Events).Id);
    }

    // Snäv bevakning: matchande Polisen-händelser ligger bakom fler icke-matchande än en
    // hel skanningsbatch. De ska ändå hittas (klienten hade aldrig sett dem).
    [Fact]
    public async Task Mitt_NarrowBevakning_FindsMatchesBehindMoreThanOneBatchOfNonMatches()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var polisen = await NewSource(db, "Polisen");
        await Prenumerera(db, user, polisen);
        await Bevaka(db, user, ["Rån"], ["Kiruna"]);
        var brus = Enumerable.Range(0, UserFeedService.BatchStorlek * 2 + 50)
            .Select(i => Ev(polisen, Min(i + 1), "Trafikbrott", "Stockholm")).ToArray();
        await Lagg(db, brus);
        var traffar = await Lagg(db, Ev(polisen, Min(5000), "Rån", "Kiruna"), Ev(polisen, Min(6000), "Rån", "Kiruna"));

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 20);

        Assert.Equal(traffar.Select(e => e.Id).ToHashSet(), sida.Events.Select(e => e.Id).ToHashSet());
        Assert.Equal(2, sida.Total);
        Assert.False(sida.HasMore);
        Assert.True(sida.TotalExakt); // skanningen nådde slutet
    }

    // ---------------------------------------------------------------- paginering

    [Fact]
    public async Task Mitt_Pagination_NoBevakning_PagesAreDisjoint_TotalExact()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var a = await NewSource(db, "A");
        await Prenumerera(db, user, a);
        await Lagg(db, Enumerable.Range(0, 25).Select(i => Ev(a, Min(i + 1))).ToArray());
        var svc = NewService(db);

        var s1 = await svc.GetMittFlodeAsync(user.Id, 1, 10);
        var s2 = await svc.GetMittFlodeAsync(user.Id, 2, 10);
        var s3 = await svc.GetMittFlodeAsync(user.Id, 3, 10);

        Assert.Equal([10, 10, 5], new[] { s1.Events.Count, s2.Events.Count, s3.Events.Count });
        Assert.All(new[] { s1, s2, s3 }, s => Assert.Equal(25, s.Total));
        Assert.Equal([true, true, false], new[] { s1.HasMore, s2.HasMore, s3.HasMore });
        var alla = s1.Events.Concat(s2.Events).Concat(s3.Events).Select(e => e.Id).ToList();
        Assert.Equal(25, alla.Distinct().Count());
        Assert.Equal(alla.OrderBy(id => id).Count(), alla.Count);
        // nyast först över sidgränserna
        var tider = s1.Events.Concat(s2.Events).Concat(s3.Events).Select(e => e.PublishedAt).ToList();
        Assert.Equal(tider.OrderByDescending(t => t), tider);
    }

    [Fact]
    public async Task Mitt_Pagination_IdenticalTimestamps_NoDuplicatesAcrossPages()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var a = await NewSource(db, "A");
        await Prenumerera(db, user, a);
        var samma = Min(3);
        await Lagg(db, Enumerable.Range(0, 12).Select(_ => Ev(a, samma)).ToArray());
        var svc = NewService(db);

        var ids = new List<Guid>();
        for (var p = 1; p <= 3; p++) ids.AddRange((await svc.GetMittFlodeAsync(user.Id, p, 5)).Events.Select(e => e.Id));

        Assert.Equal(12, ids.Distinct().Count());
        Assert.Equal(12, ids.Count);
    }

    [Fact]
    public async Task Mitt_Pagination_BevakningMode_PagesCompleteWithoutDuplicates()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var polisen = await NewSource(db, "Polisen"); var krisen = await NewSource(db, "Krisinformation");
        await Prenumerera(db, user, polisen); await Prenumerera(db, user, krisen);
        await Bevaka(db, user, ["Brand"], null);
        var forvantade = new List<CanonicalEvent>();
        for (var i = 0; i < 40; i++)
        {
            forvantade.AddRange(await Lagg(db, Ev(polisen, Min(i * 3 + 1), "Brand", "Uppsala")));
            await Lagg(db, Ev(polisen, Min(i * 3 + 2), "Stöld", "Uppsala")); // matchar inte
            forvantade.AddRange(await Lagg(db, Ev(krisen, Min(i * 3 + 3))));
        }
        var svc = NewService(db);

        var ids = new List<Guid>();
        FeedPage sida;
        var p = 0;
        do { sida = await svc.GetMittFlodeAsync(user.Id, ++p, 15); ids.AddRange(sida.Events.Select(e => e.Id)); }
        while (sida.HasMore && p < 20);

        Assert.Equal(forvantade.Select(e => e.Id).ToHashSet(), ids.ToHashSet());
        Assert.Equal(80, ids.Count);
        Assert.Equal(6, p); // 80 träffar, 15 per sida
        Assert.True(sida.TotalExakt);
        Assert.Equal(80, sida.Total);
    }

    [Fact]
    public async Task Mitt_BevakningMode_TotalIsLowerBound_WhenMoreThanAPageRemainsUnscanned()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var polisen = await NewSource(db, "Polisen");
        await Prenumerera(db, user, polisen);
        await Bevaka(db, user, ["Brand"], null);
        var antal = UserFeedService.BatchStorlek * 2 + 30;
        await Lagg(db, Enumerable.Range(0, antal).Select(i => Ev(polisen, Min(i + 1), "Brand", "Uppsala")).ToArray());

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 1, 10);

        Assert.Equal(10, sida.Events.Count);
        Assert.True(sida.HasMore);
        Assert.False(sida.TotalExakt);
        Assert.InRange(sida.Total, 11, antal); // nedre gräns, aldrig mer än verkligheten
    }

    [Fact]
    public async Task Mitt_PageSizeIsClampedTo100_AndPageBelow1Becomes1()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var a = await NewSource(db, "A");
        await Prenumerera(db, user, a);
        await Lagg(db, Enumerable.Range(0, 130).Select(i => Ev(a, Min(i + 1))).ToArray());

        var sida = await NewService(db).GetMittFlodeAsync(user.Id, 0, 5000);

        Assert.Equal(1, sida.Page);
        Assert.Equal(100, sida.PageSize);
        Assert.Equal(100, sida.Events.Count);
        Assert.True(sida.HasMore);
    }

    // ---------------------------------------------------------------- Sparat

    [Fact]
    public async Task Sparat_ReturnsOldSavedEvents_BeyondNewest50()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var a = await NewSource(db, "A");
        await Lagg(db, Enumerable.Range(0, 120).Select(i => Ev(a, Min(i + 1))).ToArray());
        var gammal = (await Lagg(db, Ev(a, Nu.AddDays(-200))))[0];
        db.UserSavedEvents.Add(new UserSavedEvent { UserId = user.Id, EventId = gammal.Id });
        await db.SaveChangesAsync();

        var sida = await NewService(db).GetSparatAsync(user.Id, 1, 20);

        Assert.Equal(gammal.Id, Assert.Single(sida.Events).Id);
        Assert.Equal(1, sida.Total);
    }

    [Fact]
    public async Task Sparat_OnlyMine_NewestFirst_ExcludesUnpublishedSources_Paginates()
    {
        using var db = TestDb.Create();
        var jag = await NewUser(db); var annan = await NewUser(db);
        var a = await NewSource(db, "A"); var dold = await NewSource(db, "Dold", published: false);
        var mina = await Lagg(db, Enumerable.Range(0, 7).Select(i => Ev(a, Min(i + 1))).ToArray());
        var doldEv = (await Lagg(db, Ev(dold, Min(1))))[0];
        var annansEv = (await Lagg(db, Ev(a, Min(1))))[0];
        foreach (var e in mina.Append(doldEv)) db.UserSavedEvents.Add(new UserSavedEvent { UserId = jag.Id, EventId = e.Id });
        db.UserSavedEvents.Add(new UserSavedEvent { UserId = annan.Id, EventId = annansEv.Id });
        await db.SaveChangesAsync();
        var svc = NewService(db);

        var s1 = await svc.GetSparatAsync(jag.Id, 1, 4);
        var s2 = await svc.GetSparatAsync(jag.Id, 2, 4);

        Assert.Equal(7, s1.Total);
        Assert.True(s1.HasMore); Assert.False(s2.HasMore);
        var ids = s1.Events.Concat(s2.Events).Select(e => e.Id).ToList();
        Assert.Equal(mina.OrderByDescending(e => e.PublishedAt).Select(e => e.Id).ToList(), ids);
        Assert.DoesNotContain(doldEv.Id, ids);
        Assert.DoesNotContain(annansEv.Id, ids);
    }

    [Fact]
    public async Task Sparat_Nothing_IsEmpty()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);

        var sida = await NewService(db).GetSparatAsync(user.Id, 1, 20);

        Assert.Empty(sida.Events);
        Assert.Equal(0, sida.Total);
    }

    // ---------------------------------------------------------------- endpoints

    private static UserFeedController NewController(AppDbContext db, Guid userId) => new(NewService(db))
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "TestAuth")),
            },
        },
    };

    [Fact]
    public async Task Controller_ReturnsSameShapeAsEvents_PlusHasMore()
    {
        using var db = TestDb.Create();
        var user = await NewUser(db);
        var a = await NewSource(db, "A");
        await Prenumerera(db, user, a);
        await Lagg(db, Ev(a, Min(1)));

        var ok = Assert.IsType<OkObjectResult>(await NewController(db, user.Id).Get(1, 20));

        var json = JsonSerializer.Serialize(ok.Value);
        using var doc = JsonDocument.Parse(json);
        var rot = doc.RootElement;
        Assert.Equal(1, rot.GetProperty("total").GetInt32());
        Assert.Equal(1, rot.GetProperty("page").GetInt32());
        Assert.Equal(20, rot.GetProperty("pageSize").GetInt32());
        Assert.Equal(1, rot.GetProperty("events").GetArrayLength());
        Assert.False(rot.GetProperty("hasMore").GetBoolean());
    }

    // Anonym -> 401: [Authorize] på hela klassen (ASP.NET Cores auktoriseringsmiddleware
    // svarar 401 innan action körs). Guarden i AnonymousEndpointsGuardTests fångar om det tas bort.
    [Theory]
    [InlineData(typeof(UserFeedController))]
    [InlineData(typeof(UserSavedEventsController))]
    public void UserFeedEndpoints_RequireAuthorization(Type controller)
    {
        Assert.NotNull(controller.GetCustomAttribute<AuthorizeAttribute>());
        Assert.Null(controller.GetCustomAttribute<AllowAnonymousAttribute>());
        Assert.Null(controller.GetMethods().Select(m => m.GetCustomAttribute<AllowAnonymousAttribute>()).FirstOrDefault(a => a != null));
    }

    // Bakåtkompatibelt: det publika händelseanropet är orört och ignorerar användarens
    // prenumerationer (cachade klienter fortsätter fungera).
    [Fact]
    public async Task PublicEvents_Unchanged_ReturnsAllPublishedEvents_RegardlessOfSubscriptions()
    {
        using var db = TestDb.Create();
        var a = await NewSource(db, "A"); var b = await NewSource(db, "B"); var dold = await NewSource(db, "Dold", published: false);
        await Lagg(db, Ev(a, Min(1)), Ev(b, Min(2)), Ev(dold, Min(3)));
        var controller = new EventsController(db, NSubstitute.Substitute.For<IHttpClientFactory>());

        var ok = Assert.IsType<OkObjectResult>(await controller.GetEvents(null, null, null, null, null, null));

        var total = (int)ok.Value!.GetType().GetProperty("total")!.GetValue(ok.Value)!;
        Assert.Equal(2, total);
    }
}
