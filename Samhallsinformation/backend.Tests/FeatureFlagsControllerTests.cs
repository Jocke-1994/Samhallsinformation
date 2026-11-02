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

public class FeatureFlagsControllerTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static FeatureFlagsController NewController(AppDbContext db) =>
        new(db, Substitute.For<IAktivitetsloggService>());

    // null = anonym besökare (samma mönster som UppdateringarControllerTests) —
    // role-claimen heter uttryckligen "role" (RoleClaimType i Program.cs,
    // MapInboundClaims=false), inte ClaimTypes.Role.
    private static FeatureFlagsController NewController(AppDbContext db, string? roll) => new(db, Substitute.For<IAktivitetsloggService>())
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                // roleType måste anges explicit som "role" — ClaimsIdentitys
                // defaultkonstruktor letar annars efter ClaimTypes.Role (den
                // långa XML-URI:n), som inte matchar RoleClaimType="role"
                // (Program.cs, MapInboundClaims=false) och User.IsInRole
                // skulle alltid returnera false även med en giltig roll-claim.
                User = roll == null
                    ? new ClaimsPrincipal(new ClaimsIdentity())
                    : new ClaimsPrincipal(new ClaimsIdentity([new Claim("role", roll)], "TestAuth", ClaimTypes.Name, "role")),
            },
        },
    };

    [Fact]
    public async Task SetOverride_TurningOn_ClearsStaleRedoAttLanseras()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "kallor_lan_filter", Value = false, RedoAttLanseras = true });
        await db.SaveChangesAsync();
        var controller = NewController(db);

        // Admin slår på flaggan direkt via den vanliga på/av-brytaren,
        // förbi schemaläggningsflödet helt.
        await controller.SetOverride("kallor_lan_filter", new SetFlagRequest(true));

        var flagg = db.FeatureFlagOverrides.Single();
        Assert.True(flagg.Value);
        Assert.False(flagg.RedoAttLanseras);
    }

    [Fact]
    public async Task SetOverride_TurningOff_DoesNotTouchRedoAttLanseras()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "kallor_lan_filter", Value = true, RedoAttLanseras = false });
        await db.SaveChangesAsync();
        var controller = NewController(db);

        await controller.SetOverride("kallor_lan_filter", new SetFlagRequest(false));

        Assert.False(db.FeatureFlagOverrides.Single().Value);
    }

    [Fact]
    public async Task SetOverride_TurningOff_AlsoClearsEndastAdmin()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "flode_platsfilter", Value = true, EndastAdmin = true });
        await db.SaveChangesAsync();
        var controller = NewController(db);

        await controller.SetOverride("flode_platsfilter", new SetFlagRequest(false));

        Assert.False(db.FeatureFlagOverrides.Single().EndastAdmin);
    }

    // Testmiljö-läget (Beslut 2026-10-19): en flagga markerad EndastAdmin
    // ska vara effektivt PÅ för en inloggad Admin men AV för alla andra,
    // oavsett vad som faktiskt står i databasen.

    [Fact]
    public async Task GetOverrides_EndastAdminFlagga_ArTrueForAdmin()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "flode_platsfilter", Value = true, EndastAdmin = true });
        await db.SaveChangesAsync();
        var controller = NewController(db, "Admin");

        var result = Assert.IsType<OkObjectResult>(await controller.GetOverrides());
        var overrides = Assert.IsType<Dictionary<string, bool>>(result.Value);

        Assert.True(overrides["flode_platsfilter"]);
    }

    [Fact]
    public async Task GetOverrides_EndastAdminFlagga_ArFalseForAnonym()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "flode_platsfilter", Value = true, EndastAdmin = true });
        await db.SaveChangesAsync();
        var controller = NewController(db, roll: null);

        var result = Assert.IsType<OkObjectResult>(await controller.GetOverrides());
        var overrides = Assert.IsType<Dictionary<string, bool>>(result.Value);

        Assert.False(overrides["flode_platsfilter"]);
    }

    [Fact]
    public async Task GetOverrides_EndastAdminFlagga_ArFalseForInloggadAnvandare()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "flode_platsfilter", Value = true, EndastAdmin = true });
        await db.SaveChangesAsync();
        var controller = NewController(db, "Användare");

        var result = Assert.IsType<OkObjectResult>(await controller.GetOverrides());
        var overrides = Assert.IsType<Dictionary<string, bool>>(result.Value);

        Assert.False(overrides["flode_platsfilter"]);
    }

    [Fact]
    public async Task GetOverrides_VanligFlagga_OpaverkadAvEndastAdminLogik()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "kallor_lan_filter", Value = true, EndastAdmin = false });
        await db.SaveChangesAsync();
        var controller = NewController(db, roll: null);

        var result = Assert.IsType<OkObjectResult>(await controller.GetOverrides());
        var overrides = Assert.IsType<Dictionary<string, bool>>(result.Value);

        Assert.True(overrides["kallor_lan_filter"]);
    }

    [Fact]
    public async Task SetEndastAdmin_SatterFaltetUtanAttRoraValue()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "flode_platsfilter", Value = true, EndastAdmin = false });
        await db.SaveChangesAsync();
        var controller = NewController(db);

        await controller.SetEndastAdmin("flode_platsfilter", new SetSynlighetRequest(true));

        var flagg = db.FeatureFlagOverrides.Single();
        Assert.True(flagg.EndastAdmin);
        Assert.True(flagg.Value);
    }

    [Fact]
    public async Task SetEndastAdmin_UpsertarRadenOmDenSaknas()
    {
        using var db = NewDb();
        var controller = NewController(db);

        await controller.SetEndastAdmin("ny_flagga", new SetSynlighetRequest(true));

        var flagg = db.FeatureFlagOverrides.Single();
        Assert.True(flagg.EndastAdmin);
        Assert.False(flagg.Value); // upsert rör aldrig Value — samma mönster som /redo
    }

    [Fact]
    public async Task SetEndastAdmin_OppnadForAlla_RensarRedoAttLanseras()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "flode_platsfilter", Value = true, EndastAdmin = true, RedoAttLanseras = true });
        await db.SaveChangesAsync();
        var controller = NewController(db);

        await controller.SetEndastAdmin("flode_platsfilter", new SetSynlighetRequest(false));

        var flagg = db.FeatureFlagOverrides.Single();
        Assert.False(flagg.EndastAdmin);
        Assert.False(flagg.RedoAttLanseras);
        Assert.True(flagg.Value);
    }

    [Fact]
    public async Task SetEndastAdmin_BegransadTillAdmin_BeharRedoAttLanseras()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "flode_platsfilter", Value = true, EndastAdmin = false, RedoAttLanseras = true });
        await db.SaveChangesAsync();
        var controller = NewController(db);

        await controller.SetEndastAdmin("flode_platsfilter", new SetSynlighetRequest(true));

        Assert.True(db.FeatureFlagOverrides.Single().RedoAttLanseras);
    }
}
