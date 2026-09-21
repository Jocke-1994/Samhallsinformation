namespace Samhallsinformation.Tests;

using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

public class ScheduledReleaseBackgroundServiceTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static string Json(params string[] flaggor) => JsonSerializer.Serialize(flaggor);

    [Fact]
    public async Task ExecuteDueAsync_DueRelease_ActivatesFlagEvenWithoutExistingOverrideRow()
    {
        using var db = NewDb();
        db.Uppdateringar.Add(new Uppdatering
        {
            Titel = "Version 0.4.0",
            SchemalagdPubliceringUtc = DateTime.UtcNow.AddMinutes(-1),
            SchemalagdaFlaggorJson = Json("kallor_lan_filter"),
        });
        await db.SaveChangesAsync();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>());

        var flagg = Assert.Single(db.FeatureFlagOverrides);
        Assert.Equal("kallor_lan_filter", flagg.Key);
        Assert.True(flagg.Value);
        Assert.False(flagg.RedoAttLanseras);
    }

    [Fact]
    public async Task ExecuteDueAsync_ReleaseWithoutPunkter_StaysUnpublishedButFlagActivates()
    {
        using var db = NewDb();
        var uppdatering = new Uppdatering
        {
            Titel = "Bara flagg-aktivering",
            Publicerad = false,
            SchemalagdPubliceringUtc = DateTime.UtcNow.AddMinutes(-1),
            SchemalagdaFlaggorJson = Json("kallor_lan_filter"),
        };
        db.Uppdateringar.Add(uppdatering);
        await db.SaveChangesAsync();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>());

        Assert.False(db.Uppdateringar.Single().Publicerad);
        Assert.True(db.FeatureFlagOverrides.Single().Value);
    }

    [Fact]
    public async Task ExecuteDueAsync_ReleaseWithPunkter_BecomesPublished()
    {
        using var db = NewDb();
        var uppdatering = new Uppdatering
        {
            Titel = "Version 0.4.0",
            Publicerad = false,
            SchemalagdPubliceringUtc = DateTime.UtcNow.AddMinutes(-1),
        };
        db.Uppdateringar.Add(uppdatering);
        db.UppdateringsPunkter.Add(new UppdateringsPunkt
        {
            UppdateringId = uppdatering.Id, Typ = "ny-funktion", Text = "Nu kan du filtrera på län", Synlighet = "alla",
        });
        await db.SaveChangesAsync();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>());

        Assert.True(db.Uppdateringar.Single().Publicerad);
    }

    [Fact]
    public async Task ExecuteDueAsync_AlwaysClearsScheduleAfterProcessing()
    {
        using var db = NewDb();
        db.Uppdateringar.Add(new Uppdatering
        {
            Titel = "Bara flagg-aktivering",
            SchemalagdPubliceringUtc = DateTime.UtcNow.AddMinutes(-1),
            SchemalagdaFlaggorJson = Json("kallor_lan_filter"),
        });
        await db.SaveChangesAsync();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>());

        var uppdatering = db.Uppdateringar.Single();
        Assert.Null(uppdatering.SchemalagdPubliceringUtc);
        Assert.Null(uppdatering.SchemalagdaFlaggorJson); // inte bara tidsstämpeln — se code review-fynd, PR #590
    }

    [Fact]
    public async Task ExecuteDueAsync_NotYetDue_IsSkipped()
    {
        using var db = NewDb();
        db.Uppdateringar.Add(new Uppdatering
        {
            Titel = "Inte än",
            SchemalagdPubliceringUtc = DateTime.UtcNow.AddHours(1),
            SchemalagdaFlaggorJson = Json("kallor_lan_filter"),
        });
        await db.SaveChangesAsync();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>());

        Assert.Empty(db.FeatureFlagOverrides);
        Assert.NotNull(db.Uppdateringar.Single().SchemalagdPubliceringUtc);
    }
}
