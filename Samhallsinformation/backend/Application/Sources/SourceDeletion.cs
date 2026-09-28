namespace Samhallsinformation.Application.Sources;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;

/// <summary>
/// Källor som <c>Program.cs</c> seedar/återskapar vid varje start. En raderad sådan källa dyker upp igen
/// (dedikerade ingestorer med hårdkodade Id:n 1/4/5/10, samt de två seedade RSS-komplementen identifierade via URL),
/// så radering är aldrig varaktig — de ska inaktiveras (IsActive=false), inte raderas.
/// </summary>
public static class SeededSources
{
    // Delas med Program.cs så att seed-villkoret och raderingsspärren aldrig glider isär.
    public const string SmhiNyheterUrl           = "https://www.smhi.se/rss/nyheter-fran-smhi";
    public const string PolisenEfterlysningarUrl = "https://polisen.se/aktuellt/rss/hela-landet/hjalp-polisen-rss/";

    public static bool IsSeeded(Source source, IEnumerable<IIngestor> dedicatedIngestors) =>
        dedicatedIngestors.Any(i => i.Source.Id == source.Id)
        || source.Url == SmhiNyheterUrl
        || source.Url == PolisenEfterlysningarUrl;
}

/// <summary>Vad en radering tog bort — används i aktivitetsloggen.</summary>
public sealed record SourceDeletionResult(
    int Events, int SavedEvents, int ShareLogs, int RunLogs, int Subscriptions);

/// <summary>
/// Raderar en vanlig (icke-seedad) källa tillsammans med allt som hänger på den, i EN transaktion.
/// Events saknar FK mot Sources, så händelserna (och EventShareLogs/IngestorRunLogs, som saknar FK) tas bort
/// explicit. Databasens kaskadregler gör resten och görs därför INTE om här:
///   Sources → UserSourcePreferences / UserNotificationSettings (prenumerationerna)
///   Events  → UserSavedEvents
/// Vid fel rullas allt tillbaka och undantaget kastas vidare.
/// </summary>
public static class SourceDeletion
{
    public static async Task<SourceDeletionResult> DeleteAsync(AppDbContext db, int sourceId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            // Räkna först — kaskaderna sker i databasen och ger inget antal tillbaka.
            var savedEvents = await db.UserSavedEvents.CountAsync(s => s.Event.SourceId == sourceId, ct);
            var subscriptions =
                await db.UserSourcePreferences.CountAsync(p => p.SourceId == sourceId, ct)
              + await db.UserNotificationSettings.CountAsync(n => n.SourceId == sourceId, ct);

            var shareLogs = await db.EventShareLogs
                .Where(l => db.Events.Any(e => e.Id == l.EventId && e.SourceId == sourceId))
                .ExecuteDeleteAsync(ct);
            var runLogs = await db.IngestorRunLogs.Where(r => r.SourceId == sourceId).ExecuteDeleteAsync(ct);
            var events  = await db.Events.Where(e => e.SourceId == sourceId).ExecuteDeleteAsync(ct);
            await db.Sources.Where(s => s.Id == sourceId).ExecuteDeleteAsync(ct);

            await tx.CommitAsync(ct);
            db.ChangeTracker.Clear(); // ExecuteDelete går förbi trackern — släpp inaktuella Source-instanser
            return new SourceDeletionResult(events, savedEvents, shareLogs, runLogs, subscriptions);
        }
        catch
        {
            db.ChangeTracker.Clear();
            throw; // tx disponeras utan commit → rollback
        }
    }
}
