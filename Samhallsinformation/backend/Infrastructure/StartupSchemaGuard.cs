namespace Samhallsinformation.Infrastructure;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

/// <summary>
/// Vad startlogiken ska göra med databasschemat (PostgreSQL) innan MigrateAsync körs.
/// </summary>
public enum SchemaAction
{
    /// <summary>Migreringshistorik finns — kör den vanliga vägen (typläkning + MigrateAsync).</summary>
    Migrate,

    /// <summary>
    /// Bevisligen en tom/legacy-databas utan migreringshistorik och utan data —
    /// säkert att droppa de gamla tabellerna och låta MigrateAsync bygga om.
    /// </summary>
    ResetLegacySchema,

    /// <summary>Kan inte avgöra säkert, eller data skulle gå förlorad — starta INTE, droppa INGET.</summary>
    Abort,
}

public sealed record SchemaDecision(SchemaAction Action, string? Reason = null);

/// <summary>
/// Det startlogiken faktiskt kunde observera i databasen. <see cref="Failure"/> är satt om
/// själva undersökningen kastade (anslutningsfel, timeout, behörighet, ...) — i så fall är
/// övriga fält meningslösa och får aldrig tolkas som "tomt".
/// </summary>
public sealed record SchemaInspection(
    Exception? Failure,
    bool HistoryHasRows,
    long EventCount,
    long SourceCount,
    long UserCount);

/// <summary>
/// Beslutar om startlogiken får droppa legacy-tabeller. Ren logik utan databasåtkomst
/// (<see cref="Decide"/>) skild från själva undersökningen (<see cref="InspectAsync"/>).
///
/// Bakgrund (E2#2): tidigare tolkades VARJE undantag från GetAppliedMigrationsAsync som "ingen
/// migreringshistorik" och ledde till DROP TABLE på Events/Sources/UserPreferences/
/// __EFMigrationsHistory. Ett övergående anslutningsfel vid en Railway-omstart kunde alltså
/// radera produktionsdatan. Nu gäller: en krasch vid start är alltid bättre än dataförlust.
/// </summary>
public static class StartupSchemaGuard
{
    public static SchemaDecision Decide(SchemaInspection inspection)
    {
        if (inspection.Failure is not null)
        {
            return new SchemaDecision(SchemaAction.Abort,
                "Kunde inte undersöka migreringshistoriken vid start "
                + $"({inspection.Failure.GetType().Name}: {inspection.Failure.Message}). "
                + "Ingen tabell har droppats. Starta om när databasen är nåbar.");
        }

        if (inspection.HistoryHasRows)
            return new SchemaDecision(SchemaAction.Migrate);

        if (inspection.EventCount > 0 || inspection.SourceCount > 0 || inspection.UserCount > 0)
        {
            return new SchemaDecision(SchemaAction.Abort,
                "Migreringshistorik saknas men databasen innehåller data "
                + $"(Events={inspection.EventCount}, Sources={inspection.SourceCount}, Users={inspection.UserCount}). "
                + "Startlogiken vägrar droppa tabeller med data. Återställ __EFMigrationsHistory manuellt "
                + "eller rensa databasen avsiktligt innan nästa start.");
        }

        return new SchemaDecision(SchemaAction.ResetLegacySchema);
    }

    /// <summary>
    /// Läser av databasen (PostgreSQL). Fångar alla undantag och returnerar dem i
    /// <see cref="SchemaInspection.Failure"/> — ett fel tolkas aldrig som "tomt".
    /// Tabeller som bevisligen saknas (to_regclass) räknas som 0 rader; allt annat som går fel
    /// blir ett Failure.
    /// </summary>
    public static async Task<SchemaInspection> InspectAsync(AppDbContext db, CancellationToken ct = default)
    {
        try
        {
            var historyRows = await CountIfTableExistsAsync(db, "__EFMigrationsHistory", ct);
            if (historyRows > 0)
                return new SchemaInspection(null, true, 0, 0, 0);

            var events  = await CountIfTableExistsAsync(db, "Events", ct);
            var sources = await CountIfTableExistsAsync(db, "Sources", ct);
            var users   = await CountIfTableExistsAsync(db, "Users", ct);
            return new SchemaInspection(null, false, events, sources, users);
        }
        catch (Exception ex)
        {
            return new SchemaInspection(ex, false, 0, 0, 0);
        }
    }

    private static async Task<long> CountIfTableExistsAsync(AppDbContext db, string table, CancellationToken ct)
    {
        // Tabellnamnen är hårdkodade konstanter ovan, aldrig indata.
        var exists = (await db.Database
            .SqlQueryRaw<bool>($"SELECT to_regclass('\"{table}\"') IS NOT NULL AS \"Value\"")
            .ToListAsync(ct)).Single();
        if (!exists) return 0;

        return (await db.Database
            .SqlQueryRaw<long>($"SELECT count(*) AS \"Value\" FROM \"{table}\"")
            .ToListAsync(ct)).Single();
    }
}
