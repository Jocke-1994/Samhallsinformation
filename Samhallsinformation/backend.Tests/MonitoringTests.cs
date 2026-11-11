namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Samhallsinformation.Application.Monitoring;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

// V1-9: övervakning och larm. Reglerna testas var för sig (utlöser vid tröskel / inte under), och
// AdminAlertCycle testas för dedupe, återöppning, mejl (fejkad IEmailService) och felhantering.
// Riktig SQLite (TestDb) eftersom unikt index på AdminAlert.Key är en del av dedupe-garantin.
public class MonitoringTests
{
    private static readonly DateTime Nu = new(2026, 9, 25, 12, 0, 0, DateTimeKind.Utc);

    private static MonitoringOptions Opt(int users = 3, int streak = 3, int staleMin = 30) =>
        new() { UsersThreshold = users, SourceFailStreak = streak, SourceStaleMinutes = staleMin };

    private static User NyUser(string email, string role = "Användare", bool active = true, DateTime? deletedAt = null) =>
        new() { Name = email, Email = email, PasswordHash = "x", Role = role, IsActive = active, DeletedAt = deletedAt };

    private static Source NySource(int id, string name = "Testkälla", bool active = true, bool published = true, DateTime? fetched = null) =>
        new() { Id = id, Name = name, ShortName = name, BaseUrl = "https://example.se", IsActive = active, IsPublished = published, LastFetchedAt = fetched };

    private static IngestorRunLog Run(int sourceId, DateTime at, bool success, string? error = null) =>
        new() { SourceId = sourceId, RunAt = at, Success = success, ErrorMessage = error };

    private static AdminAlertCycle NewCycle(
        AppDbContext db, IEmailService email, params IMonitoringRule[] rules) =>
        new(db, rules, email, new ConfigurationBuilder().Build(), NullLogger<AdminAlertCycle>.Instance);

    private static async Task<User> LäggTillAdmin(AppDbContext db, string email = "admin@example.se")
    {
        var admin = NyUser(email, "Admin");
        db.Users.Add(admin);
        await db.SaveChangesAsync();
        return admin;
    }

    private sealed class ThrowingRule : IMonitoringRule
    {
        public string RuleId => "throwing";
        public bool OneShot => false;
        public Task<IReadOnlyList<AlertCandidate>> EvaluateAsync(AppDbContext db, DateTime nowUtc, CancellationToken ct) =>
            throw new InvalidOperationException("regeln är trasig");
    }

    private sealed class StaticRule : IMonitoringRule
    {
        private readonly Func<IReadOnlyList<AlertCandidate>> _get;
        public StaticRule(string ruleId, Func<IReadOnlyList<AlertCandidate>> get, bool oneShot = false)
        { RuleId = ruleId; _get = get; OneShot = oneShot; }
        public string RuleId { get; }
        public bool OneShot { get; }
        public Task<IReadOnlyList<AlertCandidate>> EvaluateAsync(AppDbContext db, DateTime nowUtc, CancellationToken ct) =>
            Task.FromResult(_get());
    }

    // ── users_threshold ───────────────────────────────────────────────────────

    [Fact]
    public async Task UsersThreshold_AtThreshold_Raises()
    {
        using var db = TestDb.Create();
        db.Users.AddRange(NyUser("a@x.se"), NyUser("b@x.se"), NyUser("c@x.se"));
        await db.SaveChangesAsync();

        var res = await new UsersThresholdRule(Opt(users: 3)).EvaluateAsync(db, Nu, default);

        var c = Assert.Single(res);
        Assert.Equal("users_threshold", c.Key);
        Assert.Contains("alt C", c.Detail);
        Assert.Contains("Beslut - Alt C refresh-token i cookie", c.Detail);
    }

    [Fact]
    public async Task UsersThreshold_BelowThreshold_DoesNotRaise()
    {
        using var db = TestDb.Create();
        db.Users.AddRange(NyUser("a@x.se"), NyUser("b@x.se"));
        await db.SaveChangesAsync();

        Assert.Empty(await new UsersThresholdRule(Opt(users: 3)).EvaluateAsync(db, Nu, default));
    }

