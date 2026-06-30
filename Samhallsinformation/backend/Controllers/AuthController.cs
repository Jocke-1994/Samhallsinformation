namespace Samhallsinformation.Controllers;

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext  _db;
    private readonly IEmailService _email;
    private readonly string        _jwtSecret;
    private readonly string        _frontendUrl;

    public AuthController(AppDbContext db, IEmailService email, IConfiguration config)
    {
        _db          = db;
        _email       = email;
        _jwtSecret   = config["JWT_SECRET"] ?? "dev-secret-change-in-production-at-least-32-chars";
        _frontendUrl = config["FRONTEND_URL"] ?? "https://samhallsinformation.se";
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest req)
    {
        var user = _db.Users.FirstOrDefault(u => u.Email == req.Email);
        if (user == null)
            return Unauthorized(new { error = "Felaktigt e-post eller lösenord" });

        var hasher = new PasswordHasher<User>();
        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
        if (result == PasswordVerificationResult.Failed)
            return Unauthorized(new { error = "Felaktigt e-post eller lösenord" });

        var token = GenerateToken(user);
        return Ok(new { token, name = user.Name, role = user.Role });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Namn, e-post och lösenord krävs" });

        if (await _db.Users.AnyAsync(u => u.Email == req.Email))
            return Conflict(new { error = "E-postadressen används redan" });

        var hasher = new PasswordHasher<User>();
        var user   = new User { Name = req.Name, Email = req.Email };
        user.PasswordHash = hasher.HashPassword(user, req.Password);

        _db.Users.Add(user);

        var sources = await _db.Sources.Where(s => s.IsPublished).OrderBy(s => s.Id).ToListAsync();
        for (int i = 0; i < sources.Count; i++)
        {
            _db.UserSourcePreferences.Add(new UserSourcePreference
            {
                UserId    = user.Id,
                SourceId  = sources[i].Id,
                IsActive  = true,
                SortOrder = i,
            });
        }

        await _db.SaveChangesAsync();

        _ = _email.SendWelcomeAsync(user.Email, user.Name);

        var token = GenerateToken(user);
        return Ok(new { token, name = user.Name, role = user.Role });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
        if (user == null)
            return Ok(new { message = "Om e-postadressen finns skickas ett återställningsmejl" });

        var resetToken = new PasswordResetToken { UserId = user.Id };
        _db.PasswordResetTokens.Add(resetToken);
        await _db.SaveChangesAsync();

        var resetLink = $"{_frontendUrl}/reset-password?token={resetToken.Token}";
        _ = _email.SendPasswordResetAsync(user.Email, user.Name, resetLink);

        return Ok(new { message = "Om e-postadressen finns skickas ett återställningsmejl" });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        var resetToken = await _db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == req.Token);

        if (resetToken == null || resetToken.UsedAt != null || resetToken.ExpiresAt < DateTime.UtcNow)
            return BadRequest(new { error = "Länken är ogiltig eller har gått ut" });

        if (req.NewPassword.Length < 8)
            return BadRequest(new { error = "Lösenordet måste vara minst 8 tecken" });

        var hasher = new PasswordHasher<User>();
        resetToken.User.PasswordHash = hasher.HashPassword(resetToken.User, req.NewPassword);
        resetToken.UsedAt = DateTime.UtcNow;

        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
        {
            UserId    = resetToken.UserId,
            Setting   = "password",
            ChangedBy = "reset",
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = "Lösenordet är uppdaterat" });
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        var name  = User.FindFirstValue("name");
        var role  = User.FindFirstValue("role");
        return Ok(new { email, name, role });
    }

    [HttpPut("me")]
    [Authorize]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateMeRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user   = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        var oldName  = user.Name;
        var oldEmail = user.Email;

        if (!string.IsNullOrWhiteSpace(req.Name))  user.Name  = req.Name;
        if (!string.IsNullOrWhiteSpace(req.Email))
        {
            if (await _db.Users.AnyAsync(u => u.Email == req.Email && u.Id != userId))
                return Conflict(new { error = "E-postadressen används redan" });
            user.Email = req.Email;
        }

        if (user.Name != oldName)
            _db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = userId, Setting = "name", OldValue = oldName, NewValue = user.Name });
        if (user.Email != oldEmail)
            _db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = userId, Setting = "email", OldValue = oldEmail, NewValue = user.Email });

        await _db.SaveChangesAsync();

        var token = GenerateToken(user);
        return Ok(new { token, name = user.Name, role = user.Role });
    }

    [HttpPut("me/password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user   = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        var hasher = new PasswordHasher<User>();
        if (hasher.VerifyHashedPassword(user, user.PasswordHash, req.CurrentPassword) == PasswordVerificationResult.Failed)
            return Unauthorized(new { error = "Nuvarande lösenord stämmer inte" });

        user.PasswordHash = hasher.HashPassword(user, req.NewPassword);

        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = userId, Setting = "password", OldValue = null, NewValue = null, ChangedBy = "user" });

        await _db.SaveChangesAsync();
        return Ok(new { message = "Lösenordet är uppdaterat" });
    }

    private string GenerateToken(User user)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier,     user.Id.ToString()),
            new Claim(ClaimTypes.Email,              user.Email),
            new Claim("name",                        user.Name),
            new Claim("role",                        user.Role),
        };

        var token = new JwtSecurityToken(
            claims:             claims,
            expires:            DateTime.UtcNow.AddDays(30),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Name, string Email, string Password);
public record UpdateMeRequest(string? Name, string? Email);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);
