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
}
