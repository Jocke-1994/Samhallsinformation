namespace Samhallsinformation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/[controller]")]
public class UppdateringarController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAktivitetsloggService _aktivitetslogg;

    public UppdateringarController(AppDbContext db, IAktivitetsloggService aktivitetslogg)
    {
        _db = db;
        _aktivitetslogg = aktivitetslogg;
    }

    // Publik — inga backend-filter på Synlighet ännu (samma resonemang som
    // FAQ innan kundtjänstboten blev en verklig konsument): frontend
    // (UppdateringarPage.tsx) filtrerar klientsidan till synlighet="alla",
    // Profile/Uppdateringar.tsx visar allt till redan inloggade.
    [HttpGet]
    public async Task<IActionResult> GetUppdateringar()
    {
        var releaser = await _db.Uppdateringar
            .Where(u => u.Publicerad)
            .OrderByDescending(u => u.Datum)
            .ToListAsync();

        return Ok(await ByggDtoAsync(releaser));
    }

    [HttpGet("/api/admin/uppdateringar")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAdminUppdateringar()
    {
        var releaser = await _db.Uppdateringar
            .OrderByDescending(u => u.Datum)
            .ToListAsync();

        return Ok(await ByggDtoAsync(releaser));
    }

    [HttpPost("/api/admin/uppdateringar")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateUppdatering([FromBody] UppdateringRequest req)
    {
        var uppdatering = new Uppdatering
        {
            Titel      = req.Titel,
            Datum      = req.Datum,
            Publicerad = req.Publicerad,
        };
        _db.Uppdateringar.Add(uppdatering);
        LäggTillPunkter(uppdatering.Id, req.Punkter);
        await _db.SaveChangesAsync();

        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"Uppdatering skapad — {uppdatering.Titel}", $"{(req.Publicerad ? "publicerad" : "utkast")}");
        return Ok((await ByggDtoAsync(new List<Uppdatering> { uppdatering })).Single());
    }

    [HttpPut("/api/admin/uppdateringar/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateUppdatering(Guid id, [FromBody] UppdateringRequest req)
    {
        var uppdatering = await _db.Uppdateringar.FindAsync(id);
        if (uppdatering == null) return NotFound();

        var publiceradFörut = uppdatering.Publicerad;

        uppdatering.Titel      = req.Titel;
        uppdatering.Datum      = req.Datum;
        uppdatering.Publicerad = req.Publicerad;
        uppdatering.UpdatedAt  = DateTime.UtcNow;

        // Ersätter hela punkter-listan — samma helobjekt-PUT-UX som FAQ,
        // slipper spåra per-punkt-ID:n genom formuläret.
        var gamla = await _db.UppdateringsPunkter.Where(p => p.UppdateringId == id).ToListAsync();
        _db.UppdateringsPunkter.RemoveRange(gamla);
        LäggTillPunkter(id, req.Punkter);

        await _db.SaveChangesAsync();
        var detalj = publiceradFörut != req.Publicerad
            ? (req.Publicerad ? "Publicerad" : "Avpublicerad")
            : "Innehåll redigerat";
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"Uppdatering redigerad — {uppdatering.Titel}", detalj);
        return Ok((await ByggDtoAsync(new List<Uppdatering> { uppdatering })).Single());
    }

    [HttpDelete("/api/admin/uppdateringar/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteUppdatering(Guid id)
    {
        var uppdatering = await _db.Uppdateringar.FindAsync(id);
        if (uppdatering == null) return NotFound();

        var titel = uppdatering.Titel;
        _db.Uppdateringar.Remove(uppdatering); // punkter tas bort via ON DELETE CASCADE
        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konfiguration,
            $"Uppdatering borttagen — {titel}", "");
        return NoContent();
    }

    private void LäggTillPunkter(Guid uppdateringId, List<PunktRequest> punkter)
    {
        for (var i = 0; i < punkter.Count; i++)
        {
            var p = punkter[i];
            _db.UppdateringsPunkter.Add(new UppdateringsPunkt
            {
                UppdateringId = uppdateringId,
                Typ           = p.Typ,
                Plats         = p.Plats,
                Text          = p.Text,
                Synlighet     = p.Synlighet,
                Ordning       = i,
            });
        }
    }

    private async Task<List<UppdateringDto>> ByggDtoAsync(List<Uppdatering> releaser)
    {
        var ids = releaser.Select(u => u.Id).ToList();
        var punkter = await _db.UppdateringsPunkter
            .Where(p => ids.Contains(p.UppdateringId))
            .OrderBy(p => p.Ordning)
            .ToListAsync();

        return releaser.Select(u => new UppdateringDto(
            u.Id, u.Titel, u.Datum, u.Publicerad,
            punkter.Where(p => p.UppdateringId == u.Id)
                   .Select(p => new PunktDto(p.Id, p.Typ, p.Plats, p.Text, p.Synlighet))
                   .ToList()
        )).ToList();
    }
}

public record PunktDto(Guid Id, string Typ, string Plats, string Text, string Synlighet);
public record UppdateringDto(Guid Id, string Titel, DateTime Datum, bool Publicerad, List<PunktDto> Punkter);

public record PunktRequest(string Typ, string Plats, string Text, string Synlighet);
public record UppdateringRequest(string Titel, DateTime Datum, bool Publicerad, List<PunktRequest> Punkter);
