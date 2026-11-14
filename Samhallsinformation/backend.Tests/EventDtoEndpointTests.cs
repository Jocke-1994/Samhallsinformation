namespace Samhallsinformation.Tests;

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Feed;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

// #729, resten: Mitt flöde, Sparat och platsfiltret skickade hela CanonicalEvent
// (med RawData, ExternalId, IngestedAt, UpdatedAt). Platsfiltret är dessutom
// publikt, så vem som helst kunde läsa källornas råa svar. Alla tre ska bara
// skicka vitlistan i EventDto, samma som /api/events sedan PR #742.
public class EventDtoEndpointTests
{
    private static AppDbContext NewDb() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    // Fyllt med allt som INTE får gå ut, så ett läckage syns direkt.
    private static CanonicalEvent FullHändelse(int sourceId = 1) => new()
    {
        SourceId = sourceId,
        Title = "Trafikolycka",
        Content = "x",
        Url = "https://polisen.se/1",
        RawData = "{\"intern\":true}",
        ExternalId = "p-1",
        IsNational = true,
        PublishedAt = DateTime.UtcNow.AddMinutes(-5),
        UpdatedAt = DateTime.UtcNow,
    };

    private static FeedPage SidaMed(CanonicalEvent e) => new(1, 1, 20, [e], false, true);

    private static ControllerContext InloggadSom(Guid userId) => new()
    {
        HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "test")),
        },
    };

    private static List<JsonElement> Händelser(JsonElement svar, string fält = "events") =>
        svar.GetProperty(fält).EnumerateArray().ToList();

    [Fact]
    public async Task MittFlode_Json_EachEventHasOnlyAllowedFields()
    {
        var userId = Guid.NewGuid();
        var feed = Substitute.For<IUserFeedService>();
        feed.GetMittFlodeAsync(userId, 1, 20, Arg.Any<CancellationToken>()).Returns(SidaMed(FullHändelse()));
        var controller = new UserFeedController(feed) { ControllerContext = InloggadSom(userId) };

        var result = Assert.IsType<OkObjectResult>(await controller.Get());

        var händelser = Händelser(EventFaltVitlista.TillJson(result.Value!));
        Assert.Single(händelser);
        EventFaltVitlista.AssertEndastTillatnaFalt(händelser[0]);
    }

    [Fact]
    public async Task Sparat_Json_EachEventHasOnlyAllowedFields()
    {
        var userId = Guid.NewGuid();
        using var db = NewDb();
        var feed = Substitute.For<IUserFeedService>();
        feed.GetSparatAsync(userId, 1, 20, Arg.Any<CancellationToken>()).Returns(SidaMed(FullHändelse()));
        var controller = new UserSavedEventsController(db, feed) { ControllerContext = InloggadSom(userId) };

        var result = Assert.IsType<OkObjectResult>(await controller.GetEvents());

        var händelser = Händelser(EventFaltVitlista.TillJson(result.Value!));
        Assert.Single(händelser);
        EventFaltVitlista.AssertEndastTillatnaFalt(händelser[0]);
    }

    [Fact]
    public async Task Platsfiltret_Json_EachEventHasOnlyAllowedFields()
    {
        using var db = NewDb();
        db.Sources.Add(new Source { Id = 1, Name = "Polisen", ShortName = "Polisen", BaseUrl = "https://polisen.se", IsPublished = true });
        db.Events.Add(FullHändelse());
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await new PlatserController(db).GetHändelserForPlatser("Nationellt"));

        var sektioner = EventFaltVitlista.TillJson(result.Value!).EnumerateArray().ToList();
        var händelser = Händelser(Assert.Single(sektioner), "handelser");
        Assert.Single(händelser);
        EventFaltVitlista.AssertEndastTillatnaFalt(händelser[0]);
    }
}
