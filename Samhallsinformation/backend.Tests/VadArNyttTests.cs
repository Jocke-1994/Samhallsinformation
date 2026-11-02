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

// Vad är nytt-rutan (Ideer/Vad ar nytt-modal.md): GET /api/uppdateringar/vad-ar-nytt
// och POST .../{id}/sett. En regel per test, så att ett fel pekar ut exakt vilken.
public class VadArNyttTests
{
    private static AppDbContext NewDb() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static VadArNyttController NewController(AppDbContext db, Guid userId) =>
        new(db)
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

    private static User SeedaAnvändare(AppDbContext db, DateTime? skapad = null)
    {
        var u = new User { Email = $"{Guid.NewGuid()}@test.se", CreatedAt = skapad ?? DateTime.UtcNow.AddDays(-30) };
        db.Users.Add(u);
        db.SaveChanges();
        return u;
    }

    private static Uppdatering SeedaRelease(AppDbContext db, DateTime datum, bool visaVadArNytt = true,
        bool publicerad = true, DateTime? schemalagd = null, string synlighet = "alla")
    {
        var r = new Uppdatering
        {
            Titel = $"Release {datum:yyyy-MM-dd}", Datum = datum, Publicerad = publicerad,
            VisaVadArNytt = visaVadArNytt, SchemalagdPubliceringUtc = schemalagd,
        };
        db.Uppdateringar.Add(r);
        db.UppdateringsPunkter.Add(new UppdateringsPunkt
        {
            UppdateringId = r.Id, Typ = "ny-funktion", Plats = "Allmänt", Text = "Nytt!", Synlighet = synlighet,
        });
        db.SaveChanges();
        return r;
    }

    [Fact]
    public async Task GetVadArNytt_PubliceradMedKryss_ReturnerarReleasen()
    {
        using var db = NewDb();
        var användare = SeedaAnvändare(db);
        var release = SeedaRelease(db, DateTime.UtcNow.Date);

        var svar = Assert.IsType<OkObjectResult>(await NewController(db, användare.Id).GetVadÄrNytt());
        Assert.Equal(release.Id, ((VadArNyttDto)svar.Value!).Id);
    }

    [Fact]
    public async Task GetVadArNytt_UtanKryss_Returnerar204()
    {
        using var db = NewDb();
        var användare = SeedaAnvändare(db);
        SeedaRelease(db, DateTime.UtcNow.Date, visaVadArNytt: false);

        Assert.IsType<NoContentResult>(await NewController(db, användare.Id).GetVadÄrNytt());
    }

    [Fact]
    public async Task GetVadArNytt_Opublicerad_Returnerar204()
    {
        using var db = NewDb();
        var användare = SeedaAnvändare(db);
        SeedaRelease(db, DateTime.UtcNow.Date, publicerad: false);

        Assert.IsType<NoContentResult>(await NewController(db, användare.Id).GetVadÄrNytt());
    }

    [Fact]
    public async Task GetVadArNytt_ReleaseFöreKontot_Returnerar204()
    {
        using var db = NewDb();
        var användare = SeedaAnvändare(db, skapad: DateTime.UtcNow);
        SeedaRelease(db, DateTime.UtcNow.Date.AddDays(-5));

        Assert.IsType<NoContentResult>(await NewController(db, användare.Id).GetVadÄrNytt());
    }

    [Fact]
    public async Task GetVadArNytt_ReleaseSammaDagSomKontot_Visas()
    {
        using var db = NewDb();
        var användare = SeedaAnvändare(db, skapad: DateTime.UtcNow);
        SeedaRelease(db, DateTime.UtcNow.Date);

        Assert.IsType<OkObjectResult>(await NewController(db, användare.Id).GetVadÄrNytt());
    }

    [Fact]
    public async Task GetVadArNytt_IAnnonseringsfasen_Returnerar204()
    {
        // Under annonseringen visar den publika vyn bara "Kommer snart" —
        // rutan får inte avslöja det riktiga innehållet i förväg.
        using var db = NewDb();
        var användare = SeedaAnvändare(db);
        SeedaRelease(db, DateTime.UtcNow.Date, schemalagd: DateTime.UtcNow.AddDays(3));

        Assert.IsType<NoContentResult>(await NewController(db, användare.Id).GetVadÄrNytt());
    }

