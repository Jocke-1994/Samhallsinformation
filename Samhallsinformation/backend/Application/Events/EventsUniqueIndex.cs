namespace Samhallsinformation.Application.Events;

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Samhallsinformation.Data;

/// <summary>
/// Uppstartssteg och hjälpmetoder för det unika indexet på <c>Events(SourceId, ExternalId)</c> (V3-2).
/// Båda uppstartsmetoderna kastar ALDRIG — uppstarten får inte dö på grund av indexet; de loggar Error och
/// returnerar false, och nästa start försöker igen.
/// </summary>
public static class EventsUniqueIndex
{
    public const string UniqueIndexName = "IX_Events_SourceId_ExternalId";
    public const string SourceIndexName = "IX_Events_SourceId";

    /// <summary>
    /// Steg 1 (före MigrateAsync): rensa dubbletter så att indexet kan skapas. Hoppar över om Events-tabellen
    /// inte finns än (tom databas). Returnerar false om rensningen misslyckades (då ska indexet inte försökas).
    /// </summary>
    public static async Task<bool> PrepareAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        try
        {
            if (!await EventsTableExistsAsync(db, ct)) return true;
            await EventDeduplicator.DeduplicateAsync(db, logger, ct);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex,
                "Kunde inte rensa dubbletter i Events — appen startar ändå, åtgärda dubbletter manuellt. " +
                "Det unika indexet på Events skapas inte förrän det är löst (nästa start försöker igen).");
            return false;
        }
    }

    /// <summary>
    /// Steg 2 (efter MigrateAsync, varje start): skapa indexen idempotent. Samma SQL fungerar i SQLite och
    /// PostgreSQL (partiella index, dubbelciterade identifierare). Finns indexen redan är det en no-op.
    /// </summary>
    public static async Task<bool> EnsureAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(
                $@"CREATE INDEX IF NOT EXISTS ""{SourceIndexName}"" ON ""Events"" (""SourceId"")", ct);
            await db.Database.ExecuteSqlRawAsync(
                $@"CREATE UNIQUE INDEX IF NOT EXISTS ""{UniqueIndexName}"" ON ""Events"" (""SourceId"", ""ExternalId"")
                   WHERE ""ExternalId"" IS NOT NULL AND ""ExternalId"" <> ''", ct);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex,
                "Kunde inte skapa unikt index på Events — appen startar ändå, åtgärda dubbletter manuellt. " +
                "Ingest fungerar som förut utan skyddet; nästa start försöker igen.");
            return false;
        }
    }

    /// <summary>
    /// Sant om undantaget (eller ett inre) är brottet mot det unika indexet på Events(SourceId, ExternalId) —
    /// dvs. en samtidig körning hann spara samma händelse. Andra unique-fel räknas inte.
    /// </summary>
    public static bool IsEventDuplicateViolation(Exception ex)
    {
        for (var e = ex; e != null; e = e.InnerException)
        {
            if (e is PostgresException pg)
                return pg.SqlState == PostgresErrorCodes.UniqueViolation && pg.ConstraintName == UniqueIndexName;
            if (e is SqliteException sq)
                return sq.SqliteErrorCode == 19
                    && sq.Message.Contains("Events.SourceId, Events.ExternalId", StringComparison.Ordinal);
        }
        return false;
    }

    private static async Task<bool> EventsTableExistsAsync(AppDbContext db, CancellationToken ct)
    {
        var sql = db.Database.IsNpgsql()
            ? @"SELECT COUNT(*) AS ""Value"" FROM information_schema.tables WHERE table_name = 'Events' AND table_schema = current_schema()"
            : @"SELECT COUNT(*) AS ""Value"" FROM sqlite_master WHERE type = 'table' AND name = 'Events'";
        return await db.Database.SqlQueryRaw<long>(sql).SingleAsync(ct) > 0;
    }
}
