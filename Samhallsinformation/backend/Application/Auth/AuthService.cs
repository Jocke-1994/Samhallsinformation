namespace Samhallsinformation.Application.Auth;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

public class AuthService : IAuthService
{
    private static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(30);

    private readonly AppDbContext             _db;
    private readonly ITokenService            _tokens;
    private readonly IPasswordHasher<User>    _hasher;
    private readonly IEmailService            _email;
    private readonly IGoogleTokenValidator    _google;
    private readonly IPushNotificationService _push;
    private readonly IAktivitetsloggService   _aktivitetslogg;
    private readonly string                   _frontendUrl;

    public AuthService(AppDbContext db, ITokenService tokens, IPasswordHasher<User> hasher, IEmailService email, IGoogleTokenValidator google, IPushNotificationService push, IAktivitetsloggService aktivitetslogg, IConfiguration config)
    {
        _db          = db;
        _tokens      = tokens;
        _hasher      = hasher;
        _email       = email;
        _google      = google;
        _push        = push;
        _aktivitetslogg = aktivitetslogg;
        _frontendUrl = config["FRONTEND_URL"] ?? "https://samhallsinformation.se";
    }

    public async Task<AuthResult> RegisterAsync(string name, string email, string password, bool acceptedTerms)
    {
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            return AuthResult.Fail(400, "Namn, e-post och lösenord krävs");

        if (!acceptedTerms)
            return AuthResult.Fail(400, "Du måste godkänna användarvillkoren");

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return AuthResult.Fail(409, "E-postadressen används redan");

        var user = new User { Name = name, Email = email, TermsAcceptedAt = DateTime.UtcNow };
        user.PasswordHash = _hasher.HashPassword(user, password);
        _db.Users.Add(user);

        // Nya konton börjar utan källor — ingen auto-seed av alla publicerade
        // källor. Annars riskerar en användare som hoppar över källval att
        // drunkna i notiser från allt, istället för att aktivt välja vad de
        // vill följa (session 24, #298).
        await _db.SaveChangesAsync();

        _ = _email.SendWelcomeAsync(user.Email, user.Name);
        await PushDispatcher.DispatchNewUserAsync(_db, _push, _frontendUrl, user);
        await _aktivitetslogg.LogAsync(AktörTyper.System, LoggTyper.Registrering, "Ny registrering", $"{user.Name} — via Lösenord");

        var verificationToken = new EmailVerificationToken { UserId = user.Id };
        _db.EmailVerificationTokens.Add(verificationToken);
        await _db.SaveChangesAsync();

        var verifyLink = $"{_frontendUrl}/verify-email?token={verificationToken.Token}";
        _ = _email.SendEmailVerificationAsync(user.Email, user.Name, verifyLink);

        return await IssueTokensAsync(user);
    }

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
            return AuthResult.Fail(401, "Felaktigt e-post eller lösenord");

        // Google-konton har ingen (giltig) PasswordHash — hashern kan kasta på
        // ett tomt/malformerat hash-värde, så avvisa innan vi ens verifierar.
        if (user.AuthProvider != "local")
            return AuthResult.Fail(401, "Det här kontot loggar in via Google. Använd Google-knappen istället.");

        var verification = _hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (verification == PasswordVerificationResult.Failed)
            return AuthResult.Fail(401, "Felaktigt e-post eller lösenord");

        if (!user.IsActive)
            return AuthResult.Fail(403, "Kontot är avstängt. Kontakta support om du tror det här är ett misstag.");

