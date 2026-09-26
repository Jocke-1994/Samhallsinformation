namespace Samhallsinformation.Application.Retention;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

/// <summary>Antal raderade rader per tabell i en retention-körning.</summary>
public readonly record struct RetentionResult(int IngestorRunLogs, int PushDispatchClaims);

/// <summary>
/// Retention för loggtabeller som annars växer obegränsat (V4-1a, E2#6):
/// <c>IngestorRunLogs</c> (en rad per källa var 5:e minut, ~600 000/år) äldre än 30 dagar och
/// <c>PushDispatchClaims</c> äldre än 14 dagar. Rör medvetet INTE <c>EventShareLogs</c> (statistik) eller
/// <c>NotificationDeliveryLogs</c> (statistik + GDPR-export).
///
/// Raderar i batchar (id-urval + <c>ExecuteDeleteAsync</c>) så att tabellen aldrig låses länge. 30 dagar räcker
/// för allt som läser <c>IngestorRunLogs</c>: Felsökningens sammanfattning kapar på 30 dagar och
/// <c>SourceFailingRule</c> tittar bara på de senaste N körningarna per källa.
/// </summary>
public static class DataRetention
{
    public static readonly TimeSpan IngestorRunLogMaxAge = TimeSpan.FromDays(30);
    public static readonly TimeSpan PushDispatchClaimMaxAge = TimeSpan.FromDays(14);
    public const int DefaultBatchSize = 1000;

    /// <summary>
    /// Kör båda städningarna. Ett fel i den ena tabellen loggas som Error och hindrar inte den andra;
    /// avbrott (<see cref="OperationCanceledException"/>) propageras.
    /// </summary>
    public static async Task<RetentionResult> PurgeAsync(
        AppDbContext db, DateTime nowUtc, ILogger logger,
        int batchSize = DefaultBatchSize, TimeSpan? pauseBetweenBatches = null, CancellationToken ct = default)
    {
        var pause = pauseBetweenBatches ?? TimeSpan.FromMilliseconds(100);
        var runLogCutoff = nowUtc - IngestorRunLogMaxAge;
        var claimCutoff  = nowUtc - PushDispatchClaimMaxAge;

        var runLogs = await SafeAsync("IngestorRunLogs", logger, () => DeleteInBatchesAsync(
            async token =>
            {
                var ids = await db.IngestorRunLogs.Where(l => l.RunAt < runLogCutoff)
                    .OrderBy(l => l.RunAt).Select(l => l.Id).Take(batchSize).ToListAsync(token);
                if (ids.Count == 0) return (0, 0);
                return (ids.Count, await db.IngestorRunLogs.Where(l => ids.Contains(l.Id)).ExecuteDeleteAsync(token));
            }, batchSize, pause, ct));

        var claims = await SafeAsync("PushDispatchClaims", logger, () => DeleteInBatchesAsync(
            async token =>
            {
                var ids = await db.PushDispatchClaims.Where(c => c.CreatedAt < claimCutoff)
                    .OrderBy(c => c.CreatedAt).Select(c => c.Id).Take(batchSize).ToListAsync(token);
                if (ids.Count == 0) return (0, 0);
                return (ids.Count, await db.PushDispatchClaims.Where(c => ids.Contains(c.Id)).ExecuteDeleteAsync(token));
            }, batchSize, pause, ct));

        if (runLogs + claims > 0)
            logger.LogInformation(
                "Retention raderade {RunLogs} IngestorRunLogs (>{RunLogDays} dagar) och {Claims} PushDispatchClaims (>{ClaimDays} dagar).",
                runLogs, IngestorRunLogMaxAge.TotalDays, claims, PushDispatchClaimMaxAge.TotalDays);

        return new RetentionResult(runLogs, claims);
    }

    /// <summary>Upprepar <paramref name="deleteBatch"/> (urvalsstorlek, raderade) tills ett batch inte fyllts.</summary>
    private static async Task<int> DeleteInBatchesAsync(
        Func<CancellationToken, Task<(int Selected, int Deleted)>> deleteBatch,
        int batchSize, TimeSpan pause, CancellationToken ct)
    {
        var total = 0;
        while (true)
        {
            ct.ThrowIfCancellationRequested();
            var (selected, deleted) = await deleteBatch(ct);
            total += deleted;
            // Tomt urval, inget raderades (skydd mot oändlig loop) eller sista, ofullständiga batchen.
            if (selected < batchSize || deleted == 0) return total;
            if (pause > TimeSpan.Zero) await Task.Delay(pause, ct);
        }
    }

    private static async Task<int> SafeAsync(string table, ILogger logger, Func<Task<int>> action)
    {
        try
        {
            return await action();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Retention misslyckades för {Table} — hoppar över, försöker igen nästa cykel.", table);
            return 0;
        }
    }
}
