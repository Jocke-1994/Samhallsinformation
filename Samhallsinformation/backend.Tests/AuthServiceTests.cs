namespace Samhallsinformation.Tests;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

public class AuthServiceTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static AuthService NewService(
        AppDbContext db,
        ITokenService? tokens = null,
        IPasswordHasher<User>? hasher = null,
        IEmailService? email = null,
        IGoogleTokenValidator? google = null,
        IPushNotificationService? push = null,
        IAktivitetsloggService? aktivitetslogg = null)
    {
        tokens ??= Substitute.For<ITokenService>();
        hasher ??= Substitute.For<IPasswordHasher<User>>();
        email  ??= Substitute.For<IEmailService>();
        google ??= Substitute.For<IGoogleTokenValidator>();
        push   ??= Substitute.For<IPushNotificationService>();
        aktivitetslogg ??= Substitute.For<IAktivitetsloggService>();

        var config = Substitute.For<IConfiguration>();
        config["FRONTEND_URL"].Returns("https://test.local");

        return new AuthService(db, tokens, hasher, email, google, push, aktivitetslogg, config);
    }

    [Fact]
    public async Task RegisterAsync_CreatesUser_AndReturnsTokens()
    {
        using var db = NewDb();

        var tokens = Substitute.For<ITokenService>();
        tokens.GenerateAccessToken(Arg.Any<User>()).Returns("access-token");
        tokens.GenerateRefreshToken().Returns(("raw-refresh", "hashed-refresh"));

        var hasher = Substitute.For<IPasswordHasher<User>>();
        hasher.HashPassword(Arg.Any<User>(), "pw123456").Returns("hashed-pw");

        var service = NewService(db, tokens, hasher);

        var result = await service.RegisterAsync("Test Testsson", "test@example.com", "pw123456", acceptedTerms: true);

        Assert.True(result.Success);
        Assert.Equal("access-token", result.Tokens!.AccessToken);
        Assert.Equal("raw-refresh", result.Tokens.RefreshToken);
        Assert.Single(db.Users);
        Assert.Single(db.RefreshTokens);
        Assert.NotNull((await db.Users.SingleAsync()).TermsAcceptedAt);
    }

    [Fact]
    public async Task RegisterAsync_CreatesUnverifiedUser_AndSendsVerificationEmail()
    {
        using var db = NewDb();

        var tokens = Substitute.For<ITokenService>();
        tokens.GenerateAccessToken(Arg.Any<User>()).Returns("access-token");
        tokens.GenerateRefreshToken().Returns(("raw-refresh", "hashed-refresh"));

        var email = Substitute.For<IEmailService>();

        var service = NewService(db, tokens, email: email);

        await service.RegisterAsync("Test Testsson", "test@example.com", "pw123456", acceptedTerms: true);

        var user = await db.Users.SingleAsync();
        Assert.False(user.EmailVerified);
        Assert.Single(db.EmailVerificationTokens);
        await email.Received(1).SendEmailVerificationAsync("test@example.com", "Test Testsson", Arg.Is<string>(s => s.Contains("https://test.local/verify-email?token=")));
    }

    [Fact]
    public async Task VerifyEmailAsync_ValidToken_MarksUserVerified()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        var token = new EmailVerificationToken { UserId = user.Id };
        db.EmailVerificationTokens.Add(token);
        await db.SaveChangesAsync();

        var service = NewService(db);

        var result = await service.VerifyEmailAsync(token.Token);

        Assert.True(result.Success);
        Assert.True((await db.Users.FindAsync(user.Id))!.EmailVerified);
        Assert.NotNull((await db.EmailVerificationTokens.FindAsync(token.Id))!.UsedAt);
    }

    [Fact]
    public async Task VerifyEmailAsync_ExpiredToken_ReturnsBadRequest()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        db.EmailVerificationTokens.Add(new EmailVerificationToken { UserId = user.Id, ExpiresAt = DateTime.UtcNow.AddHours(-1) });
        await db.SaveChangesAsync();
        var token = await db.EmailVerificationTokens.FirstAsync();

        var service = NewService(db);

        var result = await service.VerifyEmailAsync(token.Token);

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.False((await db.Users.FindAsync(user.Id))!.EmailVerified);
    }

    [Fact]
    public async Task VerifyEmailAsync_AlreadyUsedToken_ReturnsBadRequest()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        db.EmailVerificationTokens.Add(new EmailVerificationToken { UserId = user.Id, UsedAt = DateTime.UtcNow.AddMinutes(-1) });
        await db.SaveChangesAsync();
        var token = await db.EmailVerificationTokens.FirstAsync();

        var service = NewService(db);

        var result = await service.VerifyEmailAsync(token.Token);

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
    }

    [Fact]
    public async Task VerifyEmailAsync_UnknownToken_ReturnsBadRequest()
    {
        using var db = NewDb();
        var service = NewService(db);

        var result = await service.VerifyEmailAsync("does-not-exist");

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
    }

    [Fact]
    public async Task ResendVerificationAsync_UnverifiedUser_SendsNewToken()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x", EmailVerified = false };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var email = Substitute.For<IEmailService>();
        var service = NewService(db, email: email);

        var result = await service.ResendVerificationAsync(user.Id);

        Assert.True(result.Success);
        Assert.Single(db.EmailVerificationTokens);
        await email.Received(1).SendEmailVerificationAsync("ada@example.com", "Ada", Arg.Any<string>());
    }

    [Fact]
    public async Task ResendVerificationAsync_AlreadyVerified_DoesNotSendEmail()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x", EmailVerified = true };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var email = Substitute.For<IEmailService>();
        var service = NewService(db, email: email);

        var result = await service.ResendVerificationAsync(user.Id);

        Assert.True(result.Success);
        Assert.Empty(db.EmailVerificationTokens);
        await email.DidNotReceive().SendEmailVerificationAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>());
    }

    private static IPasswordHasher<User> CorrectPasswordHasher(User user, string correctPassword)
    {
        var hasher = Substitute.For<IPasswordHasher<User>>();
        hasher.VerifyHashedPassword(user, user.PasswordHash, correctPassword).Returns(PasswordVerificationResult.Success);
        return hasher;
    }

    [Fact]
    public async Task RequestEmailChangeAsync_ValidNewEmail_CreatesTokenAndSendsBothEmails()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var email = Substitute.For<IEmailService>();
        var service = NewService(db, hasher: CorrectPasswordHasher(user, "correct-pw"), email: email);

        var result = await service.RequestEmailChangeAsync(user.Id, "ny@example.com", "correct-pw");

        Assert.True(result.Success);
        Assert.Single(db.EmailChangeTokens);
        Assert.Equal("ny@example.com", (await db.EmailChangeTokens.SingleAsync()).NewEmail);
        // E-posten på kontot ändras inte förrän länken bekräftas.
        Assert.Equal("ada@example.com", (await db.Users.FindAsync(user.Id))!.Email);
        await email.Received(1).SendEmailChangeConfirmationAsync("ny@example.com", "Ada", Arg.Is<string>(s => s.Contains("https://test.local/confirm-email-change?token=")));
        await email.Received(1).SendEmailChangeNoticeAsync("ada@example.com", "Ada", "ny@example.com");
    }

    [Fact]
    public async Task RequestEmailChangeAsync_WrongPassword_ReturnsUnauthorized()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var service = NewService(db, hasher: CorrectPasswordHasher(user, "correct-pw"));

        var result = await service.RequestEmailChangeAsync(user.Id, "ny@example.com", "fel-lösenord");

        Assert.False(result.Success);
        Assert.Equal(401, result.StatusCode);
        Assert.Empty(db.EmailChangeTokens);
    }

    [Fact]
    public async Task RequestEmailChangeAsync_MissingPassword_ReturnsBadRequest()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var service = NewService(db);

        var result = await service.RequestEmailChangeAsync(user.Id, "ny@example.com", null);

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.Empty(db.EmailChangeTokens);
    }

    [Fact]
    public async Task RequestEmailChangeAsync_GoogleAccount_SkipsPasswordCheck()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", AuthProvider = "google" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var hasher = Substitute.For<IPasswordHasher<User>>();
        var service = NewService(db, hasher: hasher);

        var result = await service.RequestEmailChangeAsync(user.Id, "ny@example.com", null);

        Assert.True(result.Success);
        Assert.Single(db.EmailChangeTokens);
        hasher.DidNotReceive().VerifyHashedPassword(Arg.Any<User>(), Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task RequestEmailChangeAsync_AlreadyTakenEmail_ReturnsConflict()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed" };
        db.Users.Add(user);
        db.Users.Add(new User { Name = "Björn", Email = "upptagen@example.com", PasswordHash = "x" });
        await db.SaveChangesAsync();

        var service = NewService(db, hasher: CorrectPasswordHasher(user, "correct-pw"));

        var result = await service.RequestEmailChangeAsync(user.Id, "upptagen@example.com", "correct-pw");

        Assert.False(result.Success);
        Assert.Equal(409, result.StatusCode);
        Assert.Empty(db.EmailChangeTokens);
    }

    [Fact]
    public async Task RequestEmailChangeAsync_NewRequestSupersedesOlderPendingToken()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var service = NewService(db, hasher: CorrectPasswordHasher(user, "correct-pw"));

        await service.RequestEmailChangeAsync(user.Id, "forsta@example.com", "correct-pw");
        var forstaToken = await db.EmailChangeTokens.SingleAsync();
        await service.RequestEmailChangeAsync(user.Id, "andra@example.com", "correct-pw");

        Assert.Equal(2, await db.EmailChangeTokens.CountAsync());
        Assert.NotNull((await db.EmailChangeTokens.FindAsync(forstaToken.Id))!.UsedAt);
        Assert.Null((await db.EmailChangeTokens.SingleAsync(t => t.NewEmail == "andra@example.com")).UsedAt);
    }

    [Fact]
    public async Task ConfirmEmailChangeAsync_ValidToken_SwapsEmailAndMarksVerified()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x", EmailVerified = false };
        db.Users.Add(user);
        var token = new EmailChangeToken { UserId = user.Id, NewEmail = "ny@example.com" };
        db.EmailChangeTokens.Add(token);
        await db.SaveChangesAsync();

        var service = NewService(db);

        var result = await service.ConfirmEmailChangeAsync(token.Token);

        Assert.True(result.Success);
        var updated = await db.Users.FindAsync(user.Id);
        Assert.Equal("ny@example.com", updated!.Email);
        Assert.True(updated.EmailVerified);
        Assert.NotNull((await db.EmailChangeTokens.FindAsync(token.Id))!.UsedAt);
        Assert.Contains(db.UserSettingAuditLogs, l => l.Setting == "email" && l.OldValue == "ada@example.com" && l.NewValue == "ny@example.com");
    }

    [Fact]
    public async Task ConfirmEmailChangeAsync_ValidToken_RevokesAllActiveRefreshTokens()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        var token = new EmailChangeToken { UserId = user.Id, NewEmail = "ny@example.com" };
        db.EmailChangeTokens.Add(token);
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = "aktiv-hash", ExpiresAt = DateTime.UtcNow.AddDays(1) });
        db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, TokenHash = "redan-utloggad-hash", ExpiresAt = DateTime.UtcNow.AddDays(1), RevokedAt = DateTime.UtcNow.AddMinutes(-5) });
        await db.SaveChangesAsync();

        var service = NewService(db);

        await service.ConfirmEmailChangeAsync(token.Token);

        Assert.All(db.RefreshTokens, rt => Assert.NotNull(rt.RevokedAt));
    }

    [Fact]
    public async Task ConfirmEmailChangeAsync_ExpiredToken_ReturnsBadRequest()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        db.EmailChangeTokens.Add(new EmailChangeToken { UserId = user.Id, NewEmail = "ny@example.com", ExpiresAt = DateTime.UtcNow.AddHours(-1) });
        await db.SaveChangesAsync();
        var token = await db.EmailChangeTokens.FirstAsync();

        var service = NewService(db);

        var result = await service.ConfirmEmailChangeAsync(token.Token);

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.Equal("ada@example.com", (await db.Users.FindAsync(user.Id))!.Email);
    }

    [Fact]
    public async Task ConfirmEmailChangeAsync_EmailTakenSinceRequest_ReturnsConflict()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        db.Users.Add(new User { Name = "Björn", Email = "ny@example.com", PasswordHash = "x" });
        var token = new EmailChangeToken { UserId = user.Id, NewEmail = "ny@example.com" };
        db.EmailChangeTokens.Add(token);
        await db.SaveChangesAsync();

        var service = NewService(db);

        var result = await service.ConfirmEmailChangeAsync(token.Token);

        Assert.False(result.Success);
        Assert.Equal(409, result.StatusCode);
        Assert.Equal("ada@example.com", (await db.Users.FindAsync(user.Id))!.Email);
    }

    [Fact]
    public async Task CancelEmailChangeAsync_MarksPendingTokensUsed()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        var token = new EmailChangeToken { UserId = user.Id, NewEmail = "ny@example.com" };
        db.EmailChangeTokens.Add(token);
        await db.SaveChangesAsync();

        var service = NewService(db);

        var result = await service.CancelEmailChangeAsync(user.Id);

        Assert.True(result.Success);
        Assert.NotNull((await db.EmailChangeTokens.FindAsync(token.Id))!.UsedAt);
    }

    [Fact]
    public async Task RegisterAsync_DuplicateEmail_ReturnsConflict()
    {
        using var db = NewDb();
        db.Users.Add(new User { Name = "Finns Redan", Email = "taken@example.com", PasswordHash = "x" });
        await db.SaveChangesAsync();

        var service = NewService(db);

        var result = await service.RegisterAsync("Ny Person", "taken@example.com", "pw123456", acceptedTerms: true);

        Assert.False(result.Success);
        Assert.Equal(409, result.StatusCode);
    }

    [Fact]
    public async Task RegisterAsync_TermsNotAccepted_ReturnsBadRequest()
    {
        using var db = NewDb();
        var service = NewService(db);

        var result = await service.RegisterAsync("Test Testsson", "test@example.com", "pw123456", acceptedTerms: false);

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.Empty(db.Users);
    }

    [Fact]
    public async Task LoginAsync_CorrectPassword_ReturnsTokens()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var hasher = Substitute.For<IPasswordHasher<User>>();
        hasher.VerifyHashedPassword(user, "hashed", "correct-pw").Returns(PasswordVerificationResult.Success);

        var tokens = Substitute.For<ITokenService>();
        tokens.GenerateAccessToken(Arg.Any<User>()).Returns("access-token");
        tokens.GenerateRefreshToken().Returns(("raw-refresh", "hashed-refresh"));

        var service = NewService(db, tokens, hasher);

        var result = await service.LoginAsync("ada@example.com", "correct-pw");

        Assert.True(result.Success);
        Assert.Equal("access-token", result.Tokens!.AccessToken);
    }

    [Fact]
    public async Task LoginAsync_WrongPassword_ReturnsUnauthorized()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var hasher = Substitute.For<IPasswordHasher<User>>();
        hasher.VerifyHashedPassword(user, "hashed", "wrong-pw").Returns(PasswordVerificationResult.Failed);

        var service = NewService(db, hasher: hasher);

        var result = await service.LoginAsync("ada@example.com", "wrong-pw");

        Assert.False(result.Success);
        Assert.Equal(401, result.StatusCode);
    }

    [Fact]
    public async Task LoginAsync_SuspendedAccount_ReturnsForbidden()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed", IsActive = false };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var hasher = Substitute.For<IPasswordHasher<User>>();
        hasher.VerifyHashedPassword(user, "hashed", "correct-pw").Returns(PasswordVerificationResult.Success);

        var service = NewService(db, hasher: hasher);

        var result = await service.LoginAsync("ada@example.com", "correct-pw");

        Assert.False(result.Success);
        Assert.Equal(403, result.StatusCode);
    }

    [Fact]
    public async Task LoginAsync_GoogleAccount_RejectsPasswordLogin()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", AuthProvider = "google" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var hasher = Substitute.For<IPasswordHasher<User>>();
        var service = NewService(db, hasher: hasher);

        var result = await service.LoginAsync("ada@example.com", "nagot-lösenord");

        Assert.False(result.Success);
        Assert.Equal(401, result.StatusCode);
        hasher.DidNotReceive().VerifyHashedPassword(Arg.Any<User>(), Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task GoogleLoginAsync_InvalidToken_ReturnsUnauthorized()
    {
        using var db = NewDb();
        var google = Substitute.For<IGoogleTokenValidator>();
        google.ValidateAsync("bad-token").Returns((GooglePayload?)null);

        var service = NewService(db, google: google);

        var result = await service.GoogleLoginAsync("bad-token", acceptedTerms: true);

        Assert.False(result.Success);
        Assert.Equal(401, result.StatusCode);
    }

    [Fact]
    public async Task GoogleLoginAsync_NewUser_TermsNotAccepted_ReturnsBadRequest()
    {
        using var db = NewDb();
        var google = Substitute.For<IGoogleTokenValidator>();
        google.ValidateAsync("good-token").Returns(new GooglePayload("ny@example.com", "Ny Person", true));

        var service = NewService(db, google: google);

        var result = await service.GoogleLoginAsync("good-token", acceptedTerms: false);

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.Empty(db.Users);
    }

    [Fact]
    public async Task GoogleLoginAsync_NewUser_CreatesAccountAndReturnsTokens()
    {
        using var db = NewDb();
        var google = Substitute.For<IGoogleTokenValidator>();
        google.ValidateAsync("good-token").Returns(new GooglePayload("ny@example.com", "Ny Person", true));

        var tokens = Substitute.For<ITokenService>();
        tokens.GenerateAccessToken(Arg.Any<User>()).Returns("access-token");
        tokens.GenerateRefreshToken().Returns(("raw-refresh", "hashed-refresh"));

        var service = NewService(db, tokens, google: google);

        var result = await service.GoogleLoginAsync("good-token", acceptedTerms: true);

        Assert.True(result.Success);
        Assert.Equal("access-token", result.Tokens!.AccessToken);
        Assert.True(result.Tokens.IsNewUser);

        var created = await db.Users.SingleAsync();
        Assert.Equal("ny@example.com", created.Email);
        Assert.Equal("google", created.AuthProvider);
        Assert.NotNull(created.TermsAcceptedAt);
    }

    // Reproducerar en riktig, live-rapporterad bugg (2026-09-12): en Google-
    // inloggning på /register mot en e-post som redan har ett lösenordskonto
    // drog användaren genom hela Källor-onboardingguiden som om kontot vore
    // nytt, med risk att skriva över redan sparade källval. IsNewUser=false
    // här är vad OnboardingPage använder för att hoppa förbi guiden helt.
    [Fact]
    public async Task GoogleLoginAsync_ExistingEmail_LogsInWithoutCreatingDuplicate()
    {
        using var db = NewDb();
        var existing = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed", EmailVerified = true };
        db.Users.Add(existing);
        await db.SaveChangesAsync();

        var google = Substitute.For<IGoogleTokenValidator>();
        google.ValidateAsync("good-token").Returns(new GooglePayload("ada@example.com", "Ada", true));

        var tokens = Substitute.For<ITokenService>();
        tokens.GenerateAccessToken(Arg.Any<User>()).Returns("access-token");
        tokens.GenerateRefreshToken().Returns(("raw-refresh", "hashed-refresh"));

        var service = NewService(db, tokens, google: google);

        var result = await service.GoogleLoginAsync("good-token", acceptedTerms: true);

        Assert.True(result.Success);
        Assert.False(result.Tokens!.IsNewUser);
        Assert.Single(db.Users);
    }

    [Fact]
    public async Task RefreshAsync_ValidToken_RotatesAndReturnsNewPair()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed" };
        db.Users.Add(user);
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId    = user.Id,
            TokenHash = "old-hash",
            ExpiresAt = DateTime.UtcNow.AddDays(1),
        });
        await db.SaveChangesAsync();

        var tokens = Substitute.For<ITokenService>();
        tokens.HashToken("old-raw").Returns("old-hash");
        tokens.GenerateAccessToken(Arg.Any<User>()).Returns("new-access");
        tokens.GenerateRefreshToken().Returns(("new-raw", "new-hash"));

        var service = NewService(db, tokens);

        var result = await service.RefreshAsync("old-raw");

        Assert.True(result.Success);
        Assert.Equal("new-access", result.Tokens!.AccessToken);
        Assert.Equal("new-raw", result.Tokens.RefreshToken);

        var oldToken = await db.RefreshTokens.FirstAsync(t => t.TokenHash == "old-hash");
        Assert.NotNull(oldToken.RevokedAt);
        Assert.Equal("new-hash", oldToken.ReplacedByTokenHash);
        Assert.Equal(2, await db.RefreshTokens.CountAsync());
    }

    [Fact]
    public async Task RefreshAsync_SuspendedAccount_ReturnsForbidden()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed", IsActive = false };
        db.Users.Add(user);
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId    = user.Id,
            TokenHash = "suspended-hash",
            ExpiresAt = DateTime.UtcNow.AddDays(1),
        });
        await db.SaveChangesAsync();

        var tokens = Substitute.For<ITokenService>();
        tokens.HashToken("suspended-raw").Returns("suspended-hash");

        var service = NewService(db, tokens);

        var result = await service.RefreshAsync("suspended-raw");

        Assert.False(result.Success);
        Assert.Equal(403, result.StatusCode);
        // Ingen ny token ska ha utfärdats eller den gamla rullats
        Assert.Single(db.RefreshTokens);
        var untouched = await db.RefreshTokens.FirstAsync();
        Assert.Null(untouched.RevokedAt);
    }

    [Fact]
    public async Task RefreshAsync_ExpiredToken_ReturnsUnauthorized()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed" };
        db.Users.Add(user);
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId    = user.Id,
            TokenHash = "expired-hash",
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
        });
        await db.SaveChangesAsync();

        var tokens = Substitute.For<ITokenService>();
        tokens.HashToken("expired-raw").Returns("expired-hash");

        var service = NewService(db, tokens);

        var result = await service.RefreshAsync("expired-raw");

        Assert.False(result.Success);
        Assert.Equal(401, result.StatusCode);
    }

    [Fact]
    public async Task RefreshAsync_RevokedToken_ReturnsUnauthorized()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "hashed" };
        db.Users.Add(user);
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId    = user.Id,
            TokenHash = "revoked-hash",
            ExpiresAt = DateTime.UtcNow.AddDays(1),
            RevokedAt = DateTime.UtcNow.AddMinutes(-5),
        });
        await db.SaveChangesAsync();

        var tokens = Substitute.For<ITokenService>();
        tokens.HashToken("revoked-raw").Returns("revoked-hash");

        var service = NewService(db, tokens);

        var result = await service.RefreshAsync("revoked-raw");

        Assert.False(result.Success);
        Assert.Equal(401, result.StatusCode);
    }

    [Fact]
    public async Task RefreshAsync_UnknownToken_ReturnsUnauthorized()
    {
        using var db = NewDb();

        var tokens = Substitute.For<ITokenService>();
        tokens.HashToken("unknown-raw").Returns("unknown-hash");

        var service = NewService(db, tokens);

        var result = await service.RefreshAsync("unknown-raw");

        Assert.False(result.Success);
        Assert.Equal(401, result.StatusCode);
    }

    [Fact]
    public async Task CancelDeletionAsync_ValidToken_ReactivatesAccount()
    {
        using var db = NewDb();
        var user = new User
        {
            Name = "Ada", Email = "ada@example.com", PasswordHash = "x",
            IsActive = false, SuspendedAt = DateTime.UtcNow, SuspendedReason = "Radering begärd",
            DeletionScheduledAt = DateTime.UtcNow.AddHours(20), DeletionCancelToken = "valid-token",
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var service = NewService(db);

        var result = await service.CancelDeletionAsync("valid-token");

        Assert.True(result.Success);
        var updated = await db.Users.FindAsync(user.Id);
        Assert.True(updated!.IsActive);
        Assert.Null(updated.DeletionScheduledAt);
        Assert.Null(updated.DeletionCancelToken);
        Assert.Null(updated.SuspendedAt);
        Assert.Null(updated.SuspendedReason);
    }

    [Fact]
    public async Task CancelDeletionAsync_UnknownToken_ReturnsBadRequest()
    {
        using var db = NewDb();
        var service = NewService(db);

        var result = await service.CancelDeletionAsync("does-not-exist");

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
    }

    // Simulerar att UserDeletionBackgroundService redan hunnit köra —
    // DeletionScheduledAt kan i praktiken fortfarande stå kvar en kort
    // stund efter att fristen passerat, men länken ska ändå sluta fungera.
    [Fact]
    public async Task CancelDeletionAsync_DeletionAlreadyPassed_ReturnsBadRequest()
    {
        using var db = NewDb();
        var user = new User
        {
            Name = "Ada", Email = "ada@example.com", PasswordHash = "x", IsActive = false,
            DeletionScheduledAt = DateTime.UtcNow.AddMinutes(-5), DeletionCancelToken = "expired-token",
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var service = NewService(db);

        var result = await service.CancelDeletionAsync("expired-token");

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.False((await db.Users.FindAsync(user.Id))!.IsActive);
    }
}
