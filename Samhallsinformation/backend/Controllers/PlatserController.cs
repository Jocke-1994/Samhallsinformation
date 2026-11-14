namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Events;
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

    // Dataunderlaget är det senaste dygnet (ändrat 2026-11-03 från "de 50
    // senaste händelserna", beslut 6). Trafikverket står för ~95 % av alla
    // händelser, så 50 st täckte bara ~1,5 timme och trängde ut Polisen —
    // i produktion gav det 4 pluppar totalt. Ingen caching/polling, räknas
    // om vid varje anrop (beslut 7).
    internal static readonly TimeSpan Fönster = TimeSpan.FromHours(24);

    // Taket per sektion i resultatvyn — ett helt dygn för t.ex. Skåne län
    // kan vara över hundra vägsituationer, mer än någon skrollar igenom.
    internal const int MaxPerSektion = 50;

    [HttpGet("katalog")]
    public async Task<IActionResult> GetKatalog()
    {
        var publishedSourceIds = await _db.Sources
            .Where(s => s.IsPublished)
            .Select(s => s.Id)
            .ToListAsync();

        var gräns = DateTime.UtcNow - Fönster;
        var senasteHändelser = await _db.Events
            .Where(e => publishedSourceIds.Contains(e.SourceId) && e.PublishedAt >= gräns)
            .Select(e => new { e.Geography, e.IsNational, e.SourceId })
            .ToListAsync();

        var katalog = PlatsKatalogBygger.ByggPerKälla(senasteHändelser.Select(e => (e.Geography, e.IsNational, e.SourceId)));

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
    // dygnsfönster som katalogen (beslut 10: egen fristående vy, men samma
    // delade dataunderlag), högst MaxPerSektion nyaste per sektion.
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

        var gräns = DateTime.UtcNow - Fönster;
        var senasteHändelser = await _db.Events
            .Where(e => publishedSourceIds.Contains(e.SourceId) && e.PublishedAt >= gräns)
            .OrderByDescending(e => e.PublishedAt)
            .ToListAsync();

        var sektioner = valdaPlatser.Select(plats => new
        {
            plats,
            lan = KommunLan.LanForKommun.GetValueOrDefault(plats),
            handelser = senasteHändelser
                .Where(e => PlatsHändelseFiltrerare.GällerPlats(plats, e.Geography, e.IsNational, e.SourceId))
                .Take(MaxPerSektion)
                .Select(EventDto.From) // publikt: bara vitlistan, aldrig RawData m.m. (#729)
                .ToList(),
        });

        return Ok(sektioner);
    }
}
