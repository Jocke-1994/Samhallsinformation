namespace Samhallsinformation.Application.Auth;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

public class AuthService : IAuthService
{
    private static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(30);
    private const int MaxEmailLength = 254; // RFC 5321-gränsen för en adress

    private readonly ILogger<AuthService>?    _logger;
    private readonly AppDbContext             _db;
    private readonly ITokenService            _tokens;
    private readonly IPasswordHasher<User>    _hasher;
    private readonly IEmailService            _email;
    private readonly IGoogleTokenValidator    _google;
    private readonly IPushNotificationService _push;
    private readonly IAktivitetsloggService   _aktivitetslogg;
    private readonly LoginThrottle            _loginThrottle;
    private readonly string                   _frontendUrl;

    public AuthService(AppDbContext db, ITokenService tokens, IPasswordHasher<User> hasher, IEmailService email, IGoogleTokenValidator google, IPushNotificationService push, IAktivitetsloggService aktivitetslogg, LoginThrottle loginThrottle, IConfiguration config, ILogger<AuthService>? logger = null)
    {
        _loginThrottle = loginThrottle;
        _logger      = logger;
        _db          = db;
        _tokens      = tokens;
        _hasher      = hasher;
        _email       = email;
        _google      = google;
        _push        = push;
        _aktivitetslogg = aktivitetslogg;
        _frontendUrl = config["FRONTEND_URL"] ?? "https://samhallsinformation.se";
    }

    // Skiftlägesokänsligt uppslag mot normaliserad adress (V2-11, D6). Jämför ToLower() så att även
    // äldre rader med versaler hittas. Skulle databasen (före datafixen, eller om den avbröts pga
    // krock) innehålla flera rader som normaliseras lika, väljs exakt träff först och sedan äldsta
    // kontot — samma resultat som det gamla exakta uppslaget gav.
    private Task<User?> FindByEmailAsync(string normalizedEmail) =>
        _db.Users
            .Where(u => u.Email.ToLower() == normalizedEmail)
            .OrderByDescending(u => u.Email == normalizedEmail)
            .ThenBy(u => u.CreatedAt)
            .FirstOrDefaultAsync();

