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
using Xunit;

// Nyhetsbanderollen (Stil/Rubrik/LankUrl) — se Verktyg/Schemalagd-lansering i valvet.
public class MaintenanceBannerStilTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
    private static readonly DateTime Start = DateTime.UtcNow.AddHours(-1);
    private static readonly DateTime Slut  = DateTime.UtcNow.AddHours(1);

    private static AppDbContext NewDb() => new(
        new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static MaintenanceBannersController Controller(AppDbContext db) =>
        new(db, Substitute.For<IAktivitetsloggService>())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) },
            },
        };

    [Fact]
    public async Task Create_WithoutStil_DefaultsToDrift()
    {
        using var db = NewDb();
        await Controller(db).Create(new MaintenanceBannerRequest("Underhåll", Start, Slut, "Alla"));

        var banner = await db.MaintenanceBanners.SingleAsync();
        Assert.Equal("Drift", banner.Stil);
        Assert.Null(banner.Rubrik);
        Assert.Null(banner.LankUrl);
    }

    [Fact]
    public async Task Create_Nyhet_StoresRubrikAndLink_AndPublicGetReturnsThem()
    {
        using var db = NewDb();
        var c = Controller(db);
        Assert.IsType<OkObjectResult>(await c.Create(new MaintenanceBannerRequest(
            "Filtrera på plats", Start, Slut, "Alla", "Nyhet", "  Nytt på Samhällsinformation ", "/uppdateringar")));

        var ok = Assert.IsType<OkObjectResult>(await c.GetAll());
        var rad = JsonDocument.Parse(JsonSerializer.Serialize(ok.Value, Web)).RootElement.EnumerateArray().Single();
        Assert.Equal("Nyhet", rad.GetProperty("stil").GetString());
        Assert.Equal("Nytt på Samhällsinformation", rad.GetProperty("rubrik").GetString());
        Assert.Equal("/uppdateringar", rad.GetProperty("lankUrl").GetString());
    }

    [Fact]
    public async Task Create_BlankRubrikAndLink_StoredAsNull()
    {
        using var db = NewDb();
        await Controller(db).Create(new MaintenanceBannerRequest("Nyhet", Start, Slut, "Alla", "Kommande", "  ", ""));

        var banner = await db.MaintenanceBanners.SingleAsync();
        Assert.Null(banner.Rubrik);
        Assert.Null(banner.LankUrl);
    }

    [Fact]
    public async Task Create_UnknownStil_IsRejected()
    {
        using var db = NewDb();
        var result = await Controller(db).Create(new MaintenanceBannerRequest("x", Start, Slut, "Alla", "Rosa"));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.MaintenanceBanners);
    }

    [Theory]
    [InlineData("https://evil.se")]
    [InlineData("//evil.se")]
    [InlineData("/\\evil.se")]
    [InlineData("javascript:alert(1)")]
    [InlineData("uppdateringar")]
    [InlineData("/\t/evil.se")]
    [InlineData("/\n/evil.se")]
    [InlineData("/ /evil.se")]
    public async Task Create_ExternalOrRelativeLink_IsRejected(string lank)
    {
        using var db = NewDb();
        var result = await Controller(db).Create(new MaintenanceBannerRequest("x", Start, Slut, "Alla", "Nyhet", null, lank));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.MaintenanceBanners);
    }

    [Theory]
    [InlineData("/uppdateringar")]
    [InlineData("/uppdateringar#v0.8:nyheter")]
    [InlineData("/?tid=12:00")]
    public async Task Create_InternalLink_IsAccepted(string lank)
    {
        using var db = NewDb();
        var result = await Controller(db).Create(new MaintenanceBannerRequest("x", Start, Slut, "Alla", "Nyhet", null, lank));

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Create_RubrikWithTrailingColon_IsStoredWithout()
    {
        using var db = NewDb();
        await Controller(db).Create(new MaintenanceBannerRequest("x", Start, Slut, "Alla", " Nyhet ", "Nytt på Samhällsinformation: "));

        var banner = await db.MaintenanceBanners.SingleAsync();
        Assert.Equal("Nyhet", banner.Stil);
        Assert.Equal("Nytt på Samhällsinformation", banner.Rubrik);
    }

    [Fact]
    public async Task Update_FromOldClientWithoutStil_KeepsStoredStilRubrikAndLink()
    {
        using var db = NewDb();
        var c = Controller(db);
        await c.Create(new MaintenanceBannerRequest("Filtrera på plats", Start, Slut, "Alla", "Kommande", "Kommer 15 oktober", "/uppdateringar"));
        var id = (await db.MaintenanceBanners.SingleAsync()).Id;

        Assert.IsType<OkObjectResult>(await c.Update(id, new MaintenanceBannerRequest("Filtrera på plats!", Start, Slut, "Alla")));

        var banner = await db.MaintenanceBanners.SingleAsync();
        Assert.Equal("Filtrera på plats!", banner.Message);
        Assert.Equal("Kommande", banner.Stil);
        Assert.Equal("Kommer 15 oktober", banner.Rubrik);
        Assert.Equal("/uppdateringar", banner.LankUrl);
    }

    [Fact]
    public async Task Update_ChangesStilRubrikAndLink()
    {
        using var db = NewDb();
        var c = Controller(db);
        await c.Create(new MaintenanceBannerRequest("Filtrera på plats", Start, Slut, "Alla", "Kommande", "Kommer 15 oktober", "/uppdateringar"));
        var id = (await db.MaintenanceBanners.SingleAsync()).Id;

        Assert.IsType<OkObjectResult>(await c.Update(id, new MaintenanceBannerRequest(
            "Filtrera på plats", Start, Slut, "Alla", "Nyhet", "Nytt på Samhällsinformation", "/uppdateringar")));

        var banner = await db.MaintenanceBanners.SingleAsync();
        Assert.Equal("Nyhet", banner.Stil);
        Assert.Equal("Nytt på Samhällsinformation", banner.Rubrik);
    }
}
