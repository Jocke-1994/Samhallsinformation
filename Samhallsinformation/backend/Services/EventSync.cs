namespace Samhallsinformation.Services;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;

public static class EventSync
{
    // Hämtar händelser från en ingestor och sparar dem. Vid overwriteExisting=false
    // (normal bakgrundskörning) hoppas redan kända ExternalId över, precis som förut.
    // Vid overwriteExisting=true (admin-triggad resync) skrivs befintliga rader om med
    // den nyss hämtade datan — används för att se ingestor-ändringar slå igenom på data
    // som redan ligger i databasen, utan att vänta på att nya händelser dyker upp.
    //
    // Tål dubbletter (V3-1): utan unikt index på (SourceId, ExternalId) kan databasen innehålla
    // flera rader med samma nyckel, och en hämtning kan innehålla samma nyckel två gånger. Inget
    // av det får kasta — ToDictionary gjorde det och tog ner källan för alltid.
    //  - Dubbletter i databasen: deterministiskt används den äldsta raden (IngestedAt, sedan Id).
    //    De övriga lämnas orörda; själva rensningen hör till det unika indexet (V3-2).
    //  - Dubbletter i hämtningen: den sista posten vinner, en enda rad skapas/uppdateras.
    //  - Tomt/null/blankt ExternalId: posten hoppas över (loggas). En post utan stabil nyckel kan
    //    inte kännas igen nästa cykel och skulle annars skapa en ny rad varje gång.
    public static async Task<(int Inserted, int Updated, List<CanonicalEvent> InsertedEvents)> SyncAsync(
        AppDbContext db, IIngestor ingestor, bool overwriteExisting, CancellationToken ct = default,
        ILogger? logger = null)
    {
        var fetched = await ingestor.FetchEventsAsync();

        var skippedNoKey = fetched.Count(e => string.IsNullOrWhiteSpace(e.ExternalId));
        if (skippedNoKey > 0)
            logger?.LogWarning(
                "{Source} (id {SourceId}): {Count} händelse(r) saknar ExternalId och hoppades över",
                ingestor.Source.Name, ingestor.Source.Id, skippedNoKey);

        // Sista förekomsten av varje ExternalId vinner; ordningen följer sista förekomstens läge.
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var events = new List<CanonicalEvent>();
        for (var i = fetched.Count - 1; i >= 0; i--)
        {
            var candidate = fetched[i];
            if (string.IsNullOrWhiteSpace(candidate.ExternalId)) continue;
            if (seen.Add(candidate.ExternalId)) events.Add(candidate);
        }
        events.Reverse();

        var duplicatesInBatch = fetched.Count - skippedNoKey - events.Count;
        if (duplicatesInBatch > 0)
            logger?.LogWarning(
                "{Source} (id {SourceId}): {Count} dubblett(er) av ExternalId i hämtningen, sista posten används",
                ingestor.Source.Name, ingestor.Source.Id, duplicatesInBatch);

        var externalIds = events.Select(e => e.ExternalId).ToList();

        var existingRows = await db.Events
            .Where(e => e.SourceId == ingestor.Source.Id && externalIds.Contains(e.ExternalId))
            .ToListAsync(ct);

        var existingByExternalId = new Dictionary<string, CanonicalEvent>(StringComparer.Ordinal);
        foreach (var row in existingRows.OrderBy(r => r.IngestedAt).ThenBy(r => r.Id))
            existingByExternalId.TryAdd(row.ExternalId, row);

        var duplicateRows = existingRows.Count - existingByExternalId.Count;
        if (duplicateRows > 0)
            logger?.LogWarning(
                "{Source} (id {SourceId}): {Count} dubblettrad(er) med samma ExternalId i databasen, den äldsta används",
                ingestor.Source.Name, ingestor.Source.Id, duplicateRows);

        var inserted = 0;
        var updated  = 0;
        var insertedEvents = new List<CanonicalEvent>();

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
                current.EventType   = incoming.EventType;
                current.Severity    = incoming.Severity;
                current.IsNational  = incoming.IsNational;
                current.PublishedAt = incoming.PublishedAt;
                updated++;
            }
            else
            {
                db.Events.Add(incoming);
                inserted++;
                insertedEvents.Add(incoming);
            }
        }

        return (inserted, updated, insertedEvents);
    }
}
