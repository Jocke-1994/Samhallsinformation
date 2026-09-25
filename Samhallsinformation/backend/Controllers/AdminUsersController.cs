namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Data;
using Samhallsinformation.Services;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class AdminUsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAktivitetsloggService _aktivitetslogg;
    private readonly IEmailService _email;
    private readonly IAuthService _auth;
    private readonly string _frontendUrl;

    public AdminUsersController(AppDbContext db, IAktivitetsloggService aktivitetslogg, IEmailService email, IAuthService auth, IConfiguration config)
    {
        _db = db;
        _aktivitetslogg = aktivitetslogg;
        _email = email;
        _auth = auth;
        _frontendUrl = config["FRONTEND_URL"] ?? "https://samhallsinformation.se";
    }

    // Guid.Empty om claimet saknas (matchar då aldrig ett riktigt konto-id).
    private Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : Guid.Empty;

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
                u.DeletionScheduledAt,
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] SetUserStatusRequest req)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (!req.IsActive)
        {
            // Spärr mot utlåsning: ingen självspärr, och aldrig den sista aktiva admin
            // (återställning kräver annars DB-ändring/ny ADMIN_EMAIL-deploy).
            if (id == CurrentUserId)
                return BadRequest(new { error = "Du kan inte spärra ditt eget konto." });
            if (await AccountSuspension.IsLastActiveAdminAsync(_db, user))
                return BadRequest(new { error = "Det här är den sista aktiva administratören — spärra inte kontot, då blir ingen kvar som kan logga in som admin." });
        }
        else if (user.DeletedAt != null)
        {
            return BadRequest(new { error = "Kontot är raderat (anonymiserat) och kan inte återaktiveras." });
        }

        // Återaktivering av ett konto med schemalagd radering avbryter också raderingen —
        // annars ser kontot aktivt ut men anonymiseras oåterkalleligt av
        // UserDeletionBackgroundService inom 24 h.
        var cancelsDeletion = req.IsActive && user.DeletionScheduledAt != null;

        user.IsActive = req.IsActive;
        user.SuspendedAt     = req.IsActive ? null : DateTime.UtcNow;
        user.SuspendedReason = req.IsActive ? null : req.Reason;
        user.SuspensionReminderAt   = req.IsActive ? null : req.ReminderAt;
        user.SuspensionReminderNote = req.IsActive ? null : req.ReminderNote;
        if (cancelsDeletion)
        {
            user.DeletionScheduledAt = null;
            user.DeletionCancelToken = null;
        }

        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konto,
            req.IsActive
                ? (cancelsDeletion ? $"Konto återaktiverat och schemalagd radering avbruten — {user.Name}" : $"Konto återaktiverat — {user.Name}")
                : $"Konto spärrat — {user.Name}",
            req.IsActive ? "" : (req.Reason ?? "Ingen anledning angiven"));
        return Ok();
    }

    // GDPR-radering (artikel 17) implementerad som anonymisering, inte fysisk radering
    // av raden — kontot refereras av RefreshTokens/SupportTickets/UserSourcePreference
    // m.fl. via FK, och en anonymiserad rad håller referentiell integritet intakt utan
    // att behöva städa upp varje beroende tabell för hand.
    //
    // 24h ångerfönster: kontot spärras omedelbart (samma inloggnings-/refresh-spärr
    // som en vanlig avstängning slår igenom på direkt), men den faktiska
    // anonymiseringen (namn/e-post/lösenord skrivs över) sker inte förrän
    // UserDeletionBackgroundService kör igenom DeletionScheduledAt. Fram tills dess
    // kan raderingen ångras via CancelDeletion.
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (id == CurrentUserId)
            return BadRequest(new { error = "Du kan inte radera ditt eget konto." });

        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        if (user.DeletedAt != null)
            return BadRequest(new { error = "Kontot är redan raderat." });
        if (user.DeletionScheduledAt != null)
            return BadRequest(new { error = "Radering är redan schemalagd för det här kontot." });

        if (await AccountSuspension.IsLastActiveAdminAsync(_db, user))
            return BadRequest(new { error = "Det här är den sista aktiva administratören och kan inte raderas." });

        // Redan admin-spärrat konto: behåll admins spärr (orsak/tid) i stället för att skriva över den
        // med raderingsmarkören — annars kunde användarens ångra-länk häva admins spärr.
        var keepAdminSuspension = AccountSuspension.IsAdminSuspended(user);

        user.IsActive            = false;
        if (!keepAdminSuspension)
        {
            user.SuspendedAt       ??= DateTime.UtcNow;
            user.SuspendedReason     = AccountSuspension.AdminDeletionReason;
        }
        user.DeletionScheduledAt = DateTime.UtcNow.AddHours(24);
        user.DeletionCancelToken = Guid.NewGuid().ToString("N");

        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konto,
            $"Radering begärd — {user.Name}",
            $"Verkställs {user.DeletionScheduledAt:yyyy-MM-dd HH:mm} UTC om ingen avbryter");

        var cancelLink = $"{_frontendUrl.TrimEnd('/')}/cancel-deletion?token={Uri.EscapeDataString(user.DeletionCancelToken)}";
        _ = _email.SendAccountDeletionScheduledAsync(user.Email, user.Name, cancelLink, user.DeletionScheduledAt.Value);

        return Ok(new { deletionScheduledAt = user.DeletionScheduledAt });
    }

    // Ångrar en schemalagd (ännu ej verkställd) radering — återaktiverar kontot.
    // Går inte att ångra efter att UserDeletionBackgroundService redan anonymiserat.
    [HttpPost("{id}/cancel-deletion")]
    public async Task<IActionResult> CancelDeletion(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();
        if (user.DeletionScheduledAt == null)
            return BadRequest(new { error = "Ingen radering är schemalagd för det här kontot." });

        // Bara en spärr som uteslutande beror på raderingen hävs. Har en admin spärrat kontot
        // (före eller efter begäran) avbryts raderingen men spärren står kvar — admin återaktiverar
        // i så fall uttryckligen via SetStatus.
        var restoreAccess = AccountSuspension.IsDeletionOnlySuspension(user) || user.IsActive;

        user.DeletionScheduledAt = null;
        user.DeletionCancelToken = null;
        if (restoreAccess)
        {
            user.IsActive        = true;
            user.SuspendedAt     = null;
            user.SuspendedReason = null;
        }

        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konto,
            $"Radering ångrad — {user.Name}",
            restoreAccess ? "Kontot återaktiverat" : "Kontot är fortfarande spärrat av admin");
        return Ok();
    }

    // Återanvänder exakt samma token/mejl-mekanism som självbetjäningens
    // "Glömt lösenord" (AuthService.RequestPasswordResetAsync) — admin skickar
    // bara länken å användarens vägnar, ingen separat adminspecifik logik.
    [HttpPost("{id}/send-password-reset")]
    public async Task<IActionResult> SendPasswordReset(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        var result = await _auth.RequestPasswordResetAsync(user.Email);
        await _aktivitetslogg.LogAsync(
            AktörTyper.Admin, LoggTyper.Konto,
            $"Lösenordsåterställning skickad — {user.Name}", "");

        return result.Success ? Ok(new { message = result.Message }) : StatusCode(result.StatusCode, new { error = result.Error });
    }

    // Samma resonemang som ovan — återanvänder självbetjäningens
    // AuthService.ResendVerificationAsync.
    [HttpPost("{id}/resend-verification")]
    public async Task<IActionResult> ResendVerification(Guid id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        var result = await _auth.ResendVerificationAsync(id);
        if (result.Success)
        {
            await _aktivitetslogg.LogAsync(
                AktörTyper.Admin, LoggTyper.Konto,
                $"Verifieringsmejl skickat — {user.Name}", "");
        }

        return result.Success ? Ok(new { message = result.Message }) : StatusCode(result.StatusCode, new { error = result.Error });
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
