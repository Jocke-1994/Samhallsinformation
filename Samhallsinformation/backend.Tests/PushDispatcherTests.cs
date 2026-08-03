namespace Samhallsinformation.Tests;

using System.Net;
using System.Net.Http;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using WebPush;
using Xunit;

public class PushDispatcherTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static (User User, Source Source, UserDevice Device) SeedSubscriber(
        AppDbContext db, bool pushEnabled = true, bool sourceActive = true)
    {
        var user = new User
        {
            Name         = "Ada",
            Email        = $"{Guid.NewGuid()}@example.com",
            PasswordHash = "x",
            PushEnabled  = pushEnabled,
        };
        var source = new Source { Name = "Polisen", ShortName = "Polisen", BaseUrl = "https://example.com" };
        db.Users.Add(user);
        db.Sources.Add(source);
        db.SaveChanges();

        db.UserSourcePreferences.Add(new UserSourcePreference
        {
            UserId    = user.Id,
            SourceId  = source.Id,
            IsActive  = sourceActive,
            SortOrder = 0,
        });
        var device = new UserDevice
        {
            UserId   = user.Id,
            Endpoint = "https://push.example/ep1",
            P256dh   = "p256dh-key",
            Auth     = "auth-secret",
        };
        db.UserDevices.Add(device);
        db.SaveChanges();

        return (user, source, device);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_ActiveSubscriberWithDevice_SendsPushAndLogsSent()
    {
        using var db = NewDb();
        var (_, source, device) = SeedSubscriber(db);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 3);

        await push.Received(1).SendAsync(
            Arg.Is<UserDevice>(d => d!.Id == device.Id),
            Arg.Any<string>(),
            Arg.Is<string>(b => b!.Contains('3') && b.Contains("Polisen")),
            Arg.Any<string?>(),
            Arg.Any<CancellationToken>());

        var log = Assert.Single(db.NotificationDeliveryLogs);
        Assert.Equal("sent", log.Status);
        Assert.Equal("push", log.Channel);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_GlobalMuteEnabled_SendsNothing()
    {
        using var db = NewDb();
        var (_, source, _) = SeedSubscriber(db, pushEnabled: false);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1);

        await push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default);
        Assert.Empty(db.NotificationDeliveryLogs);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_SourceNotActiveForUser_SendsNothing()
    {
        using var db = NewDb();
        var (_, source, _) = SeedSubscriber(db, sourceActive: false);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1);

        await push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_NoNewEvents_SendsNothing()
    {
        using var db = NewDb();
        var (_, source, _) = SeedSubscriber(db);
        var push = Substitute.For<IPushNotificationService>();

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 0);

        await push.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, default, default);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_ExpiredSubscription_RemovesDeviceAndLogsExpired()
    {
        using var db = NewDb();
        var (_, source, device) = SeedSubscriber(db);
        var push = Substitute.For<IPushNotificationService>();

        var subscription  = new PushSubscription(device.Endpoint, device.P256dh, device.Auth);
        var goneException = new WebPushException("gone", subscription, new HttpResponseMessage(HttpStatusCode.Gone));
        push.SendAsync(Arg.Any<UserDevice>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(goneException));

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1);

        Assert.Empty(db.UserDevices);
        var log = Assert.Single(db.NotificationDeliveryLogs);
        Assert.Equal("expired", log.Status);
    }

    [Fact]
    public async Task DispatchNewEventsAsync_OtherSendFailure_KeepsDeviceAndLogsFailed()
    {
        using var db = NewDb();
        var (_, source, device) = SeedSubscriber(db);
        var push = Substitute.For<IPushNotificationService>();

        push.SendAsync(Arg.Any<UserDevice>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("boom")));

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, insertedCount: 1);

        Assert.Single(db.UserDevices);
        Assert.Equal(device.Id, db.UserDevices.Single().Id);
        var log = Assert.Single(db.NotificationDeliveryLogs);
        Assert.Equal("failed", log.Status);
    }
}
