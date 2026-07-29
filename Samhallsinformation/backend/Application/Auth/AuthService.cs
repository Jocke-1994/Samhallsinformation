namespace Samhallsinformation.Application.Auth;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

public class AuthService : IAuthService
{
    private static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(30);

    private readonly AppDbContext          _db;
    private readonly ITokenService         _tokens;
    private readonly IPasswordHasher<User> _hasher;
    private readonly IEmailService         _email;
    private readonly string                _frontendUrl;

    public AuthService(AppDbContext db, ITokenService tokens, IPasswordHasher<User> hasher, IEmailService email, IConfiguration config)
    {
        _db          = db;
        _tokens      = tokens;
        _hasher      = hasher;
        _email       = email;
        _frontendUrl = config["FRONTEND_URL"] ?? "https://samhallsinformation.se";
    }

    public async Task<AuthResult> RegisterAsync(string name, string email, string password)
    {
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            return AuthResult.Fail(400, "Namn, e-post och lösenord krävs");

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return AuthResult.Fail(409, "E-postadressen används redan");

        var user = new User { Name = name, Email = email };
        user.PasswordHash = _hasher.HashPassword(user, password);
        _db.Users.Add(user);

        // Nya konton börjar utan källor — ingen auto-seed av alla publicerade
        // källor. Annars riskerar en användare som hoppar över källval att
        // drunkna i notiser från allt, istället för att aktivt välja vad de
        // vill följa (session 24, #298).
        await _db.SaveChangesAsync();

        _ = _email.SendWelcomeAsync(user.Email, user.Name);

        return await IssueTokensAsync(user);
    }

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
            return AuthResult.Fail(401, "Felaktigt e-post eller lösenord");

        var verification = _hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (verification == PasswordVerificationResult.Failed)
            return AuthResult.Fail(401, "Felaktigt e-post eller lösenord");

        return await IssueTokensAsync(user);
    }

    public async Task<AuthResult> RefreshAsync(string refreshToken)
    {
        var hash = _tokens.HashToken(refreshToken);
        var existing = await _db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash);

        if (existing == null || existing.RevokedAt != null || existing.ExpiresAt < DateTime.UtcNow)
            return AuthResult.Fail(401, "Ogiltig eller utgången refresh-token");

        var (rawToken, newHash) = _tokens.GenerateRefreshToken();

        existing.RevokedAt           = DateTime.UtcNow;
        existing.ReplacedByTokenHash = newHash;

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId    = existing.UserId,
            TokenHash = newHash,
            ExpiresAt = DateTime.UtcNow.Add(RefreshTokenLifetime),
        });

        await _db.SaveChangesAsync();

        var accessToken = _tokens.GenerateAccessToken(existing.User);
        return AuthResult.Ok(new AuthTokens(accessToken, rawToken, existing.User.Name, existing.User.Role));
    }

    public async Task<AuthResult> LogoutAsync(string refreshToken)
    {
        var hash = _tokens.HashToken(refreshToken);
        var existing = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);

        if (existing != null && existing.RevokedAt == null)
        {
            existing.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return AuthResult.Ok("Utloggad");
    }

    public async Task<AuthResult> RequestPasswordResetAsync(string email)
    {
        const string genericMessage = "Om e-postadressen finns skickas ett återställningsmejl";

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
            return AuthResult.Ok(genericMessage);

        var resetToken = new PasswordResetToken { UserId = user.Id };
        _db.PasswordResetTokens.Add(resetToken);
        await _db.SaveChangesAsync();

        var resetLink = $"{_frontendUrl}/reset-password?token={resetToken.Token}";
        _ = _email.SendPasswordResetAsync(user.Email, user.Name, resetLink);

        return AuthResult.Ok(genericMessage);
    }

    public async Task<AuthResult> ResetPasswordAsync(string token, string newPassword)
    {
        var resetToken = await _db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == token);

        if (resetToken == null || resetToken.UsedAt != null || resetToken.ExpiresAt < DateTime.UtcNow)
            return AuthResult.Fail(400, "Länken är ogiltig eller har gått ut");

        if (newPassword.Length < 8)
            return AuthResult.Fail(400, "Lösenordet måste vara minst 8 tecken");

        resetToken.User.PasswordHash = _hasher.HashPassword(resetToken.User, newPassword);
        resetToken.UsedAt = DateTime.UtcNow;

        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
        {
            UserId    = resetToken.UserId,
            Setting   = "password",
            ChangedBy = "reset",
        });

        await _db.SaveChangesAsync();
        return AuthResult.Ok("Lösenordet är uppdaterat");
    }

    private async Task<AuthResult> IssueTokensAsync(User user)
    {
        var accessToken         = _tokens.GenerateAccessToken(user);
        var (rawRefresh, hash)  = _tokens.GenerateRefreshToken();

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId    = user.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.Add(RefreshTokenLifetime),
        });

        await _db.SaveChangesAsync();

        return AuthResult.Ok(new AuthTokens(accessToken, rawRefresh, user.Name, user.Role));
    }
}
