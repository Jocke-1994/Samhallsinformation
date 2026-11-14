namespace Samhallsinformation.Tests;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

public class FaqControllerTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static FaqController NewController(AppDbContext db) => new(db, Substitute.For<IAktivitetsloggService>());

    [Fact]
    public async Task GetFaq_Unpublished_NeverShown()
    {
        using var db = NewDb();
        db.FaqItems.Add(new FaqItem { Fraga = "Dold", Svar = "x", Publicerad = false });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).GetFaq());
        var items = Assert.IsAssignableFrom<IEnumerable<FaqItem>>(result.Value);
        Assert.Empty(items);
    }

    [Fact]
    public async Task GetFaq_PublishedNoFlagKey_AlwaysShown()
    {
        using var db = NewDb();
        db.FaqItems.Add(new FaqItem { Fraga = "Allmän fråga", Svar = "x", Publicerad = true, FlagKey = null });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).GetFaq());
        var items = Assert.IsAssignableFrom<IEnumerable<FaqItem>>(result.Value);
        Assert.Single(items);
    }

    // konto_tvafaktor har defaultAktiv=false i frontend/src/lib/featureFlags.ts
    // och ingen override satt här — frågan ska döljas trots Publicerad=true.
    [Fact]
    public async Task GetFaq_FlagOffByDefault_HiddenEvenIfPublished()
    {
        using var db = NewDb();
        db.FaqItems.Add(new FaqItem { Fraga = "Om tvåfaktor", Svar = "x", Publicerad = true, FlagKey = "konto_tvafaktor" });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).GetFaq());
        var items = Assert.IsAssignableFrom<IEnumerable<FaqItem>>(result.Value);
        Assert.Empty(items);
    }

    // konto_info har defaultAktiv=true — ska synas utan någon override alls.
    [Fact]
    public async Task GetFaq_FlagOnByDefault_Shown()
    {
        using var db = NewDb();
        db.FaqItems.Add(new FaqItem { Fraga = "Om kontoinfo", Svar = "x", Publicerad = true, FlagKey = "konto_info" });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).GetFaq());
        var items = Assert.IsAssignableFrom<IEnumerable<FaqItem>>(result.Value);
        Assert.Single(items);
    }

    // Admin kan slå PÅ en annars avstängd flagga via FeatureFlagOverrides —
    // frågan ska då synas trots att koddefaulten är false.
    [Fact]
    public async Task GetFaq_FlagOffByDefaultButOverriddenOn_Shown()
    {
        using var db = NewDb();
        db.FaqItems.Add(new FaqItem { Fraga = "Om tvåfaktor", Svar = "x", Publicerad = true, FlagKey = "konto_tvafaktor" });
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "konto_tvafaktor", Value = true });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db).GetFaq());
        var items = Assert.IsAssignableFrom<IEnumerable<FaqItem>>(result.Value);
        Assert.Single(items);
    }

    // ── Publika GET /api/faq: vad som får gå ut ──────────────────────────────

    private static FaqController NewController(AppDbContext db, string? roll) => new(db, Substitute.For<IAktivitetsloggService>())
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = roll == null
                    ? new ClaimsPrincipal(new ClaimsIdentity())
                    : new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Role, roll)], "test")),
            },
        },
    };

    // Kontraktet mot kundtjänstboten (docs/vault/Ideer/FAQ-synk-kundtjanstbot.md):
    // { id, kategori, fraga, svar, flagKey, createdAt, updatedAt }. FaqKort.tsx
    // filtrerar också på flagKey. Publicerad är alltid true här och ska inte ut.
    private static readonly string[] TillatnaFaqFalt =
        ["createdAt", "flagKey", "fraga", "id", "kategori", "svar", "updatedAt"];

    [Fact]
    public async Task GetFaq_Json_HasOnlyAllowedFields()
    {
        using var db = NewDb();
        db.FaqItems.Add(new FaqItem { Kategori = "Konto", Fraga = "Fråga", Svar = "Svar", Publicerad = true });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db, roll: null).GetFaq());

        var json = EventFaltVitlista.TillJson(result.Value!);
        var falt = Assert.Single(json.EnumerateArray().ToList())
            .EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToArray();
        Assert.Equal(TillatnaFaqFalt, falt);
    }

    // En flagga som bara admin ser (EndastAdmin, betatest) är påslagen men inte
    // lanserad. Publika /api/faq får då inte visa frågan för besökare eller
    // kundtjänstboten, på samma sätt som GET /api/feature-flags ger false.
    [Fact]
    public async Task GetFaq_EndastAdminFlag_HiddenForVisitor()
    {
        using var db = NewDb();
        db.FaqItems.Add(new FaqItem { Fraga = "Om betafunktionen", Svar = "x", Publicerad = true, FlagKey = "konto_tvafaktor" });
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "konto_tvafaktor", Value = true, EndastAdmin = true });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db, roll: null).GetFaq());

        Assert.Empty(EventFaltVitlista.TillJson(result.Value!).EnumerateArray());
    }

    [Fact]
    public async Task GetFaq_EndastAdminFlag_ShownForAdmin()
    {
        using var db = NewDb();
        db.FaqItems.Add(new FaqItem { Fraga = "Om betafunktionen", Svar = "x", Publicerad = true, FlagKey = "konto_tvafaktor" });
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "konto_tvafaktor", Value = true, EndastAdmin = true });
        await db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await NewController(db, roll: "Admin").GetFaq());

        Assert.Single(EventFaltVitlista.TillJson(result.Value!).EnumerateArray());
    }

    [Fact]
    public async Task UpdateFaq_SetsUpdatedAt()
    {
        using var db = NewDb();
        var item = new FaqItem { Fraga = "Fråga", Svar = "Svar", Publicerad = true, UpdatedAt = DateTime.UtcNow.AddDays(-5) };
        db.FaqItems.Add(item);
        await db.SaveChangesAsync();
        var föreUppdaterad = item.UpdatedAt;

        await NewController(db).UpdateFaq(item.Id, new FaqRequest("Kategori", "Ny fråga", "Nytt svar", true, null));

        var uppdaterad = await db.FaqItems.FindAsync(item.Id);
        Assert.True(uppdaterad!.UpdatedAt > föreUppdaterad);
    }
}
