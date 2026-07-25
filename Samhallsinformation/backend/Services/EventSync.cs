namespace Samhallsinformation.Services;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;

public static class EventSync
{
    // Hämtar händelser från en ingestor och sparar dem. Vid overwriteExisting=false
    // (normal bakgrundskörning) hoppas redan kända ExternalId över, precis som förut.
    // Vid overwriteExisting=true (admin-triggad resync) skrivs befintliga rader om med
    // den nyss hämtade datan — används för att se ingestor-ändringar slå igenom på data
    // som redan ligger i databasen, utan att vänta på att nya händelser dyker upp.
    public static async Task<(int Inserted, int Updated)> SyncAsync(
        AppDbContext db, IIngestor ingestor, bool overwriteExisting, CancellationToken ct = default)
    {
        var events = await ingestor.FetchEventsAsync();
        var externalIds = events.Select(e => e.ExternalId).ToList();

        var existingByExternalId = await db.Events
            .Where(e => e.SourceId == ingestor.Source.Id && externalIds.Contains(e.ExternalId))
            .ToDictionaryAsync(e => e.ExternalId, ct);

        var inserted = 0;
        var updated  = 0;

        foreach (var incoming in events)
        {
            if (existingByExternalId.TryGetValue(incoming.ExternalId, out var current))
            {
                if (!overwriteExisting) continue;

                current.Title       = incoming.Title;
                current.Content     = incoming.Content;
                current.Url         = incoming.Url;
                current.RawData     = incoming.RawData;
                current.Geography   = incoming.Geography;
                current.Severity    = incoming.Severity;
                current.IsNational  = incoming.IsNational;
                current.PublishedAt = incoming.PublishedAt;
                updated++;
            }
            else
            {
                db.Events.Add(incoming);
                inserted++;
            }
        }

        return (inserted, updated);
    }
}
