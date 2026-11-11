namespace Samhallsinformation.Tests;

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Xunit;

// E4#5 + E4#10 (V2-8): publika endpoints ska inte läcka interna fält,
// framtida/avslutade eller målgruppsstyrda banderoller.
public class PublicDtoTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private static AppDbContext NewDb() => new(
        new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static ClaimsPrincipal Anonymous() => new(new ClaimsIdentity());

    private static ClaimsPrincipal LoggedIn(string role = "User") => new(
        new ClaimsIdentity(
            new[] { new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()), new Claim("role", role) },
            "TestAuth", nameType: null, roleType: "role"));

    private static MaintenanceBannersController NewBannerController(AppDbContext db, ClaimsPrincipal user) =>
        new(db, Substitute.For<IAktivitetsloggService>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } },
        };

    private static MaintenanceBanner Banner(string message, string audience, TimeSpan startOffset, TimeSpan endOffset) =>
        new()
        {
            Id = Guid.NewGuid(),
            Message = message,
            Audience = audience,
            StartUtc = DateTime.UtcNow + startOffset,
            EndUtc = DateTime.UtcNow + endOffset,
            CreatedAt = DateTime.UtcNow,
        };

    private static async Task<string[]> Messages(MaintenanceBannersController c)
    {
        var ok = Assert.IsType<OkObjectResult>(await c.GetAll());
        var json = JsonSerializer.Serialize(ok.Value, Web);
        return JsonDocument.Parse(json).RootElement.EnumerateArray()
            .Select(e => e.GetProperty("message").GetString()!).ToArray();
    }

    // --- Sources ---

    [Fact]
    public async Task GetSources_PublicResponse_ContainsOnlyPublicFields()
    {
        using var db = NewDb();
        db.Sources.Add(new Source
        {
            Id = 1,
            Name = "Polisen",
            ShortName = "Polisen",
            BaseUrl = "https://polisen.se",
            Url = "https://polisen.se/rss",
            Category = "Blåljus",
            Type = SourceType.RSS,
            IsActive = true,
            IsPublished = true,
            LastFetchedAt = DateTime.UtcNow,
            LastFetchError = "HTTP 500 mot https://intern/detalj",
        });
        db.Sources.Add(new Source { Id = 2, Name = "Dold", ShortName = "Dold", BaseUrl = "x", IsPublished = false });
        await db.SaveChangesAsync();

        var controller = new SourcesController(db, Array.Empty<IIngestor>(),
            Substitute.For<IHttpClientFactory>(), Substitute.For<IAktivitetsloggService>());

        var ok = Assert.IsType<OkObjectResult>(await controller.GetSources());
        var json = JsonSerializer.Serialize(ok.Value, Web);
        var rows = JsonDocument.Parse(json).RootElement.EnumerateArray().ToList();

        var row = Assert.Single(rows);
        var keys = row.EnumerateObject().Select(p => p.Name).OrderBy(n => n).ToArray();
        Assert.Equal(new[] { "id", "isActive", "name", "shortName" }, keys);
        Assert.DoesNotContain("lastFetchError", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("intern/detalj", json);
    }

    // --- Maintenance banners ---

    [Fact]
    public async Task GetAll_ActiveAlla_IsIncluded()
    {
        using var db = NewDb();
        db.MaintenanceBanners.Add(Banner("aktiv", "Alla", TimeSpan.FromHours(-1), TimeSpan.FromHours(1)));
        await db.SaveChangesAsync();

        Assert.Equal(new[] { "aktiv" }, await Messages(NewBannerController(db, Anonymous())));
    }

    [Fact]
    public async Task GetAll_FutureBanner_IsExcluded()
    {
        using var db = NewDb();
        db.MaintenanceBanners.Add(Banner("kommande", "Alla", TimeSpan.FromHours(1), TimeSpan.FromHours(2)));
        await db.SaveChangesAsync();

        Assert.Empty(await Messages(NewBannerController(db, Anonymous())));
    }

    [Fact]
    public async Task GetAll_EndedBanner_IsExcluded()
    {
        using var db = NewDb();
        db.MaintenanceBanners.Add(Banner("avslutad", "Alla", TimeSpan.FromHours(-2), TimeSpan.FromHours(-1)));
        await db.SaveChangesAsync();

        Assert.Empty(await Messages(NewBannerController(db, Anonymous())));
    }

    [Fact]
    public async Task GetAll_AnvandareBanner_NotForAnonymous_ButForLoggedIn()
    {
        using var db = NewDb();
        db.MaintenanceBanners.Add(Banner("bara inloggade", "Användare", TimeSpan.FromHours(-1), TimeSpan.FromHours(1)));
        await db.SaveChangesAsync();

        Assert.Empty(await Messages(NewBannerController(db, Anonymous())));
        Assert.Equal(new[] { "bara inloggade" }, await Messages(NewBannerController(db, LoggedIn())));
        Assert.Equal(new[] { "bara inloggade" }, await Messages(NewBannerController(db, LoggedIn("Admin"))));
    }

    [Fact]
    public async Task GetAll_BesokareBanner_ForAnonymous_NotForLoggedIn()
    {
        using var db = NewDb();
        db.MaintenanceBanners.Add(Banner("bara besökare", "Besökare", TimeSpan.FromHours(-1), TimeSpan.FromHours(1)));
        await db.SaveChangesAsync();

        Assert.Equal(new[] { "bara besökare" }, await Messages(NewBannerController(db, Anonymous())));
        Assert.Empty(await Messages(NewBannerController(db, LoggedIn())));
    }

    [Fact]
    public async Task GetAllAdmin_ReturnsEverything_IncludingFutureEndedAndTargeted()
    {
        using var db = NewDb();
        db.MaintenanceBanners.Add(Banner("kommande", "Användare", TimeSpan.FromHours(1), TimeSpan.FromHours(2)));
        db.MaintenanceBanners.Add(Banner("avslutad", "Alla", TimeSpan.FromHours(-2), TimeSpan.FromHours(-1)));
        db.MaintenanceBanners.Add(Banner("aktiv", "Besökare", TimeSpan.FromHours(-1), TimeSpan.FromHours(1)));
        await db.SaveChangesAsync();

        var ok = Assert.IsType<OkObjectResult>(await NewBannerController(db, LoggedIn("Admin")).GetAllAdmin());
        var rows = JsonDocument.Parse(JsonSerializer.Serialize(ok.Value, Web)).RootElement.GetArrayLength();
        Assert.Equal(3, rows);
    }
}
