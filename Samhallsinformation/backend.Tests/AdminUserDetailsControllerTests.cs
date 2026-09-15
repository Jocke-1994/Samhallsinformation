namespace Samhallsinformation.Tests;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

public class AdminUserDetailsControllerTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task GetPushSettings_UnknownUser_ReturnsNotFound()
    {
        using var db = NewDb();
        var controller = new AdminUserDetailsController(db);

        var result = await controller.GetPushSettings(Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task GetPushSettings_KnownUser_ReturnsFlagsAndDevices()
    {
        using var db = NewDb();
        var user = new User
        {
            Name = "Ada", Email = "ada@example.com", PasswordHash = "x",
            PushEnabled = true, PushNyaHandelser = true, PushNyVersion = false,
        };
        db.Users.Add(user);
        db.UserDevices.Add(new UserDevice
        {
            UserId = user.Id, Endpoint = "https://push.example/secret-ep",
            P256dh = "p256dh-key", Auth = "auth-secret",
            DeviceName = "Adas Pixel", Platform = "Android",
        });
        await db.SaveChangesAsync();

        var controller = new AdminUserDetailsController(db);
        var result = Assert.IsType<OkObjectResult>(await controller.GetPushSettings(user.Id));

        var json = System.Text.Json.JsonSerializer.Serialize(result.Value);
        Assert.Contains("\"PushEnabled\":true", json);
        Assert.Contains("\"PushNyaHandelser\":true", json);
        Assert.Contains("\"PushNyVersion\":false", json);
        Assert.Contains("Adas Pixel", json);

        // Push-prenumerationens känsliga uppgifter ska aldrig exponeras för admin.
        Assert.DoesNotContain("secret-ep", json);
        Assert.DoesNotContain("p256dh-key", json);
        Assert.DoesNotContain("auth-secret", json);
    }

    [Fact]
    public async Task SetPushSettings_UnknownUser_ReturnsNotFound()
    {
        using var db = NewDb();
        var controller = new AdminUserDetailsController(db);

        var result = await controller.SetPushSettings(Guid.NewGuid(), new PushSettingsRequest(true, null, null));

        Assert.IsType<NotFoundResult>(result);
    }

    // PATCH-semantik: bara det skickade fältet ändras, precis som
    // självbetjäningens PushController.SaveSettings — annars skulle en admin
    // som bara vill slå på "Ny händelse" åt en användare tyst nolla resten.
    [Fact]
    public async Task SetPushSettings_OnlySetsProvidedField_LeavesOthersUntouched()
    {
        using var db = NewDb();
        var user = new User
        {
            Name = "Ada", Email = "ada@example.com", PasswordHash = "x",
            PushEnabled = false, PushNyaHandelser = false, PushNyVersion = true,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = new AdminUserDetailsController(db);
        await controller.SetPushSettings(user.Id, new PushSettingsRequest(true, null, null));

        var updated = await db.Users.FindAsync(user.Id);
        Assert.True(updated!.PushEnabled);
        Assert.False(updated.PushNyaHandelser);
        Assert.True(updated.PushNyVersion);
    }

    [Fact]
    public async Task SetPushSettings_ActualChange_WritesAuditLogAsAdmin()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x", PushEnabled = false };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = new AdminUserDetailsController(db);
        await controller.SetPushSettings(user.Id, new PushSettingsRequest(true, null, null));

        var log = Assert.Single(db.UserSettingAuditLogs);
        Assert.Equal("push_enabled", log.Setting);
        Assert.Equal("False", log.OldValue);
        Assert.Equal("True", log.NewValue);
        Assert.Equal("admin", log.ChangedBy);
    }

    [Fact]
    public async Task SetPushSettings_NoActualChange_WritesNoAuditLog()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x", PushEnabled = true };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = new AdminUserDetailsController(db);
        await controller.SetPushSettings(user.Id, new PushSettingsRequest(true, null, null));

        Assert.Empty(db.UserSettingAuditLogs);
    }
}
