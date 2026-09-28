namespace Samhallsinformation.Application.Sources;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

/// <summary>
/// PostgreSQL-steg (V4-1a, E2#5): flyttar <c>Sources</c>-sekvensen till <c>MAX("Id")</c>. Ingestor-seeden
/// infogar explicita ID:n (1/4/5/10) utan att sekvensen avanceras, så en admin-skapad källa kunde annars få
/// ett ID som senare krockar med en hårdkodad ingestor. Kastar ALDRIG — uppstarten får inte dö på grund av
/// steget; ett fel loggas som Error och nästa start försöker igen. Körs bara mot Npgsql (SQLite har ingen
/// separat sekvens — rowid håller redan koll på högsta ID).
/// </summary>
public static class SourceIdSequence
{
    /// <summary>
    /// SQL:en som sätter sekvensen till högsta använda ID (nästa nextval blir MAX+1). Tom tabell -> 1.
    /// <c>pg_get_serial_sequence</c> hittar bara sekvenser som är ÄGDA av kolumnen (serial/identity); den
    /// manuellt skapade <c>Sources_Id_seq</c> i uppstarten (CREATE SEQUENCE utan OWNED BY) ger NULL där, och
    /// <c>setval(NULL, …)</c> vore en tyst no-op — därför COALESCE mot sekvensens fasta namn.
    /// </summary>
    public static string BuildSetvalSql() =>
        @"SELECT setval(COALESCE(pg_get_serial_sequence('""Sources""', 'Id'), '""Sources_Id_seq""'), " +
        @"COALESCE((SELECT MAX(""Id"") FROM ""Sources""), 1))";

    /// <summary>Uppstartssteget mot en riktig kontext. Returnerar sant om SQL:en kördes utan fel.</summary>
    public static Task<bool> EnsureAsync(AppDbContext db, ILogger logger, CancellationToken ct = default) =>
        EnsureAsync(
            db.Database.IsNpgsql(),
            async (sql, token) => { await db.Database.ExecuteSqlRawAsync(sql, token); },
            logger, ct);

    /// <summary>
    /// Kärnan, utan databasberoende: <paramref name="isNpgsql"/> styr om något alls körs och
    /// <paramref name="executeSql"/> är det som kör SQL:en (fejkbar i test).
    /// </summary>
    public static async Task<bool> EnsureAsync(
        bool isNpgsql, Func<string, CancellationToken, Task> executeSql, ILogger logger, CancellationToken ct = default)
    {
        if (!isNpgsql) return false;
        try
        {
            await executeSql(BuildSetvalSql(), ct);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex,
                "Kunde inte flytta Sources-sekvensen till MAX(Id) — appen startar ändå. En nyskapad källa " +
                "kan få ett ID som krockar med en hårdkodad ingestor; nästa start försöker igen.");
            return false;
        }
    }
}
