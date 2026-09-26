namespace Samhallsinformation.Application.Events;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;

/// <summary>Vad en deduplicering gjorde — allt 0 betyder att inga dubbletter fanns och inget skrevs.</summary>
public sealed record EventDeduplicationResult(
    int Groups, int EventsRemoved, int SavedEventsMoved, int SavedEventsDropped, int ShareLogsMoved, int UndoReferencesUpdated)
{
    public static readonly EventDeduplicationResult None = new(0, 0, 0, 0, 0, 0);
    public bool AnyChange => EventsRemoved > 0;
}

/// <summary>
/// Rensar dubbletter av (SourceId, ExternalId) i <c>Events</c> INNAN det unika indexet skapas (V3-2, E2#7).
///
/// Regler (ingen legitim data får förloras):
///  - Bara rader med ICKE-tomt ExternalId rörs. Tomma/NULL-ExternalId undantas av indexets filter och lämnas alltid orörda.
///  - Grupperingen är exakt (SourceId, ExternalId) — samma ExternalId hos olika källor är olika händelser.
///  - Den ÄLDSTA raden behålls (minsta IngestedAt, sedan minsta Id — samma ordning som <c>EventSync</c> använder).
///  - Beroende rader flyttas till den behållna raden innan den överflödiga raden raderas:
///      UserSavedEvents  (har samma användare sparat båda raderas den överflödiga sparningen, så att det unika
///                        indexet (UserId, EventId) hålls),
///      EventShareLogs   (flyttas),
///      AdminActivityLogs.AngraEventId (textreferens för "ångra", pekas om).
///  - Allt i EN transaktion — vid fel rullas allt tillbaka och undantaget kastas vidare.
///  - Finns ingen dubblett görs bara en läsfråga; ingen transaktion öppnas och inget skrivs.
///
/// Endast portabel EF Core-LINQ (SQLite lokalt, PostgreSQL i produktion) — ingen providerspecifik SQL.
/// </summary>
public static class EventDeduplicator
{
    public static async Task<EventDeduplicationResult> DeduplicateAsync(
        AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        if (!await DuplicateKeys(db).AnyAsync(ct))
            return EventDeduplicationResult.None;

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            // Läs om inne i transaktionen — bygger på det som faktiskt gäller när vi skriver.
            var keys = await DuplicateKeys(db).ToListAsync(ct);

            int groups = 0, removed = 0, moved = 0, dropped = 0, shares = 0, undo = 0;

            foreach (var key in keys)
            {
                var rows = await db.Events
                    .Where(e => e.SourceId == key.SourceId && e.ExternalId == key.ExternalId)
                    .Select(e => new { e.Id, e.IngestedAt })
                    .ToListAsync(ct);
                if (rows.Count < 2) continue;

                var ordered = rows.OrderBy(r => r.IngestedAt).ThenBy(r => r.Id).ToList();
                var keepId = ordered[0].Id;
                var surplusIds = ordered.Skip(1).Select(r => r.Id).ToList();
                groups++;

                // Sparade händelser: en användare får bara ha EN sparning per händelse (unikt index UserId+EventId).
                var saved = await db.UserSavedEvents
                    .Where(s => s.EventId == keepId || surplusIds.Contains(s.EventId))
                    .Select(s => new { s.Id, s.UserId, s.EventId, s.SavedAt })
                    .ToListAsync(ct);
                var usersOnKeeper = saved.Where(s => s.EventId == keepId).Select(s => s.UserId).ToHashSet();
                var toMove = new List<Guid>();
                var toDrop = new List<Guid>();
                foreach (var s in saved.Where(s => s.EventId != keepId).OrderBy(s => s.SavedAt).ThenBy(s => s.Id))
                {
                    if (usersOnKeeper.Add(s.UserId)) toMove.Add(s.Id);
                    else toDrop.Add(s.Id);
                }
                if (toDrop.Count > 0)
                    dropped += await db.UserSavedEvents.Where(s => toDrop.Contains(s.Id)).ExecuteDeleteAsync(ct);
                if (toMove.Count > 0)
                    moved += await db.UserSavedEvents.Where(s => toMove.Contains(s.Id))
                        .ExecuteUpdateAsync(u => u.SetProperty(s => s.EventId, keepId), ct);

                shares += await db.EventShareLogs.Where(l => surplusIds.Contains(l.EventId))
                    .ExecuteUpdateAsync(u => u.SetProperty(l => l.EventId, keepId), ct);

                var keepText = keepId.ToString();
                var surplusText = surplusIds.Select(i => i.ToString()).ToList();
                undo += await db.AdminActivityLogs
                    .Where(l => l.AngraEventId != null && surplusText.Contains(l.AngraEventId.ToLower()))
                    .ExecuteUpdateAsync(u => u.SetProperty(l => l.AngraEventId, keepText), ct);

                removed += await db.Events.Where(e => surplusIds.Contains(e.Id)).ExecuteDeleteAsync(ct);
            }

            await tx.CommitAsync(ct);
            db.ChangeTracker.Clear(); // ExecuteUpdate/Delete går förbi trackern

            var result = new EventDeduplicationResult(groups, removed, moved, dropped, shares, undo);
            if (result.AnyChange)
                logger.LogWarning(
                    "Events: {Groups} dubblettgrupp(er) på (SourceId, ExternalId) rensades — {Removed} överflödig(a) rad(er) raderades " +
                    "(äldsta behölls); {Moved} sparade händelser och {Shares} delningsloggar flyttades, {Dropped} dubbla sparningar " +
                    "raderades, {Undo} ångra-referens(er) pekades om",
                    result.Groups, result.EventsRemoved, result.SavedEventsMoved, result.ShareLogsMoved,
                    result.SavedEventsDropped, result.UndoReferencesUpdated);
            return result;
        }
        catch
        {
            db.ChangeTracker.Clear();
            throw; // tx disponeras utan commit → rollback
        }
    }

    // Nycklar (SourceId, ExternalId) som förekommer mer än en gång. Tomt ExternalId undantas — samma
    // villkor som det partiella unika indexet, så vi rensar exakt det indexet annars skulle vägra.
    private static IQueryable<DuplicateKey> DuplicateKeys(AppDbContext db) =>
        db.Events
            .Where(e => e.ExternalId != null && e.ExternalId != "")
            .GroupBy(e => new { e.SourceId, e.ExternalId })
            .Where(g => g.Count() > 1)
            .Select(g => new DuplicateKey { SourceId = g.Key.SourceId, ExternalId = g.Key.ExternalId });

    private sealed class DuplicateKey
    {
        public int SourceId { get; set; }
        public string ExternalId { get; set; } = "";
    }
}
