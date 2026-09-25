namespace Samhallsinformation.Tests;

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
}
