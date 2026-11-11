namespace Samhallsinformation.Tests;

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

// V3-17 (E4#6): storleks- och längdgränser för Polisen-bevakningar. Gränserna
// gäller vid skapa/ändra — redan sparade, för stora rader ska fortfarande gå
// att läsa (och ändra till något giltigt).
public class PolisenBevakningGranserTests
{
    private static AppDbContext NewDb() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);

    private static UserPolisenBevakningController NewController(AppDbContext db, Guid userId) => new(db)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "TestAuth")),
            },
        },
    };

    private static string Message(IActionResult result) =>
        Assert.IsType<string>(Assert.IsType<BadRequestObjectResult>(result).Value);

    private static BevakningResponse Ok(IActionResult result) =>
        Assert.IsType<BevakningResponse>(Assert.IsType<OkObjectResult>(result).Value);

    private static async Task<PolisenBevakning> Seed(AppDbContext db, Guid userId, string? kategorierJson = null, string? omradenJson = null)
    {
        var b = new PolisenBevakning { UserId = userId, KategorierJson = kategorierJson, OmradenJson = omradenJson };
        db.PolisenBevakningar.Add(b);
        await db.SaveChangesAsync();
        return b;
    }

    private static List<string> Repeat(string v, int n) => Enumerable.Repeat(v, n).ToList();

    // ── Max antal bevakningar (serverregel) ──────────────────────────────

    [Fact]
    public async Task Create_OverMaxBevakningar_Returns400()
    {
        using var db = NewDb();
        var userId = Guid.NewGuid();
        for (var i = 0; i < UserPolisenBevakningController.MaxBevakningar; i++) await Seed(db, userId);

        var result = await NewController(db, userId).Create(new(["Stöld"], ["Kungälv"]));

        Assert.Contains("Max 5", Message(result));
        Assert.Equal(UserPolisenBevakningController.MaxBevakningar, await db.PolisenBevakningar.CountAsync());
    }

    [Fact]
    public async Task Create_ExactlyMaxBevakningar_Succeeds()
    {
        using var db = NewDb();
        var userId = Guid.NewGuid();
        for (var i = 0; i < UserPolisenBevakningController.MaxBevakningar - 1; i++) await Seed(db, userId);

        var result = await NewController(db, userId).Create(new(["Stöld"], ["Kungälv"]));

        Ok(result);
        Assert.Equal(UserPolisenBevakningController.MaxBevakningar, await db.PolisenBevakningar.CountAsync());
    }

    // ── Antal poster per lista ───────────────────────────────────────────

    [Fact]
    public async Task Create_TooManyKategorier_Returns400_AndSavesNothing()
    {
        using var db = NewDb();

        var result = await NewController(db, Guid.NewGuid())
            .Create(new(Repeat("Stöld", PolisenBevakningValidator.MaxKategorierIRequest + 1), null));

        Assert.Contains("kategorier", Message(result));
        Assert.Empty(await db.PolisenBevakningar.ToListAsync());
    }

    [Fact]
    public async Task Create_TooManyOmraden_Returns400_AndSavesNothing()
    {
        using var db = NewDb();

        var result = await NewController(db, Guid.NewGuid())
            .Create(new(null, Repeat("Kungälv", PolisenBevakningValidator.MaxOmradenIRequest + 1)));

        Assert.Contains("områden", Message(result));
        Assert.Empty(await db.PolisenBevakningar.ToListAsync());
    }

    [Fact]
    public async Task Create_MegabyteSizedList_Returns400_WithoutSaving()
    {
        // Själva scenariot i E4#6: en enorm lista ska aldrig nå databasen.
        using var db = NewDb();

        var result = await NewController(db, Guid.NewGuid()).Create(new(null, Repeat("Kungälv", 200_000)));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(await db.PolisenBevakningar.ToListAsync());
    }

    // ── Strängar: längd, tomma, okända ───────────────────────────────────

    [Fact]
    public async Task Create_TooLongString_Returns400()
    {
        using var db = NewDb();

        var result = await NewController(db, Guid.NewGuid())
            .Create(new(null, [new string('x', PolisenBevakningValidator.MaxStrangLangd + 1)]));

        Assert.Contains("för långt", Message(result));
        Assert.Empty(await db.PolisenBevakningar.ToListAsync());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t")]
    public async Task Create_EmptyOrWhitespaceValue_Returns400(string tomt)
    {
        using var db = NewDb();
        var controller = NewController(db, Guid.NewGuid());

        Assert.Contains("tomma", Message(await controller.Create(new([tomt], null))));
        Assert.Contains("tomma", Message(await controller.Create(new(null, ["Kungälv", tomt]))));
        Assert.Empty(await db.PolisenBevakningar.ToListAsync());
    }

    [Fact]
    public async Task Create_NullEntryInList_Returns400_NotException()
    {
        using var db = NewDb();

        var result = await NewController(db, Guid.NewGuid()).Create(new(["Stöld", null!], null));

        Assert.Contains("tomma", Message(result));
    }

    [Fact]
    public async Task Create_UnknownKategori_Returns400()
    {
        using var db = NewDb();

        var result = await NewController(db, Guid.NewGuid()).Create(new(["Stöld", "Påhittad kategori"], null));

        Assert.Contains("Påhittad kategori", Message(result));
        Assert.Empty(await db.PolisenBevakningar.ToListAsync());
    }

    [Fact]
    public async Task Create_UnknownOmrade_Returns400()
    {
        using var db = NewDb();

        var result = await NewController(db, Guid.NewGuid()).Create(new(null, ["Kungälv", "Atlantis"]));

        Assert.Contains("Atlantis", Message(result));
        Assert.Empty(await db.PolisenBevakningar.ToListAsync());
    }

    // ── Dedupe, null-semantik, legitima stora val ────────────────────────

    [Fact]
    public async Task Create_Duplicates_AreDeduplicated_KeepingFirstOrder()
    {
        using var db = NewDb();

        var result = await NewController(db, Guid.NewGuid())
            .Create(new(["Stöld", "Brand", "Stöld", " Brand "], ["Kungälv", "Kungälv", "Stenungsund"]));

        var dto = Ok(result);
        Assert.Equal(["Stöld", "Brand"], dto.Kategorier);
        Assert.Equal(["Kungälv", "Stenungsund"], dto.Omraden);
        var saved = await db.PolisenBevakningar.SingleAsync();
        Assert.Equal(["Kungälv", "Stenungsund"], JsonSerializer.Deserialize<List<string>>(saved.OmradenJson!));
    }

    [Fact]
    public async Task Create_NullLists_StayNull_MeaningAll()
    {
        using var db = NewDb();

        var dto = Ok(await NewController(db, Guid.NewGuid()).Create(new(null, null)));

        Assert.Null(dto.Kategorier);
        Assert.Null(dto.Omraden);
    }

    [Fact]
    public async Task Create_EmptyLists_StayEmpty_ExplicitEmptySelection()
    {
        using var db = NewDb();

        var dto = Ok(await NewController(db, Guid.NewGuid()).Create(new([], [])));

        Assert.Empty(dto.Kategorier!);
        Assert.Empty(dto.Omraden!);
    }

    [Fact]
    public async Task Create_AllKommunerInALan_Succeeds()
    {
        // Största länet (Västra Götaland, 49 kommuner) — "Välj alla kommuner" i modalen.
        using var db = NewDb();
        var vg = SvenskaLan.KommunerILan("Västra Götalands län");

        var dto = Ok(await NewController(db, Guid.NewGuid()).Create(new(null, [.. vg])));

        Assert.Equal(vg.Length, dto.Omraden!.Count);
    }

    [Fact]
    public async Task Create_AllKommunerExceptOne_Succeeds()
    {
        // Frontend skickar null bara när ALLA 290 är valda; 289 skickas som en lista
        // och måste rymmas i taget. Alla 16 kategorier likaså.
        using var db = NewDb();
        var alla = SvenskaLan.LanKommuner.Values.SelectMany(k => k).ToList();
        Assert.Equal(290, alla.Count);

        var dto = Ok(await NewController(db, Guid.NewGuid())
            .Create(new([.. PolisenBevakningMatcher.Kategorier], alla.Skip(1).ToList())));

        Assert.Equal(289, dto.Omraden!.Count);
        Assert.Equal(PolisenBevakningMatcher.Kategorier.Length, dto.Kategorier!.Count);
    }

    [Fact]
    public void Limits_NeverBelowTheLegitimateSets()
    {
        // Skyddsnät: om någon lägger till fler kommuner/kategorier ska taget inte tyst bli för lågt.
        var antalKommuner = SvenskaLan.LanKommuner.Values.Sum(k => k.Length);
        Assert.True(PolisenBevakningValidator.MaxOmradenIRequest >= antalKommuner);
        Assert.True(PolisenBevakningValidator.MaxKategorierIRequest >= PolisenBevakningMatcher.Kategorier.Length);
        Assert.True(PolisenBevakningValidator.MaxStrangLangd >= SvenskaLan.LanKommuner.Values.SelectMany(k => k).Max(k => k.Length));
        Assert.True(PolisenBevakningValidator.MaxStrangLangd >= PolisenBevakningMatcher.Kategorier.Max(k => k.Length));
    }

    // ── Update ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Update_InvalidInput_Returns400_AndLeavesRowUnchanged()
    {
        using var db = NewDb();
        var userId = Guid.NewGuid();
        var b = await Seed(db, userId, "[\"Stöld\"]", "[\"Kungälv\"]");

        var result = await NewController(db, userId).Update(b.Id, new(["Stöld"], ["Atlantis"]));

        Assert.Contains("Atlantis", Message(result));
        var after = await db.PolisenBevakningar.SingleAsync();
        Assert.Equal("[\"Stöld\"]", after.KategorierJson);
        Assert.Equal("[\"Kungälv\"]", after.OmradenJson);
    }

    [Fact]
    public async Task Update_Duplicates_AreDeduplicated()
    {
        using var db = NewDb();
        var userId = Guid.NewGuid();
        var b = await Seed(db, userId);

        var dto = Ok(await NewController(db, userId).Update(b.Id, new(["Rån", "Rån"], ["Lund", "Lund", "Malmö"])));

        Assert.Equal(["Rån"], dto.Kategorier);
        Assert.Equal(["Lund", "Malmö"], dto.Omraden);
    }

    // ── Befintliga överstora rader (gränserna gäller bara vid skriv) ─────

    private static string OversizedJson(int n) => JsonSerializer.Serialize(Enumerable.Range(0, n).Select(i => $"gammalt-värde-{i}"));

    [Fact]
    public async Task Get_ExistingOversizedBevakning_StillReadable_NoThrow()
    {
        using var db = NewDb();
        var userId = Guid.NewGuid();
        await Seed(db, userId, OversizedJson(5_000), OversizedJson(20_000));

        var result = await NewController(db, userId).Get();

        var lista = Assert.IsAssignableFrom<IEnumerable<BevakningResponse>>(Assert.IsType<OkObjectResult>(result).Value).ToList();
        var dto = Assert.Single(lista);
        Assert.Equal(5_000, dto.Kategorier!.Count);
        Assert.Equal(20_000, dto.Omraden!.Count);
    }

    [Fact]
    public async Task Update_ExistingOversizedBevakning_CanBeFixedToValidValues()
    {
        using var db = NewDb();
        var userId = Guid.NewGuid();
        var b = await Seed(db, userId, OversizedJson(5_000), OversizedJson(20_000));

        var dto = Ok(await NewController(db, userId).Update(b.Id, new(["Stöld"], ["Kungälv"])));

        Assert.Equal(["Stöld"], dto.Kategorier);
        Assert.Equal(["Kungälv"], dto.Omraden);
    }

    [Fact]
    public async Task Delete_ExistingOversizedBevakning_Works()
    {
        using var db = NewDb();
        var userId = Guid.NewGuid();
        var b = await Seed(db, userId, OversizedJson(5_000), OversizedJson(20_000));

        var result = await NewController(db, userId).Delete(b.Id);

        Assert.IsType<OkResult>(result);
        Assert.Empty(await db.PolisenBevakningar.ToListAsync());
    }

    [Fact]
    public async Task Matcher_ExistingOversizedBevakning_StillMatchesAsBefore()
    {
        // Matcharens semantik rörs inte: en gammal överstor rad läses och matchar som förut.
        var b = new PolisenBevakning
        {
            UserId = Guid.NewGuid(),
            KategorierJson = null,
            OmradenJson = JsonSerializer.Serialize(Enumerable.Range(0, 5_000).Select(i => $"x{i}").Append("Kungälv")),
        };
        var ev = new CanonicalEvent
        {
            SourceId = 1,
            ExternalId = "e",
            Title = "t",
            Content = "",
            Url = "u",
            RawData = "",
            Geography = "Kungälv",
            EventType = "Stöld",
            PublishedAt = DateTime.UtcNow,
        };

        Assert.True(PolisenBevakningMatcher.Matches(ev, [b]));
    }

    // ── Admin-varianten delar samma regler ───────────────────────────────

    [Fact]
    public async Task AdminCreate_InvalidInput_Returns400_ValidIsDeduplicated()
    {
        using var db = NewDb();
        var controller = new AdminUserDetailsController(db);
        var userId = Guid.NewGuid();

        var bad = await controller.CreatePolisenBevakning(userId, new(null, ["Atlantis"]));
        Assert.Contains("Atlantis", Message(bad));
        Assert.Empty(await db.PolisenBevakningar.ToListAsync());

        var good = await controller.CreatePolisenBevakning(userId, new(["Stöld", "Stöld"], null));
        Assert.IsType<OkObjectResult>(good);
        var saved = await db.PolisenBevakningar.SingleAsync();
        Assert.Equal(["Stöld"], JsonSerializer.Deserialize<List<string>>(saved.KategorierJson!));
    }

    [Fact]
    public async Task AdminUpdate_TooManyOmraden_Returns400()
    {
        using var db = NewDb();
        var userId = Guid.NewGuid();
        var b = await Seed(db, userId, null, "[\"Kungälv\"]");
        var controller = new AdminUserDetailsController(db);

        var result = await controller.UpdatePolisenBevakning(userId, b.Id, new(null, Repeat("Kungälv", 301)));

        Assert.Contains("områden", Message(result));
        Assert.Equal(["Kungälv"], JsonSerializer.Deserialize<List<string>>((await db.PolisenBevakningar.SingleAsync()).OmradenJson!));
    }
}
