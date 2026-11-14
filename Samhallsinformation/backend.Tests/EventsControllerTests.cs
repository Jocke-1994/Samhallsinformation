namespace Samhallsinformation.Tests;

using System.Linq;
using System.Net;
using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Events;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

public class EventsControllerTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static EventsController NewController(AppDbContext db, Guid? callerId = null)
    {
        var identity = callerId.HasValue
            ? new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, callerId.Value.ToString()) }, "TestAuth")
            : new ClaimsIdentity();

        return new EventsController(db, Substitute.For<IHttpClientFactory>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) } },
        };
    }

    private static async Task<Guid> SeedEventAsync(AppDbContext db, bool published = true)
    {
        db.Sources.Add(NewSource(1, "Polisen", published));
        var evt = new CanonicalEvent { SourceId = 1, Title = "x", Content = "x", Url = "https://polisen.se/1" };
        db.Events.Add(evt);
        await db.SaveChangesAsync();
        return evt.Id;
    }

    [Fact]
    public async Task LogShare_Anonymous_WritesLogWithNullUserId()
    {
        using var db = NewDb();
        var eventId = await SeedEventAsync(db);

        var result = await NewController(db).LogShare(eventId);

        Assert.IsType<OkResult>(result);
        var log = Assert.Single(db.EventShareLogs);
        Assert.Equal(eventId, log.EventId);
        Assert.Null(log.UserId);
    }

    [Fact]
    public async Task LogShare_LoggedIn_WritesLogWithUserId()
    {
        using var db = NewDb();
        var eventId = await SeedEventAsync(db);
        var userId = Guid.NewGuid();

        await NewController(db, userId).LogShare(eventId);

        var log = Assert.Single(db.EventShareLogs);
        Assert.Equal(userId, log.UserId);
    }

    // Anonym skrivning: ett påhittat id får inte ge en rad, annars kan vem som
    // helst fylla EventShareLogs och förstöra delningsstatistiken.
    [Fact]
    public async Task LogShare_UnknownEvent_Returns404AndWritesNothing()
    {
        using var db = NewDb();

        var result = await NewController(db).LogShare(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
        Assert.Empty(db.EventShareLogs);
    }

    // Samma synlighetsregel som GET /api/events/{id} (#729): en händelse från en
    // opublicerad källa finns inte utåt och kan inte delas.
    [Fact]
    public async Task LogShare_UnpublishedSource_Returns404AndWritesNothing()
    {
        using var db = NewDb();
        var eventId = await SeedEventAsync(db, published: false);

        var result = await NewController(db).LogShare(eventId);

        Assert.IsType<NotFoundResult>(result);
        Assert.Empty(db.EventShareLogs);
    }

    [Fact]
    public void LogShare_HasOwnRateLimitPolicy()
    {
        var method = typeof(EventsController).GetMethod(nameof(EventsController.LogShare))!;

        Assert.Equal(ShareLogRateLimit.PolicyName, method.GetCustomAttribute<EnableRateLimitingAttribute>()!.PolicyName);
    }

    private static HttpContext FromIp(string ip)
    {
        var ctx = new DefaultHttpContext();
        ctx.Connection.RemoteIpAddress = IPAddress.Parse(ip);
        return ctx;
    }

    [Fact]
    public void ShareLogRateLimit_Allows20PerMinutePerIp()
    {
        Assert.Equal(TimeSpan.FromMinutes(1), ShareLogRateLimit.Window);

        var partition = ShareLogRateLimit.GetPartition(FromIp("203.0.113.5"));
        using var limiter = partition.Factory(partition.PartitionKey);
        var permitted = 0;
        for (var i = 0; i < 100; i++)
        {
            using var lease = limiter.AttemptAcquire();
            if (lease.IsAcquired) permitted++;
        }

        Assert.Equal(20, permitted);
    }

    [Fact]
    public void ShareLogRateLimit_PartitionsPerIp_AndNormalizesIpv6To64()
    {
        Assert.NotEqual(
            ShareLogRateLimit.GetPartition(FromIp("203.0.113.5")).PartitionKey,
            ShareLogRateLimit.GetPartition(FromIp("203.0.113.6")).PartitionKey);
        Assert.Equal(
            ShareLogRateLimit.GetPartition(FromIp("2001:db8:1:2::1")).PartitionKey,
            ShareLogRateLimit.GetPartition(FromIp("2001:db8:1:2:ffff::9")).PartitionKey);
    }

    private static Source NewSource(int id, string shortName, bool published = true) => new()
    {
        Id = id,
        Name = shortName,
        ShortName = shortName,
        BaseUrl = "https://example.se",
        Type = SourceType.RSS,
        IsActive = true,
        IsPublished = published,
    };

    [Fact]
    public async Task SearchPublic_ExcludesUnpublishedSources()
    {
        using var db = NewDb();
        db.Sources.AddRange(NewSource(1, "Polisen"), NewSource(2, "Hemlig", published: false));
        db.Events.AddRange(
            new CanonicalEvent { SourceId = 1, Title = "Trafikolycka, Göteborg", Content = "x", Url = "https://polisen.se/1", Geography = "Göteborg" },
            new CanonicalEvent { SourceId = 2, Title = "Hemlig händelse, Göteborg", Content = "x", Url = "https://hemlig.se/1", Geography = "Göteborg" });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).SearchPublic(geography: "Göteborg"));
        var events = (IEnumerable<object>)result.Value!.GetType().GetProperty("events")!.GetValue(result.Value)!;
        var sourcesSearched = (IEnumerable<string>)result.Value!.GetType().GetProperty("sourcesSearched")!.GetValue(result.Value)!;

        Assert.Single(events);
        Assert.DoesNotContain("Hemlig", sourcesSearched);
        Assert.Contains("Polisen", sourcesSearched);
    }

    [Fact]
    public async Task SearchPublic_GeographyIsFuzzyMatch()
    {
        using var db = NewDb();
        db.Sources.Add(NewSource(1, "Polisen"));
        db.Events.Add(new CanonicalEvent { SourceId = 1, Title = "Trafikolycka, Göteborgs kommun", Content = "x", Url = "https://polisen.se/1", Geography = "Göteborgs kommun" });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).SearchPublic(geography: "Göteborg"));
        var total = (int)result.Value!.GetType().GetProperty("total")!.GetValue(result.Value)!;

        Assert.Equal(1, total);
    }

    [Fact]
    public async Task SearchPublic_Sokord_MatchesTitleOrContent()
    {
        using var db = NewDb();
        db.Sources.Add(NewSource(1, "SMHI"));
        db.Events.Add(new CanonicalEvent { SourceId = 1, Title = "Varning", Content = "Kraftig storm väntas i Skåne", Url = "https://smhi.se/1" });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).SearchPublic(sokord: "storm"));
        var total = (int)result.Value!.GetType().GetProperty("total")!.GetValue(result.Value)!;

        Assert.Equal(1, total);
    }

    [Fact]
    public async Task SearchPublic_ShortNameFilter_ScopesSourcesSearchedToThatSourceOnly()
    {
        using var db = NewDb();
        db.Sources.AddRange(NewSource(1, "Polisen"), NewSource(2, "SMHI"));
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).SearchPublic(shortName: "SMHI"));
        var sourcesSearched = (IEnumerable<string>)result.Value!.GetType().GetProperty("sourcesSearched")!.GetValue(result.Value)!;

        Assert.Equal(new[] { "SMHI" }, sourcesSearched);
    }

    [Fact]
    public async Task SearchPublic_UnknownShortName_ReturnsEmptySourcesSearchedNotAllSources()
    {
        using var db = NewDb();
        db.Sources.Add(NewSource(1, "Polisen"));
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).SearchPublic(shortName: "Finns-inte"));
        var sourcesSearched = (IEnumerable<string>)result.Value!.GetType().GetProperty("sourcesSearched")!.GetValue(result.Value)!;
        var total = (int)result.Value!.GetType().GetProperty("total")!.GetValue(result.Value)!;

        Assert.Empty(sourcesSearched);
        Assert.Equal(0, total);
    }

    [Fact]
    public async Task SearchPublic_ResponseShape_MapsFieldsToBotContract()
    {
        using var db = NewDb();
        db.Sources.Add(NewSource(1, "Polisen"));
        var publishedAt = new DateTime(2026, 9, 13, 14, 0, 0, DateTimeKind.Utc);
        db.Events.Add(new CanonicalEvent
        {
            SourceId = 1,
            Title = "Trafikolycka, Göteborg",
            Content = "En bil voltade.",
            Url = "https://polisen.se/nyheter/1",
            Geography = "Göteborg",
            PublishedAt = publishedAt,
        });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).SearchPublic());
        var events = ((IEnumerable<object>)result.Value!.GetType().GetProperty("events")!.GetValue(result.Value)!).ToList();
        var evt = Assert.Single(events);
        var type = evt.GetType();

        Assert.Equal("Trafikolycka, Göteborg", type.GetProperty("title")!.GetValue(evt));
        Assert.Equal("En bil voltade.", type.GetProperty("content")!.GetValue(evt));
        Assert.Equal("Polisen", type.GetProperty("sourceName")!.GetValue(evt));
        Assert.Equal("https://polisen.se/nyheter/1", type.GetProperty("sourceUrl")!.GetValue(evt));
        Assert.Equal("Göteborg", type.GetProperty("location")!.GetValue(evt));
        Assert.Equal(publishedAt, type.GetProperty("timestamp")!.GetValue(evt));
    }

    [Fact]
    public async Task SearchPublic_DefaultPageSizeIsTen()
    {
        using var db = NewDb();
        db.Sources.Add(NewSource(1, "Polisen"));
        for (var i = 0; i < 15; i++)
            db.Events.Add(new CanonicalEvent { SourceId = 1, Title = $"Händelse {i}", Content = "x", Url = $"https://polisen.se/{i}" });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).SearchPublic());
        var events = (IEnumerable<object>)result.Value!.GetType().GetProperty("events")!.GetValue(result.Value)!;

        Assert.Equal(10, events.Count());
    }

    // ── Publika händelse-endpoints: vad som får gå ut (#729) ──────────────────

    // Vitlistan delas med övriga händelse-endpoints, se EventFaltVitlista.
    private static void AssertEndastTillatnaFalt(object value) => EventFaltVitlista.AssertEndastTillatnaFalt(value);

    [Fact]
    public async Task GetEvent_UnpublishedSource_ReturnsNotFound()
    {
        using var db = NewDb();
        db.Sources.Add(NewSource(2, "Hemlig", published: false));
        var hemlig = new CanonicalEvent { SourceId = 2, Title = "Hemlig händelse", Content = "x", Url = "https://hemlig.se/1" };
        db.Events.Add(hemlig);
        await db.SaveChangesAsync();

        var result = await NewController(db).GetEvent(hemlig.Id);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetEvent_PublishedSource_ReturnsEvent()
    {
        using var db = NewDb();
        db.Sources.Add(NewSource(1, "Polisen"));
        var evt = new CanonicalEvent { SourceId = 1, Title = "Trafikolycka", Content = "x", Url = "https://polisen.se/1" };
        db.Events.Add(evt);
        await db.SaveChangesAsync();

        var result = await NewController(db).GetEvent(evt.Id);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task GetEvent_Json_HasOnlyAllowedFields()
    {
        using var db = NewDb();
        db.Sources.Add(NewSource(1, "Polisen"));
        var evt = new CanonicalEvent { SourceId = 1, Title = "Trafikolycka", Content = "x", Url = "https://polisen.se/1", RawData = "{\"intern\":true}", ExternalId = "p-1" };
        db.Events.Add(evt);
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).GetEvent(evt.Id));

        AssertEndastTillatnaFalt(result.Value!);
    }

    [Fact]
    public async Task GetEvents_Json_EachEventHasOnlyAllowedFields()
    {
        using var db = NewDb();
        db.Sources.Add(NewSource(1, "Polisen"));
        db.Events.Add(new CanonicalEvent { SourceId = 1, Title = "Trafikolycka", Content = "x", Url = "https://polisen.se/1", RawData = "{\"intern\":true}", ExternalId = "p-1" });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).GetEvents(null, null, null, null, null, null));
        var events = (System.Collections.IEnumerable)result.Value!.GetType().GetProperty("events")!.GetValue(result.Value)!;
        var evt = Assert.Single(events.Cast<object>());

        AssertEndastTillatnaFalt(evt);
    }
}
