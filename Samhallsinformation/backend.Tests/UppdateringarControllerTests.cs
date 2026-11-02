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

    // ── Del 2: push + banderoll-fälten (Beslut 2026-10-08) ───────────────────

    [Fact]
    public async Task CreateUppdatering_VisaBanderollUtanPunkter_ReturnsBadRequest()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = await controller.CreateUppdatering(new UppdateringRequest(
            "Bara flagg", DateTime.UtcNow, false, [], DateTime.UtcNow.AddDays(1), ["en_flagga"],
            VisaBanderoll: true));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CreateUppdatering_SkickaPushUtanVersion_ReturnsBadRequest()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = await controller.CreateUppdatering(new UppdateringRequest(
            "Version 0.9.0", DateTime.UtcNow, false, [Punkt()], DateTime.UtcNow.AddDays(1), [],
            SkickaPush: true, PushVersion: null, PushMeddelande: "Meddelande"));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CreateUppdatering_SkickaPushUtanMeddelande_ReturnsBadRequest()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = await controller.CreateUppdatering(new UppdateringRequest(
            "Version 0.9.0", DateTime.UtcNow, false, [Punkt()], DateTime.UtcNow.AddDays(1), [],
            SkickaPush: true, PushVersion: "0.9.0", PushMeddelande: "  "));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CreateUppdatering_GiltigPushOchBanderoll_PersistsAllaFalt()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = (OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "Version 0.9.0", DateTime.UtcNow, false, [Punkt()], DateTime.UtcNow.AddDays(1), [],
            SkickaPush: true, PushVersion: "0.9.0", PushMeddelande: "Nyheter!", VisaBanderoll: true));
        var dto = (UppdateringDto)result.Value!;

        Assert.True(dto.SkickaPush);
        Assert.Equal("0.9.0", dto.PushVersion);
        Assert.Equal("Nyheter!", dto.PushMeddelande);
        Assert.True(dto.VisaBanderoll);

        var sparad = db.Uppdateringar.Single();
        Assert.True(sparad.SkickaPush);
        Assert.Equal("0.9.0", sparad.PushVersion);
        Assert.Equal("Nyheter!", sparad.PushMeddelande);
        Assert.True(sparad.VisaBanderoll);
    }

    // ── Versionsnummer (beslut 2026-11-02) ───────────────────────────────────

    [Fact]
    public async Task CreateUppdatering_Version_SparasOchBlirPushensVersion()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var dto = (UppdateringDto)((OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "Push-notiser", DateTime.UtcNow, false, [Punkt()], DateTime.UtcNow.AddDays(1), [],
            SkickaPush: true, PushVersion: null, PushMeddelande: "Nu kan du få notiser", Version: " 1.2 "))).Value!;

        Assert.Equal("1.2", dto.Version);
        Assert.Equal("1.2", dto.PushVersion);
        Assert.Equal("1.2", db.Uppdateringar.Single().Version);
    }

    [Fact]
    public async Task UpdateUppdatering_VersionSaknasIRequest_BeharSparadVersion()
    {
        using var db = NewDb();
        var controller = NewController(db);
        var dto = (UppdateringDto)((OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "Logga in", DateTime.UtcNow, true, [Punkt()], Version: "1.0"))).Value!;

        // Äldre klient (t.ex. en flik öppen sedan före deployen) skickar inget versionsfält.
        await controller.UpdateUppdatering(dto.Id, new UppdateringRequest("Logga in", dto.Datum, false, [Punkt()]));

        Assert.Equal("1.0", db.Uppdateringar.Single().Version);
    }

    [Fact]
    public async Task UpdateUppdatering_TomVersion_TarBortVersionen()
    {
        using var db = NewDb();
        var controller = NewController(db);
        var dto = (UppdateringDto)((OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "Logga in", DateTime.UtcNow, true, [Punkt()], Version: "1.0"))).Value!;

        await controller.UpdateUppdatering(dto.Id, new UppdateringRequest("Logga in", dto.Datum, true, [Punkt()], Version: ""));

        Assert.Null(db.Uppdateringar.Single().Version);
    }

    [Fact]
    public async Task CreateUppdatering_ForLangVersion_ReturnsBadRequest()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = await controller.CreateUppdatering(new UppdateringRequest(
            "Titel", DateTime.UtcNow, true, [Punkt()], Version: new string('1', 21)));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    // ── Del 3: annonsering i förväg (Beslut 2026-10-08) ──────────────────────

    [Fact]
    public async Task CreateUppdatering_AnnonseringUtanSchemalagdLansering_ReturnsBadRequest()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = await controller.CreateUppdatering(new UppdateringRequest(
            "Version 0.9.0", DateTime.UtcNow, false, [Punkt()], SchemalagdPubliceringUtc: null, [],
            AnnonseringUtc: DateTime.UtcNow.AddDays(1)));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CreateUppdatering_AnnonseringEfterLansering_ReturnsBadRequest()
    {
        using var db = NewDb();
        var controller = NewController(db);
        var lansering = DateTime.UtcNow.AddDays(5);

        var result = await controller.CreateUppdatering(new UppdateringRequest(
            "Version 0.9.0", DateTime.UtcNow, false, [Punkt()], lansering, [],
            AnnonseringUtc: lansering.AddDays(1))); // efter, inte före

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CreateUppdatering_OgiltigPushSkickaVid_ReturnsBadRequest()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = await controller.CreateUppdatering(new UppdateringRequest(
            "Version 0.9.0", DateTime.UtcNow, false, [Punkt()], DateTime.UtcNow.AddDays(5), [],
            PushSkickaVid: "Nagonsin"));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CreateUppdatering_GiltigAnnonsering_PersistsAnnonseringUtcOchPushSkickaVid()
    {
        using var db = NewDb();
        var controller = NewController(db);
        var lansering = DateTime.UtcNow.AddDays(5);
        var annonsering = DateTime.UtcNow.AddDays(1);

        var result = (OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "Version 0.9.0", DateTime.UtcNow, false, [Punkt()], lansering, [],
            AnnonseringUtc: annonsering, PushSkickaVid: "Båda"));
        var dto = (UppdateringDto)result.Value!;

        Assert.Equal(annonsering, dto.AnnonseringUtc);
        Assert.Null(dto.AnnonseradUtc);
        Assert.Equal("Båda", dto.PushSkickaVid);
    }

    [Fact]
    public async Task UpdateUppdatering_AndratAnnonseringsdatum_NollstallerAnnonseradUtc()
    {
        using var db = NewDb();
        var controller = NewController(db);
        var lansering = DateTime.UtcNow.AddDays(5);
        var annonsering1 = DateTime.UtcNow.AddDays(1);
        var annonsering2 = DateTime.UtcNow.AddDays(2);

        var created = (OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "Version 0.9.0", DateTime.UtcNow, false, [Punkt()], lansering, [], AnnonseringUtc: annonsering1));
        var dto = (UppdateringDto)created.Value!;

        // Simulerar att fas 1 redan körts av bakgrundstjänsten.
        var uppdatering = db.Uppdateringar.Single();
        uppdatering.AnnonseradUtc = DateTime.UtcNow;
        await db.SaveChangesAsync();

        await controller.UpdateUppdatering(dto.Id, new UppdateringRequest(
            dto.Titel, dto.Datum, false, [Punkt()], lansering, [], AnnonseringUtc: annonsering2));

        Assert.Null(db.Uppdateringar.Single().AnnonseradUtc);
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

    // ── Prova själv-länkar (Ideer/Prova-sjalv-lankar.md) ──────────────────────

    [Fact]
    public async Task CreateUppdatering_ProvaSjalv_SparasOchReturneras()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var created = (OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "Version", DateTime.UtcNow, true,
            [new PunktRequest("ny-funktion", "Nyhetsflöde", "Filtrera på plats", "alla", "senaste-nytt-plats"),
             new PunktRequest("buggfix", "Allmänt", "Utan länk", "alla")]));

        var dto = (UppdateringDto)created.Value!;
        Assert.Equal(["senaste-nytt-plats", null], dto.Punkter.Select(p => p.ProvaSjalv).ToArray());
        Assert.Equal("senaste-nytt-plats", db.UppdateringsPunkter.Single(p => p.Text == "Filtrera på plats").ProvaSjalv);
    }

    [Theory]
    [InlineData("https://evil.se")]
    [InlineData("/profil")]
    [InlineData("Senaste-nytt-plats")]   // fel skiftläge
    [InlineData("")]
    public async Task CreateUppdatering_OkantProvaSjalvMal_Ger400OchSpararInget(string mål)
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = await controller.CreateUppdatering(new UppdateringRequest(
            "Version", DateTime.UtcNow, true, [new PunktRequest("ny-funktion", "Allmänt", "Text", "alla", mål)]));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.Uppdateringar);
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

    // ── Del 3: annonseringsteaser på PUBLIKA endpointen ──────────────────────

    private static Uppdatering SeedaAnnonseradRelease(AppDbContext db)
    {
        var lansering = DateTime.UtcNow.AddDays(3);
        var u = new Uppdatering
        {
            Titel = "Nytt platsfilter", Publicerad = true,
            SchemalagdPubliceringUtc = lansering,
            AnnonseringUtc = lansering.AddDays(-2),
            AnnonseradUtc = DateTime.UtcNow.AddHours(-1), // fas 1 redan körd
        };
        db.Uppdateringar.Add(u);
        db.UppdateringsPunkter.Add(new UppdateringsPunkt { UppdateringId = u.Id, Typ = "ny-funktion", Text = "Den riktiga, hemliga texten", Synlighet = "alla", Ordning = 0 });
        db.SaveChanges();
        return u;
    }

    [Fact]
    public async Task GetUppdateringar_AnnonseradInteLanserad_VisarTeaserInteRiktigaPunkter()
    {
        using var db = NewDb();
        SeedaAnnonseradRelease(db);

        foreach (var inloggad in new[] { true, false })
        {
            var result = (OkObjectResult)await NewController(db, inloggad).GetUppdateringar();
            var punkt = Assert.Single(Assert.Single(Assert.IsType<List<UppdateringDto>>(result.Value)).Punkter);
            Assert.Equal("kommer-snart", punkt.Typ);
            Assert.StartsWith("Släpps", punkt.Text);
            Assert.DoesNotContain("hemliga", punkt.Text);
        }
    }

    [Fact]
    public async Task GetAdminUppdateringar_AnnonseradInteLanserad_VisarRiktigtInnehall()
    {
        using var db = NewDb();
        SeedaAnnonseradRelease(db);

        var result = (OkObjectResult)await NewController(db).GetAdminUppdateringar();
        var punkt = Assert.Single(Assert.Single(Assert.IsType<List<UppdateringDto>>(result.Value)).Punkter);
        Assert.Equal("ny-funktion", punkt.Typ);
        Assert.Equal("Den riktiga, hemliga texten", punkt.Text);
    }

    [Fact]
    public async Task GetUppdateringar_InteAnnonseradAn_VisarRiktigaPunkter()
    {
        using var db = NewDb();
        var u = new Uppdatering
        {
            Titel = "Kommande funktion", Publicerad = true,
            SchemalagdPubliceringUtc = DateTime.UtcNow.AddDays(5),
            AnnonseringUtc = DateTime.UtcNow.AddDays(1), // satt men inte körd — AnnonseradUtc är null
        };
        db.Uppdateringar.Add(u);
        db.UppdateringsPunkter.Add(new UppdateringsPunkt { UppdateringId = u.Id, Typ = "ny-funktion", Text = "Riktig text", Synlighet = "alla", Ordning = 0 });
        db.SaveChanges();

        var result = (OkObjectResult)await NewController(db, inloggad: false).GetUppdateringar();
        var punkt = Assert.Single(Assert.Single(Assert.IsType<List<UppdateringDto>>(result.Value)).Punkter);
        Assert.Equal("Riktig text", punkt.Text);
    }
}