    [Fact]
    public async Task GetVadArNytt_FleraReleaser_VisarBaraSenaste()
    {
        using var db = NewDb();
        var användare = SeedaAnvändare(db);
        SeedaRelease(db, DateTime.UtcNow.Date.AddDays(-3));
        var senaste = SeedaRelease(db, DateTime.UtcNow.Date.AddDays(-1));

        var svar = Assert.IsType<OkObjectResult>(await NewController(db, användare.Id).GetVadÄrNytt());
        Assert.Equal(senaste.Id, ((VadArNyttDto)svar.Value!).Id);
    }

    [Fact]
    public async Task GetVadArNytt_SenasteRedanSett_VisarInteÄldreOsedd()
    {
        // Bara den senaste räknas — har man stängt den ska inte en äldre
        // osedd release dyka upp i stället.
        using var db = NewDb();
        var användare = SeedaAnvändare(db);
        SeedaRelease(db, DateTime.UtcNow.Date.AddDays(-3));
        var senaste = SeedaRelease(db, DateTime.UtcNow.Date.AddDays(-1));
        användare.VadArNyttSettId = senaste.Id;
        db.SaveChanges();

        Assert.IsType<NoContentResult>(await NewController(db, användare.Id).GetVadÄrNytt());
    }

    [Fact]
    public async Task MarkeraSett_DärefterGet_Returnerar204_MenNyReleaseVisasIgen()
    {
        using var db = NewDb();
        var användare = SeedaAnvändare(db);
        var första = SeedaRelease(db, DateTime.UtcNow.Date.AddDays(-2));
        var controller = NewController(db, användare.Id);

        Assert.IsType<NoContentResult>(await controller.MarkeraVadÄrNyttSett(första.Id));
        Assert.Equal(första.Id, db.Users.Single().VadArNyttSettId);
        Assert.IsType<NoContentResult>(await controller.GetVadÄrNytt());

        var nästa = SeedaRelease(db, DateTime.UtcNow.Date);
        var svar = Assert.IsType<OkObjectResult>(await controller.GetVadÄrNytt());
        Assert.Equal(nästa.Id, ((VadArNyttDto)svar.Value!).Id);
    }

    [Fact]
    public async Task MarkeraSett_OkändRelease_Returnerar404()
    {
        using var db = NewDb();
        var användare = SeedaAnvändare(db);

        Assert.IsType<NotFoundResult>(await NewController(db, användare.Id).MarkeraVadÄrNyttSett(Guid.NewGuid()));
        Assert.Null(db.Users.Single().VadArNyttSettId);
    }

    [Fact]
    public async Task GetVadArNytt_InloggadSerÄvenInloggadePunkter()
    {
        using var db = NewDb();
        var användare = SeedaAnvändare(db);
        SeedaRelease(db, DateTime.UtcNow.Date, synlighet: "inloggade");

        var svar = Assert.IsType<OkObjectResult>(await NewController(db, användare.Id).GetVadÄrNytt());
        Assert.Single(((VadArNyttDto)svar.Value!).Punkter);
    }

    [Fact]
    public async Task CreateUppdatering_VisaVadArNyttUtanPunkter_ReturnsBadRequest()
    {
        using var db = NewDb();
        var svar = await new UppdateringarController(db, Substitute.For<IAktivitetsloggService>()).CreateUppdatering(new UppdateringRequest(
            "Tom", DateTime.UtcNow, true, [], VisaVadArNytt: true));

        Assert.IsType<BadRequestObjectResult>(svar);
    }

    [Fact]
    public async Task CreateOchUpdate_SpararVisaVadArNytt()
    {
        using var db = NewDb();
        var controller = new UppdateringarController(db, Substitute.For<IAktivitetsloggService>());
        PunktRequest punkt = new("ny-funktion", "Allmänt", "Text", "alla");

        var skapad = (UppdateringDto)((OkObjectResult)await controller.CreateUppdatering(new UppdateringRequest(
            "V1", DateTime.UtcNow, true, [punkt], VisaVadArNytt: true))).Value!;
        Assert.True(skapad.VisaVadArNytt);
        Assert.True(db.Uppdateringar.Single().VisaVadArNytt);

        await controller.UpdateUppdatering(skapad.Id, new UppdateringRequest(
            "V1", DateTime.UtcNow, true, [punkt], VisaVadArNytt: false));
        Assert.False(db.Uppdateringar.Single().VisaVadArNytt);
    }
}
