namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class AdminUsersController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminUsersController(AppDbContext db) => _db = db;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup([FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return BadRequest("email krävs.");

        var user = await _db.Users
            .Where(u => u.Email == email)
            .Select(u => new { u.Id, u.Name, u.Email })
            .FirstOrDefaultAsync();

        if (user == null) return NotFound();
        return Ok(user);
    }

    // Ingen paginering/sökning än — en enda admin, inte ett skalproblem
    // förrän listan faktiskt blir stor.
    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new
            {
                u.Id,
                u.Name,
                u.Email,
                u.Role,
                u.IsActive,
                u.SuspendedAt,
                u.SuspendedReason,
                u.SuspensionReminderAt,
                u.SuspensionReminderNote,
                u.AuthProvider,
                u.CreatedAt,
                u.DeletedAt,
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] SetUserStatusRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.IsActive = req.IsActive;
        user.SuspendedAt     = req.IsActive ? null : DateTime.UtcNow;
        user.SuspendedReason = req.IsActive ? null : req.Reason;
        user.SuspensionReminderAt   = req.IsActive ? null : req.ReminderAt;
        user.SuspensionReminderNote = req.IsActive ? null : req.ReminderNote;

        await _db.SaveChangesAsync();
        return Ok();
    }

    // GDPR-radering (artikel 17) implementerad som anonymisering, inte fysisk radering
    // av raden — kontot refereras av RefreshTokens/SupportTickets/UserSourcePreference
    // m.fl. via FK, och en anonymiserad rad håller referentiell integritet intakt utan
    // att behöva städa upp varje beroende tabell för hand. Namn/e-post/lösenord skrivs
    // över med slumpade placeholder-värden, kontot spärras precis som en vanlig
    // avstängning (samma inloggnings-/refresh-spärr slår igenom automatiskt) och
    // markeras med DeletedAt så adminpanelen kan skilja det från en vanlig avstängning
    // (ett raderat konto ska aldrig kunna återaktiveras).
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (id == CurrentUserId)
            return BadRequest(new { error = "Du kan inte radera ditt eget konto." });

        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.Name                   = "Raderad användare";
        user.Email                  = $"deleted-{Guid.NewGuid():N}@anonymized.local";
        user.PasswordHash           = "";
        user.Role                   = "Användare";
        user.IsActive               = false;
        user.SuspendedAt            = DateTime.UtcNow;
        user.SuspendedReason        = "Konto raderat (GDPR)";
        user.SuspensionReminderAt   = null;
        user.SuspensionReminderNote = null;
        user.DeletedAt              = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok();
    }

    // Härledd, inte persisterad — samma mönster som AdminSupportController.GetNotifications
    // för ärendepåminnelser. Kontospärrning är inte tilldelad en specifik admin, så alla
    // admins ser samma förfallna påminnelser (till skillnad från ärenden).
    [HttpGet("notifications")]
    public async Task<IActionResult> GetNotifications()
    {
        var now = DateTime.UtcNow;

        var notiser = await _db.Users
            .Where(u => !u.IsActive && u.SuspensionReminderAt != null && u.SuspensionReminderAt <= now)
            .Select(u => new { UserId = u.Id, Namn = u.Name, Epost = u.Email, Notering = u.SuspensionReminderNote })
            .ToListAsync();

        return Ok(notiser);
    }
}

public record SetUserStatusRequest(bool IsActive, string? Reason, DateTime? ReminderAt = null, string? ReminderNote = null);
