namespace Samhallsinformation.Tests;

using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Application.RateLimiting;
using Samhallsinformation.Application.Support;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

// V2-10 (E1#1): kontobaserad räknare på misslyckade inloggningar (LoginThrottle) och
// IPv6-/64-partition för rate limit-policyerna. IP-räknaren stoppar en angripare från EN adress;
// räknaren per e-post stoppar brute force mot ETT konto från många adresser.
public class LoginThrottleTests
{
    // Injicerbar klocka: fönstret löper ut utan att testet sover.
    private sealed class FakeClock : TimeProvider
    {
        private DateTimeOffset _now = new(2026, 9, 25, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan by) => _now += by;
    }

    private static readonly PasswordHasher<User> Hasher = new();
    private const string Email = "kalle@example.se";
    private const string Password = "R1ktigtLosen!";

    // ----- LoginThrottle (ren klass) -----

    [Fact]
    public void TryAcquire_UpToMaxAttempts_AreAllowed_ThenNextIsBlocked()
    {
        var throttle = new LoginThrottle(new FakeClock());

        for (var i = 0; i < LoginThrottle.MaxAttempts; i++)
            Assert.Null(throttle.TryAcquire(Email));

        var retryAfter = throttle.TryAcquire(Email); // det 11:e
        Assert.NotNull(retryAfter);
        Assert.True(retryAfter > TimeSpan.Zero);
        Assert.True(retryAfter <= LoginThrottle.Window);
    }

    [Fact]
    public void Reset_AfterSuccessfulLogin_ClearsTheCounter()
    {
        var throttle = new LoginThrottle(new FakeClock());
        for (var i = 0; i < LoginThrottle.MaxAttempts; i++) throttle.TryAcquire(Email);
        Assert.NotNull(throttle.TryAcquire(Email));

        throttle.Reset(Email);

        for (var i = 0; i < LoginThrottle.MaxAttempts; i++)
            Assert.Null(throttle.TryAcquire(Email));
    }

    [Fact]
    public void TryAcquire_DifferentAddresses_HaveIndependentCounters()
    {
        var throttle = new LoginThrottle(new FakeClock());
        for (var i = 0; i < LoginThrottle.MaxAttempts; i++) throttle.TryAcquire("a@example.se");

        Assert.NotNull(throttle.TryAcquire("a@example.se"));
        Assert.Null(throttle.TryAcquire("b@example.se"));
    }

    [Fact]
    public async Task LoginAsync_CaseAndWhitespaceVariantsOfSameAddress_ShareOneCounter()
    {
        using var db = TestDb.Create();
        var service = NewService(db, new LoginThrottle(new FakeClock()));

        // Tio felaktiga försök, blandat skiftläge/blanksteg — alla räknas mot samma normaliserade adress.
        for (var i = 0; i < LoginThrottle.MaxAttempts; i++)
        {
            var variant = i % 2 == 0 ? "KALLE@Example.se" : "  kalle@example.se ";
            Assert.Equal(401, (await service.LoginAsync(variant, "fel")).StatusCode);
        }

        var result = await service.LoginAsync("kalle@EXAMPLE.se", "fel");
        Assert.Equal(429, result.StatusCode);
    }

    [Fact]
    public void TryAcquire_WindowExpires_AllowsAttemptsAgain()
    {
        var clock = new FakeClock();
        var throttle = new LoginThrottle(clock);
        for (var i = 0; i < LoginThrottle.MaxAttempts; i++) throttle.TryAcquire(Email);
        Assert.NotNull(throttle.TryAcquire(Email));

        clock.Advance(LoginThrottle.Window + TimeSpan.FromSeconds(1));

        Assert.Null(throttle.TryAcquire(Email));
    }

    [Fact]
    public void TryAcquire_RetryAfter_ShrinksAsTimePasses_AndRejectedAttemptsDoNotExtendTheLock()
    {
        var clock = new FakeClock();
        var throttle = new LoginThrottle(clock);
        for (var i = 0; i < LoginThrottle.MaxAttempts; i++) throttle.TryAcquire(Email);

        var first = throttle.TryAcquire(Email)!.Value;
        clock.Advance(TimeSpan.FromMinutes(5));
        // Avvisade försök under tiden bokförs inte — låset förlängs alltså inte av hamrande.
        for (var i = 0; i < 20; i++) throttle.TryAcquire(Email);
        var later = throttle.TryAcquire(Email)!.Value;

        Assert.Equal(TimeSpan.FromMinutes(5), first - later);
    }

