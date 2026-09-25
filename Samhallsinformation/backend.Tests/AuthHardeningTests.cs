namespace Samhallsinformation.Tests;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

// V2-11 (E1#9): e-postnormalisering, lösenordspolicy vid registrering, Google-inloggning
// (email_verified + pre-hijack-skydd), återkallade sessioner vid lösenordsåterställning och
// startup-datafixen. Testerna använder SQLite (TestDb) där uppslagens SQL-översättning
// (ToLower-jämförelse, sortering) ska bevisas, och riktiga PasswordHasher så att "gamla
// lösenordet fungerar inte längre" är ett faktiskt bevis och inte en mockad sanning.
public class AuthHardeningTests
{
    private static readonly PasswordHasher<User> Hasher = new();

    private static int _tokenCounter;

    private static AuthService NewService(AppDbContext db, IGoogleTokenValidator? google = null, IEmailService? email = null)
    {
        var tokens = Substitute.For<ITokenService>();
        tokens.HashToken(Arg.Any<string>()).Returns(ci => "hash:" + ci.Arg<string>());
        tokens.GenerateAccessToken(Arg.Any<User>()).Returns("access-token");
        tokens.GenerateRefreshToken().Returns(_ =>
        {
            var n = Interlocked.Increment(ref _tokenCounter);
            return ($"raw-{n}", $"hash:raw-{n}");
        });

        var config = Substitute.For<IConfiguration>();
        config["FRONTEND_URL"].Returns("https://test.local");

        return new AuthService(db, tokens, Hasher, email ?? Substitute.For<IEmailService>(),
            google ?? Substitute.For<IGoogleTokenValidator>(), Substitute.For<IPushNotificationService>(),
            Substitute.For<IAktivitetsloggService>(), config);
    }

    private static User LocalUser(string email, string password, bool verified)
    {
        var user = new User { Name = "Kalle", Email = email, AuthProvider = "local", EmailVerified = verified };
        user.PasswordHash = Hasher.HashPassword(user, password);
        return user;
    }

    private static IGoogleTokenValidator GoogleReturning(string email, bool emailVerified, string name = "Kalle")
    {
        var google = Substitute.For<IGoogleTokenValidator>();
        google.ValidateAsync("google-token").Returns(new GooglePayload(email, name, emailVerified));
        return google;
    }

    // ---------- EmailNormalizer ----------

    [Theory]
    [InlineData("Kalle@X.se", "kalle@x.se")]
    [InlineData("  kalle@x.se  ", "kalle@x.se")]
    [InlineData("KALLE@X.SE\t", "kalle@x.se")]
    [InlineData(null, "")]
    public void EmailNormalizer_TrimsAndLowercases(string? indata, string forvantat) =>
        Assert.Equal(forvantat, EmailNormalizer.Normalize(indata));

    // ---------- Registrering ----------

    [Fact]
    public async Task Register_MixedCaseAndWhitespace_IsStoredTrimmedAndLowercase()
    {
        using var db = TestDb.Create();

        var result = await NewService(db).RegisterAsync("Kalle", "  Kalle@X.se ", "lang-nog-1", true);

        Assert.True(result.Success);
        Assert.Equal("kalle@x.se", (await db.Users.SingleAsync()).Email);
    }

    [Theory]
    [InlineData("kalle@x.se")]
    [InlineData("KALLE@X.SE")]
    [InlineData("Kalle@x.se ")]
    public async Task Register_SameEmailWithOtherCasing_Returns409_AndCreatesNoSecondAccount(string andraSkiftning)
    {
        using var db = TestDb.Create();
        var service = NewService(db);
        Assert.True((await service.RegisterAsync("Kalle", "Kalle@x.se", "lang-nog-1", true)).Success);

        var result = await service.RegisterAsync("Kalle 2", andraSkiftning, "lang-nog-1", true);

        Assert.False(result.Success);
        Assert.Equal(409, result.StatusCode);
        Assert.Single(db.Users);
    }

