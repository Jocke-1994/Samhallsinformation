namespace Samhallsinformation.Controllers;

using System.Security.Claims;
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

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user   = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        return Ok(new { user.Email, user.Name, user.DisplayName, user.Role });
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
public record RefreshRequest(string RefreshToken);
public record UpdateMeRequest(string? Name, string? Email, string? DisplayName = null);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);
