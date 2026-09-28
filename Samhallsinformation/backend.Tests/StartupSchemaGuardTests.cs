namespace Samhallsinformation.Tests;

using Samhallsinformation.Infrastructure;
using Xunit;

/// <summary>
/// Regressionstester för E2#2: startlogiken fick tidigare DROP:a Events/Sources/UserPreferences/
/// __EFMigrationsHistory så fort GetAppliedMigrationsAsync kastade (t.ex. timeout vid en
/// Railway-omstart). Den gamla koden var <c>catch { alreadyMigrated = false; }</c> följt av DROP,
/// dvs. "undersökningen misslyckades" gav samma utfall som "ingen historik" -> ResetLegacySchema.
/// Testerna nedan för Failure-fallen hade därför varit röda mot det beteendet.
/// </summary>
public class StartupSchemaGuardTests
{
    private static SchemaInspection Failed(Exception ex) => new(ex, false, 0, 0, 0);

    [Fact]
    public void Decide_ConnectionFailure_AbortsAndNeverResets()
    {
        var decision = StartupSchemaGuard.Decide(Failed(new InvalidOperationException("connection reset by peer")));

        Assert.Equal(SchemaAction.Abort, decision.Action);
        Assert.False(string.IsNullOrWhiteSpace(decision.Reason));
    }

    [Fact]
    public void Decide_Timeout_AbortsAndNeverResets()
    {
        var decision = StartupSchemaGuard.Decide(Failed(new TimeoutException("Timeout during connection attempt")));

        Assert.Equal(SchemaAction.Abort, decision.Action);
    }

    [Fact]
    public void Decide_UnknownException_Aborts()
    {
        var decision = StartupSchemaGuard.Decide(Failed(new NotSupportedException("något oväntat")));

        Assert.Equal(SchemaAction.Abort, decision.Action);
    }

    [Fact]
    public void Decide_FailureWithEmptyLookingCounts_StillAborts()
    {
        // Ett fel får aldrig tolkas som "tomt", även om övriga fält råkar se tomma ut.
        var inspection = new SchemaInspection(new TimeoutException(), HistoryHasRows: false,
            EventCount: 0, SourceCount: 0, UserCount: 0);

        Assert.Equal(SchemaAction.Abort, StartupSchemaGuard.Decide(inspection).Action);
    }

    [Fact]
    public void Decide_NoHistoryAndEmptyTables_ResetsLegacySchema()
    {
        var decision = StartupSchemaGuard.Decide(new SchemaInspection(null, false, 0, 0, 0));

        Assert.Equal(SchemaAction.ResetLegacySchema, decision.Action);
    }

    [Theory]
    [InlineData(5, 0, 0)]   // bara Events
    [InlineData(0, 3, 0)]   // bara Sources
    [InlineData(0, 0, 2)]   // bara Users (droppa aldrig när Users finns)
    [InlineData(120000, 40, 500)]
    public void Decide_NoHistoryButData_AbortsAndNeverResets(long events, long sources, long users)
    {
        var decision = StartupSchemaGuard.Decide(new SchemaInspection(null, false, events, sources, users));

        Assert.Equal(SchemaAction.Abort, decision.Action);
        Assert.False(string.IsNullOrWhiteSpace(decision.Reason));
    }

    [Fact]
    public void Decide_HistoryExists_Migrates()
    {
        var decision = StartupSchemaGuard.Decide(new SchemaInspection(null, true, 0, 0, 0));

        Assert.Equal(SchemaAction.Migrate, decision.Action);
        Assert.Null(decision.Reason);
    }
}
