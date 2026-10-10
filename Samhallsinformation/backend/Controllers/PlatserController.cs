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
}
