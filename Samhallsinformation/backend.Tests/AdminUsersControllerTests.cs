namespace Samhallsinformation.Tests;

using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
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

    private static AdminUsersController NewController(AppDbContext db) => new(db, Substitute.For<IAktivitetsloggService>())
    {
        ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) } },
    };

    private static AdminUsersController NewController(AppDbContext db, Guid callerId) => new(db, Substitute.For<IAktivitetsloggService>())
    {
        ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(
            new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, callerId.ToString()) }, "TestAuth")) } },
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
    public async Task SetStatus_SuspendWithReminder_SetsReminderFields()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var reminderAt = DateTime.UtcNow.AddDays(7);
        var controller = NewController(db);
        await controller.SetStatus(user.Id, new SetUserStatusRequest(false, "Missbruk", reminderAt, "Kolla igen om en vecka"));

        var updated = await db.Users.FindAsync(user.Id);
        Assert.Equal(reminderAt, updated!.SuspensionReminderAt);
        Assert.Equal("Kolla igen om en vecka", updated.SuspensionReminderNote);
    }

    [Fact]
    public async Task SetStatus_Reactivate_ClearsReminderFields()
    {
        using var db = NewDb();
        var user = new User
        {
            Name = "Ada", Email = "ada@example.com", PasswordHash = "x",
            IsActive = false, SuspendedAt = DateTime.UtcNow, SuspendedReason = "Missbruk",
            SuspensionReminderAt = DateTime.UtcNow.AddDays(3), SuspensionReminderNote = "Kolla igen",
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = NewController(db);
        await controller.SetStatus(user.Id, new SetUserStatusRequest(true, null));

        var updated = await db.Users.FindAsync(user.Id);
        Assert.Null(updated!.SuspensionReminderAt);
        Assert.Null(updated.SuspensionReminderNote);
    }

    [Fact]
    public async Task GetNotifications_OnlyReturnsOverdueSuspendedReminders()
    {
        using var db = NewDb();
        db.Users.Add(new User // Förfallen påminnelse — ska synas
        {
            Name = "Ada", Email = "ada@example.com", PasswordHash = "x",
            IsActive = false, SuspensionReminderAt = DateTime.UtcNow.AddDays(-1), SuspensionReminderNote = "Kolla",
        });
        db.Users.Add(new User // Framtida påminnelse — ska INTE synas än
        {
            Name = "Bob", Email = "bob@example.com", PasswordHash = "x",
            IsActive = false, SuspensionReminderAt = DateTime.UtcNow.AddDays(1),
        });
        db.Users.Add(new User // Avstängd men ingen påminnelse satt — ska INTE synas
        {
            Name = "Cleo", Email = "cleo@example.com", PasswordHash = "x",
            IsActive = false,
        });
        db.Users.Add(new User // Aktiv — ska INTE synas oavsett datum
        {
            Name = "Dan", Email = "dan@example.com", PasswordHash = "x",
            IsActive = true, SuspensionReminderAt = DateTime.UtcNow.AddDays(-1),
        });
        await db.SaveChangesAsync();

        var controller = NewController(db);
        var result = Assert.IsType<OkObjectResult>(await controller.GetNotifications());
        var list = Assert.IsAssignableFrom<System.Collections.IEnumerable>(result.Value).Cast<object>().ToList();

        Assert.Single(list);
    }

    [Fact]
    public async Task Delete_SchedulesDeletion_AndBlocksLoginImmediately()
    {
        using var db = NewDb();
        var admin = new User { Name = "Admin", Email = "admin@example.com", PasswordHash = "x", Role = "Admin" };
        var target = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.AddRange(admin, target);
        await db.SaveChangesAsync();

        var controller = NewController(db, admin.Id);
        await controller.Delete(target.Id);

        var updated = await db.Users.FindAsync(target.Id);
        Assert.False(updated!.IsActive);
        Assert.NotNull(updated.DeletionScheduledAt);
        Assert.True(updated.DeletionScheduledAt > DateTime.UtcNow.AddHours(23));
        Assert.Null(updated.DeletedAt);
        // Inte anonymiserat än — det görs av UserDeletionBackgroundService när fönstret gått ut
        Assert.Equal("Ada", updated.Name);
        Assert.Equal("ada@example.com", updated.Email);
    }

    [Fact]
    public async Task Delete_AlreadyScheduled_ReturnsBadRequest()
    {
        using var db = NewDb();
        var admin = new User { Name = "Admin", Email = "admin@example.com", PasswordHash = "x", Role = "Admin" };
        var target = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x", DeletionScheduledAt = DateTime.UtcNow.AddHours(10) };
        db.Users.AddRange(admin, target);
        await db.SaveChangesAsync();

        var controller = NewController(db, admin.Id);
        var result = await controller.Delete(target.Id);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Delete_AlreadyDeleted_ReturnsBadRequest()
    {
        using var db = NewDb();
        var admin = new User { Name = "Admin", Email = "admin@example.com", PasswordHash = "x", Role = "Admin" };
        var target = new User { Name = "Raderad användare", Email = "deleted-x@anonymized.local", PasswordHash = "", DeletedAt = DateTime.UtcNow };
        db.Users.AddRange(admin, target);
        await db.SaveChangesAsync();

        var controller = NewController(db, admin.Id);
        var result = await controller.Delete(target.Id);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CancelDeletion_ClearsScheduleAndReactivatesAccount()
    {
        using var db = NewDb();
        var user = new User
        {
            Name = "Ada", Email = "ada@example.com", PasswordHash = "x",
            IsActive = false, SuspendedAt = DateTime.UtcNow, SuspendedReason = "Radering begärd (GDPR)",
            DeletionScheduledAt = DateTime.UtcNow.AddHours(10),
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = NewController(db);
        await controller.CancelDeletion(user.Id);

        var updated = await db.Users.FindAsync(user.Id);
        Assert.Null(updated!.DeletionScheduledAt);
        Assert.True(updated.IsActive);
        Assert.Null(updated.SuspendedAt);
        Assert.Null(updated.SuspendedReason);
    }

    [Fact]
    public async Task CancelDeletion_NothingScheduled_ReturnsBadRequest()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = NewController(db);
        var result = await controller.CancelDeletion(user.Id);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CancelDeletion_UnknownUser_ReturnsNotFound()
    {
        using var db = NewDb();
        var controller = NewController(db);

        var result = await controller.CancelDeletion(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Delete_OwnAccount_ReturnsBadRequest()
    {
        using var db = NewDb();
        var admin = new User { Name = "Admin", Email = "admin@example.com", PasswordHash = "x", Role = "Admin" };
        db.Users.Add(admin);
        await db.SaveChangesAsync();

        var controller = NewController(db, admin.Id);
        var result = await controller.Delete(admin.Id);

        Assert.IsType<BadRequestObjectResult>(result);
        var stillThere = await db.Users.FindAsync(admin.Id);
        Assert.Equal("Admin", stillThere!.Name);
    }

    [Fact]
    public async Task Delete_UnknownUser_ReturnsNotFound()
    {
        using var db = NewDb();
        var controller = NewController(db, Guid.NewGuid());

        var result = await controller.Delete(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
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