    [Fact]
    public async Task Register_AgainstLegacyMixedCaseRow_Returns409()
    {
        // En rad skapad före normaliseringen (och ännu ogemenifierad) ska också blockera dubbletten.
        using var db = TestDb.Create();
        db.Users.Add(LocalUser("Kalle@X.se", "gammalt-losen", verified: true));
        await db.SaveChangesAsync();

        var result = await NewService(db).RegisterAsync("Kalle 2", "kalle@x.se", "lang-nog-1", true);

        Assert.Equal(409, result.StatusCode);
        Assert.Single(db.Users);
    }

    [Theory]
    [InlineData("")]
    [InlineData("a")]
    [InlineData("1234567")]
    public async Task Register_TooShortPassword_Returns400_AndCreatesNoUser(string losenord)
    {
        using var db = TestDb.Create();

        var result = await NewService(db).RegisterAsync("Kalle", "kalle@x.se", losenord, true);

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.Empty(db.Users);
    }

    [Fact]
    public async Task Register_ShortNonEmptyPassword_GetsPolicyMessage()
    {
        using var db = TestDb.Create();

        var result = await NewService(db).RegisterAsync("Kalle", "kalle@x.se", "kort", true);

        Assert.Equal(400, result.StatusCode);
        Assert.Contains("minst 8", result.Error);
    }

    [Fact]
    public async Task Register_TooLongPassword_Returns400_AndExactlyMaxLengthIsAccepted()
    {
        using var db = TestDb.Create();
        var service = NewService(db);

        var forLangt = await service.RegisterAsync("Kalle", "kalle@x.se", new string('a', PasswordPolicy.MaxLength + 1), true);
        Assert.Equal(400, forLangt.StatusCode);
        Assert.Contains("högst", forLangt.Error);
        Assert.Empty(db.Users);

        var precisMax = await service.RegisterAsync("Kalle", "kalle@x.se", new string('a', PasswordPolicy.MaxLength), true);
        Assert.True(precisMax.Success);
    }

    [Theory]
    [InlineData("ingen-snabel-a")]
    public async Task Register_EmailWithoutAt_Returns400(string epost)
    {
        using var db = TestDb.Create();

        var result = await NewService(db).RegisterAsync("Kalle", epost, "lang-nog-1", true);

        Assert.Equal(400, result.StatusCode);
        Assert.Empty(db.Users);
    }

    // ---------- Inloggning ----------

    [Theory]
    [InlineData("Kalle@X.se")]
    [InlineData("kalle@x.se")]
    [InlineData("KALLE@X.SE")]
    [InlineData("  kalle@x.se ")]
    public async Task Login_WorksRegardlessOfCasing_AfterRegisteringWithMixedCase(string inloggningsadress)
    {
        using var db = TestDb.Create();
        var service = NewService(db);
        await service.RegisterAsync("Kalle", "Kalle@X.se", "lang-nog-1", true);

        var result = await service.LoginAsync(inloggningsadress, "lang-nog-1");

        Assert.True(result.Success);
        Assert.Single(db.Users);
    }

    [Fact]
    public async Task Login_FindsLegacyRowWithUppercase_WhenTypedInLowercase()
    {
        // Rad skapad före normaliseringen — inloggning ska fungera även innan datafixen gemenifierat den.
        using var db = TestDb.Create();
        db.Users.Add(LocalUser("Kalle@X.se", "lang-nog-1", verified: true));
        await db.SaveChangesAsync();

        var result = await NewService(db).LoginAsync("kalle@x.se", "lang-nog-1");

        Assert.True(result.Success);
    }

    [Fact]
    public async Task Login_WrongPassword_StillReturns401_WithMixedCase()
    {
        using var db = TestDb.Create();
        db.Users.Add(LocalUser("kalle@x.se", "lang-nog-1", verified: true));
        await db.SaveChangesAsync();

        var result = await NewService(db).LoginAsync("KALLE@x.se", "fel-losenord");

        Assert.Equal(401, result.StatusCode);
    }

