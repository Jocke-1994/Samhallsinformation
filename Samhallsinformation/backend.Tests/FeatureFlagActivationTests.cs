namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.FeatureFlags;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

public class FeatureFlagActivationTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    // Testmiljö-läget (Beslut 2026-10-19): en flagga som bara varit aktiv för
    // Admin (testad skarpt, aldrig riktigt lanserad) ska gå fullt publik när
    // en riktig schemalagd lansering aktiverar den — inte tyst förbli
    // admin-begränsad bara för att Value redan var true.
    [Fact]
    public async Task ActivateFlagsAsync_FlagganVarBaraAktivForAdmin_BlirFulltOffentlig()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "flode_platsfilter", Value = true, EndastAdmin = true });
        await db.SaveChangesAsync();
        var aktivitetslogg = Substitute.For<IAktivitetsloggService>();

        await FeatureFlagActivation.ActivateFlagsAsync(
            db, aktivitetslogg, ["flode_platsfilter"], "Del av schemalagd lansering", "System");
        await db.SaveChangesAsync();

        var flagg = db.FeatureFlagOverrides.Single();
        Assert.True(flagg.Value);
        Assert.False(flagg.EndastAdmin);
    }

    [Fact]
    public async Task ActivateFlagsAsync_RedanFulltAktiv_HoppasOverTystUtanAttLogga()
    {
        using var db = NewDb();
        db.FeatureFlagOverrides.Add(new FeatureFlagOverride { Key = "kallor_lan_filter", Value = true, EndastAdmin = false });
        await db.SaveChangesAsync();
        var aktivitetslogg = Substitute.For<IAktivitetsloggService>();

        await FeatureFlagActivation.ActivateFlagsAsync(
            db, aktivitetslogg, ["kallor_lan_filter"], "Del av schemalagd lansering", "System");

        await aktivitetslogg.DidNotReceiveWithAnyArgs().LogAsync(
            default!, default!, default!, default!);
    }

    [Fact]
    public async Task ActivateFlagsAsync_HelNy_SkaparOchAktiverarUtanEndastAdmin()
    {
        using var db = NewDb();
        var aktivitetslogg = Substitute.For<IAktivitetsloggService>();

        await FeatureFlagActivation.ActivateFlagsAsync(
            db, aktivitetslogg, ["helt_ny_flagga"], "Del av schemalagd lansering", "System");
        await db.SaveChangesAsync();

        var flagg = db.FeatureFlagOverrides.Single();
        Assert.True(flagg.Value);
        Assert.False(flagg.EndastAdmin);
        Assert.False(flagg.RedoAttLanseras);
    }
}
