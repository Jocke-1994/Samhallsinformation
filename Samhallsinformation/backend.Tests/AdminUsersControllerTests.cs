namespace Samhallsinformation.Tests;

using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

public class AdminUsersControllerTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static AdminUsersController NewController(AppDbContext db) => new(db)
    {
        ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) } },
    };

    [Fact]
    public async Task GetUsers_ReturnsAllUsers()
    {
        using var db = NewDb();
        db.Users.Add(new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" });
        db.Users.Add(new User { Name = "Bob", Email = "bob@example.com", PasswordHash = "x" });
        await db.SaveChangesAsync();

        var controller = NewController(db);
        var result = Assert.IsType<OkObjectResult>(await controller.GetUsers());
        var list = Assert.IsAssignableFrom<System.Collections.IEnumerable>(result.Value);
        Assert.Equal(2, list.Cast<object>().Count());
    }

    [Fact]
    public async Task SetStatus_Suspend_SetsFieldsCorrectly()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = NewController(db);
        await controller.SetStatus(user.Id, new SetUserStatusRequest(false, "Missbruk"));

        var updated = await db.Users.FindAsync(user.Id);
        Assert.False(updated!.IsActive);
        Assert.NotNull(updated.SuspendedAt);
        Assert.Equal("Missbruk", updated.SuspendedReason);
    }

    [Fact]
    public async Task SetStatus_Reactivate_ClearsSuspensionFields()
    {
        using var db = NewDb();
        var user = new User
        {
            Name = "Ada", Email = "ada@example.com", PasswordHash = "x",
            IsActive = false, SuspendedAt = DateTime.UtcNow, SuspendedReason = "Missbruk",
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = NewController(db);
        await controller.SetStatus(user.Id, new SetUserStatusRequest(true, null));

        var updated = await db.Users.FindAsync(user.Id);
        Assert.True(updated!.IsActive);
        Assert.Null(updated.SuspendedAt);
        Assert.Null(updated.SuspendedReason);
    }

    [Fact]
    public async Task SetStatus_UnknownUser_ReturnsNotFound()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = await controller.SetStatus(Guid.NewGuid(), new SetUserStatusRequest(false, null));

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public void AdminUsersController_RequiresAdminRole()
    {
        var attr = typeof(AdminUsersController).GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(attr);
        Assert.Equal("Admin", attr!.Roles);
    }
}