    // ---------- Glömt lösenord ----------

    [Fact]
    public async Task ForgotPassword_MixedCaseAddress_FindsAccountAndSendsMail()
    {
        using var db = TestDb.Create();
        db.Users.Add(LocalUser("kalle@x.se", "lang-nog-1", verified: true));
        await db.SaveChangesAsync();
        var email = Substitute.For<IEmailService>();

        var result = await NewService(db, email: email).RequestPasswordResetAsync("  KALLE@X.se ");

        Assert.True(result.Success);
        Assert.Single(db.PasswordResetTokens);
        await email.Received(1).SendPasswordResetAsync("kalle@x.se", "Kalle", Arg.Any<string>());
    }

    [Fact]
    public async Task ForgotPassword_UnknownAddress_GivesSameGenericAnswer_AndSendsNothing()
    {
        using var db = TestDb.Create();
        var email = Substitute.For<IEmailService>();

        var result = await NewService(db, email: email).RequestPasswordResetAsync("finns-inte@x.se");

        Assert.True(result.Success);
        Assert.Empty(db.PasswordResetTokens);
        await email.DidNotReceiveWithAnyArgs().SendPasswordResetAsync(default!, default!, default!);
    }

    // ---------- E-postbyte ----------

    [Fact]
    public async Task EmailChange_NewAddressIsNormalized_AndStoredLowercaseOnConfirm()
    {
        using var db = TestDb.Create();
        var user = LocalUser("kalle@x.se", "lang-nog-1", verified: true);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var service = NewService(db);

        var request = await service.RequestEmailChangeAsync(user.Id, "  Ny.Adress@Y.se ", "lang-nog-1");
        Assert.True(request.Success);
        var token = await db.EmailChangeTokens.SingleAsync();
        Assert.Equal("ny.adress@y.se", token.NewEmail);

        var confirm = await service.ConfirmEmailChangeAsync(token.Token);
        Assert.True(confirm.Success);
        Assert.Equal("ny.adress@y.se", (await db.Users.SingleAsync()).Email);
    }

    [Fact]
    public async Task EmailChange_AddressTakenWithOtherCasing_Returns409()
    {
        using var db = TestDb.Create();
        var user  = LocalUser("kalle@x.se", "lang-nog-1", verified: true);
        var annan = LocalUser("Annan@Y.se", "lang-nog-1", verified: true);
        db.Users.AddRange(user, annan);
        await db.SaveChangesAsync();

        var result = await NewService(db).RequestEmailChangeAsync(user.Id, "annan@y.se", "lang-nog-1");

        Assert.Equal(409, result.StatusCode);
    }

    [Fact]
    public async Task EmailChange_SameAddressWithOtherCasing_IsRejectedAsAlreadyYours()
    {
        using var db = TestDb.Create();
        var user = LocalUser("kalle@x.se", "lang-nog-1", verified: true);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await NewService(db).RequestEmailChangeAsync(user.Id, "KALLE@x.se", "lang-nog-1");

        Assert.Equal(400, result.StatusCode);
        Assert.Contains("redan din", result.Error);
    }

    // ---------- Google ----------

    [Fact]
    public async Task Google_WithoutEmailVerified_IsRejected_AndCreatesNoAccount()
    {
        using var db = TestDb.Create();
        var service = NewService(db, GoogleReturning("kalle@x.se", emailVerified: false));

        var result = await service.GoogleLoginAsync("google-token", acceptedTerms: true);

        Assert.False(result.Success);
        Assert.Equal(401, result.StatusCode);
        Assert.Contains("bekräftat", result.Error);
        Assert.Empty(db.Users);
        Assert.Empty(db.RefreshTokens);
    }

