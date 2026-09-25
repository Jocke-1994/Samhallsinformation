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

/// <summary>
/// Kontospärrens integritet (V2-2, E1 #3/#7, E6 #1 backend): en admins spärr får inte kunna hävas
/// via GDPR-radering/ångra-länk, återaktivering ska avbryta schemalagd radering, och ingen
/// (sig själv / sista aktiva admin) ska kunna låsas ut.
/// </summary>
public class KontosparrIntegritetTests
{
    private static AppDbContext NewDb() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);

    private static ControllerContext CallerContext(Guid callerId) => new()
    {
        HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(
            new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, callerId.ToString()) }, "TestAuth")) },
    };

    private static AuthController NewAuthController(AppDbContext db, Guid userId) =>
        new(Substitute.For<IAuthService>(), Substitute.For<ITokenService>(), db,
            Substitute.For<IPasswordHasher<User>>(), Substitute.For<IEmailService>(), Substitute.For<IConfiguration>())
        {
            ControllerContext = CallerContext(userId),
        };

    private static AdminUsersController NewAdminController(AppDbContext db, Guid callerId) =>
        new(db, Substitute.For<IAktivitetsloggService>(), Substitute.For<IEmailService>(),
            Substitute.For<IAuthService>(), Substitute.For<IConfiguration>())
        {
            ControllerContext = CallerContext(callerId),
        };

    private static AuthService NewAuthService(AppDbContext db)
    {
        var config = Substitute.For<IConfiguration>();
        config["FRONTEND_URL"].Returns("https://test.local");
        return new AuthService(db, Substitute.For<ITokenService>(), Substitute.For<IPasswordHasher<User>>(),
            Substitute.For<IEmailService>(), Substitute.For<IGoogleTokenValidator>(),
            Substitute.For<IPushNotificationService>(), Substitute.For<IAktivitetsloggService>(), config);
    }

    private static User AdminSuspendedUser(string reason = "Missbruk") => new()
    {
        Name = "Ada", Email = $"ada-{Guid.NewGuid():N}@example.com", PasswordHash = "x",
        IsActive = false, SuspendedAt = DateTime.UtcNow.AddDays(-1), SuspendedReason = reason,
    };

    private static User NewAdmin(string name, bool active = true) => new()
    {
        Name = name, Email = $"{name}-{Guid.NewGuid():N}@example.com", PasswordHash = "x", Role = "Admin", IsActive = active,
    };

    // ---- DeleteMe ----------------------------------------------------------------------

    [Fact]
    public async Task DeleteMe_AdminSuspendedUser_IsRejectedWith403_AndNothingIsScheduled()
    {
        using var db = NewDb();
        var user = AdminSuspendedUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await NewAuthController(db, user.Id).DeleteMe();

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, obj.StatusCode);
        var stored = await db.Users.FindAsync(user.Id);
        Assert.Null(stored!.DeletionScheduledAt);
        Assert.Null(stored.DeletionCancelToken);
        Assert.Equal("Missbruk", stored.SuspendedReason);
    }

    [Fact]
    public async Task DeleteMe_ActiveUser_SchedulesDeletion()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var result = await NewAuthController(db, user.Id).DeleteMe();

        Assert.IsType<OkObjectResult>(result);
        var stored = await db.Users.FindAsync(user.Id);
        Assert.False(stored!.IsActive);
        Assert.NotNull(stored.DeletionScheduledAt);
        Assert.NotNull(stored.DeletionCancelToken);
        Assert.StartsWith(AccountSuspension.DeletionReasonPrefix, stored.SuspendedReason);
    }

    [Fact]
    public async Task DeleteMe_LastActiveAdmin_IsRejected()
    {
        using var db = NewDb();
        var admin = NewAdmin("admin");
        db.Users.Add(admin);
        await db.SaveChangesAsync();

        var result = await NewAuthController(db, admin.Id).DeleteMe();

        Assert.IsType<BadRequestObjectResult>(result);
        var stored = await db.Users.FindAsync(admin.Id);
        Assert.True(stored!.IsActive);
        Assert.Null(stored.DeletionScheduledAt);
    }

    // ---- CancelDeletion (användarens ångra-länk) ----------------------------------------

    [Fact]
    public async Task CancelDeletion_AfterPureUserDeletion_Reactivates()
    {
        // Riktigt flöde: DeleteMe sätter spärren, ångra-länken (med token från DeleteMe) häver den.
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        await NewAuthController(db, user.Id).DeleteMe();
        var token = (await db.Users.FindAsync(user.Id))!.DeletionCancelToken!;

        var result = await NewAuthService(db).CancelDeletionAsync(token);

        Assert.True(result.Success);
        var stored = await db.Users.FindAsync(user.Id);
        Assert.True(stored!.IsActive);
        Assert.Null(stored.DeletionScheduledAt);
        Assert.Null(stored.SuspendedReason);
    }

    [Fact]
    public async Task CancelDeletion_AdminSuspendsAfterUserRequest_DoesNotLiftSuspension()
    {
        using var db = NewDb();
        var admin = NewAdmin("admin");
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.AddRange(admin, user);
        await db.SaveChangesAsync();
        await NewAuthController(db, user.Id).DeleteMe();
        var token = (await db.Users.FindAsync(user.Id))!.DeletionCancelToken!;
        await NewAdminController(db, admin.Id).SetStatus(user.Id, new SetUserStatusRequest(false, "Missbruk"));

        var result = await NewAuthService(db).CancelDeletionAsync(token);

        Assert.False(result.Success);
        Assert.Equal(400, result.StatusCode);
        Assert.DoesNotContain("admin", result.Error, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Missbruk", result.Error);
        var stored = await db.Users.FindAsync(user.Id);
        Assert.False(stored!.IsActive);
        Assert.Equal("Missbruk", stored.SuspendedReason);
        Assert.NotNull(stored.SuspendedAt);
    }

    [Fact]
    public async Task CancelDeletion_AdminDeletesAlreadySuspendedUser_DoesNotLiftSuspension()
    {
        using var db = NewDb();
        var admin = NewAdmin("admin");
        var user = AdminSuspendedUser("Missbruk");
        db.Users.AddRange(admin, user);
        await db.SaveChangesAsync();
        await NewAdminController(db, admin.Id).Delete(user.Id);
        var stored = await db.Users.FindAsync(user.Id);
        Assert.NotNull(stored!.DeletionScheduledAt);
        Assert.Equal("Missbruk", stored.SuspendedReason); // admins spärr skrevs inte över med raderingsmarkören
        var token = stored.DeletionCancelToken!;

        var result = await NewAuthService(db).CancelDeletionAsync(token);

        Assert.False(result.Success);
        Assert.False((await db.Users.FindAsync(user.Id))!.IsActive);
    }

    [Fact]
    public async Task AdminCancelDeletion_OnAdminSuspendedAccount_CancelsDeletionButKeepsSuspension()
    {
        using var db = NewDb();
        var admin = NewAdmin("admin");
        var user = AdminSuspendedUser("Missbruk");
        db.Users.AddRange(admin, user);
        await db.SaveChangesAsync();
        var controller = NewAdminController(db, admin.Id);
        await controller.Delete(user.Id);

        await controller.CancelDeletion(user.Id);

        var stored = await db.Users.FindAsync(user.Id);
        Assert.Null(stored!.DeletionScheduledAt);
        Assert.False(stored.IsActive);
        Assert.Equal("Missbruk", stored.SuspendedReason);
    }

    // ---- SetStatus ----------------------------------------------------------------------

    [Fact]
    public async Task SetStatus_Reactivate_ScheduledDeletion_CancelsTheDeletion()
    {
        using var db = NewDb();
        var admin = NewAdmin("admin");
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.AddRange(admin, user);
        await db.SaveChangesAsync();
        await NewAuthController(db, user.Id).DeleteMe();

        var result = await NewAdminController(db, admin.Id).SetStatus(user.Id, new SetUserStatusRequest(true, null));

        Assert.IsType<OkResult>(result);
        var stored = await db.Users.FindAsync(user.Id);
        Assert.True(stored!.IsActive);
        Assert.Null(stored.DeletionScheduledAt);
        Assert.Null(stored.DeletionCancelToken);
        Assert.Null(stored.SuspendedReason);

        // ...och bakgrundstjänsten anonymiserar det därför inte.
        db.Entry(stored).State = EntityState.Detached;
        await UserDeletionBackgroundService.ExecuteDueDeletionsAsync(db);
        Assert.Equal("Ada", (await db.Users.FindAsync(user.Id))!.Name);
    }

    [Fact]
    public async Task SetStatus_Reactivate_AnonymizedAccount_IsRejected()
    {
        using var db = NewDb();
        var admin = NewAdmin("admin");
        var user = AdminSuspendedUser("Konto raderat (GDPR)");
        user.DeletedAt = DateTime.UtcNow.AddDays(-2);
        db.Users.AddRange(admin, user);
        await db.SaveChangesAsync();

        var result = await NewAdminController(db, admin.Id).SetStatus(user.Id, new SetUserStatusRequest(true, null));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.False((await db.Users.FindAsync(user.Id))!.IsActive);
    }

    [Fact]
    public async Task SetStatus_AdminCannotSuspendThemselves_EvenWithOtherAdmins()
    {
        using var db = NewDb();
        var me = NewAdmin("me");
        var other = NewAdmin("other");
        db.Users.AddRange(me, other);
        await db.SaveChangesAsync();

        var result = await NewAdminController(db, me.Id).SetStatus(me.Id, new SetUserStatusRequest(false, "Test"));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.True((await db.Users.FindAsync(me.Id))!.IsActive);
    }

    [Fact]
    public async Task SetStatus_LastActiveAdmin_CannotBeSuspended()
    {
        using var db = NewDb();
        var caller = new User { Name = "Support", Email = "s@example.com", PasswordHash = "x", Role = "Support" };
        var onlyAdmin = NewAdmin("admin");
        var suspendedAdmin = NewAdmin("gammal", active: false); // räknas inte som aktiv admin
        db.Users.AddRange(caller, onlyAdmin, suspendedAdmin);
        await db.SaveChangesAsync();

        var result = await NewAdminController(db, caller.Id).SetStatus(onlyAdmin.Id, new SetUserStatusRequest(false, "Test"));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.True((await db.Users.FindAsync(onlyAdmin.Id))!.IsActive);
    }

    [Fact]
    public async Task SetStatus_SuspendAnotherAdmin_IsAllowedWhenAnotherActiveAdminRemains()
    {
        using var db = NewDb();
        var me = NewAdmin("me");
        var other = NewAdmin("other");
        db.Users.AddRange(me, other);
        await db.SaveChangesAsync();

        var result = await NewAdminController(db, me.Id).SetStatus(other.Id, new SetUserStatusRequest(false, "Test"));

        Assert.IsType<OkResult>(result);
        Assert.False((await db.Users.FindAsync(other.Id))!.IsActive);
    }

    // ---- Delete (admin) -----------------------------------------------------------------

    [Fact]
    public async Task Delete_LastActiveAdmin_IsRejected()
    {
        using var db = NewDb();
        var caller = new User { Name = "Support", Email = "s@example.com", PasswordHash = "x", Role = "Support" };
        var onlyAdmin = NewAdmin("admin");
        db.Users.AddRange(caller, onlyAdmin);
        await db.SaveChangesAsync();

        var result = await NewAdminController(db, caller.Id).Delete(onlyAdmin.Id);

        Assert.IsType<BadRequestObjectResult>(result);
        var stored = await db.Users.FindAsync(onlyAdmin.Id);
        Assert.True(stored!.IsActive);
        Assert.Null(stored.DeletionScheduledAt);
    }

    [Fact]
    public async Task Delete_AdminWhenAnotherActiveAdminRemains_IsAllowed()
    {
        using var db = NewDb();
        var me = NewAdmin("me");
        var other = NewAdmin("other");
        db.Users.AddRange(me, other);
        await db.SaveChangesAsync();

        var result = await NewAdminController(db, me.Id).Delete(other.Id);

        Assert.IsType<OkObjectResult>(result);
        Assert.NotNull((await db.Users.FindAsync(other.Id))!.DeletionScheduledAt);
    }
}
