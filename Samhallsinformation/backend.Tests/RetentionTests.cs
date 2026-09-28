namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Samhallsinformation.Application.Monitoring;
using Samhallsinformation.Application.Retention;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

/// <summary>
/// V4-1a (E2#6): retention för IngestorRunLogs (30 dagar) och PushDispatchClaims (14 dagar). Riktig SQLite
/// (ExecuteDeleteAsync + tidsjämförelser). EventShareLogs/NotificationDeliveryLogs får aldrig röras, och
/// övervakningens source_failing-regel ska inte påverkas.
/// </summary>
public class RetentionTests
{
    private static readonly DateTime Nu = new(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc);
    private static readonly TimeSpan NoPause = TimeSpan.Zero;

    private sealed class FixedTime(DateTime utc) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(utc, TimeSpan.Zero);
    }

    private static IngestorRunLog Run(int sourceId, DateTime at, bool success = true) =>
        new() { SourceId = sourceId, RunAt = at, Success = success };

    private static PushDispatchClaim Claim(DateTime at) => new() { UserId = Guid.NewGuid(), CreatedAt = at };

    private static RetentionService NewService(AppDbContext db, ILogger<RetentionService>? logger = null)
    {
        var services = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        return new RetentionService(
            services.GetRequiredService<IServiceScopeFactory>(),
            logger ?? new CapturingLogger<RetentionService>(),
            new FixedTime(Nu));
    }

    // ---- IngestorRunLogs ------------------------------------------------------------------------------------

    [Fact]
    public async Task Purge_IngestorRunLogs_RaderarÄldreÄn30Dagar_LämnarFärska()
    {
        using var db = TestDb.Create();
        db.IngestorRunLogs.AddRange(
            Run(1, Nu.AddDays(-31)), Run(1, Nu.AddDays(-30).AddMinutes(-1)),   // gamla
            Run(1, Nu.AddDays(-30).AddMinutes(1)), Run(1, Nu.AddDays(-1)), Run(1, Nu)); // färska
        await db.SaveChangesAsync();

        var res = await DataRetention.PurgeAsync(db, Nu, new CapturingLogger(), pauseBetweenBatches: NoPause);

        Assert.Equal(2, res.IngestorRunLogs);
        Assert.Equal(3, await db.IngestorRunLogs.CountAsync());
        Assert.All(await db.IngestorRunLogs.ToListAsync(), l => Assert.True(l.RunAt > Nu.AddDays(-30)));
    }

    [Fact]
    public async Task Purge_PushDispatchClaims_RaderarÄldreÄn14Dagar_LämnarFärska()
    {
        using var db = TestDb.Create();
        db.PushDispatchClaims.AddRange(
            Claim(Nu.AddDays(-20)), Claim(Nu.AddDays(-14).AddMinutes(-1)),
            Claim(Nu.AddDays(-14).AddMinutes(1)), Claim(Nu.AddDays(-2)));
        await db.SaveChangesAsync();

        var res = await DataRetention.PurgeAsync(db, Nu, new CapturingLogger(), pauseBetweenBatches: NoPause);

        Assert.Equal(2, res.PushDispatchClaims);
        Assert.Equal(2, await db.PushDispatchClaims.CountAsync());
    }

    [Fact]
    public async Task Purge_RörInteEventShareLogsEllerNotificationDeliveryLogs()
    {
        using var db = TestDb.Create();
        var user = new User { Name = "u", Email = "u@x.se", PasswordHash = "x" };
        db.Users.Add(user);
        db.EventShareLogs.AddRange(
            new EventShareLog { EventId = Guid.NewGuid(), SharedAt = Nu.AddDays(-400) },
            new EventShareLog { EventId = Guid.NewGuid(), SharedAt = Nu.AddDays(-1) });
        db.NotificationDeliveryLogs.AddRange(
            new NotificationDeliveryLog { UserId = user.Id, SentAt = Nu.AddDays(-400), Channel = "push" },
            new NotificationDeliveryLog { UserId = user.Id, SentAt = Nu.AddDays(-1), Channel = "push" });
        db.IngestorRunLogs.Add(Run(1, Nu.AddDays(-100)));
        await db.SaveChangesAsync();

        await DataRetention.PurgeAsync(db, Nu, new CapturingLogger(), pauseBetweenBatches: NoPause);

        Assert.Equal(2, await db.EventShareLogs.CountAsync());
        Assert.Equal(2, await db.NotificationDeliveryLogs.CountAsync());
        Assert.Equal(0, await db.IngestorRunLogs.CountAsync());
    }

    [Fact]
    public async Task Purge_Batchar_RaderarAllaÖverBatchgränsen()
    {
        using var db = TestDb.Create();
        for (var i = 0; i < 25; i++) db.IngestorRunLogs.Add(Run(1, Nu.AddDays(-40).AddMinutes(i)));
        for (var i = 0; i < 7; i++) db.IngestorRunLogs.Add(Run(1, Nu.AddDays(-1).AddMinutes(i)));
        for (var i = 0; i < 12; i++) db.PushDispatchClaims.Add(Claim(Nu.AddDays(-30).AddMinutes(i)));
        await db.SaveChangesAsync();

        var res = await DataRetention.PurgeAsync(db, Nu, new CapturingLogger(), batchSize: 10, pauseBetweenBatches: NoPause);

        Assert.Equal(25, res.IngestorRunLogs);   // 10 + 10 + 5
        Assert.Equal(12, res.PushDispatchClaims); // 10 + 2
        Assert.Equal(7, await db.IngestorRunLogs.CountAsync());
        Assert.Equal(0, await db.PushDispatchClaims.CountAsync());
    }

    [Fact]
    public async Task Purge_ExaktEnFullBatch_TerminerarOchRaderarAlla()
    {
        using var db = TestDb.Create();
        for (var i = 0; i < 20; i++) db.IngestorRunLogs.Add(Run(1, Nu.AddDays(-40).AddMinutes(i)));
        await db.SaveChangesAsync();

        var res = await DataRetention.PurgeAsync(db, Nu, new CapturingLogger(), batchSize: 10, pauseBetweenBatches: NoPause);

        Assert.Equal(20, res.IngestorRunLogs);
        Assert.Equal(0, await db.IngestorRunLogs.CountAsync());
    }

    [Fact]
    public async Task Purge_TomDatabas_GörInget()
    {
        using var db = TestDb.Create();

        var res = await DataRetention.PurgeAsync(db, Nu, new CapturingLogger(), pauseBetweenBatches: NoPause);

        Assert.Equal(default, res);
    }

    [Fact]
    public async Task Purge_FelIEnTabell_LoggasOchDenAndraStädasÄndå()
    {
        using var db = TestDb.Create();
        db.PushDispatchClaims.Add(Claim(Nu.AddDays(-30)));
        await db.SaveChangesAsync();
        await db.Database.ExecuteSqlRawAsync(@"DROP TABLE ""IngestorRunLogs""");
        var logger = new CapturingLogger();

        var res = await DataRetention.PurgeAsync(db, Nu, logger, pauseBetweenBatches: NoPause);

        Assert.Equal(1, res.PushDispatchClaims);
        Assert.Contains(logger.Entries, e => e.Level == LogLevel.Error && e.Message.Contains("IngestorRunLogs"));
    }

    // ---- tjänsten ---------------------------------------------------------------------------------------------

    [Fact]
    public async Task Service_RunOnce_StädarMedTjänstensKlocka()
    {
        using var db = TestDb.Create();
        db.IngestorRunLogs.AddRange(Run(1, Nu.AddDays(-45)), Run(1, Nu.AddDays(-2)));
        await db.SaveChangesAsync();

        var res = await NewService(db).RunOnceAsync(default, NoPause);

        Assert.Equal(1, res.IngestorRunLogs);
        Assert.Equal(1, await db.IngestorRunLogs.CountAsync());
    }

    [Fact]
    public async Task Service_RunOnce_FelKastarAldrig_LoggarError()
    {
        var factory = Substitute.For<IServiceScopeFactory>();
        factory.CreateScope().Returns(_ => throw new InvalidOperationException("databasen nere"));
        var logger = new CapturingLogger<RetentionService>();
        var service = new RetentionService(factory, logger, new FixedTime(Nu));

        var res = await service.RunOnceAsync(default, NoPause);

        Assert.Equal(default, res);
        Assert.Contains(logger.Entries, e => e.Level == LogLevel.Error && e.Exception is InvalidOperationException);
    }

    [Fact]
    public async Task Service_RunOnce_AvbrottPropageras()
    {
        using var db = TestDb.Create();
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => NewService(db).RunOnceAsync(cts.Token, NoPause));
    }

    // ---- övervakningen ---------------------------------------------------------------------------------------

    [Fact]
    public async Task SourceFailing_PåverkasInteAvRetention_SenasteKörningarnaFinnsKvar()
    {
        using var db = TestDb.Create();
        db.Sources.Add(new Source { Id = 1, Name = "K", ShortName = "K", BaseUrl = "https://k.se",
                                    IsActive = true, IsPublished = true });
        // Gammal historik (ska städas) + tre misslyckade cykler i rad inom fönstret.
        for (var i = 0; i < 50; i++) db.IngestorRunLogs.Add(Run(1, Nu.AddDays(-60).AddMinutes(i), success: true));
        db.IngestorRunLogs.AddRange(
            Run(1, Nu.AddMinutes(-15), false), Run(1, Nu.AddMinutes(-10), false), Run(1, Nu.AddMinutes(-5), false));
        await db.SaveChangesAsync();
        var rule = new SourceFailingRule(new MonitoringOptions { SourceFailStreak = 3, SourceStaleMinutes = 30 });

        var före = await rule.EvaluateAsync(db, Nu, default);
        await DataRetention.PurgeAsync(db, Nu, new CapturingLogger(), pauseBetweenBatches: NoPause);
        var efter = await rule.EvaluateAsync(db, Nu, default);

        Assert.Equal(3, await db.IngestorRunLogs.CountAsync()); // de 50 gamla är borta, de tre senaste finns kvar
        Assert.Single(före);
        var larm = Assert.Single(efter);
        Assert.Equal(SourceFailingRule.KeyFor(1), larm.Key);
        Assert.Equal(före[0].Detail, larm.Detail);
    }
}