    [Fact]
    public async Task Google_WithoutEmailVerified_DoesNotTouchExistingUnverifiedLocalAccount()
    {
        // Ett ej verifierat Google-token får inte heller utlösa neutraliseringen (den bygger på att ägarskapet bevisats).
        using var db = TestDb.Create();
        var user = LocalUser("kalle@x.se", "lang-nog-1", verified: false);
        db.Users.Add(user);
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = "hash:a", ExpiresAt = DateTime.UtcNow.AddDays(30) });
        await db.SaveChangesAsync();

        var result = await NewService(db, GoogleReturning("kalle@x.se", emailVerified: false))
            .GoogleLoginAsync("google-token", acceptedTerms: true);

        Assert.Equal(401, result.StatusCode);
        var kvar = await db.Users.SingleAsync();
        Assert.Equal("local", kvar.AuthProvider);
        Assert.NotEmpty(kvar.PasswordHash);
        Assert.Null((await db.RefreshTokens.SingleAsync()).RevokedAt);
    }

    [Fact]
    public async Task Google_NewAccount_IsCreatedWithLowercaseEmail()
    {
        using var db = TestDb.Create();
        var service = NewService(db, GoogleReturning("Kalle@Gmail.com", emailVerified: true));

        var result = await service.GoogleLoginAsync("google-token", acceptedTerms: true);

        Assert.True(result.Success);
        Assert.True(result.Tokens!.IsNewUser);
        var user = await db.Users.SingleAsync();
        Assert.Equal("kalle@gmail.com", user.Email);
        Assert.Equal("google", user.AuthProvider);
        Assert.True(user.EmailVerified);
    }

    [Fact]
    public async Task Google_FindsAccountRegisteredWithUppercase_InsteadOfCreatingSecondAccount()
    {
        using var db = TestDb.Create();
        var service = NewService(db, GoogleReturning("kalle@x.se", emailVerified: true));
        await service.RegisterAsync("Kalle", "Kalle@X.se", "lang-nog-1", true);
        // Kontot är bekräftat, så Google-inloggningen ska bara logga in i det.
        (await db.Users.SingleAsync()).EmailVerified = true;
        await db.SaveChangesAsync();

        var result = await service.GoogleLoginAsync("google-token", acceptedTerms: true);

        Assert.True(result.Success);
        Assert.False(result.Tokens!.IsNewUser);
        Assert.Single(db.Users);
    }

    [Fact]
    public async Task Google_AgainstUnverifiedLocalAccount_NeutralizesAttackerAccess()
    {
        // Angriparen registrerade offrets adress med eget lösenord (obekräftat) och är inloggad.
        using var db = TestDb.Create();
        var attackerPassword = "angriparens-losen";
        var user = LocalUser("kalle@x.se", attackerPassword, verified: false);
        db.Users.Add(user);
        db.RefreshTokens.AddRange(
            new RefreshToken { UserId = user.Id, TokenHash = "hash:angripare-1", ExpiresAt = DateTime.UtcNow.AddDays(30) },
            new RefreshToken { UserId = user.Id, TokenHash = "hash:angripare-2", ExpiresAt = DateTime.UtcNow.AddDays(30) });
        db.EmailChangeTokens.Add(new EmailChangeToken { UserId = user.Id, NewEmail = "angripare@evil.se" });
        db.PasswordResetTokens.Add(new PasswordResetToken { UserId = user.Id });
        db.EmailVerificationTokens.Add(new EmailVerificationToken { UserId = user.Id });
        await db.SaveChangesAsync();

        var service = NewService(db, GoogleReturning("kalle@x.se", emailVerified: true));

        var google = await service.GoogleLoginAsync("google-token", acceptedTerms: true);

        // Offret (Google-ägaren) släpps in i kontot ...
        Assert.True(google.Success);
        Assert.False(google.Tokens!.IsNewUser);

        // ... men angriparens åtkomst är borta.
        var uppdaterad = await db.Users.SingleAsync();
        Assert.Equal("google", uppdaterad.AuthProvider);
        Assert.True(uppdaterad.EmailVerified);
        Assert.Equal(string.Empty, uppdaterad.PasswordHash);

        var gamla = await db.RefreshTokens.Where(t => t.TokenHash.StartsWith("hash:angripare")).ToListAsync();
        Assert.Equal(2, gamla.Count);
        Assert.All(gamla, t => Assert.NotNull(t.RevokedAt));

        // Endast offrets nya session är aktiv.
        Assert.Single(await db.RefreshTokens.Where(t => t.RevokedAt == null).ToListAsync());

        // Påbörjade engångslänkar (t.ex. ett e-postbyte till angriparens adress) är stängda.
        Assert.NotNull((await db.EmailChangeTokens.SingleAsync()).UsedAt);
        Assert.NotNull((await db.PasswordResetTokens.SingleAsync()).UsedAt);
        Assert.NotNull((await db.EmailVerificationTokens.SingleAsync()).UsedAt);

        // Angriparens lösenord fungerar inte längre, och den gamla refresh-tokenen inte heller.
        var losenordsLogin = await service.LoginAsync("kalle@x.se", attackerPassword);
        Assert.False(losenordsLogin.Success);
        Assert.Equal(401, losenordsLogin.StatusCode);
        var refresh = await service.RefreshAsync("angripare-1");
        Assert.Equal(401, refresh.StatusCode);
    }

    [Fact]
    public async Task Google_AgainstUnverifiedLocalAccount_WithMixedCaseRow_IsAlsoNeutralized()
    {
        using var db = TestDb.Create();
        db.Users.Add(LocalUser("Kalle@X.se", "angriparens-losen", verified: false));
        await db.SaveChangesAsync();

        var result = await NewService(db, GoogleReturning("kalle@x.se", emailVerified: true))
            .GoogleLoginAsync("google-token", acceptedTerms: true);

        Assert.True(result.Success);
        Assert.Single(db.Users);
        Assert.Equal("google", (await db.Users.SingleAsync()).AuthProvider);
    }

    [Fact]
    public async Task Google_AgainstVerifiedLocalAccount_KeepsTodaysBehaviour()
    {
        // Bekräftat lokalt konto: ägaren har redan bevisat adressen via mejllänk — Google-inloggning
        // loggar bara in i kontot. Lösenord, leverantör och andra enheters sessioner rörs inte.
        using var db = TestDb.Create();
        var user = LocalUser("kalle@x.se", "agarens-losen", verified: true);
        db.Users.Add(user);
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = "hash:enhet-a", ExpiresAt = DateTime.UtcNow.AddDays(30) });
        await db.SaveChangesAsync();
        var hashFore = user.PasswordHash;

        var service = NewService(db, GoogleReturning("kalle@x.se", emailVerified: true));
        var result = await service.GoogleLoginAsync("google-token", acceptedTerms: true);

        Assert.True(result.Success);
        Assert.False(result.Tokens!.IsNewUser);
        var kvar = await db.Users.SingleAsync();
        Assert.Equal("local", kvar.AuthProvider);
        Assert.Equal(hashFore, kvar.PasswordHash);
        Assert.Null((await db.RefreshTokens.SingleAsync(t => t.TokenHash == "hash:enhet-a")).RevokedAt);
        Assert.True((await service.LoginAsync("kalle@x.se", "agarens-losen")).Success);
    }

    [Fact]
    public async Task Google_AgainstUnverifiedLocalAccount_ThatIsSuspended_StillNeutralizesButReturns403()
    {
        using var db = TestDb.Create();
        var user = LocalUser("kalle@x.se", "angriparens-losen", verified: false);
        user.IsActive = false;
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await NewService(db, GoogleReturning("kalle@x.se", emailVerified: true))
            .GoogleLoginAsync("google-token", acceptedTerms: true);

        Assert.Equal(403, result.StatusCode);
        var kvar = await db.Users.SingleAsync();
        Assert.Equal("google", kvar.AuthProvider);
        Assert.Equal(string.Empty, kvar.PasswordHash);
    }

    [Theory]
    [InlineData("Admin")]
    [InlineData("Support")]
    public async Task Google_AgainstUnverifiedAdminOrSupport_KeepsPasswordAndProvider_ButVerifiesAndRevokesTokens(string roll)
    {
        // PM-beslut: Admin/Support kan inte pre-registreras av en angripare, och adminens
        // lösenordsinloggning får inte låsas ut. Google-inloggningen verifierar adressen och
        // återkallar sessioner, men lösenord och AuthProvider lämnas orörda.
        using var db = TestDb.Create();
        var user = LocalUser("admin@x.se", "adminens-losen", verified: false);
        user.Role = roll;
        db.Users.Add(user);
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = "hash:gammal", ExpiresAt = DateTime.UtcNow.AddDays(30) });
        await db.SaveChangesAsync();
        var hashFore = user.PasswordHash;
        var service = NewService(db, GoogleReturning("admin@x.se", emailVerified: true));

        var result = await service.GoogleLoginAsync("google-token", acceptedTerms: true);

        Assert.True(result.Success);
        Assert.False(result.Tokens!.IsNewUser);
        var kvar = await db.Users.SingleAsync();
        Assert.Equal("local", kvar.AuthProvider);
        Assert.Equal(hashFore, kvar.PasswordHash);
        Assert.True(kvar.EmailVerified);
        Assert.NotNull((await db.RefreshTokens.SingleAsync(t => t.TokenHash == "hash:gammal")).RevokedAt);
        Assert.Single(await db.RefreshTokens.Where(t => t.RevokedAt == null).ToListAsync()); // bara den nya Google-sessionen
        Assert.True((await service.LoginAsync("admin@x.se", "adminens-losen")).Success);
    }

    [Fact]
    public async Task Google_AgainstUnverifiedOrdinaryUser_IsStillNeutralized()
    {
        using var db = TestDb.Create();
        var user = LocalUser("kalle@x.se", "angriparens-losen", verified: false); // Role = "Användare"
        db.Users.Add(user);
        await db.SaveChangesAsync();

        await NewService(db, GoogleReturning("kalle@x.se", emailVerified: true)).GoogleLoginAsync("google-token", acceptedTerms: true);

        var kvar = await db.Users.SingleAsync();
        Assert.Equal("google", kvar.AuthProvider);
        Assert.Equal(string.Empty, kvar.PasswordHash);
    }

    // ---------- Admin-seed ----------

    [Fact]
    public async Task AdminSeeder_CreatesVerifiedAdmin_WithNormalizedEmail()
    {
        using var db = TestDb.Create();

        var skapad = await AdminSeeder.EnsureAdminAsync(db, " Admin@X.se ", "seed-losenord", "Adminen");

        Assert.True(skapad);
        var admin = await db.Users.SingleAsync();
        Assert.Equal("admin@x.se", admin.Email);
        Assert.Equal("Admin", admin.Role);
        Assert.True(admin.EmailVerified);
        Assert.True((await NewService(db).LoginAsync("ADMIN@x.se", "seed-losenord")).Success);
    }

    [Fact]
    public async Task AdminSeeder_DoesNothing_WhenAdminAlreadyExistsWithOtherCasing_OrConfigMissing()
    {
        using var db = TestDb.Create();
        db.Users.Add(LocalUser("Admin@X.se", "gammalt", verified: false));
        await db.SaveChangesAsync();

        Assert.False(await AdminSeeder.EnsureAdminAsync(db, "admin@x.se", "seed-losenord", "Adminen"));
        Assert.False(await AdminSeeder.EnsureAdminAsync(db, null, "seed-losenord", "Adminen"));
        Assert.False(await AdminSeeder.EnsureAdminAsync(db, "ny@x.se", "", "Adminen"));
        Assert.Single(db.Users);
    }

    // ---------- Lösenordsåterställning ----------

    [Fact]
    public async Task ResetPassword_RevokesAllActiveRefreshTokens()
    {
        using var db = TestDb.Create();
        var user  = LocalUser("kalle@x.se", "gammalt-losen", verified: true);
        var annan = LocalUser("annan@x.se", "annat-losen-1", verified: true);
        db.Users.AddRange(user, annan);
        db.RefreshTokens.AddRange(
            new RefreshToken { UserId = user.Id,  TokenHash = "hash:a", ExpiresAt = DateTime.UtcNow.AddDays(30) },
            new RefreshToken { UserId = user.Id,  TokenHash = "hash:b", ExpiresAt = DateTime.UtcNow.AddDays(30) },
            new RefreshToken { UserId = annan.Id, TokenHash = "hash:c", ExpiresAt = DateTime.UtcNow.AddDays(30) });
        var reset = new PasswordResetToken { UserId = user.Id };
        db.PasswordResetTokens.Add(reset);
        await db.SaveChangesAsync();

        var result = await NewService(db).ResetPasswordAsync(reset.Token, "nytt-losenord-1");

        Assert.True(result.Success);
        var tokens = await db.RefreshTokens.ToListAsync();
        Assert.All(tokens.Where(t => t.UserId == user.Id), t => Assert.NotNull(t.RevokedAt));
        Assert.Null(tokens.Single(t => t.UserId == annan.Id).RevokedAt); // andra användares sessioner rörs inte
    }

    [Fact]
    public async Task ResetPassword_TooLongPassword_Returns400_AndRevokesNothing()
    {
        using var db = TestDb.Create();
        var user = LocalUser("kalle@x.se", "gammalt-losen", verified: true);
        db.Users.Add(user);
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = "hash:a", ExpiresAt = DateTime.UtcNow.AddDays(30) });
        var reset = new PasswordResetToken { UserId = user.Id };
        db.PasswordResetTokens.Add(reset);
        await db.SaveChangesAsync();

        var result = await NewService(db).ResetPasswordAsync(reset.Token, new string('a', PasswordPolicy.MaxLength + 1));

        Assert.Equal(400, result.StatusCode);
        Assert.Null((await db.RefreshTokens.SingleAsync()).RevokedAt);
        Assert.Null((await db.PasswordResetTokens.SingleAsync()).UsedAt);
    }

    // ---------- Admin-uppslag ----------

    [Fact]
    public async Task AdminLookup_IsCaseInsensitive()
    {
        using var db = TestDb.Create();
        db.Users.Add(LocalUser("Kalle@X.se", "lang-nog-1", verified: true));
        await db.SaveChangesAsync();

        var controller = new AdminUsersController(db, Substitute.For<IAktivitetsloggService>(), Substitute.For<IEmailService>(),
            Substitute.For<IAuthService>(), Substitute.For<IConfiguration>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) } },
        };

        Assert.IsType<OkObjectResult>(await controller.Lookup(" kalle@x.SE "));
        Assert.IsType<NotFoundResult>(await controller.Lookup("finns-inte@x.se"));
    }

    // ---------- Startup-datafix ----------

    private sealed class CapturingLogger : ILogger
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Entries.Add((logLevel, formatter(state, exception)));
    }

    private static User RawUser(string email, DateTime? createdAt = null) =>
        new() { Name = "U", Email = email, PasswordHash = "x", CreatedAt = createdAt ?? DateTime.UtcNow };

    [Fact]
    public async Task DataFix_LowercasesAndTrimsExistingEmails_WhenNoCollision()
    {
        using var db = TestDb.Create();
        db.Users.AddRange(RawUser("Kalle@X.se"), RawUser(" Anna@Y.SE "), RawUser("redan@gemener.se"));
        await db.SaveChangesAsync();
        var logger = new CapturingLogger();

        var result = await EmailNormalizationDataFix.RunAsync(db, logger);

        Assert.False(result.Aborted);
        Assert.Equal(2, result.Updated);
        var adresser = (await TestDb.CreateSecondContext(db).Users.Select(u => u.Email).ToListAsync()).OrderBy(e => e).ToList();
        Assert.Equal(new[] { "anna@y.se", "kalle@x.se", "redan@gemener.se" }, adresser);
        Assert.DoesNotContain(logger.Entries, e => e.Level == LogLevel.Warning);
    }

    [Fact]
    public async Task DataFix_Collision_AbortsWithoutChangingAnything_AndLogsTheCollidingAccounts()
    {
        using var db = TestDb.Create();
        var a = RawUser("Kalle@x.se",  new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var b = RawUser("kalle@x.se",  new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc));
        var c = RawUser("Ovan@Krock.se"); // skulle gå att gemenifiera, men hela fixen ska ändå avbrytas
        db.Users.AddRange(a, b, c);
        await db.SaveChangesAsync();
        var logger = new CapturingLogger();

        var result = await EmailNormalizationDataFix.RunAsync(db, logger);

        Assert.True(result.Aborted);
        Assert.Equal(0, result.Updated);
        Assert.Equal(2, result.Conflicts.Count);
        Assert.Contains(result.Conflicts, k => k.UserId == a.Id && k.Email == "Kalle@x.se");
        Assert.Contains(result.Conflicts, k => k.UserId == b.Id && k.Email == "kalle@x.se");

        // Inget ändrat i databasen — inte ens den okrockande raden.
        var i_db = await TestDb.CreateSecondContext(db).Users.ToDictionaryAsync(u => u.Id, u => u.Email);
        Assert.Equal("Kalle@x.se", i_db[a.Id]);
        Assert.Equal("kalle@x.se", i_db[b.Id]);
        Assert.Equal("Ovan@Krock.se", i_db[c.Id]);

        // Warning med exakt vilka konton (id + adress) som krockar.
        var warning = Assert.Single(logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains(a.Id.ToString(), warning.Message);
        Assert.Contains("Kalle@x.se", warning.Message);
        Assert.Contains(b.Id.ToString(), warning.Message);
        Assert.Contains("'kalle@x.se'", warning.Message);
        Assert.DoesNotContain(c.Id.ToString(), warning.Message);
    }

    [Fact]
    public async Task DataFix_IsIdempotent()
    {
        using var db = TestDb.Create();
        db.Users.AddRange(RawUser("Kalle@X.se"), RawUser("Anna@Y.se"));
        await db.SaveChangesAsync();

        var forsta = await EmailNormalizationDataFix.RunAsync(db, new CapturingLogger());
        var andra  = await EmailNormalizationDataFix.RunAsync(db, new CapturingLogger());

        Assert.Equal(2, forsta.Updated);
        Assert.False(andra.Aborted);
        Assert.Equal(0, andra.Updated);
        Assert.Equal(new[] { "anna@y.se", "kalle@x.se" }, (await db.Users.Select(u => u.Email).ToListAsync()).OrderBy(e => e).ToArray());
    }

    [Fact]
    public async Task DataFix_OnEmptyDatabase_DoesNothing()
    {
        using var db = TestDb.Create();

        var result = await EmailNormalizationDataFix.RunAsync(db, new CapturingLogger());

        Assert.False(result.Aborted);
        Assert.Equal(0, result.Updated);
    }

    [Fact]
    public async Task DataFix_AfterAbort_LoginResolvesToTheExactLowercaseAccount()
    {
        // Krockläget lämnar båda raderna orörda. Uppslaget ska då fortfarande ge exakt träff först,
        // så att ingen av de två kontoägarna plötsligt loggas in i den andres konto.
        using var db = TestDb.Create();
        db.Users.Add(LocalUser("Kalle@x.se", "versal-losen", verified: true));
        db.Users.Add(LocalUser("kalle@x.se", "gemen-losen-1", verified: true));
        await db.SaveChangesAsync();
        await EmailNormalizationDataFix.RunAsync(db, new CapturingLogger());
        var service = NewService(db);

        Assert.True((await service.LoginAsync("kalle@x.se", "gemen-losen-1")).Success);
    }
}
