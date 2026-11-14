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

    // En push-mottagande användare (PushNyVersion=true som standard) med en
    // registrerad enhet — samma minimala uppsättning som PushDispatcherTests
    // använder för DispatchNewVersionAsync.
    private static void SeedPushMottagare(AppDbContext db)
    {
        var user = new User { Name = "Ada", Email = $"{Guid.NewGuid()}@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        db.SaveChanges();
        db.UserDevices.Add(new UserDevice { UserId = user.Id, Endpoint = "https://push.example/ep1", P256dh = "k", Auth = "a" });
        db.SaveChanges();
    }

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
            UppdateringId = uppdatering.Id,
            Typ = "ny-funktion",
            Text = "Nu kan du filtrera på län",
            Synlighet = "alla",
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

    // ------------------------------------------------------------------
    // Del 2: push + banderoll vid lansering (Beslut 2026-10-08)
    // ------------------------------------------------------------------

    [Fact]
    public async Task ExecuteDueAsync_SkickaPushTrue_DispatchesNewVersionPushToEligibleDevice()
    {
        using var db = NewDb();
        SeedPushMottagare(db);
        var uppdatering = new Uppdatering
        {
            Titel = "Ny källa tillagd",
            Publicerad = false,
            SchemalagdPubliceringUtc = DateTime.UtcNow.AddMinutes(-1),
            SkickaPush = true,
            PushVersion = "0.9.0",
            PushMeddelande = "Nu kan du filtrera på plats",
        };
        db.Uppdateringar.Add(uppdatering);
        db.UppdateringsPunkter.Add(new UppdateringsPunkt { UppdateringId = uppdatering.Id, Typ = "ny-funktion", Text = "...", Synlighet = "alla" });
        await db.SaveChangesAsync();
        var push = Substitute.For<IPushNotificationService>();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>(), push: push);

        await push.Received(1).SendAsync(
            Arg.Any<UserDevice>(), Arg.Is<string>(t => t!.Contains("0.9.0")),
            Arg.Is<string>(b => b == "Nu kan du filtrera på plats"),
            Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteDueAsync_SkickaPushFalse_SendsNoPush()
    {
        using var db = NewDb();
        SeedPushMottagare(db);
        var uppdatering = new Uppdatering
        {
            Titel = "Ny källa tillagd",
            Publicerad = false,
            SchemalagdPubliceringUtc = DateTime.UtcNow.AddMinutes(-1),
            SkickaPush = false,
        };
        db.Uppdateringar.Add(uppdatering);
        db.UppdateringsPunkter.Add(new UppdateringsPunkt { UppdateringId = uppdatering.Id, Typ = "ny-funktion", Text = "...", Synlighet = "alla" });
        await db.SaveChangesAsync();
        var push = Substitute.For<IPushNotificationService>();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>(), push: push);

        await push.DidNotReceive().SendAsync(
            Arg.Any<UserDevice>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteDueAsync_VisaBanderollWithAllaPunkt_CreatesBannerForAllaAudience()
    {
        using var db = NewDb();
        var uppdatering = new Uppdatering
        {
            Titel = "Nytt platsfilter",
            Publicerad = false,
            SchemalagdPubliceringUtc = DateTime.UtcNow.AddMinutes(-1),
            VisaBanderoll = true,
        };
        db.Uppdateringar.Add(uppdatering);
        db.UppdateringsPunkter.Add(new UppdateringsPunkt { UppdateringId = uppdatering.Id, Typ = "ny-funktion", Text = "Punkt för besökare", Synlighet = "alla" });
        db.UppdateringsPunkter.Add(new UppdateringsPunkt { UppdateringId = uppdatering.Id, Typ = "ny-funktion", Text = "Punkt bara inloggade", Synlighet = "inloggade" });
        await db.SaveChangesAsync();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>());

        var banner = Assert.Single(db.MaintenanceBanners);
        Assert.Equal("Alla", banner.Audience);
        Assert.Equal("Nyhet", banner.Stil);
        Assert.Equal("Nytt på Samhällsinformation", banner.Rubrik);
        Assert.Equal("/uppdateringar", banner.LankUrl);
        Assert.Equal("Nytt platsfilter", banner.Message);
    }

    [Fact]
    public async Task ExecuteDueAsync_VisaBanderollOnlyInloggadePunkter_CreatesBannerForAnvandareAudience()
    {
        using var db = NewDb();
        var uppdatering = new Uppdatering
        {
            Titel = "Ny intern funktion",
            Publicerad = false,
            SchemalagdPubliceringUtc = DateTime.UtcNow.AddMinutes(-1),
            VisaBanderoll = true,
        };
        db.Uppdateringar.Add(uppdatering);
        db.UppdateringsPunkter.Add(new UppdateringsPunkt { UppdateringId = uppdatering.Id, Typ = "ny-funktion", Text = "Bara inloggade", Synlighet = "inloggade" });
        await db.SaveChangesAsync();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>());

        Assert.Equal("Användare", db.MaintenanceBanners.Single().Audience);
    }

    [Fact]
    public async Task ExecuteDueAsync_VisaBanderollTrueButNoPunkter_CreatesNoBanner()
    {
        using var db = NewDb();
        db.Uppdateringar.Add(new Uppdatering
        {
            Titel = "Bara flagg-aktivering",
            Publicerad = false,
            SchemalagdPubliceringUtc = DateTime.UtcNow.AddMinutes(-1),
            VisaBanderoll = true,
        });
        await db.SaveChangesAsync();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>());

        Assert.Empty(db.MaintenanceBanners);
    }

    // ------------------------------------------------------------------
    // Del 3: annonsering i förväg, två faser (Beslut 2026-10-08)
    // ------------------------------------------------------------------

    private static Uppdatering SeedaAnnonseradLansering(AppDbContext db, DateTime annonsering, DateTime lansering, string pushSkickaVid = "Lansering", bool skickaPush = false, bool visaBanderoll = false)
    {
        var uppdatering = new Uppdatering
        {
            Titel = "Nytt platsfilter",
            Publicerad = false,
            AnnonseringUtc = annonsering,
            SchemalagdPubliceringUtc = lansering,
            SkickaPush = skickaPush,
            PushVersion = "1.0.0",
            PushMeddelande = "Nu kan du filtrera på plats",
            PushSkickaVid = pushSkickaVid,
            VisaBanderoll = visaBanderoll,
        };
        db.Uppdateringar.Add(uppdatering);
        db.UppdateringsPunkter.Add(new UppdateringsPunkt { UppdateringId = uppdatering.Id, Typ = "ny-funktion", Text = "...", Synlighet = "alla" });
        db.SaveChanges();
        return uppdatering;
    }

    [Fact]
    public async Task ExecuteDueAsync_AnnonseringDue_LanseringInteAn_PublicerarUtanAttAktiveraFlaggor()
    {
        using var db = NewDb();
        var uppdatering = SeedaAnnonseradLansering(db, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddDays(3));
        uppdatering.SchemalagdaFlaggorJson = Json("kallor_lan_filter");
        await db.SaveChangesAsync();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>());

        var sparad = db.Uppdateringar.Single();
        Assert.True(sparad.Publicerad);
        Assert.NotNull(sparad.AnnonseradUtc);
        Assert.NotNull(sparad.SchemalagdPubliceringUtc); // fas 2 väntar fortfarande
        Assert.NotNull(sparad.AnnonseringUtc);
        Assert.Empty(db.FeatureFlagOverrides); // flaggor aktiveras bara vid fas 2
    }

    [Fact]
    public async Task ExecuteDueAsync_AnnonseringRedanKord_KorsInteOmVidNastaPoll()
    {
        using var db = NewDb();
        SeedPushMottagare(db);
        SeedaAnnonseradLansering(db, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddDays(3), skickaPush: true, pushSkickaVid: "Annonsering");
        var push = Substitute.For<IPushNotificationService>();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>(), push: push);
        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>(), push: push);

        // Andra pollen ska INTE skicka push igen — AnnonseradUtc redan satt.
        await push.Received(1).SendAsync(
            Arg.Any<UserDevice>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteDueAsync_PushSkickaVidAnnonsering_SkickarKommerPushMenInteVidLansering()
    {
        using var db = NewDb();
        SeedPushMottagare(db);
        var push = Substitute.For<IPushNotificationService>();

        // Fas 1 — due nu, fas 2 i framtiden.
        SeedaAnnonseradLansering(db, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddDays(3), skickaPush: true, pushSkickaVid: "Annonsering");
        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>(), push: push);

        await push.Received(1).SendAsync(
            Arg.Any<UserDevice>(), Arg.Is<string>(t => t!.StartsWith("Kommer ")),
            Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());

        // Flytta fram lanseringstiden till nu och köra om — ska INTE skicka
        // ännu en push (PushSkickaVid är bara "Annonsering", inte "Lansering").
        var uppdatering = db.Uppdateringar.Single();
        uppdatering.SchemalagdPubliceringUtc = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();
        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>(), push: push);

        await push.Received(1).SendAsync( // fortfarande bara 1 — inte 2
            Arg.Any<UserDevice>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteDueAsync_PushSkickaVidBada_SkickarVidBadaFaserna()
    {
        using var db = NewDb();
        SeedPushMottagare(db);
        var push = Substitute.For<IPushNotificationService>();
        SeedaAnnonseradLansering(db, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddDays(3), skickaPush: true, pushSkickaVid: "Båda");

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>(), push: push);
        var uppdatering = db.Uppdateringar.Single();
        uppdatering.SchemalagdPubliceringUtc = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();
        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>(), push: push);

        await push.Received(2).SendAsync(
            Arg.Any<UserDevice>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteDueAsync_VisaBanderollAnnonseringsfas_SkaparKommandeBannerSomSlutarVidLansering()
    {
        using var db = NewDb();
        var lansering = DateTime.UtcNow.AddDays(3);
        SeedaAnnonseradLansering(db, DateTime.UtcNow.AddMinutes(-1), lansering, visaBanderoll: true);

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>());

        var banner = Assert.Single(db.MaintenanceBanners);
        Assert.Equal("Kommande", banner.Stil);
        Assert.StartsWith("Kommer ", banner.Rubrik);
        Assert.Equal(lansering, banner.EndUtc);
    }

    [Fact]
    public async Task ExecuteDueAsync_LanseringEfterAnnonsering_AktiverarFlaggorOchNollstallerAllt()
    {
        using var db = NewDb();
        var uppdatering = SeedaAnnonseradLansering(db, DateTime.UtcNow.AddDays(-2), DateTime.UtcNow.AddMinutes(-1), visaBanderoll: true);
        uppdatering.AnnonseradUtc = DateTime.UtcNow.AddDays(-2); // fas 1 redan körd tidigare
        uppdatering.Publicerad = true;
        uppdatering.SchemalagdaFlaggorJson = Json("kallor_lan_filter");
        await db.SaveChangesAsync();

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>());

        var sparad = db.Uppdateringar.Single();
        Assert.True(db.FeatureFlagOverrides.Single().Value);
        Assert.Null(sparad.SchemalagdPubliceringUtc);
        Assert.Null(sparad.AnnonseringUtc);
        Assert.Null(sparad.AnnonseradUtc);
        var banner = Assert.Single(db.MaintenanceBanners); // bara "Nyhet" skapas nu, ingen ny "Kommande"
        Assert.Equal("Nyhet", banner.Stil);
    }

    [Fact]
    public async Task ExecuteDueAsync_BadaFasernaDuSamtidigt_KorBaddaIEnEndaPoll()
    {
        using var db = NewDb();
        SeedPushMottagare(db);
        var push = Substitute.For<IPushNotificationService>();
        // Annonsering och lansering hamnar i samma poll-tick — ska hantera
        // båda i tur och ordning utan att fastna.
        SeedaAnnonseradLansering(db, DateTime.UtcNow.AddMinutes(-2), DateTime.UtcNow.AddMinutes(-1), skickaPush: true, pushSkickaVid: "Båda", visaBanderoll: true);

        await ScheduledReleaseBackgroundService.ExecuteDueAsync(db, Substitute.For<IAktivitetsloggService>(), push: push);

        var sparad = db.Uppdateringar.Single();
        Assert.True(sparad.Publicerad);
        Assert.Null(sparad.SchemalagdPubliceringUtc); // fas 2 körde och nollställde allt
        Assert.Null(sparad.AnnonseringUtc);
        Assert.Equal(2, db.MaintenanceBanners.Count()); // "Kommande" + "Nyhet"
        await push.Received(2).SendAsync(
            Arg.Any<UserDevice>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string?>(), Arg.Any<Guid?>(), Arg.Any<PushGrupp?>(), Arg.Any<CancellationToken>());
    }
}
