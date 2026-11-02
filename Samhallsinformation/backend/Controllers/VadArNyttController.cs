namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// Vad är nytt-rutan (Ideer/Vad ar nytt-modal.md, beslut 2026-11-02): bara för
// inloggade. Egen controller, inte en del av UppdateringarController — där är
// varje skrivande action Admin-only (låst av SupportRollBehorighetTests), medan
// "markera som sedd" ska kunna anropas av vilken inloggad användare som helst.
[ApiController]
[Route("api/uppdateringar/vad-ar-nytt")]
[Authorize]
public class VadArNyttController : ControllerBase
{
    private readonly AppDbContext _db;

    public VadArNyttController(AppDbContext db) => _db = db;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // Returnerar den SENASTE publicerade releasen med VisaVadArNytt — aldrig en
    // äldre, även om användaren missat flera (en lång lista i en popup läser
    // ingen; resten finns på /uppdateringar). 204 när det inte finns något att visa:
    //  - användaren har redan stängt just den releasen (VadArNyttSettId)
    //  - releasen är daterad före den dag kontot skapades (ett nytt konto ska
    //    inte mötas av gamla nyheter)
    //  - releasen är fortfarande i annonseringsfasen (SchemalagdPubliceringUtc
    //    satt) — då visar den publika vyn bara en "Kommer snart"-teaser, och
    //    rutan ska inte avslöja det riktiga innehållet i förväg
    [HttpGet]
    public async Task<IActionResult> GetVadÄrNytt()
    {
        var användare = await _db.Users.FindAsync(CurrentUserId);
        if (användare == null) return NoContent();

        var senaste = await _db.Uppdateringar
            .Where(u => u.Publicerad && u.VisaVadArNytt && u.SchemalagdPubliceringUtc == null)
            .OrderByDescending(u => u.Datum)
            .ThenByDescending(u => u.CreatedAt)
            .FirstOrDefaultAsync();

        if (senaste == null
            || senaste.Id == användare.VadArNyttSettId
            || senaste.Datum.Date < användare.CreatedAt.Date)
            return NoContent();

        var punkter = await _db.UppdateringsPunkter
            .Where(p => p.UppdateringId == senaste.Id)
            .OrderBy(p => p.Ordning)
            .Select(p => new PunktDto(p.Id, p.Typ, p.Plats, p.Text, p.Synlighet, p.ProvaSjalv))
            .ToListAsync();
        if (punkter.Count == 0) return NoContent();

        return Ok(new VadArNyttDto(senaste.Id, senaste.Titel, senaste.Datum, punkter));
    }

    [HttpPost("{id:guid}/sett")]
    public async Task<IActionResult> MarkeraVadÄrNyttSett(Guid id)
    {
        if (!await _db.Uppdateringar.AnyAsync(u => u.Id == id)) return NotFound();

        var användare = await _db.Users.FindAsync(CurrentUserId);
        if (användare == null) return NotFound();

        användare.VadArNyttSettId = id;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record VadArNyttDto(Guid Id, string Titel, DateTime Datum, List<PunktDto> Punkter);