    [Fact]
    public async Task UsersThreshold_DeletedUsersAreNotCounted()
    {
        using var db = TestDb.Create();
        db.Users.AddRange(NyUser("a@x.se"), NyUser("b@x.se"), NyUser("c@x.se", deletedAt: Nu.AddDays(-1)));
        await db.SaveChangesAsync();

        Assert.Empty(await new UsersThresholdRule(Opt(users: 3)).EvaluateAsync(db, Nu, default));
    }

    [Fact]
    public void MonitoringOptions_DefaultsTo500_AndReadsEnv()
    {
        Assert.Equal(500, MonitoringOptions.FromConfiguration(new ConfigurationBuilder().Build()).UsersThreshold);

        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["MONITORING_USERS_THRESHOLD"] = "750",
            ["MONITORING_SOURCE_FAIL_STREAK"] = "abc",
        }).Build();
        var o = MonitoringOptions.FromConfiguration(cfg);
        Assert.Equal(750, o.UsersThreshold);
        Assert.Equal(3, o.SourceFailStreak); // ogiltigt värde -> default
    }

    [Fact]
    public async Task UsersThreshold_AlertsOnlyOnce_EvenAfterManyCycles_AndNeverAfterAcknowledge()
    {
        using var db = TestDb.Create();
        await LäggTillAdmin(db);
        db.Users.AddRange(NyUser("a@x.se"), NyUser("b@x.se")); // 3 st totalt inkl. admin
        await db.SaveChangesAsync();
        var email = Substitute.For<IEmailService>();
        var rule = new UsersThresholdRule(Opt(users: 3));
        var cycle = NewCycle(db, email, rule);

        for (var i = 0; i < 4; i++) await cycle.RunAsync(Nu.AddMinutes(5 * i));

        var alert = await db.AdminAlerts.SingleAsync();
        Assert.Equal(1, alert.OccurrenceCount);
        Assert.Null(alert.ResolvedAt);
        await email.Received(1).SendAdminAlertsAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<IReadOnlyList<AdminAlertMailItem>>(), Arg.Any<string>());

        // Användare försvinner under tröskeln: larmet löses INTE av sig självt (milstolpe).
        db.Users.RemoveRange(db.Users.Where(u => u.Role != "Admin"));
        await db.SaveChangesAsync();
        await cycle.RunAsync(Nu.AddMinutes(30));
        Assert.Null((await db.AdminAlerts.SingleAsync()).ResolvedAt);

        // Kvittering stänger det; tröskeln nås igen men inget nytt larm/mejl.
        var ackade = await db.AdminAlerts.SingleAsync();
        ackade.AcknowledgedAt = Nu; ackade.ResolvedAt = Nu; // vad AdminAlertsController.Acknowledge gör för OneShot
        db.Users.AddRange(NyUser("d@x.se"), NyUser("e@x.se"));
        await db.SaveChangesAsync();
        await cycle.RunAsync(Nu.AddMinutes(35));

        Assert.Equal(1, await db.AdminAlerts.CountAsync());
        Assert.NotNull((await db.AdminAlerts.SingleAsync()).ResolvedAt);
        await email.Received(1).SendAdminAlertsAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<IReadOnlyList<AdminAlertMailItem>>(), Arg.Any<string>());
    }

    // ── source_failing ────────────────────────────────────────────────────────

    [Fact]
    public async Task SourceFailing_ThreeFailuresInARow_Raises()
    {
        using var db = TestDb.Create();
        db.Sources.Add(NySource(1, "Polisen", fetched: Nu.AddMinutes(-1)));
        db.IngestorRunLogs.AddRange(
            Run(1, Nu.AddMinutes(-15), false, "timeout"), Run(1, Nu.AddMinutes(-10), false, "timeout"), Run(1, Nu.AddMinutes(-5), false, "HTML istället för RSS"));
        await db.SaveChangesAsync();

        var res = await new SourceFailingRule(Opt()).EvaluateAsync(db, Nu, default);

        var c = Assert.Single(res);
        Assert.Equal("source_failing:1", c.Key);
        Assert.Contains("Polisen", c.Title);
        Assert.Contains("3 misslyckade", c.Detail);
        Assert.Contains("HTML istället för RSS", c.Detail); // det SENASTE felet
    }

    [Fact]
    public async Task SourceFailing_TwoFailuresOnly_DoesNotRaise()
    {
        using var db = TestDb.Create();
        db.Sources.Add(NySource(1, fetched: Nu.AddMinutes(-1)));
        db.IngestorRunLogs.AddRange(Run(1, Nu.AddMinutes(-10), false, "x"), Run(1, Nu.AddMinutes(-5), false, "x"));
        await db.SaveChangesAsync();

        Assert.Empty(await new SourceFailingRule(Opt()).EvaluateAsync(db, Nu, default));
    }

    [Fact]
    public async Task SourceFailing_SuccessBreaksTheStreak()
    {
        using var db = TestDb.Create();
        db.Sources.Add(NySource(1, fetched: Nu.AddMinutes(-1)));
        db.IngestorRunLogs.AddRange(
            Run(1, Nu.AddMinutes(-20), false, "x"), Run(1, Nu.AddMinutes(-15), false, "x"),
            Run(1, Nu.AddMinutes(-10), true), Run(1, Nu.AddMinutes(-5), false, "x"));
        await db.SaveChangesAsync();

        Assert.Empty(await new SourceFailingRule(Opt()).EvaluateAsync(db, Nu, default));
    }

    [Fact]
    public async Task SourceFailing_NotFetchedForTooLong_Raises_AndFreshDoesNot()
    {
        using var db = TestDb.Create();
        db.Sources.AddRange(
            NySource(1, "Gammal", fetched: Nu.AddMinutes(-31)),
            NySource(2, "Färsk", fetched: Nu.AddMinutes(-29)),
            NySource(3, "Aldrig hämtad", fetched: null));
        await db.SaveChangesAsync();

        var res = await new SourceFailingRule(Opt(staleMin: 30)).EvaluateAsync(db, Nu, default);

        var c = Assert.Single(res);
        Assert.Equal("source_failing:1", c.Key);
        Assert.Contains("Inte hämtad", c.Detail);
    }

    [Fact]
    public async Task SourceFailing_IgnoresInactiveAndUnpublishedSources()
    {
        using var db = TestDb.Create();
        db.Sources.AddRange(
            NySource(1, "Pausad", active: false, fetched: Nu.AddHours(-5)),
            NySource(2, "Sandlåda", published: false, fetched: Nu.AddHours(-5)));
        await db.SaveChangesAsync();

        Assert.Empty(await new SourceFailingRule(Opt()).EvaluateAsync(db, Nu, default));
    }

    [Fact]
    public async Task SourceFailing_RaisesResolvesAndReopens_WithMailOnlyWhenRaised()
    {
        using var db = TestDb.Create();
        await LäggTillAdmin(db);
        db.Sources.Add(NySource(1, "Polisen", fetched: Nu.AddMinutes(-1)));
        db.IngestorRunLogs.AddRange(Run(1, Nu.AddMinutes(-15), false, "x"), Run(1, Nu.AddMinutes(-10), false, "x"), Run(1, Nu.AddMinutes(-5), false, "x"));
        await db.SaveChangesAsync();
        var email = Substitute.For<IEmailService>();
        var cycle = NewCycle(db, email, new SourceFailingRule(Opt()));

        await cycle.RunAsync(Nu);
        var alert = await db.AdminAlerts.SingleAsync();
        Assert.Null(alert.ResolvedAt);
        Assert.Equal(1, email.ReceivedCalls().Count(c => c.GetMethodInfo().Name == nameof(IEmailService.SendAdminAlertsAsync)));

        // Källan återhämtar sig -> larmet löses (inget mejl).
        db.IngestorRunLogs.Add(Run(1, Nu.AddMinutes(1), true));
        await db.SaveChangesAsync();
        await cycle.RunAsync(Nu.AddMinutes(2));
        db.ChangeTracker.Clear();
        alert = await db.AdminAlerts.SingleAsync();
        Assert.NotNull(alert.ResolvedAt);
        Assert.Equal(1, email.ReceivedCalls().Count(c => c.GetMethodInfo().Name == nameof(IEmailService.SendAdminAlertsAsync)));

        // Kvittera det lösta larmet, sedan faller källan igen: samma rad öppnas på nytt,
        // kvitteringen nollställs och ETT nytt mejl skickas.
        alert.AcknowledgedAt = Nu; alert.AcknowledgedBy = "Admin";
        db.IngestorRunLogs.AddRange(Run(1, Nu.AddMinutes(6), false, "y"), Run(1, Nu.AddMinutes(11), false, "y"), Run(1, Nu.AddMinutes(16), false, "y"));
        await db.SaveChangesAsync();
        await cycle.RunAsync(Nu.AddMinutes(17));
        db.ChangeTracker.Clear();

        var reopened = await db.AdminAlerts.SingleAsync();
        Assert.Null(reopened.ResolvedAt);
        Assert.Null(reopened.AcknowledgedAt);
        Assert.Null(reopened.AcknowledgedBy);
        Assert.Equal(1, reopened.OccurrenceCount);
        Assert.Equal(alert.Id, reopened.Id);
        Assert.Equal(2, email.ReceivedCalls().Count(c => c.GetMethodInfo().Name == nameof(IEmailService.SendAdminAlertsAsync)));
    }

    // ── push_failures ─────────────────────────────────────────────────────────

    private static async Task SeedPush(AppDbContext db, int sent, int failed, int expired = 0, DateTime? at = null)
    {
        var user = NyUser($"push-{Guid.NewGuid():N}@x.se");
        db.Users.Add(user);
        await db.SaveChangesAsync();
        void Add(string status) => db.NotificationDeliveryLogs.Add(new NotificationDeliveryLog
        { UserId = user.Id, Channel = "push", Recipient = "ep", Subject = "s", Body = "b", Status = status, SentAt = at ?? Nu.AddMinutes(-30) });
        for (var i = 0; i < sent; i++) Add("sent");
        for (var i = 0; i < failed; i++) Add("failed");
        for (var i = 0; i < expired; i++) Add("expired");
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task PushFailures_HighFailureShare_Raises()
    {
        using var db = TestDb.Create();
        await SeedPush(db, sent: 5, failed: 5);

        var c = Assert.Single(await new PushFailuresRule(Opt()).EvaluateAsync(db, Nu, default));
        Assert.Equal("push_failures", c.Key);
        Assert.Contains("5 av 10", c.Detail);
    }

    [Fact]
    public async Task PushFailures_LowFailureShare_DoesNotRaise()
    {
        using var db = TestDb.Create();
        await SeedPush(db, sent: 9, failed: 2); // 2/11

        Assert.Empty(await new PushFailuresRule(Opt()).EvaluateAsync(db, Nu, default));
    }

    [Fact]
    public async Task PushFailures_TooFewAttempts_DoesNotRaise()
    {
        using var db = TestDb.Create();
        await SeedPush(db, sent: 0, failed: 4); // 100 % men bara 4 försök

        Assert.Empty(await new PushFailuresRule(Opt()).EvaluateAsync(db, Nu, default));
    }

    [Fact]
    public async Task PushFailures_ExpiredSubscriptionsAndOldLogsAreNotCounted()
    {
        using var db = TestDb.Create();
        await SeedPush(db, sent: 10, failed: 0, expired: 30);          // expired = normal städning
        Assert.Empty(await new PushFailuresRule(Opt()).EvaluateAsync(db, Nu, default));

        await SeedPush(db, sent: 0, failed: 20, at: Nu.AddHours(-7));  // utanför 6h-fönstret
        Assert.Empty(await new PushFailuresRule(Opt()).EvaluateAsync(db, Nu, default));
    }

    // ── AdminAlertCycle: dedupe, mejl, felhantering ───────────────────────────

    [Fact]
    public async Task Cycle_SameAlertAcrossCycles_IsDeduplicated_AndMailedOnce()
    {
        using var db = TestDb.Create();
        await LäggTillAdmin(db);
        var email = Substitute.For<IEmailService>();
        var rule = new StaticRule("r", () => [new AlertCandidate("r:1", AlertSeverity.Critical, "Titel", "Detalj")]);
        var cycle = NewCycle(db, email, rule);

        await cycle.RunAsync(Nu);
        await cycle.RunAsync(Nu.AddMinutes(5));
        await cycle.RunAsync(Nu.AddMinutes(10));

        var alert = await db.AdminAlerts.SingleAsync();
        Assert.Equal(3, alert.OccurrenceCount);
        Assert.Equal(Nu, alert.FirstRaisedAt);
        Assert.Equal(Nu.AddMinutes(10), alert.LastSeenAt);
        Assert.NotNull(alert.NotifiedAt);
        await email.Received(1).SendAdminAlertsAsync("admin@example.se", Arg.Any<string>(),
            Arg.Is<IReadOnlyList<AdminAlertMailItem>>(l => l.Count == 1 && l[0].Title == "Titel"), Arg.Any<string>());
    }

    [Fact]
    public async Task Cycle_SeveralNewAlertsInOneCycle_GiveOneMailPerAdmin()
    {
        using var db = TestDb.Create();
        await LäggTillAdmin(db, "a@example.se");
        await LäggTillAdmin(db, "b@example.se");
        var email = Substitute.For<IEmailService>();
        var rule = new StaticRule("r", () =>
        [
            new AlertCandidate("r:1", AlertSeverity.Critical, "Ett", "d"),
            new AlertCandidate("r:2", AlertSeverity.Critical, "Två", "d"),
            new AlertCandidate("r:3", AlertSeverity.Critical, "Tre", "d"),
        ]);

        await NewCycle(db, email, rule).RunAsync(Nu);

        Assert.Equal(3, await db.AdminAlerts.CountAsync());
        await email.Received(1).SendAdminAlertsAsync("a@example.se", Arg.Any<string>(), Arg.Is<IReadOnlyList<AdminAlertMailItem>>(l => l.Count == 3), Arg.Any<string>());
        await email.Received(1).SendAdminAlertsAsync("b@example.se", Arg.Any<string>(), Arg.Is<IReadOnlyList<AdminAlertMailItem>>(l => l.Count == 3), Arg.Any<string>());
    }

    [Fact]
    public async Task Cycle_MailsOnlyActiveNonDeletedAdmins_WithNormalizedEmail()
    {
        using var db = TestDb.Create();
        db.Users.AddRange(
            NyUser("  Admin@Example.SE ", "Admin"),
            NyUser("admin@example.se", "Admin"),               // dubblett efter normalisering
            NyUser("spärrad@example.se", "Admin", active: false),
            NyUser("raderad@example.se", "Admin", deletedAt: Nu.AddDays(-1)),
            NyUser("support@example.se", "Support"),
            NyUser("vanlig@example.se"));
        await db.SaveChangesAsync();
        var email = Substitute.For<IEmailService>();
        var rule = new StaticRule("r", () => [new AlertCandidate("r:1", AlertSeverity.Warning, "T", "D")]);

        await NewCycle(db, email, rule).RunAsync(Nu);

        var mottagare = email.ReceivedCalls()
            .Where(c => c.GetMethodInfo().Name == nameof(IEmailService.SendAdminAlertsAsync))
            .Select(c => (string)c.GetArguments()[0]!).ToList();
        Assert.Equal(new[] { "admin@example.se" }, mottagare);
    }

    [Fact]
    public async Task Cycle_MailFailure_DoesNotThrow_AndIsRetriedUntilItSucceeds_ThenNeverAgain()
    {
        using var db = TestDb.Create();
        await LäggTillAdmin(db);
        var email = Substitute.For<IEmailService>();
        email.SendAdminAlertsAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<IReadOnlyList<AdminAlertMailItem>>(), Arg.Any<string>())
            .Throws(new Exception("Resend nere"));
        var rule = new StaticRule("r", () => [new AlertCandidate("r:1", AlertSeverity.Critical, "T", "D")]);
        var cycle = NewCycle(db, email, rule);

        await cycle.RunAsync(Nu); // får inte kasta

        Assert.Single(await db.AdminAlerts.ToListAsync());
        Assert.Null((await db.AdminAlerts.SingleAsync()).NotifiedAt);

        email.SendAdminAlertsAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<IReadOnlyList<AdminAlertMailItem>>(), Arg.Any<string>())
            .Returns(Task.CompletedTask);
        await cycle.RunAsync(Nu.AddMinutes(5));
        Assert.NotNull((await db.AdminAlerts.SingleAsync()).NotifiedAt);

        email.ClearReceivedCalls();
        await cycle.RunAsync(Nu.AddMinutes(10));
        await email.DidNotReceive().SendAdminAlertsAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<IReadOnlyList<AdminAlertMailItem>>(), Arg.Any<string>());
    }

    [Fact]
    public async Task Cycle_AcknowledgedBeforeMailSent_IsNotMailed()
    {
        using var db = TestDb.Create();
        await LäggTillAdmin(db);
        db.AdminAlerts.Add(new AdminAlert { RuleId = "r", Key = "r:1", Title = "T", Detail = "D", FirstRaisedAt = Nu, LastSeenAt = Nu, AcknowledgedAt = Nu, AcknowledgedBy = "X" });
        await db.SaveChangesAsync();
        var email = Substitute.For<IEmailService>();

        await NewCycle(db, email, new StaticRule("r", () => [new AlertCandidate("r:1", AlertSeverity.Warning, "T", "D")])).RunAsync(Nu);

        await email.DidNotReceive().SendAdminAlertsAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<IReadOnlyList<AdminAlertMailItem>>(), Arg.Any<string>());
    }

    [Fact]
    public async Task Cycle_ThrowingRule_DoesNotStopOtherRules_AndDoesNotResolveItsAlerts()
    {
        using var db = TestDb.Create();
        await LäggTillAdmin(db);
        db.AdminAlerts.Add(new AdminAlert { RuleId = "throwing", Key = "throwing:1", Title = "Gammalt", Detail = "D", FirstRaisedAt = Nu.AddHours(-1), LastSeenAt = Nu.AddHours(-1), NotifiedAt = Nu.AddHours(-1) });
        await db.SaveChangesAsync();
        var email = Substitute.For<IEmailService>();
        var ok = new StaticRule("ok", () => [new AlertCandidate("ok:1", AlertSeverity.Warning, "Funkar", "D")]);

        await NewCycle(db, email, new ThrowingRule(), ok).RunAsync(Nu);

        var alerts = await db.AdminAlerts.ToListAsync();
        Assert.Equal(2, alerts.Count);
        Assert.Null(alerts.Single(a => a.RuleId == "throwing").ResolvedAt); // fel i utvärderingen != problemet borta
        Assert.NotNull(alerts.Single(a => a.RuleId == "ok"));
    }

    // ── MonitoringService: tjänsten dör inte ──────────────────────────────────

    private sealed class FixedTime : TimeProvider
    {
        private readonly DateTimeOffset _now;
        public FixedTime(DateTime utc) => _now = new DateTimeOffset(utc, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => _now;
    }

    [Fact]
    public async Task MonitoringService_RunOnce_SwallowsAnExceptionFromTheCycle()
    {
        var services = new ServiceCollection();
        services.AddScoped<AdminAlertCycle>(_ => throw new InvalidOperationException("kan inte bygga cykeln"));
        using var provider = services.BuildServiceProvider();
        var service = new MonitoringService(provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<MonitoringService>.Instance, new FixedTime(Nu));

        await service.RunOnceAsync(CancellationToken.None); // ska inte kasta
    }

    [Fact]
    public async Task MonitoringService_RunOnce_RunsTheCycleWithTheProvidedClock()
    {
        using var db = TestDb.Create();
        await LäggTillAdmin(db);
        db.Sources.Add(NySource(1, "Gammal", fetched: Nu.AddHours(-3)));
        await db.SaveChangesAsync();
        var email = Substitute.For<IEmailService>();

        var services = new ServiceCollection();
        services.AddSingleton(db);
        services.AddSingleton(email);
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().Build());
        services.AddLogging();
        services.AddSingleton(Opt());
        services.AddScoped<IMonitoringRule, SourceFailingRule>();
        services.AddScoped<AdminAlertCycle>();
        using var provider = services.BuildServiceProvider();
        var service = new MonitoringService(provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<MonitoringService>.Instance, new FixedTime(Nu));

        await service.RunOnceAsync(CancellationToken.None);

        var alert = await db.AdminAlerts.SingleAsync();
        Assert.Equal("source_failing:1", alert.Key);
        Assert.Equal(Nu, alert.FirstRaisedAt);
    }
}