    public async Task<AuthResult> RegisterAsync(string name, string email, string password, bool acceptedTerms)
    {
        email = EmailNormalizer.Normalize(email);

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            return AuthResult.Fail(400, "Namn, e-post och lösenord krävs");

        if (!acceptedTerms)
            return AuthResult.Fail(400, "Du måste godkänna användarvillkoren");

        if (!email.Contains('@') || email.Length > MaxEmailLength)
            return AuthResult.Fail(400, "Ange en giltig e-postadress");

        var policyFel = PasswordPolicy.Validate(password);
        if (policyFel != null)
            return AuthResult.Fail(400, policyFel);

        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == email))
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
        await NotifyStaffNewUserAsync(user);
        await _aktivitetslogg.LogAsync(AktörTyper.System, LoggTyper.Registrering, "Ny registrering", $"{user.Name} — via Lösenord");

        var verificationToken = new EmailVerificationToken { UserId = user.Id };
        _db.EmailVerificationTokens.Add(verificationToken);
        await _db.SaveChangesAsync();

        var verifyLink = $"{_frontendUrl}/verify-email?token={Uri.EscapeDataString(verificationToken.Token)}";
        _ = _email.SendEmailVerificationAsync(user.Email, user.Name, verifyLink);

        return await IssueTokensAsync(user, isNewUser: true);
    }

    // Push till personalen är en sidoeffekt EFTER att kontot är sparat: ett fel eller
    // en timeout där får aldrig ge registranten 500 (kontot finns redan, verifierings-
    // token skulle utebli och omförsök ge 409). PushFanOut har egen timeout per enhet.
    private async Task NotifyStaffNewUserAsync(User user)
    {
        try
        {
            await PushDispatcher.DispatchNewUserAsync(_db, _push, _frontendUrl, user);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Kunde inte skicka ny-användare-push för {UserId}", user.Id);
        }
    }

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        var normalizedEmail = EmailNormalizer.Normalize(email);

        // Kontobaserad spärr (V2-10): nyckas på den inskrivna adressen, inte på om kontot finns, så
        // svaret är detsamma för känd och okänd adress. Försöket bokförs här och tas bort igen vid
        // rätt lösenord; alla vägar nedan som avvisar med 401 lämnar det bokfört.
        var retryAfter = _loginThrottle.TryAcquire(normalizedEmail);
        if (retryAfter != null)
            return AuthResult.TooManyAttempts("För många misslyckade inloggningsförsök. Försök igen om en liten stund.", retryAfter.Value);

        var user = await FindByEmailAsync(normalizedEmail);
        if (user == null)
            return AuthResult.Fail(401, "Felaktigt e-post eller lösenord");

        // Google-konton har ingen (giltig) PasswordHash — hashern kan kasta på
        // ett tomt/malformerat hash-värde, så avvisa innan vi ens verifierar.
        if (user.AuthProvider != "local")
            return AuthResult.Fail(401, "Det här kontot loggar in via Google. Använd Google-knappen istället.");

        var verification = _hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (verification == PasswordVerificationResult.Failed)
            return AuthResult.Fail(401, "Felaktigt e-post eller lösenord");

        // Rätt lösenord bevisar att det är kontoägaren — nollställ även om kontot är avstängt (403 nedan).
        _loginThrottle.Reset(normalizedEmail);

        if (!user.IsActive)
            return AuthResult.Fail(403, "Kontot är avstängt. Kontakta support om du tror det här är ett misstag.");

        return await IssueTokensAsync(user);
    }

    public async Task<AuthResult> GoogleLoginAsync(string idToken, bool acceptedTerms)
    {
        var payload = await _google.ValidateAsync(idToken);
        if (payload == null)
            return AuthResult.Fail(401, "Ogiltig Google-inloggning");

        // Utan email_verified bevisar Google-tokenet inte att adressen tillhör inloggaren — då vore
        // "Google har verifierat adressen" (som vi bygger både EmailVerified=true och pre-hijack-
        // skyddet nedan på) osant. Avvisa hellre än att lita på en obekräftad adress.
        var googleEmail = EmailNormalizer.Normalize(payload.Email);
        if (!payload.EmailVerified || string.IsNullOrEmpty(googleEmail))
            return AuthResult.Fail(401, "Google har inte bekräftat e-postadressen för det här kontot. Bekräfta adressen hos Google och försök igen.");

        var user = await FindByEmailAsync(googleEmail);
        // Sparas INNAN user eventuellt tilldelas nedan — annars vore den alltid
        // false. Frontend behöver veta det här för att skilja på "ett nytt konto
        // skapades just nu" (kör onboarding-guiden) och "loggade in på ett
        // redan befintligt konto" (hoppa rakt in i appen, som /login redan gör)
        // — en Google-inloggning på /register mot en e-post som redan har ett
        // konto (lösenords- eller Google-baserat) ska aldrig dras genom
        // Källor-guiden och riskera att skriva över redan sparade källval.
        var isNewUser = user == null;

        if (user == null)
        {
            if (!acceptedTerms)
                return AuthResult.Fail(400, "Du måste godkänna användarvillkoren");

            user = new User
            {
                Name            = payload.Name,
                Email           = googleEmail,
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
            await NotifyStaffNewUserAsync(user);
            await _aktivitetslogg.LogAsync(AktörTyper.System, LoggTyper.Registrering, "Ny registrering", $"{user.Name} — via Google");
        }
        else if (user.AuthProvider == "local" && !user.EmailVerified && (user.Role == "Admin" || user.Role == "Support"))
        {
            // Admin/Support utses av oss och kan inte pre-registreras av en angripare, och att låsa ut
            // (enda) adminens lösenordsinloggning vore en risk. Google har bevisat ägarskapet, så adressen
            // markeras verifierad och alla sessioner återkallas — men lösenord och AuthProvider lämnas orörda.
            user.EmailVerified = true;
            var aktiva = await _db.RefreshTokens
                .Where(t => t.UserId == user.Id && t.RevokedAt == null)
                .ToListAsync();
            foreach (var rt in aktiva) rt.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await _aktivitetslogg.LogAsync(
                AktörTyper.System, LoggTyper.Konto,
                $"Obekräftat {user.Role}-konto bekräftades via Google-inloggning — {user.Name}",
                "E-post markerad verifierad och sessioner återkallade; lösenord och inloggningssätt oförändrade");
        }
        else if (user.AuthProvider == "local" && !user.EmailVerified)
        {
            // Pre-hijack-skydd: ett OBEKRÄFTAT lösenordskonto med den här adressen kan vara skapat av
            // en angripare som registrerade offrets adress med eget lösenord (registrering kräver ingen
            // verifiering för att få tokens). Google har nu bevisat att den som loggar in äger adressen,
            // så kontot får användas — men angriparens åtkomst neutraliseras: lösenordet ogiltigförklaras,
            // alla sessioner (refresh-tokens) återkallas och kontot blir ett Google-konto. Obekräftade
            // engångslänkar (verifiering/återställning/e-postbyte) stängs också, så angriparen inte kan
            // ta över kontot via ett redan påbörjat e-postbyte.
            await NeutralizeUnverifiedLocalAccountAsync(user);
            await _db.SaveChangesAsync();
            await _aktivitetslogg.LogAsync(
                AktörTyper.System, LoggTyper.Konto,
                $"Obekräftat lösenordskonto togs över av Google-inloggning — {user.Name}",
                "Lösenordet ogiltigförklarat och alla sessioner återkallade");
        }

        if (!user.IsActive)
            return AuthResult.Fail(403, "Kontot är avstängt. Kontakta support om du tror det här är ett misstag.");

        return await IssueTokensAsync(user, isNewUser);
    }

    private async Task NeutralizeUnverifiedLocalAccountAsync(User user)
    {
        var now = DateTime.UtcNow;

        user.PasswordHash  = string.Empty; // samma tomma värde som övriga Google-konton; LoginAsync avvisar non-local före hash-kontroll
        user.AuthProvider  = "google";
        user.EmailVerified = true;

        var aktivaRefreshTokens = await _db.RefreshTokens
            .Where(t => t.UserId == user.Id && t.RevokedAt == null)
            .ToListAsync();
        foreach (var rt in aktivaRefreshTokens) rt.RevokedAt = now;

        var resetTokens = await _db.PasswordResetTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null).ToListAsync();
        foreach (var t in resetTokens) t.UsedAt = now;

        var verificationTokens = await _db.EmailVerificationTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null).ToListAsync();
        foreach (var t in verificationTokens) t.UsedAt = now;

        var changeTokens = await _db.EmailChangeTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null).ToListAsync();
        foreach (var t in changeTokens) t.UsedAt = now;
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

        var user = await FindByEmailAsync(EmailNormalizer.Normalize(email));
        if (user == null)
            return AuthResult.Ok(genericMessage);

        var resetToken = new PasswordResetToken { UserId = user.Id };
        _db.PasswordResetTokens.Add(resetToken);
        await _db.SaveChangesAsync();

        var resetLink = $"{_frontendUrl}/reset-password?token={Uri.EscapeDataString(resetToken.Token)}";
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

        var policyFel = PasswordPolicy.Validate(newPassword);
        if (policyFel != null)
            return AuthResult.Fail(400, policyFel);

        resetToken.User.PasswordHash = _hasher.HashPassword(resetToken.User, newPassword);
        resetToken.UsedAt = DateTime.UtcNow;

        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
        {
            UserId    = resetToken.UserId,
            Setting   = "password",
            ChangedBy = "reset",
        });

        // En återställning används just när kontot kan vara kapat — då måste en stulen session
        // (refresh-token) sluta gälla direkt, annars överlever den återställningen i upp till 30 dagar.
        // Till skillnad från ChangePasswordAsync finns ingen "egen enhet" att behålla (användaren
        // är utloggad när hen återställer), så ALLA aktiva refresh-tokens återkallas.
        var aktivaRefreshTokens = await _db.RefreshTokens
            .Where(t => t.UserId == resetToken.UserId && t.RevokedAt == null)
            .ToListAsync();
        foreach (var rt in aktivaRefreshTokens) rt.RevokedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return AuthResult.Ok("Lösenordet är uppdaterat");
    }

    public async Task<AuthResult> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, string? keepRefreshToken)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return AuthResult.Fail(404, "Användaren hittades inte");

        // Google-konton har inget lösenord att byta (samma resonemang som i LoginAsync/
        // RequestEmailChangeAsync) — och hashern kan kasta på ett tomt hash-värde.
        if (user.AuthProvider != "local" || string.IsNullOrEmpty(user.PasswordHash))
            return AuthResult.Fail(400, "Det här kontot loggar in via Google och har inget lösenord att byta.");

        // 400, inte 401: ett 401 tolkas av klienten som "sessionen har gått ut" (och
        // V1-8 gör refresh + retry på 401) — fel lösenord i ett formulär är inget sådant.
        if (string.IsNullOrEmpty(currentPassword)
            || _hasher.VerifyHashedPassword(user, user.PasswordHash, currentPassword) == PasswordVerificationResult.Failed)
            return AuthResult.Fail(400, "Nuvarande lösenord stämmer inte");

        var policyFel = PasswordPolicy.Validate(newPassword);
        if (policyFel != null)
            return AuthResult.Fail(400, policyFel);

        user.PasswordHash = _hasher.HashPassword(user, newPassword);

        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog { UserId = userId, Setting = "password", OldValue = null, NewValue = null, ChangedBy = "user" });

        // Ett lösenordsbyte återkallar alla andra sessioner — annars överlever en kapad
        // session (stulen refresh-token) bytet i upp till 30 dagar. Sessionen på enheten
        // som byter behålls: klienten skickar sin egen refresh-token, som är den enda
        // som INTE återkallas. Saknas den (eller matchar ingen aktiv token) återkallas
        // allt och användaren får logga in igen — fail-säkert.
        var keepHash = string.IsNullOrEmpty(keepRefreshToken) ? null : _tokens.HashToken(keepRefreshToken);
        var aktiva = await _db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync();
        foreach (var rt in aktiva)
            if (keepHash == null || rt.TokenHash != keepHash)
                rt.RevokedAt = DateTime.UtcNow;

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

        var verifyLink = $"{_frontendUrl}/verify-email?token={Uri.EscapeDataString(verificationToken.Token)}";
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

        newEmail = EmailNormalizer.Normalize(newEmail);
        if (string.IsNullOrWhiteSpace(newEmail) || !newEmail.Contains('@') || newEmail.Length > MaxEmailLength)
            return AuthResult.Fail(400, "Ange en giltig e-postadress");

        if (newEmail == EmailNormalizer.Normalize(user.Email))
            return AuthResult.Fail(400, "Det är redan din adress");

        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == newEmail && u.Id != userId))
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

        var confirmLink = $"{_frontendUrl}/confirm-email-change?token={Uri.EscapeDataString(changeToken.Token)}";
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
        // Normaliseras igen här: en token utfärdad före V2-11 kan ha en adress med versaler.
        var newEmail = EmailNormalizer.Normalize(changeToken.NewEmail);
        if (await _db.Users.AnyAsync(u => u.Email.ToLower() == newEmail && u.Id != changeToken.UserId))
            return AuthResult.Fail(409, "E-postadressen används redan");

        var oldEmail = changeToken.User.Email;
        changeToken.User.Email         = newEmail;
        // Länken skickades till och klickades från den nya adressen — det
        // beviset på ägarskap är detsamma som e-postverifiering vid registrering.
        changeToken.User.EmailVerified = true;
        changeToken.UsedAt             = DateTime.UtcNow;

        _db.UserSettingAuditLogs.Add(new UserSettingAuditLog
        {
            UserId = changeToken.UserId, Setting = "email", OldValue = oldEmail, NewValue = newEmail,
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

    public async Task<AuthResult> CancelDeletionAsync(string token)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.DeletionCancelToken == token);
        if (user == null)
            return AuthResult.Fail(400, "Länken är ogiltig eller har redan använts.");
        if (user.DeletionScheduledAt == null || user.DeletionScheduledAt < DateTime.UtcNow)
            return AuthResult.Fail(400, "Länken har gått ut — kontot är antingen redan raderat eller raderingen redan avbruten. Kontakta support om du behöver hjälp.");

        // Länken får bara häva en spärr som uteslutande beror på användarens egen raderingsbegäran.
        // Har en admin spärrat kontot lämnas ALLT orört (raderingen löper vidare) och svaret är
        // neutralt — det avslöjar inte att det finns en admin-spärr.
        if (!user.IsActive && !AccountSuspension.IsDeletionOnlySuspension(user))
            return AuthResult.Fail(400, "Länken kunde inte användas. Kontakta support om du behöver hjälp.");

        user.DeletionScheduledAt = null;
        user.DeletionCancelToken = null;
        user.IsActive            = true;
        user.SuspendedAt         = null;
        user.SuspendedReason     = null;

        await _db.SaveChangesAsync();
        await _aktivitetslogg.LogAsync(
            AktörTyper.System, LoggTyper.Konto,
            $"Radering avbruten via mejllänk — {user.Name}", "Kontot återaktiverat");

        return AuthResult.Ok("Raderingen är avbruten — ditt konto är tillbaka.");
    }

    private async Task<AuthResult> IssueTokensAsync(User user, bool isNewUser = false)
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

        return AuthResult.Ok(new AuthTokens(accessToken, rawRefresh, user.Name, user.Role, isNewUser));
    }
}
