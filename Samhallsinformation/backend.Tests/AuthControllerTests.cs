namespace Samhallsinformation.Tests;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

public class AuthControllerTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static AuthController NewController(AppDbContext db, Guid userId)
    {
        var auth   = Substitute.For<IAuthService>();
        var tokens = Substitute.For<ITokenService>();
        tokens.GenerateAccessToken(Arg.Any<User>()).Returns("dummy-token");
        var hasher = Substitute.For<IPasswordHasher<User>>();

        return new AuthController(auth, tokens, db, hasher)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(
                new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "TestAuth")) } },
        };
    }

    [Fact]
    public async Task Me_ReturnsDisplayNameFromDatabase()
    {
        using var db = NewDb();
        var user = new User { Name = "Joakim Rehn", Email = "joakim@example.com", PasswordHash = "x", DisplayName = "Nova" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = NewController(db, user.Id);
        var result = Assert.IsType<OkObjectResult>(await controller.Me());

        var displayName = result.Value!.GetType().GetProperty("DisplayName")!.GetValue(result.Value);
        Assert.Equal("Nova", displayName);
    }

    [Fact]
    public async Task UpdateMe_SetsDisplayName()
    {
        using var db = NewDb();
        var user = new User { Name = "Joakim Rehn", Email = "joakim@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = NewController(db, user.Id);
        await controller.UpdateMe(new UpdateMeRequest(null, null, "Nova"));

        var updated = await db.Users.FindAsync(user.Id);
        Assert.Equal("Nova", updated!.DisplayName);
        Assert.Contains(db.UserSettingAuditLogs, l => l.Setting == "displayName" && l.NewValue == "Nova");
    }

    [Fact]
    public async Task UpdateMe_EmptyDisplayName_ClearsIt()
    {
        using var db = NewDb();
        var user = new User { Name = "Joakim Rehn", Email = "joakim@example.com", PasswordHash = "x", DisplayName = "Nova" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = NewController(db, user.Id);
        await controller.UpdateMe(new UpdateMeRequest(null, null, ""));

        var updated = await db.Users.FindAsync(user.Id);
        Assert.Null(updated!.DisplayName);
    }

    [Fact]
    public async Task UpdateMe_DisplayNameOmitted_LeavesItUnchanged()
    {
        using var db = NewDb();
        var user = new User { Name = "Joakim Rehn", Email = "joakim@example.com", PasswordHash = "x", DisplayName = "Nova" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = NewController(db, user.Id);
        await controller.UpdateMe(new UpdateMeRequest("Joakim R.", null));

        var updated = await db.Users.FindAsync(user.Id);
        Assert.Equal("Nova", updated!.DisplayName);
        Assert.Equal("Joakim R.", updated.Name);
    }
}
