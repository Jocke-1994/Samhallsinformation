namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Geografi;
using Samhallsinformation.Data;

/// <summary>
/// Publikt API för det geografiska platsfiltret (se
/// docs/vault/Ideer/Geografiskt-platsfilter-besokare.md) — ingen
/// inloggning krävs, filtret ska fungera redan för besökare (beslut 11).
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class PlatserController : ControllerBase
{
    private readonly AppDbContext _db;

    public PlatserController(AppDbContext db)
    {
        _db = db;
    }

    // Pluppkatalogen byggs av de senaste 50 publicerade händelserna — samma
    // mängd NewsFeed redan hämtar för "Allt"-vyn (beslut 6), ingen separat
    // fråga mot backend. Ingen caching/polling — räknas om vid varje anrop
    // (beslut 7).
    [HttpGet("katalog")]
    public async Task<IActionResult> GetKatalog()
    {
        var publishedSourceIds = await _db.Sources
            .Where(s => s.IsPublished)
            .Select(s => s.Id)
            .ToListAsync();

        var senasteHändelser = await _db.Events
            .Where(e => publishedSourceIds.Contains(e.SourceId))
            .OrderByDescending(e => e.PublishedAt)
            .Take(50)
            .Select(e => new { e.Geography, e.IsNational })
            .ToListAsync();

        var katalog = PlatsKatalogBygger.Bygg(senasteHändelser.Select(e => (e.Geography, e.IsNational)));

        var resultat = katalog.Select(p => new
        {
            namn = p.Namn,
            niva = p.Nivå.ToString(),
            lan = p.Lan,
            antalHandelser = p.AntalHändelser,
            aktiv = p.Aktiv,
        });

        return Ok(resultat);
    }

    // Sektionerad resultatvy för en eller flera valda pluppar (beslut 3+4) —
    // ELLER-logik mellan platserna, en egen sektion per vald plats. Samma
    // senaste-50-fönster som katalogen (beslut 10: egen fristående vy, men
    // samma delade dataunderlag — ingen anledning till en bredare fråga).
    // En länsvarning dyker upp under VARJE vald kommun i länet (beslut 2) —
    // en händelse kan alltså förekomma i flera sektioner samtidigt.
    [HttpGet("handelser")]
    public async Task<IActionResult> GetHändelserForPlatser([FromQuery] string? platser)
    {
        if (string.IsNullOrWhiteSpace(platser))
            return BadRequest(new { error = "platser krävs (kommaseparerad lista)" });

        var valdaPlatser = platser
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (valdaPlatser.Count == 0)
            return BadRequest(new { error = "platser krävs (kommaseparerad lista)" });

        var publishedSourceIds = await _db.Sources
            .Where(s => s.IsPublished)
            .Select(s => s.Id)
            .ToListAsync();

        var senasteHändelser = await _db.Events
            .Where(e => publishedSourceIds.Contains(e.SourceId))
            .OrderByDescending(e => e.PublishedAt)
            .Take(50)
            .ToListAsync();

        var sektioner = valdaPlatser.Select(plats => new
        {
            plats,
            lan = KommunLan.LanForKommun.GetValueOrDefault(plats),
            handelser = senasteHändelser
                .Where(e => PlatsHändelseFiltrerare.GällerPlats(plats, e.Geography, e.IsNational))
                .ToList(),
        });

        return Ok(sektioner);
    }
}
