namespace Samhallsinformation.Tests;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

// V1-1: lösenordsbyte på riktigt — server-side regel, fel nuvarande lösenord,
// Google-konton och återkallning av refresh-tokens.
public class ChangePasswordTests
{
    private const string GammaltLosenord = "gammalt-losen";

    private static readonly PasswordHasher<User> Hasher = new();

    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static AuthService NewService(AppDbContext db)
    {
        // Riktig hasher så testet bevisar att hashen faktiskt byts; token-hashen är
        // deterministisk så att en enhets token kan pekas ut.
        var tokens = Substitute.For<ITokenService>();
        tokens.HashToken(Arg.Any<string>()).Returns(ci => "hash:" + ci.Arg<string>());

        var config = Substitute.For<IConfiguration>();
        config["FRONTEND_URL"].Returns("https://test.local");

        return new AuthService(db, tokens, Hasher, Substitute.For<IEmailService>(),
            Substitute.For<IGoogleTokenValidator>(), Substitute.For<IPushNotificationService>(),
            Substitute.For<IAktivitetsloggService>(), new LoginThrottle(), config);
    }

    private static async Task<User> AddLocalUserAsync(AppDbContext db)
    {
        var user = new User { Name = "Ada", Email = "ada@example.com", AuthProvider = "local" };
        user.PasswordHash = Hasher.HashPassword(user, GammaltLosenord);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private static RefreshToken Token(Guid userId, string raw) =>
        new() { UserId = userId, TokenHash = "hash:" + raw, ExpiresAt = DateTime.UtcNow.AddDays(30) };

    [Theory]
    [InlineData("")]
    [InlineData("kort")]
    [InlineData("1234567")]
    public async Task ChangePasswordAsync_TooShortNewPassword_Returns400_AndChangesNothing(string nytt)
    {
        using var db = NewDb();
        var user = await AddLocalUserAsync(db);
        var hashFore = user.PasswordHash;
        db.RefreshTokens.Add(Token(user.Id, "enhet-a"));
        await db.SaveChangesAsync();

        var result = await NewService(db).ChangePasswordAsync(user.Id, GammaltLosenord, nytt, "enhet-a");

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.Contains("minst 8", result.Error);
        Assert.Equal(hashFore, (await db.Users.FindAsync(user.Id))!.PasswordHash);
        Assert.All(db.RefreshTokens, t => Assert.Null(t.RevokedAt));
        Assert.Empty(db.UserSettingAuditLogs);
    }

    [Fact]
    public async Task ChangePasswordAsync_WrongCurrentPassword_IsRejected_AndChangesNothing()
    {
        using var db = NewDb();
        var user = await AddLocalUserAsync(db);
        var hashFore = user.PasswordHash;
        db.RefreshTokens.Add(Token(user.Id, "enhet-a"));
        await db.SaveChangesAsync();

        var result = await NewService(db).ChangePasswordAsync(user.Id, "fel-losenord", "helt-nytt-losen", "enhet-a");

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.Equal("Nuvarande lösenord stämmer inte", result.Error);
        Assert.Equal(hashFore, (await db.Users.FindAsync(user.Id))!.PasswordHash);
        Assert.All(db.RefreshTokens, t => Assert.Null(t.RevokedAt));
    }

    [Fact]
    public async Task ChangePasswordAsync_Success_UpdatesHash_RevokesOtherDevices_KeepsCallingDevice()
    {
        using var db = NewDb();
        var user = await AddLocalUserAsync(db);
        db.RefreshTokens.AddRange(
            Token(user.Id, "enhet-a"),   // enheten som byter
            Token(user.Id, "enhet-b"),   // annan enhet
            Token(user.Id, "enhet-c"));  // annan enhet
        // En annan användares token får aldrig röras.
        var annan = Guid.NewGuid();
        db.RefreshTokens.Add(Token(annan, "annan-anvandare"));
        await db.SaveChangesAsync();

        var result = await NewService(db).ChangePasswordAsync(user.Id, GammaltLosenord, "helt-nytt-losen", "enhet-a");

        Assert.True(result.Success);

        var uppdaterad = (await db.Users.FindAsync(user.Id))!;
        Assert.Equal(PasswordVerificationResult.Success, Hasher.VerifyHashedPassword(uppdaterad, uppdaterad.PasswordHash, "helt-nytt-losen"));
        Assert.Equal(PasswordVerificationResult.Failed, Hasher.VerifyHashedPassword(uppdaterad, uppdaterad.PasswordHash, GammaltLosenord));

        Assert.Null(db.RefreshTokens.Single(t => t.TokenHash == "hash:enhet-a").RevokedAt);
        Assert.NotNull(db.RefreshTokens.Single(t => t.TokenHash == "hash:enhet-b").RevokedAt);
        Assert.NotNull(db.RefreshTokens.Single(t => t.TokenHash == "hash:enhet-c").RevokedAt);
        Assert.Null(db.RefreshTokens.Single(t => t.UserId == annan).RevokedAt);

        Assert.Contains(db.UserSettingAuditLogs, l => l.UserId == user.Id && l.Setting == "password" && l.ChangedBy == "user");
    }

    [Fact]
    public async Task ChangePasswordAsync_Success_WithoutRefreshToken_RevokesAllSessions()
    {
        using var db = NewDb();
        var user = await AddLocalUserAsync(db);
        db.RefreshTokens.AddRange(Token(user.Id, "enhet-a"), Token(user.Id, "enhet-b"));
        await db.SaveChangesAsync();

        var result = await NewService(db).ChangePasswordAsync(user.Id, GammaltLosenord, "helt-nytt-losen", null);

        Assert.True(result.Success);
        Assert.All(db.RefreshTokens, t => Assert.NotNull(t.RevokedAt));
    }

    [Fact]
    public async Task ChangePasswordAsync_GoogleAccountWithoutPassword_Returns400_InsteadOfThrowing()
    {
        using var db = NewDb();
        var user = new User { Name = "Gustav", Email = "g@example.com", AuthProvider = "google", PasswordHash = string.Empty };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await NewService(db).ChangePasswordAsync(user.Id, "vad-som-helst", "helt-nytt-losen", null);

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.Contains("Google", result.Error);
        Assert.Equal(string.Empty, (await db.Users.FindAsync(user.Id))!.PasswordHash);
    }

    [Fact]
    public async Task ChangePasswordAsync_UnknownUser_Returns404()
    {
        using var db = NewDb();

        var result = await NewService(db).ChangePasswordAsync(Guid.NewGuid(), "a", "helt-nytt-losen", null);

        Assert.False(result.Success);
        Assert.Equal(404, result.StatusCode);
    }

    [Fact]
    public async Task Controller_ChangePassword_ForwardsRefreshToken_AndMapsFailureStatus()
    {
        using var db = NewDb();
        var userId = Guid.NewGuid();
        var auth = Substitute.For<IAuthService>();
        auth.ChangePasswordAsync(userId, "gammalt", "nytt", "min-refresh")
            .Returns(AuthResult.Fail(400, "Lösenordet måste vara minst 8 tecken"));

        var controller = new AuthController(auth, Substitute.For<ITokenService>(), db,
            Substitute.For<IPasswordHasher<User>>(), Substitute.For<IEmailService>(), Substitute.For<IConfiguration>())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(
                new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "TestAuth"))
                }
            },
        };

        var result = Assert.IsType<ObjectResult>(await controller.ChangePassword(new ChangePasswordRequest("gammalt", "nytt", "min-refresh")));

        Assert.Equal(400, result.StatusCode);
        await auth.Received(1).ChangePasswordAsync(userId, "gammalt", "nytt", "min-refresh");
    }
}
