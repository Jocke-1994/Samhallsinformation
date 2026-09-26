namespace Samhallsinformation.Tests;

using System.Data.Common;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Samhallsinformation.Application.Events;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

/// <summary>
/// V3-2 (E2#7 + E3#1): unikt index på Events(SourceId, ExternalId) och rensning av befintliga dubbletter FÖRE
/// indexet. Riktig SQLite (partiella index stöds), riktiga transaktioner. Ingen dataförlust får ske: äldsta raden
/// behålls, sparade händelser/delningsloggar flyttas, tomma ExternalId rörs aldrig.
/// </summary>
public class EventsUniqueIndexTests
{
    // ---- hjälpare ----------------------------------------------------------------------------------------

    /// <summary>Loggar alla kommandon och kan tvingas kasta för ett visst kommando (rollback-test).</summary>
    private sealed class CommandSpy : DbCommandInterceptor
    {
        public List<string> Commands { get; } = new();
        public Func<string, bool>? ThrowWhen { get; set; }

        private void Observe(DbCommand command)
        {
            Commands.Add(command.CommandText);
            if (ThrowWhen?.Invoke(command.CommandText) == true)
                throw new InvalidOperationException("Simulerat fel mitt i rensningen");
        }

        public override InterceptionResult<int> NonQueryExecuting(DbCommand c, CommandEventData e, InterceptionResult<int> r)
        { Observe(c); return r; }
        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand c, CommandEventData e, InterceptionResult<int> r, CancellationToken ct = default)
        { Observe(c); return ValueTask.FromResult(r); }
        public override InterceptionResult<DbDataReader> ReaderExecuting(DbCommand c, CommandEventData e, InterceptionResult<DbDataReader> r)
        { Observe(c); return r; }
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand c, CommandEventData e, InterceptionResult<DbDataReader> r, CancellationToken ct = default)
        { Observe(c); return ValueTask.FromResult(r); }
    }

    private sealed class ListLogger : ILogger
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => Entries.Add((logLevel, formatter(state, exception)));
    }

    /// <summary>Databas med "produktionsformen före V3-2": schemat finns men det unika indexet gör det inte.</summary>
    private static AppDbContext LegacyDb(CommandSpy? spy = null)
    {
        var builder = new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:");
        if (spy != null) builder.AddInterceptors(spy);
        var db = new AppDbContext(builder.Options);
        db.Database.OpenConnection();
        db.Database.EnsureCreated();
        TestDb.DropEventsUniqueIndex(db);
        return db;
    }

    private static CanonicalEvent Ev(int sourceId, string externalId, DateTime? ingestedAt = null, Guid? id = null, string title = "Titel")
    {
        var e = new CanonicalEvent
        {
            SourceId = sourceId, ExternalId = externalId, Title = title, PublishedAt = DateTime.UtcNow,
            IngestedAt = ingestedAt ?? DateTime.UtcNow,
        };
        if (id != null) e.Id = id.Value;
        return e;
    }

    private static User NewUser(string email) => new() { Email = email, Name = email, PasswordHash = "x" };

    private static async Task<List<Guid>> EventIdsAsync(AppDbContext db) =>
        await db.Events.OrderBy(e => e.Id).Select(e => e.Id).ToListAsync();

    private static readonly DateTime T0 = new(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc);

    // ---- dedupe --------------------------------------------------------------------------------------------

    [Fact]
    public async Task Deduplicate_KeepsOldestRow_ByIngestedAt_AndDeletesSurplus()
    {
        using var db = LegacyDb();
        var newest = Ev(1, "dup", T0.AddHours(2), title: "Nyast");
        var oldest = Ev(1, "dup", T0, title: "Äldst");
        var middle = Ev(1, "dup", T0.AddHours(1), title: "Mitten");
        db.Events.AddRange(newest, oldest, middle);
        await db.SaveChangesAsync();

        var result = await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        var left = await db.Events.ToListAsync();
        Assert.Single(left);
        Assert.Equal(oldest.Id, left[0].Id);
        Assert.Equal("Äldst", left[0].Title);
        Assert.Equal(1, result.Groups);
        Assert.Equal(2, result.EventsRemoved);
    }

    [Fact]
    public async Task Deduplicate_SameIngestedAt_KeepsSmallestId()
    {
        using var db = LegacyDb();
        var low  = Ev(1, "dup", T0, Guid.Parse("00000000-0000-0000-0000-000000000001"));
        var high = Ev(1, "dup", T0, Guid.Parse("ffffffff-0000-0000-0000-000000000001"));
        db.Events.AddRange(high, low);
        await db.SaveChangesAsync();

        await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        Assert.Equal([low.Id], await EventIdsAsync(db));
    }

    [Fact]
    public async Task Deduplicate_MovesSavedEventsFromSurplusToKeptRow()
    {
        using var db = LegacyDb();
        var oldest = Ev(1, "dup", T0);
        var surplus = Ev(1, "dup", T0.AddHours(1));
        var user = NewUser("a@test.se");
        db.Events.AddRange(oldest, surplus);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        db.UserSavedEvents.Add(new UserSavedEvent { UserId = user.Id, EventId = surplus.Id });
        await db.SaveChangesAsync();

        var result = await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        var saved = await db.UserSavedEvents.ToListAsync();
        Assert.Single(saved);
        Assert.Equal(oldest.Id, saved[0].EventId);
        Assert.Equal(1, result.SavedEventsMoved);
    }

    [Fact]
    public async Task Deduplicate_UserWhoSavedBoth_EndsUpWithOneRow_NoUniqueConflict()
    {
        using var db = LegacyDb();
        var oldest = Ev(1, "dup", T0);
        var surplus = Ev(1, "dup", T0.AddHours(1));
        var both = NewUser("both@test.se");
        var onlySurplus = NewUser("surplus@test.se");
        db.Events.AddRange(oldest, surplus);
        db.Users.AddRange(both, onlySurplus);
        await db.SaveChangesAsync();
        db.UserSavedEvents.AddRange(
            new UserSavedEvent { UserId = both.Id, EventId = oldest.Id },
            new UserSavedEvent { UserId = both.Id, EventId = surplus.Id },
            new UserSavedEvent { UserId = onlySurplus.Id, EventId = surplus.Id });
        await db.SaveChangesAsync();

        var result = await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        var saved = await db.UserSavedEvents.ToListAsync();
        Assert.Equal(2, saved.Count);
        Assert.All(saved, s => Assert.Equal(oldest.Id, s.EventId));
        Assert.Equal(1, saved.Count(s => s.UserId == both.Id));
        Assert.Equal(1, saved.Count(s => s.UserId == onlySurplus.Id));
        Assert.Equal(1, result.SavedEventsMoved);
        Assert.Equal(1, result.SavedEventsDropped);
    }

    [Fact]
    public async Task Deduplicate_UserSavedTwoSurplusRows_OnlyOneSurvives()
    {
        using var db = LegacyDb();
        var oldest = Ev(1, "dup", T0);
        var s1 = Ev(1, "dup", T0.AddHours(1));
        var s2 = Ev(1, "dup", T0.AddHours(2));
        var user = NewUser("u@test.se");
        db.Events.AddRange(oldest, s1, s2);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        db.UserSavedEvents.AddRange(
            new UserSavedEvent { UserId = user.Id, EventId = s1.Id },
            new UserSavedEvent { UserId = user.Id, EventId = s2.Id });
        await db.SaveChangesAsync();

        await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        var saved = await db.UserSavedEvents.SingleAsync();
        Assert.Equal(oldest.Id, saved.EventId);
    }

    [Fact]
    public async Task Deduplicate_MovesShareLogsToKeptRow()
    {
        using var db = LegacyDb();
        var oldest = Ev(1, "dup", T0);
        var surplus = Ev(1, "dup", T0.AddHours(1));
        db.Events.AddRange(oldest, surplus);
        db.EventShareLogs.AddRange(
            new EventShareLog { EventId = oldest.Id },
            new EventShareLog { EventId = surplus.Id },
            new EventShareLog { EventId = surplus.Id });
        await db.SaveChangesAsync();

        var result = await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        var logs = await db.EventShareLogs.ToListAsync();
        Assert.Equal(3, logs.Count);
        Assert.All(logs, l => Assert.Equal(oldest.Id, l.EventId));
        Assert.Equal(2, result.ShareLogsMoved);
    }

    [Fact]
    public async Task Deduplicate_RepointsUndoReferenceInActivityLog()
    {
        using var db = LegacyDb();
        var oldest = Ev(1, "dup", T0);
        var surplus = Ev(1, "dup", T0.AddHours(1));
        var unrelated = Ev(1, "other", T0);
        db.Events.AddRange(oldest, surplus, unrelated);
        db.AdminActivityLogs.AddRange(
            new AdminActivityLog { Rubrik = "a", AngraEventId = surplus.Id.ToString().ToUpperInvariant() },
            new AdminActivityLog { Rubrik = "b", AngraEventId = unrelated.Id.ToString() },
            new AdminActivityLog { Rubrik = "c", AngraEventId = null });
        await db.SaveChangesAsync();

        await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        var logs = await db.AdminActivityLogs.OrderBy(l => l.Rubrik).ToListAsync();
        Assert.Equal(oldest.Id.ToString(), logs[0].AngraEventId);
        Assert.Equal(unrelated.Id.ToString(), logs[1].AngraEventId);
        Assert.Null(logs[2].AngraEventId);
    }

    [Fact]
    public async Task Deduplicate_HandlesMultipleGroups_AndLeavesUniqueRowsAlone()
    {
        using var db = LegacyDb();
        var a1 = Ev(1, "a", T0); var a2 = Ev(1, "a", T0.AddHours(1));
        var b1 = Ev(2, "b", T0); var b2 = Ev(2, "b", T0.AddHours(1)); var b3 = Ev(2, "b", T0.AddHours(2));
        var solo = Ev(1, "solo", T0);
        db.Events.AddRange(a2, b3, a1, solo, b2, b1);
        await db.SaveChangesAsync();

        var result = await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        Assert.Equal(2, result.Groups);
        Assert.Equal(3, result.EventsRemoved);
        var ids = (await EventIdsAsync(db)).ToHashSet();
        Assert.Equal(new HashSet<Guid> { a1.Id, b1.Id, solo.Id }, ids);
    }

    [Fact]
    public async Task Deduplicate_EmptyExternalId_IsNeverTouched_EvenWhenManyExist()
    {
        using var db = LegacyDb();
        db.Events.AddRange(Ev(1, ""), Ev(1, ""), Ev(1, ""), Ev(2, ""));
        db.Events.Add(Ev(1, "dup", T0)); db.Events.Add(Ev(1, "dup", T0.AddHours(1)));
        await db.SaveChangesAsync();

        var result = await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        Assert.Equal(4, await db.Events.CountAsync(e => e.ExternalId == ""));
        Assert.Equal(1, await db.Events.CountAsync(e => e.ExternalId == "dup"));
        Assert.Equal(1, result.EventsRemoved);
    }

    [Fact]
    public async Task Deduplicate_OnlyEmptyExternalIds_DoesNothing()
    {
        var spy = new CommandSpy();
        using var db = LegacyDb(spy);
        db.Events.AddRange(Ev(1, ""), Ev(1, ""), Ev(1, ""));
        await db.SaveChangesAsync();
        spy.Commands.Clear();

        var result = await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        Assert.Equal(EventDeduplicationResult.None, result);
        Assert.Equal(3, await db.Events.CountAsync());
    }

    [Fact]
    public async Task Deduplicate_SameExternalIdInDifferentSources_IsNotADuplicate()
    {
        using var db = LegacyDb();
        db.Events.AddRange(Ev(1, "same"), Ev(2, "same"), Ev(3, "same"));
        await db.SaveChangesAsync();

        var result = await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        Assert.Equal(0, result.EventsRemoved);
        Assert.Equal(3, await db.Events.CountAsync());
    }

    [Fact]
    public async Task Deduplicate_NoDuplicates_WritesNothing_AndOpensNoTransaction()
    {
        var spy = new CommandSpy();
        using var db = LegacyDb(spy);
        var user = NewUser("u@test.se");
        var e1 = Ev(1, "a"); var e2 = Ev(1, "b"); var e3 = Ev(2, "a");
        db.Events.AddRange(e1, e2, e3);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        db.UserSavedEvents.Add(new UserSavedEvent { UserId = user.Id, EventId = e1.Id });
        db.EventShareLogs.Add(new EventShareLog { EventId = e2.Id });
        await db.SaveChangesAsync();
        var before = await EventIdsAsync(db);
        spy.Commands.Clear();

        var logger = new ListLogger();
        var result = await EventDeduplicator.DeduplicateAsync(db, logger);

        Assert.Equal(EventDeduplicationResult.None, result);
        Assert.Equal(before, await EventIdsAsync(db));
        Assert.Equal(1, await db.UserSavedEvents.CountAsync());
        Assert.Equal(1, await db.EventShareLogs.CountAsync());
        Assert.DoesNotContain(spy.Commands, c =>
            c.Contains("INSERT", StringComparison.OrdinalIgnoreCase)
            || c.Contains("UPDATE", StringComparison.OrdinalIgnoreCase)
            || c.Contains("DELETE", StringComparison.OrdinalIgnoreCase));
        Assert.Empty(logger.Entries); // inget att varna om i vanliga fallet
    }

    [Fact]
    public async Task Deduplicate_IsIdempotent_SecondRunChangesNothing()
    {
        using var db = LegacyDb();
        db.Events.AddRange(Ev(1, "dup", T0), Ev(1, "dup", T0.AddHours(1)));
        await db.SaveChangesAsync();

        var first = await EventDeduplicator.DeduplicateAsync(db, new ListLogger());
        var idsAfterFirst = await EventIdsAsync(db);
        var second = await EventDeduplicator.DeduplicateAsync(db, new ListLogger());

        Assert.Equal(1, first.EventsRemoved);
        Assert.Equal(EventDeduplicationResult.None, second);
        Assert.Equal(idsAfterFirst, await EventIdsAsync(db));
    }

    [Fact]
    public async Task Deduplicate_LogsOneWarningWithCounts_WhenItRemovedRows()
    {
        using var db = LegacyDb();
        db.Events.AddRange(Ev(1, "dup", T0), Ev(1, "dup", T0.AddHours(1)), Ev(1, "dup", T0.AddHours(2)));
        await db.SaveChangesAsync();
        var logger = new ListLogger();

        await EventDeduplicator.DeduplicateAsync(db, logger);

        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Warning, entry.Level);
        Assert.Contains("1 dubblettgrupp", entry.Message);
        Assert.Contains("2 överflödig", entry.Message);
    }

    [Fact]
    public async Task Deduplicate_FailureMidway_RollsBackEverything_AndRethrows()
    {
        var spy = new CommandSpy();
        using var db = LegacyDb(spy);
        var oldest = Ev(1, "dup", T0);
        var surplus = Ev(1, "dup", T0.AddHours(1));
        var user = NewUser("u@test.se");
        db.Events.AddRange(oldest, surplus);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        db.UserSavedEvents.Add(new UserSavedEvent { UserId = user.Id, EventId = surplus.Id });
        db.EventShareLogs.Add(new EventShareLog { EventId = surplus.Id });
        await db.SaveChangesAsync();
        // Felet kommer sist: när själva händelseraderna ska raderas — då är barnraderna redan flyttade i transaktionen.
        spy.ThrowWhen = sql => sql.Contains("DELETE FROM \"Events\"", StringComparison.Ordinal);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            EventDeduplicator.DeduplicateAsync(db, new ListLogger()));

        spy.ThrowWhen = null;
        Assert.Equal(2, await db.Events.CountAsync());
        Assert.Equal(surplus.Id, (await db.UserSavedEvents.SingleAsync()).EventId); // flytten rullades tillbaka
        Assert.Equal(surplus.Id, (await db.EventShareLogs.SingleAsync()).EventId);
    }

    // ---- index ---------------------------------------------------------------------------------------------

    [Fact]
    public async Task Ensure_AfterDedupe_CreatesUniqueIndex_AndDuplicateInsertThrows()
    {
        using var db = LegacyDb();
        db.Events.AddRange(Ev(1, "dup", T0), Ev(1, "dup", T0.AddHours(1)), Ev(1, "ok"));
        await db.SaveChangesAsync();
        var logger = new ListLogger();

        Assert.True(await EventsUniqueIndex.PrepareAsync(db, logger));
        Assert.True(await EventsUniqueIndex.EnsureAsync(db, logger));

        db.Events.Add(Ev(1, "dup"));
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.True(EventsUniqueIndex.IsEventDuplicateViolation(ex));
        Assert.DoesNotContain(logger.Entries, e => e.Level == LogLevel.Error);
    }

    [Fact]
    public async Task Ensure_IsIdempotent_CanRunEveryStart()
    {
        using var db = LegacyDb();
        var logger = new ListLogger();

        Assert.True(await EventsUniqueIndex.EnsureAsync(db, logger));
        Assert.True(await EventsUniqueIndex.EnsureAsync(db, logger));
        Assert.True(await EventsUniqueIndex.EnsureAsync(db, logger));

        Assert.Empty(logger.Entries);
    }

    [Fact]
    public async Task Index_AllowsDuplicateEmptyExternalId_AndSameIdInOtherSources()
    {
        using var db = LegacyDb();
        Assert.True(await EventsUniqueIndex.EnsureAsync(db, new ListLogger()));

        db.Events.AddRange(Ev(1, ""), Ev(1, ""), Ev(2, "same"), Ev(3, "same"));
        await db.SaveChangesAsync();

        Assert.Equal(4, await db.Events.CountAsync());
    }

    [Fact]
    public async Task Index_ModelCreatedDatabase_AlreadyHasUniqueIndex()
    {
        using var db = TestDb.Create(); // EnsureCreated från modellen (så som lokal dev/migrering ger det)
        db.Events.Add(Ev(1, "x"));
        await db.SaveChangesAsync();
        db.Events.Add(Ev(1, "x"));

        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Ensure_WithRemainingDuplicates_DoesNotThrow_LogsError_AndLeavesDataAlone()
    {
        using var db = LegacyDb();
        db.Events.AddRange(Ev(1, "dup", T0), Ev(1, "dup", T0.AddHours(1)));
        await db.SaveChangesAsync();
        var logger = new ListLogger();

        // Utan dedupe före: skapandet av indexet kastar internt men får aldrig läcka ut och krascha uppstarten.
        var ok = await EventsUniqueIndex.EnsureAsync(db, logger);

        Assert.False(ok);
        var error = Assert.Single(logger.Entries, e => e.Level == LogLevel.Error);
        Assert.Contains("appen startar ändå", error.Message);
        Assert.Equal(2, await db.Events.CountAsync());
    }

    [Fact]
    public async Task Prepare_WhenDedupeFails_ReturnsFalse_LogsError_AndDoesNotThrow()
    {
        var spy = new CommandSpy();
        using var db = LegacyDb(spy);
        db.Events.AddRange(Ev(1, "dup", T0), Ev(1, "dup", T0.AddHours(1)));
        await db.SaveChangesAsync();
        spy.ThrowWhen = sql => sql.Contains("DELETE FROM \"Events\"", StringComparison.Ordinal);
        var logger = new ListLogger();

        var ok = await EventsUniqueIndex.PrepareAsync(db, logger);

        Assert.False(ok);
        Assert.Contains(logger.Entries, e => e.Level == LogLevel.Error && e.Message.Contains("appen startar ändå"));
        spy.ThrowWhen = null;
        Assert.Equal(2, await db.Events.CountAsync()); // rollback — inget raderat
    }

    [Fact]
    public async Task Prepare_WhenEventsTableDoesNotExist_IsANoOp_ReturnsTrue()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options;
        using var db = new AppDbContext(options);
        db.Database.OpenConnection(); // tom databas, inget schema
        var logger = new ListLogger();

        Assert.True(await EventsUniqueIndex.PrepareAsync(db, logger));
        Assert.Empty(logger.Entries);
    }

    [Fact]
    public void IsEventDuplicateViolation_IsFalseForOtherErrors()
    {
        Assert.False(EventsUniqueIndex.IsEventDuplicateViolation(new InvalidOperationException("nej")));
        Assert.False(EventsUniqueIndex.IsEventDuplicateViolation(
            new DbUpdateException("x", new SqliteException("NOT NULL constraint failed: Events.Title", 19))));
        Assert.False(EventsUniqueIndex.IsEventDuplicateViolation(
            new DbUpdateException("x", new SqliteException("UNIQUE constraint failed: Users.Email", 19))));
    }
}
