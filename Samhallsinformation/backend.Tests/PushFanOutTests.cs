namespace Samhallsinformation.Tests;

using System.Diagnostics;
using System.Net;
using System.Net.Http;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using WebPush;
using Xunit;

// V3-4 (E3#11): parallell fan-out med timeout per enhet och felisolering.
public class PushFanOutTests
{
    private sealed class FakePush(Func<UserDevice, CancellationToken, Task> behavior) : IPushNotificationService
    {
        public Task SendAsync(UserDevice device, string title, string body, string? url, Guid? claimId = null, CancellationToken ct = default)
            => behavior(device, ct);
    }

    private static List<PushSendItem> Items(int n) =>
        Enumerable.Range(0, n)
            .Select(i => new PushSendItem(new UserDevice { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), Endpoint = $"https://push.example/{i}" }, Guid.NewGuid()))
            .ToList();

    private static readonly PushFanOutOptions Fast = new(TimeSpan.FromMilliseconds(200), 8);

    [Fact]
    public async Task HangingDevice_TimesOut_AndDoesNotBlockTheOthers()
    {
        var items = Items(4);
        var hanging = items[1].Device.Id;
        // Ignorerar medvetet sin token — värsta fallet (en hängande socket).
        var push = new FakePush((d, _) => d.Id == hanging ? new TaskCompletionSource().Task : Task.CompletedTask);

        var sw = Stopwatch.StartNew();
        var results = await PushFanOut.SendAsync(push, items, "t", "b", null, Fast, CancellationToken.None);
        sw.Stop();

        Assert.Equal("failed", results[1].Status);
        Assert.Contains("Timeout", results[1].ErrorMessage);
        Assert.All(new[] { 0, 2, 3 }, i => Assert.Equal("sent", results[i].Status));
        Assert.True(sw.Elapsed < TimeSpan.FromSeconds(5), $"tog {sw.Elapsed}");
    }

    [Fact]
    public async Task Timeout_CancelsTheTokenPassedToTheSend()
    {
        var items = Items(1);
        var observedCancel = new TaskCompletionSource<bool>();
        var push = new FakePush(async (_, ct) =>
        {
            try { await Task.Delay(Timeout.Infinite, ct); }
            catch (OperationCanceledException) { observedCancel.TrySetResult(true); throw; }
        });

        var results = await PushFanOut.SendAsync(push, items, "t", "b", null, Fast, CancellationToken.None);

        Assert.Equal("failed", results[0].Status);
        Assert.True(await observedCancel.Task.WaitAsync(TimeSpan.FromSeconds(5)));
    }

    [Fact]
    public async Task SlowDevices_RunInParallel_NotSequentially()
    {
        var items = Items(8);
        var push = new FakePush(async (_, ct) => await Task.Delay(300, ct));

        var sw = Stopwatch.StartNew();
        var results = await PushFanOut.SendAsync(push, items, "t", "b", null, new PushFanOutOptions(TimeSpan.FromSeconds(10), 8), CancellationToken.None);
        sw.Stop();

        Assert.All(results, r => Assert.Equal("sent", r.Status));
        // Sekventiellt hade det tagit 8 x 300 = 2400 ms.
        Assert.True(sw.ElapsedMilliseconds < 1500, $"tog {sw.ElapsedMilliseconds} ms");
    }

    [Fact]
    public async Task ThrowingDevice_DoesNotFailTheBatch()
    {
        var items = Items(5);
        var bad = items[2].Device.Id;
        var push = new FakePush((d, _) => d.Id == bad ? Task.FromException(new InvalidOperationException("boom")) : Task.CompletedTask);

        var results = await PushFanOut.SendAsync(push, items, "t", "b", null, Fast, CancellationToken.None);

        Assert.Equal("failed", results[2].Status);
        Assert.Equal("boom", results[2].ErrorMessage);
        Assert.Equal(4, results.Count(r => r.Status == "sent"));
    }

    [Fact]
    public async Task SynchronouslyThrowingSend_IsIsolatedToo()
    {
        var items = Items(3);
        var bad = items[0].Device.Id;
        var push = new FakePush((d, _) => d.Id == bad ? throw new InvalidOperationException("sync") : Task.CompletedTask);

        var results = await PushFanOut.SendAsync(push, items, "t", "b", null, Fast, CancellationToken.None);

        Assert.Equal("failed", results[0].Status);
        Assert.Equal(2, results.Count(r => r.Status == "sent"));
    }

    [Fact]
    public async Task GoneSubscription_IsReportedAsExpired()
    {
        var items = Items(2);
        var gone = items[0].Device;
        var push = new FakePush((d, _) => d.Id == gone.Id
            ? Task.FromException(new WebPushException("gone", new PushSubscription(d.Endpoint, "p", "a"), new HttpResponseMessage(HttpStatusCode.Gone)))
            : Task.CompletedTask);

        var results = await PushFanOut.SendAsync(push, items, "t", "b", null, Fast, CancellationToken.None);

        Assert.Equal("expired", results[0].Status);
        Assert.Equal("sent", results[1].Status);
    }

    [Fact]
    public async Task Parallelism_NeverExceedsTheLimit_AndIsActuallyUsed()
    {
        var items = Items(20);
        int current = 0, peak = 0;
        var push = new FakePush(async (_, ct) =>
        {
            var now = Interlocked.Increment(ref current);
            int seen;
            while ((seen = Volatile.Read(ref peak)) < now && Interlocked.CompareExchange(ref peak, now, seen) != seen) { }
            await Task.Delay(50, ct);
            Interlocked.Decrement(ref current);
        });

        var results = await PushFanOut.SendAsync(push, items, "t", "b", null, new PushFanOutOptions(TimeSpan.FromSeconds(10), 3), CancellationToken.None);

        Assert.All(results, r => Assert.Equal("sent", r.Status));
        Assert.InRange(peak, 2, 3);
    }

    [Fact]
    public async Task OuterCancellation_PropagatesInsteadOfBeingLoggedAsDeviceFailure()
    {
        var items = Items(2);
        using var cts = new CancellationTokenSource();
        var push = new FakePush(async (_, ct) => { cts.Cancel(); await Task.Delay(Timeout.Infinite, ct); });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            PushFanOut.SendAsync(push, items, "t", "b", null, new PushFanOutOptions(TimeSpan.FromSeconds(10), 8), cts.Token));
    }

    // ── Dispatcher: claim-raden finns i databasen FÖRE utskicket (E3#4) ──

    [Fact]
    public async Task Dispatcher_ClaimRowIsCommittedBeforeFirstSend()
    {
        using var db = TestDb.Create();
        var device = PushControllerTests.SeedDevice(db);
        var source = new Source { Name = "Krisinformation", ShortName = "Krisinformation", BaseUrl = "https://example.com", IsPublished = true };
        db.Sources.Add(source);
        db.SaveChanges();
        db.UserSourcePreferences.Add(new UserSourcePreference { UserId = device.UserId, SourceId = source.Id, IsActive = true });
        db.SaveChanges();

        using var other = TestDb.CreateSecondContext(db); // ser bara vad som är COMMITTAT
        bool? existedDuringSend = null;
        Guid? claimIdSeen = null;
        var spy = new SpyPush(async (claimId) =>
        {
            claimIdSeen = claimId;
            existedDuringSend = await other.PushDispatchClaims.AnyAsync(c => c.Id == claimId && c.ClaimedAt == null);
        });

        await PushDispatcher.DispatchNewEventsAsync(db, spy, "https://test.local", source.Id, 1, []);

        Assert.NotNull(claimIdSeen);
        Assert.True(existedDuringSend);
    }

    [Fact]
    public async Task Dispatcher_WithSlowAndFailingDevices_StillLogsEveryDevice()
    {
        using var db = TestDb.Create();
        var user = new User { Name = "Ada", Email = "a@example.com", PasswordHash = "x", PushNyaHandelser = true };
        var source = new Source { Name = "Krisinformation", ShortName = "Krisinformation", BaseUrl = "https://example.com", IsPublished = true };
        db.Users.Add(user); db.Sources.Add(source); db.SaveChanges();
        db.UserSourcePreferences.Add(new UserSourcePreference { UserId = user.Id, SourceId = source.Id, IsActive = true });
        var devices = Enumerable.Range(0, 3).Select(i => new UserDevice { UserId = user.Id, Endpoint = $"https://push.example/{i}", P256dh = "p", Auth = "a" }).ToList();
        db.UserDevices.AddRange(devices);
        db.SaveChanges();
        var failing = devices[1].Id;
        var push = new FakePush((d, _) => d.Id == failing ? Task.FromException(new InvalidOperationException("boom")) : Task.CompletedTask);

        await PushDispatcher.DispatchNewEventsAsync(db, push, "https://test.local", source.Id, 1, []);

        var logs = await db.NotificationDeliveryLogs.ToListAsync();
        Assert.Equal(3, logs.Count);
        Assert.Equal(2, logs.Count(l => l.Status == "sent"));
        Assert.Equal(1, logs.Count(l => l.Status == "failed"));
        Assert.Single(db.PushDispatchClaims); // ETT claim för användaren, delat av alla tre enheterna
    }

    private sealed class SpyPush(Func<Guid, Task> onSend) : IPushNotificationService
    {
        public async Task SendAsync(UserDevice device, string title, string body, string? url, Guid? claimId = null, CancellationToken ct = default)
            => await onSend(claimId!.Value);
    }
}
