namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService          _auth;
    private readonly ITokenService         _tokens;
    private readonly AppDbContext          _db;
    private readonly IPasswordHasher<User> _hasher;

    public AuthController(IAuthService auth, ITokenService tokens, AppDbContext db, IPasswordHasher<User> hasher)
    {
        _auth   = auth;
        _tokens = tokens;
        _db     = db;
        _hasher = hasher;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req) =>
        ToActionResult(await _auth.LoginAsync(req.Email, req.Password));

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req) =>
        ToActionResult(await _auth.RegisterAsync(req.Name, req.Email, req.Password, req.AcceptedTerms));

    [HttpPost("google")]
    public async Task<IActionResult> Google([FromBody] GoogleLoginRequest req) =>
        ToActionResult(await _auth.GoogleLoginAsync(req.IdToken, req.AcceptedTerms));

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest req) =>
        ToActionResult(await _auth.RefreshAsync(req.RefreshToken));

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest req) =>
        ToActionResult(await _auth.LogoutAsync(req.RefreshToken));

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req) =>
        ToActionResult(await _auth.RequestPasswordResetAsync(req.Email));

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req) =>
        ToActionResult(await _auth.ResetPasswordAsync(req.Token, req.NewPassword));

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest req) =>
        ToActionResult(await _auth.VerifyEmailAsync(req.Token));

    [HttpPost("resend-verification")]
    [Authorize]
    public async Task<IActionResult> ResendVerification()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        return ToActionResult(await _auth.ResendVerificationAsync(userId));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user   = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        return Ok(new { user.Email, user.Name, user.DisplayName, user.Role, user.EmailVerified });
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateMeRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user   = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        // DisplayName är bara meningsfullt för konton som faktiskt kan svara på
        // ärenden — spärra på fältet direkt istället för att förlita oss på att
        // varje framtida kodväg som skapar agent-svar kommer ihåg att kolla rollen.
        if (req.DisplayName != null && user.Role != "Admin" && user.Role != "Support")
            return StatusCode(403, new { error = "Bara admin eller support kan sätta ett visningsnamn." });

        var oldName        = user.Name;
        var oldEmail       = user.Email;
        var oldDisplayName = user.DisplayName;

        if (!string.IsNullOrWhiteSpace(req.Name))  user.Name  = req.Name;
        if (!string.IsNullOrWhiteSpace(req.Email))
        {
            if (await _db.Users.AnyAsync(u => u.Email == req.Email && u.Id != userId))
                return Conflict(new { error = "E-postadressen används redan" });
            // Ett byte till en ny adress kräver en ny bekräftelse — annars
            // skulle en redan bekräftad status felaktigt gälla en adress
            // vi aldrig verifierat att kontot faktiskt äger.
            if (req.Email != user.Email) user.EmailVerified = false;
            user.Email = req.Email;
        }
        // Explicit null = rör inte fältet, tom sträng = nollställ tillbaka till "Support".
        if (req.DisplayName != null)
            user.DisplayName = string.IsNullOrWhiteSpace(req.DisplayName) ? null : req.DisplayName.Trim();

        if (user.Name != oldName)
            _db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = userId, Setting = "name", OldValue = oldName, NewValue = user.Name });
        if (user.Email != oldEmail)
            _db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = userId, Setting = "email", OldValue = oldEmail, NewValue = user.Email });
        if (user.DisplayName != oldDisplayName)
            _db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = userId, Setting = "displayName", OldValue = oldDisplayName, NewValue = user.DisplayName });

        await _db.SaveChangesAsync();

        if (user.Email != oldEmail)
            _ = _auth.ResendVerificationAsync(userId);

        var accessToken = _tokens.GenerateAccessToken(user);
        return Ok(new { accessToken, name = user.Name, displayName = user.DisplayName, role = user.Role });
    }

    [HttpPut("me/password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user   = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        if (_hasher.VerifyHashedPassword(user, user.PasswordHash, req.CurrentPassword) == PasswordVerificationResult.Failed)
            return Unauthorized(new { error = "Nuvarande lösenord stämmer inte" });

        user.PasswordHash = _hasher.HashPassword(user, req.NewPassword);

        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = userId, Setting = "password", OldValue = null, NewValue = null, ChangedBy = "user" });

        await _db.SaveChangesAsync();
        return Ok(new { message = "Lösenordet är uppdaterat" });
    }

    // Self-service GDPR-export (artikel 20) — riktig data, ersätter den
    // tidigare klientsidan som genererade en fejkad JSON med hårdkodade
    // "(mock) Polisen"-källor. Interna supportanteckningar (IsInternal)
    // exkluderas medvetet, de är aldrig menade att synas för användaren.
    [HttpGet("me/export")]
    [Authorize]
    public async Task<IActionResult> ExportMe()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        var kallor = await (
            from p in _db.UserSourcePreferences
            where p.UserId == userId
            join s in _db.Sources on p.SourceId equals s.Id
            orderby p.SortOrder
            select new { Namn = s.ShortName, p.IsActive }
        ).ToListAsync();

        var sparadeHandelser = await (
            from sv in _db.UserSavedEvents
            where sv.UserId == userId
            join e in _db.Events on sv.EventId equals e.Id
            join src in _db.Sources on e.SourceId equals src.Id into srcJ
            from src in srcJ.DefaultIfEmpty()
            orderby sv.SavedAt descending
            select new { Titel = e.Title, Kalla = src != null ? src.ShortName : "Okänd källa", sv.SavedAt }
        ).ToListAsync();

        var polisenBevakningar = (await _db.PolisenBevakningar
                .Where(b => b.UserId == userId)
                .OrderBy(b => b.CreatedAt)
                .ToListAsync())
            .Select(b => new
            {
                Kategorier = b.KategorierJson == null ? null : JsonSerializer.Deserialize<List<string>>(b.KategorierJson),
                Omraden    = b.OmradenJson    == null ? null : JsonSerializer.Deserialize<List<string>>(b.OmradenJson),
            })
            .ToList();

        var notisPerKalla = await (
            from n in _db.UserNotificationSettings
            where n.UserId == userId
            join s in _db.Sources on n.SourceId equals s.Id
            select new { Kalla = s.ShortName, n.PushEnabled, n.EmailEnabled, n.SmsEnabled }
        ).ToListAsync();

        var storEj = await _db.UserDoNotDisturbSchedules.FirstOrDefaultAsync(d => d.UserId == userId);

        var notisHistorik = await _db.NotificationDeliveryLogs
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.SentAt)
            .Take(100)
            .Select(l => new { l.SentAt, l.Channel, l.Subject, l.Status })
            .ToListAsync();

        var ärenden = await _db.SupportTickets
            .Where(t => t.CreatedByUserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        var ärendeIds = ärenden.Select(a => a.Id).ToList();
        var meddelanden = await _db.SupportTicketMessages
            .Where(m => ärendeIds.Contains(m.TicketId) && !m.IsInternal)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        var ärendenExport = ärenden.Select(a => new
        {
            ÄrendeId = $"SUP-{a.TicketNumber:0000}",
            a.Subject,
            a.Category,
            a.Status,
            a.CreatedAt,
            Meddelanden = meddelanden.Where(m => m.TicketId == a.Id).Select(m => new { m.SenderType, m.Text, m.CreatedAt }),
        });

        return Ok(new
        {
            Konto = new { user.Name, user.Email, user.CreatedAt, user.AuthProvider, user.EmailVerified },
            Kallor = kallor,
            SparadeHandelser = sparadeHandelser,
            PolisenBevakningar = polisenBevakningar,
            Notisinstallningar = new
            {
                PerKalla = notisPerKalla,
                user.PushNyaHandelser,
                user.PushNyVersion,
                StorEj = storEj == null ? null : new
                {
                    storEj.IsEnabled,
                    StartTid = storEj.StartTime.ToString("HH:mm"),
                    SlutTid  = storEj.EndTime.ToString("HH:mm"),
                },
            },
            NotisleveransHistorik = notisHistorik,
            Supportärenden = ärendenExport,
        });
    }

    // Self-service GDPR-radering (artikel 17) — samma 24h-fördröjda
    // anonymiseringsmekanism som AdminUsersController.Delete (kontot spärras
    // direkt, UserDeletionBackgroundService anonymiserar efter fristen).
    // Ingen self-service-ångra: IsActive=false blockerar inloggning direkt
    // (se AuthService.LoginAsync), så användaren kan inte logga in igen för
    // att ångra sig själv inom fristen — måste kontakta supporten, medvetet,
    // samma säkerhetsmarginal som redan finns för admin-initierad radering.
    [HttpDelete("me")]
    [Authorize]
    public async Task<IActionResult> DeleteMe()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();
        if (user.DeletionScheduledAt != null)
            return BadRequest(new { error = "Radering är redan schemalagd för ditt konto." });

        user.IsActive            = false;
        user.SuspendedAt       ??= DateTime.UtcNow;
        user.SuspendedReason     = "Radering begärd av användaren (GDPR) — raderas automatiskt om 24 timmar";
        user.DeletionScheduledAt = DateTime.UtcNow.AddHours(24);

        await _db.SaveChangesAsync();
        return Ok(new { deletionScheduledAt = user.DeletionScheduledAt });
    }

    private IActionResult ToActionResult(AuthResult result)
    {
        if (!result.Success)
            return StatusCode(result.StatusCode, new { error = result.Error });

        if (result.Tokens != null)
            return Ok(new
            {
                accessToken  = result.Tokens.AccessToken,
                refreshToken = result.Tokens.RefreshToken,
                name         = result.Tokens.Name,
                role         = result.Tokens.Role,
            });

        return Ok(new { message = result.Message });
    }
}

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Name, string Email, string Password, bool AcceptedTerms);
public record GoogleLoginRequest(string IdToken, bool AcceptedTerms);
public record RefreshRequest(string RefreshToken);
public record UpdateMeRequest(string? Name, string? Email, string? DisplayName = null);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);
public record VerifyEmailRequest(string Token);