        return await IssueTokensAsync(user);
    }

    public async Task<AuthResult> GoogleLoginAsync(string idToken, bool acceptedTerms)
    {
        var payload = await _google.ValidateAsync(idToken);
        if (payload == null)
            return AuthResult.Fail(401, "Ogiltig Google-inloggning");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == payload.Email);

        if (user == null)
        {
            if (!acceptedTerms)
                return AuthResult.Fail(400, "Du måste godkänna användarvillkoren");

            user = new User
            {
                Name            = payload.Name,
                Email           = payload.Email,
                AuthProvider    = "google",
                TermsAcceptedAt = DateTime.UtcNow,
                // Google har redan verifierat ägarskapet av adressen som en del av
                // OAuth-flödet — en påminnelsebanderoll om att bekräfta e-posten
                // vore meningslös friktion för något som redan är bevisat sant.
                EmailVerified   = true,
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            _ = _email.SendWelcomeAsync(user.Email, user.Name);
            await PushDispatcher.DispatchNewUserAsync(_db, _push, _frontendUrl, user);
            await _aktivitetslogg.LogAsync(AktörTyper.System, LoggTyper.Registrering, "Ny registrering", $"{user.Name} — via Google");
        }

        if (!user.IsActive)
            return AuthResult.Fail(403, "Kontot är avstängt. Kontakta support om du tror det här är ett misstag.");

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

        if (!existing.User.IsActive)
            return AuthResult.Fail(403, "Kontot är avstängt. Kontakta support om du tror det här är ett misstag.");

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

    public async Task<AuthResult> VerifyEmailAsync(string token)
    {
        var verificationToken = await _db.EmailVerificationTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == token);

        if (verificationToken == null || verificationToken.UsedAt != null || verificationToken.ExpiresAt < DateTime.UtcNow)
            return AuthResult.Fail(400, "Länken är ogiltig eller har gått ut");

        verificationToken.User.EmailVerified = true;
        verificationToken.UsedAt             = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return AuthResult.Ok("E-postadressen är bekräftad");
    }

    public async Task<AuthResult> ResendVerificationAsync(Guid userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return AuthResult.Fail(404, "Användaren hittades inte");

        if (user.EmailVerified)
            return AuthResult.Ok("E-postadressen är redan bekräftad");

        var verificationToken = new EmailVerificationToken { UserId = user.Id };
        _db.EmailVerificationTokens.Add(verificationToken);
        await _db.SaveChangesAsync();

        var verifyLink = $"{_frontendUrl}/verify-email?token={verificationToken.Token}";
        _ = _email.SendEmailVerificationAsync(user.Email, user.Name, verifyLink);

        return AuthResult.Ok("Ett nytt bekräftelsemejl har skickats");
    }

    public async Task<AuthResult> RequestEmailChangeAsync(Guid userId, string newEmail, string? currentPassword)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return AuthResult.Fail(404, "Användaren hittades inte");

        // En kapad session (stulen access-token) ska inte ensam räcka för att
        // byta bort kontots e-post — kräv beviset man redan bad om vid inloggning.
        // Google-konton har ingen (giltig) PasswordHash, se samma resonemang i
        // LoginAsync — inget lösenord att be om där.
        if (user.AuthProvider == "local")
        {
            if (string.IsNullOrEmpty(currentPassword))
                return AuthResult.Fail(400, "Ange ditt lösenord för att bekräfta bytet");
            if (_hasher.VerifyHashedPassword(user, user.PasswordHash, currentPassword) == PasswordVerificationResult.Failed)
                return AuthResult.Fail(401, "Fel lösenord");
        }

        newEmail = newEmail.Trim();
        if (string.IsNullOrWhiteSpace(newEmail) || !newEmail.Contains('@'))
            return AuthResult.Fail(400, "Ange en giltig e-postadress");

        if (newEmail == user.Email)
            return AuthResult.Fail(400, "Det är redan din adress");

        if (await _db.Users.AnyAsync(u => u.Email == newEmail && u.Id != userId))
            return AuthResult.Fail(409, "E-postadressen används redan");

        // En ny förfrågan ersätter en eventuell tidigare väntande — annars kan
        // flera giltiga länkar peka mot olika adresser samtidigt.
        var tidigare = await _db.EmailChangeTokens
            .Where(t => t.UserId == userId && t.UsedAt == null)
            .ToListAsync();
        foreach (var t in tidigare) t.UsedAt = DateTime.UtcNow;

        var changeToken = new EmailChangeToken { UserId = userId, NewEmail = newEmail };
        _db.EmailChangeTokens.Add(changeToken);
        await _db.SaveChangesAsync();

        var confirmLink = $"{_frontendUrl}/confirm-email-change?token={changeToken.Token}";
        _ = _email.SendEmailChangeConfirmationAsync(newEmail, user.Name, confirmLink);
        _ = _email.SendEmailChangeNoticeAsync(user.Email, user.Name, newEmail);

        return AuthResult.Ok("Ett bekräftelsemejl har skickats till den nya adressen");
    }

    public async Task<AuthResult> ConfirmEmailChangeAsync(string token)
    {
        var changeToken = await _db.EmailChangeTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == token);

        if (changeToken == null || changeToken.UsedAt != null || changeToken.ExpiresAt < DateTime.UtcNow)
            return AuthResult.Fail(400, "Länken är ogiltig eller har gått ut");

        // Adressen kan ha hunnit tas av någon annan sedan bekräftelsemejlet skickades.
        if (await _db.Users.AnyAsync(u => u.Email == changeToken.NewEmail && u.Id != changeToken.UserId))
            return AuthResult.Fail(409, "E-postadressen används redan");

        var oldEmail = changeToken.User.Email;
        changeToken.User.Email         = changeToken.NewEmail;
        // Länken skickades till och klickades från den nya adressen — det
        // beviset på ägarskap är detsamma som e-postverifiering vid registrering.
        changeToken.User.EmailVerified = true;
        changeToken.UsedAt             = DateTime.UtcNow;

        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
        {
            UserId = changeToken.UserId, Setting = "email", OldValue = oldEmail, NewValue = changeToken.NewEmail,
        });

        // Ett lyckat e-postbyte loggar ut alla enheter, även den som bekräftade
        // — samma "signa ut allt vid en känslig kontoändring"-mönster som stora
        // leverantörer använder. Tvingar en ny inloggning med den nya adressen.
        var aktivaRefreshTokens = await _db.RefreshTokens
            .Where(t => t.UserId == changeToken.UserId && t.RevokedAt == null)
            .ToListAsync();
        foreach (var rt in aktivaRefreshTokens) rt.RevokedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return AuthResult.Ok("E-postadressen är uppdaterad");
    }

    public async Task<AuthResult> CancelEmailChangeAsync(Guid userId)
    {
        var väntande = await _db.EmailChangeTokens
            .Where(t => t.UserId == userId && t.UsedAt == null)
            .ToListAsync();

        foreach (var t in väntande) t.UsedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return AuthResult.Ok("Bytet är avbrutet");
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