    [Fact]
    public void TryAcquire_SlidingWindow_OnlyRecentAttemptsCount()
    {
        var clock = new FakeClock();
        var throttle = new LoginThrottle(clock);

        // 9 försök tidigt, sedan väntan så de förfaller; därefter ska ett helt nytt tak gälla.
        for (var i = 0; i < LoginThrottle.MaxAttempts - 1; i++) throttle.TryAcquire(Email);
        clock.Advance(LoginThrottle.Window);
        for (var i = 0; i < LoginThrottle.MaxAttempts; i++)
            Assert.Null(throttle.TryAcquire(Email));
        Assert.NotNull(throttle.TryAcquire(Email));
    }

    [Fact]
    public void ExpiredEntries_AreSweptSoMemoryDoesNotGrow()
    {
        var clock = new FakeClock();
        var throttle = new LoginThrottle(clock);
        for (var i = 0; i < 500; i++) throttle.TryAcquire($"user{i}@example.se");
        Assert.Equal(500, throttle.TrackedKeyCount);

        clock.Advance(LoginThrottle.Window + TimeSpan.FromMinutes(2));
        throttle.TryAcquire("ny@example.se"); // varje anrop kan trigga den periodiska städningen

        Assert.Equal(1, throttle.TrackedKeyCount);
    }

    // ----- Genom AuthService / AuthController -----

    [Fact]
    public async Task LoginAsync_UnknownAndKnownAddress_GiveIdenticalThrottleResponse()
    {
        using var db = TestDb.Create();
        db.Users.Add(LocalUser(Email, Password));
        await db.SaveChangesAsync();
        var service = NewService(db, new LoginThrottle(new FakeClock()));

        for (var i = 0; i < LoginThrottle.MaxAttempts; i++)
        {
            await service.LoginAsync(Email, "fel");
            await service.LoginAsync("finns.inte@example.se", "fel");
        }

        var known = await service.LoginAsync(Email, "fel");
        var unknown = await service.LoginAsync("finns.inte@example.se", "fel");

        Assert.Equal(429, known.StatusCode);
        Assert.Equal(429, unknown.StatusCode);
        Assert.Equal(known.Error, unknown.Error);
    }

    [Fact]
    public async Task LoginAsync_WhileThrottled_EvenCorrectPasswordIsRejected_AndLockExpires()
    {
        using var db = TestDb.Create();
        db.Users.Add(LocalUser(Email, Password));
        await db.SaveChangesAsync();
        var clock = new FakeClock();
        var service = NewService(db, new LoginThrottle(clock));

        for (var i = 0; i < LoginThrottle.MaxAttempts; i++)
            await service.LoginAsync(Email, "fel");

        Assert.Equal(429, (await service.LoginAsync(Email, Password)).StatusCode);

        clock.Advance(LoginThrottle.Window + TimeSpan.FromSeconds(1));
        Assert.True((await service.LoginAsync(Email, Password)).Success); // aldrig permanent
    }

    [Fact]
    public async Task LoginAsync_SuccessfulLogin_ResetsCounter()
    {
        using var db = TestDb.Create();
        db.Users.Add(LocalUser(Email, Password));
        await db.SaveChangesAsync();
        var service = NewService(db, new LoginThrottle(new FakeClock()));

        for (var i = 0; i < LoginThrottle.MaxAttempts - 1; i++)
            await service.LoginAsync(Email, "fel");
        Assert.True((await service.LoginAsync(Email, Password)).Success); // 10:e försöket, rätt

        // Räknaren är nollställd: nio nya misslyckanden ger fortfarande 401, inte 429.
        for (var i = 0; i < LoginThrottle.MaxAttempts - 1; i++)
            Assert.Equal(401, (await service.LoginAsync(Email, "fel")).StatusCode);
    }

    [Fact]
    public async Task Login_Throttled_Returns429WithRetryAfterHeaderAndUnchangedErrorShape()
    {
        using var db = TestDb.Create();
        var service = NewService(db, new LoginThrottle(new FakeClock()));
        var controller = NewController(service);

        for (var i = 0; i < LoginThrottle.MaxAttempts; i++)
            await controller.Login(new LoginRequest(Email, "fel"));
        var response = await controller.Login(new LoginRequest(Email, "fel"));

        var obj = Assert.IsType<ObjectResult>(response);
        Assert.Equal(429, obj.StatusCode);
        Assert.Equal("För många misslyckade inloggningsförsök. Försök igen om en liten stund.",
            obj.Value!.GetType().GetProperty("error")!.GetValue(obj.Value));
        var retryAfter = int.Parse(controller.Response.Headers.RetryAfter.ToString());
        Assert.InRange(retryAfter, 1, (int)LoginThrottle.Window.TotalSeconds);
    }

