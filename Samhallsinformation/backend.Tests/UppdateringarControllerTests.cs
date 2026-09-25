namespace Samhallsinformation.Tests;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

public class UppdateringarControllerTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static UppdateringarController NewController(AppDbContext db) =>
        new(db, Substitute.For<IAktivitetsloggService>());

    private static PunktRequest Punkt(string text = "Text") =>
        new("ny-funktion", "Allmänt", text, "alla");

    [Fact]
    public async Task UpdateUppdatering_ManualPublishWithPendingSchedule_ActivatesFlagsAndClearsSchedule()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var created = (OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "Version 0.4.0", DateTime.UtcNow, false, [Punkt()],
            DateTime.UtcNow.AddDays(1), ["kallor_lan_filter"]));
        var dto = (UppdateringDto)created.Value!;

        // Admin publicerar manuellt före schemat (tabellens snabbknapp) —
        // skickar Publicerad=true och nollar schemafälten, precis som
        // togglePublicerad gör.
        await controller.UpdateUppdatering(dto.Id, new UppdateringRequest(
            dto.Titel, dto.Datum, true, [Punkt()], null, []));

        var flagg = Assert.Single(db.FeatureFlagOverrides);
        Assert.Equal("kallor_lan_filter", flagg.Key);
        Assert.True(flagg.Value);
        Assert.True(db.Uppdateringar.Single().Publicerad);
        Assert.Null(db.Uppdateringar.Single().SchemalagdPubliceringUtc);
    }

    [Fact]
    public async Task UpdateUppdatering_PastDueScheduleResentOnSave_FiresImmediatelyInsteadOfWaiting()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var created = (OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "Version 0.4.0", DateTime.UtcNow, false, [Punkt()],
            DateTime.UtcNow.AddMinutes(5), ["kallor_lan_filter"]));
        var dto = (UppdateringDto)created.Value!;

        // Simulerar ett öppet formulär vars schema redan hunnit passera —
        // sparar med samma (nu förfallna) tidsstämpel istället för en ny.
        var förfallen = DateTime.UtcNow.AddMinutes(-1);
        await controller.UpdateUppdatering(dto.Id, new UppdateringRequest(
            dto.Titel, dto.Datum, false, [Punkt()], förfallen, ["kallor_lan_filter"]));

        Assert.True(db.FeatureFlagOverrides.Single().Value);
        Assert.True(db.Uppdateringar.Single().Publicerad);
        Assert.Null(db.Uppdateringar.Single().SchemalagdPubliceringUtc);
    }

    [Fact]
    public async Task UpdateUppdatering_GenuineFutureSchedule_IsPersistedUntouched()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var created = (OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "Version 0.4.0", DateTime.UtcNow, false, [Punkt()], null, null));
        var dto = (UppdateringDto)created.Value!;

        var framtida = DateTime.UtcNow.AddDays(2);
        await controller.UpdateUppdatering(dto.Id, new UppdateringRequest(
            dto.Titel, dto.Datum, false, [Punkt()], framtida, ["kallor_lan_filter"]));

        Assert.Empty(db.FeatureFlagOverrides);
        Assert.False(db.Uppdateringar.Single().Publicerad);
        Assert.Equal(framtida, db.Uppdateringar.Single().SchemalagdPubliceringUtc);
    }
}
