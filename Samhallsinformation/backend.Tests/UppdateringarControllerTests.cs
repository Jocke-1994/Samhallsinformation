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

    // ── E4#1: publika GET filtrerar på Synlighet ─────────────────────────────

    private static UppdateringarController NewController(AppDbContext db, bool inloggad) => new(db, Substitute.For<IAktivitetsloggService>())
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                // authenticationType satt = IsAuthenticated true (som en giltig JWT ger);
                // tom ClaimsIdentity = anonym, precis som utan/med ogiltig token.
                User = inloggad
                    ? new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())], "TestAuth"))
                    : new ClaimsPrincipal(new ClaimsIdentity()),
            },
        },
    };

    private static void SeedaBlandadeSynligheter(AppDbContext db)
    {
        var blandad = new Uppdatering { Titel = "Blandad", Datum = DateTime.UtcNow, Publicerad = true };
        var baraInloggad = new Uppdatering { Titel = "Bara inloggad", Datum = DateTime.UtcNow.AddDays(-1), Publicerad = true };
        var utkast = new Uppdatering { Titel = "Utkast", Datum = DateTime.UtcNow.AddDays(-2), Publicerad = false };
        db.Uppdateringar.AddRange(blandad, baraInloggad, utkast);
        db.UppdateringsPunkter.AddRange(
            new UppdateringsPunkt { UppdateringId = blandad.Id, Text = "publik",  Synlighet = "alla",      Ordning = 0 },
            new UppdateringsPunkt { UppdateringId = blandad.Id, Text = "hemlig",  Synlighet = "inloggade", Ordning = 1 },
            new UppdateringsPunkt { UppdateringId = baraInloggad.Id, Text = "hemlig 2", Synlighet = "inloggade", Ordning = 0 },
            new UppdateringsPunkt { UppdateringId = utkast.Id, Text = "utkast", Synlighet = "alla", Ordning = 0 });
        db.SaveChanges();
    }

    [Fact]
    public async Task GetUppdateringar_Anonym_SerBaraAllaPunkterOchSlapperTommaReleaser()
    {
        using var db = NewDb();
        SeedaBlandadeSynligheter(db);

        var result = (OkObjectResult)await NewController(db, inloggad: false).GetUppdateringar();
        var dtos = Assert.IsType<List<UppdateringDto>>(result.Value);

        var release = Assert.Single(dtos);           // "Bara inloggad" släpps helt, utkast är opublicerat
        Assert.Equal("Blandad", release.Titel);
        var punkt = Assert.Single(release.Punkter);
        Assert.Equal("publik", punkt.Text);
    }

    [Fact]
    public async Task GetUppdateringar_Inloggad_SerAvenInloggadePunkter()
    {
        using var db = NewDb();
        SeedaBlandadeSynligheter(db);

        var result = (OkObjectResult)await NewController(db, inloggad: true).GetUppdateringar();
        var dtos = Assert.IsType<List<UppdateringDto>>(result.Value);

        Assert.Equal(["Blandad", "Bara inloggad"], dtos.Select(d => d.Titel).ToArray());
        Assert.Equal(["publik", "hemlig"], dtos[0].Punkter.Select(p => p.Text).ToArray());
        Assert.Equal(["hemlig 2"], dtos[1].Punkter.Select(p => p.Text).ToArray());
    }

    // ── E4#9: allowlist för Typ/Synlighet på skrivvägen ──────────────────────

    [Theory]
    [InlineData("nytt", "alla")]            // gammalt format
    [InlineData("", "alla")]
    [InlineData("Buggfix", "alla")]         // fel skiftläge
    [InlineData("buggfix", "Alla")]         // fel skiftläge på Synlighet
    [InlineData("buggfix", "")]
    [InlineData("buggfix", "admin")]
    public async Task CreateUppdatering_OkandTypEllerSynlighet_Ger400OchSpararInget(string typ, string synlighet)
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = await controller.CreateUppdatering(new UppdateringRequest(
            "Version", DateTime.UtcNow, true, [new PunktRequest(typ, "Allmänt", "Text", synlighet)]));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.Uppdateringar);
        Assert.Empty(db.UppdateringsPunkter);
    }

    [Fact]
    public async Task UpdateUppdatering_OkandTyp_Ger400OchLamnarBefintligaPunkterOrorda()
    {
        using var db = NewDb();
        var controller = NewController(db);
        var created = (OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "Version", DateTime.UtcNow, true, [Punkt("orörd")]));
        var dto = (UppdateringDto)created.Value!;

        var result = await controller.UpdateUppdatering(dto.Id, new UppdateringRequest(
            "Ny titel", dto.Datum, true, [new PunktRequest("nytt", "Allmänt", "dålig", "alla")]));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("Version", db.Uppdateringar.Single().Titel);
        Assert.Equal("orörd", db.UppdateringsPunkter.Single().Text);
    }

    [Theory]
    [InlineData("ny-funktion", "alla")]
    [InlineData("förbättring", "inloggade")]
    [InlineData("buggfix", "alla")]
    [InlineData("känt-problem", "inloggade")]
    [InlineData("kommer-snart", "alla")]
    public async Task CreateOchUpdateUppdatering_GiltigaVarden_Godkanns(string typ, string synlighet)
    {
        using var db = NewDb();
        var controller = NewController(db);

        var created = await controller.CreateUppdatering(new UppdateringRequest(
            "Version", DateTime.UtcNow, true, [new PunktRequest(typ, "Allmänt", "Text", synlighet)]));
        var dto = (UppdateringDto)((OkObjectResult)created).Value!;

        var updated = await controller.UpdateUppdatering(dto.Id, new UppdateringRequest(
            "Version 2", dto.Datum, true, [new PunktRequest(typ, "Allmänt", "Text 2", synlighet)]));

        Assert.IsType<OkObjectResult>(updated);
        var punkt = db.UppdateringsPunkter.Single();
        Assert.Equal(typ, punkt.Typ);
        Assert.Equal(synlighet, punkt.Synlighet);
    }

    [Fact]
    public async Task CreateUppdatering_TomPunktlista_Godkanns()
    {
        using var db = NewDb();
        var result = await NewController(db).CreateUppdatering(new UppdateringRequest(
            "Utkast", DateTime.UtcNow, false, []));

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task GetUppdateringar_RadMedOkandTypOchSynlighet_KrascharInteOchReturnerasSomDen_Ar()
    {
        using var db = NewDb();
        var u = new Uppdatering { Titel = "Gammal", Datum = DateTime.UtcNow, Publicerad = true };
        db.Uppdateringar.Add(u);
        db.UppdateringsPunkter.AddRange(
            new UppdateringsPunkt { UppdateringId = u.Id, Typ = "nytt", Text = "gammalt format", Synlighet = "alla", Ordning = 0 },
            new UppdateringsPunkt { UppdateringId = u.Id, Typ = "ny-funktion", Text = "versal", Synlighet = "Alla", Ordning = 1 });
        db.SaveChanges();

        // Inloggad: raderna kommer med oförändrade (frontend har fallback för Typ).
        var inloggad = (OkObjectResult)await NewController(db, inloggad: true).GetUppdateringar();
        var punkter = Assert.Single(Assert.IsType<List<UppdateringDto>>(inloggad.Value)).Punkter;
        Assert.Equal(["nytt", "ny-funktion"], punkter.Select(p => p.Typ).ToArray());

        // Anonym: okänd Typ med giltig Synlighet visas, okänd Synlighet ("Alla") döljs.
        var anonym = (OkObjectResult)await NewController(db, inloggad: false).GetUppdateringar();
        var anonymaPunkter = Assert.Single(Assert.IsType<List<UppdateringDto>>(anonym.Value)).Punkter;
        Assert.Equal("nytt", Assert.Single(anonymaPunkter).Typ);

        // Admin-endpointen kraschar inte heller.
        var admin = (OkObjectResult)await NewController(db).GetAdminUppdateringar();
        Assert.Equal(2, Assert.Single(Assert.IsType<List<UppdateringDto>>(admin.Value)).Punkter.Count);
    }
}