    // ----- ClientIpPartition (IPv6 /64) -----

    [Fact]
    public void ClientIpPartition_TwoAddressesInSame64_GiveSameKey()
    {
        var a = ClientIpPartition.KeyFor(IPAddress.Parse("2001:db8:aaaa:bbbb::1"));
        var b = ClientIpPartition.KeyFor(IPAddress.Parse("2001:db8:aaaa:bbbb:1234:5678:9abc:def0"));
        Assert.Equal(a, b);
    }

    [Fact]
    public void ClientIpPartition_Different64Prefixes_GiveDifferentKeys()
    {
        var a = ClientIpPartition.KeyFor(IPAddress.Parse("2001:db8:aaaa:bbbb::1"));
        var b = ClientIpPartition.KeyFor(IPAddress.Parse("2001:db8:aaaa:bbbc::1"));
        Assert.NotEqual(a, b);
    }

    [Fact]
    public void ClientIpPartition_IPv4_IsUnchanged()
    {
        Assert.Equal("203.0.113.5", ClientIpPartition.KeyFor(IPAddress.Parse("203.0.113.5")));
        Assert.NotEqual(
            ClientIpPartition.KeyFor(IPAddress.Parse("203.0.113.5")),
            ClientIpPartition.KeyFor(IPAddress.Parse("203.0.113.6")));
    }

    [Fact]
    public void ClientIpPartition_IPv4MappedIPv6_MapsToTheIPv4Key()
    {
        Assert.Equal("203.0.113.5", ClientIpPartition.KeyFor(IPAddress.Parse("::ffff:203.0.113.5")));
    }

    [Fact]
    public void ClientIpPartition_NullAddress_IsUnknown()
    {
        Assert.Equal("unknown", ClientIpPartition.KeyFor(null));
    }

    [Fact]
    public void SupportTicketPartition_AnonymousIPv6InSame64_SharesOneCounter()
    {
        static HttpContext FromIp(string ip)
        {
            var ctx = new DefaultHttpContext();
            ctx.Connection.RemoteIpAddress = IPAddress.Parse(ip);
            return ctx;
        }

        var a = SupportTicketRateLimit.GetPartition(FromIp("2001:db8:1:2::1")).PartitionKey;
        var b = SupportTicketRateLimit.GetPartition(FromIp("2001:db8:1:2:ffff:ffff:ffff:ffff")).PartitionKey;
        var c = SupportTicketRateLimit.GetPartition(FromIp("2001:db8:1:3::1")).PartitionKey;

        Assert.Equal(a, b);
        Assert.NotEqual(a, c);
    }

    // ----- hjälpare -----

    private static User LocalUser(string email, string password)
    {
        var user = new User { Name = "Kalle", Email = email, AuthProvider = "local", EmailVerified = true };
        user.PasswordHash = Hasher.HashPassword(user, password);
        return user;
    }

    private static AuthService NewService(AppDbContext db, LoginThrottle throttle)
    {
        var tokens = Substitute.For<ITokenService>();
        tokens.HashToken(Arg.Any<string>()).Returns(ci => "hash:" + ci.Arg<string>());
        tokens.GenerateAccessToken(Arg.Any<User>()).Returns("access-token");
        tokens.GenerateRefreshToken().Returns(_ => ("raw-" + Guid.NewGuid().ToString("N"), "hash-" + Guid.NewGuid().ToString("N")));

        var config = Substitute.For<IConfiguration>();
        config["FRONTEND_URL"].Returns("https://test.local");

        return new AuthService(db, tokens, Hasher, Substitute.For<IEmailService>(),
            Substitute.For<IGoogleTokenValidator>(), Substitute.For<IPushNotificationService>(),
            Substitute.For<IAktivitetsloggService>(), throttle, config);
    }

    private static AuthController NewController(IAuthService auth)
    {
        var config = Substitute.For<IConfiguration>();
        return new AuthController(auth, Substitute.For<ITokenService>(), null!,
            Substitute.For<IPasswordHasher<User>>(), Substitute.For<IEmailService>(), config)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
    }
}
