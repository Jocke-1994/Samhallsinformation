namespace Samhallsinformation.Tests;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NSubstitute;
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
        IEmailService? email = null)
    {
        tokens ??= Substitute.For<ITokenService>();
        hasher ??= Substitute.For<IPasswordHasher<User>>();
        email  ??= Substitute.For<IEmailService>();

        var config = Substitute.For<IConfiguration>();
        config["FRONTEND_URL"].Returns("https://test.local");

        return new AuthService(db, tokens, hasher, email, config);
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

        var result = await service.RegisterAsync("Test Testsson", "test@example.com", "pw123456");

        Assert.True(result.Success);
        Assert.Equal("access-token", result.Tokens!.AccessToken);
        Assert.Equal("raw-refresh", result.Tokens.RefreshToken);
        Assert.Single(db.Users);
        Assert.Single(db.RefreshTokens);
    }

    [Fact]
    public async Task RegisterAsync_DuplicateEmail_ReturnsConflict()
    {
        using var db = NewDb();
        db.Users.Add(new User { Name = "Finns Redan", Email = "taken@example.com", PasswordHash = "x" });
        await db.SaveChangesAsync();

        var service = NewService(db);

        var result = await service.RegisterAsync("Ny Person", "taken@example.com", "pw123456");

        Assert.False(result.Success);
        Assert.Equal(409, result.StatusCode);
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
}
