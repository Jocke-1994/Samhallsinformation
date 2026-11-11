namespace Samhallsinformation.Application.Feed;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

// Serverbaserat Mitt flöde/Sparat (V3-11, beslut D2). Ersätter klientens
// filtrering över de 50 senaste händelserna från alla källor - som gav tom
// eller ofullständig lista för sällsynta källor och snäva Polisen-bevakningar.
//
// Synlighetsregel (samma som EventsController och PushDispatcher): en händelse
// syns bara om dess källa är Source.IsPublished. Mitt flöde kräver dessutom
// UserSourcePreference.IsActive för källan (= vad push matchar mot).
//
// Polisen: händelser från källor med ShortName "Polisen" matchas mot användarens
// bevakningar med PolisenBevakningMatcher.Explain - den läns-medvetna varianten
// som redan avgör "visas i Mitt flöde" i admins ExplainEvent och som speglar
// vad klienten filtrerade på tidigare (sammanfattningar med län som geografi).
// Har användaren inga bevakningar gäller oförändrat beteende: all Polisen syns.
//
// Paginering: källfiltret görs i SQL (exakt total). Bevakningsmatchningen kräver
// minnet (matchern), så när användaren har bevakningar skannas kandidaterna
// (icke-Polisen + Polisen från de senaste PolisenFonsterDagar dagarna) i
// sorterad ordning, BatchStorlek rader i taget, tills sidan (+ en rad för
// "finns fler?") är full eller kandidaterna tagit slut. Bara ett smalt urval
// kolumner hämtas under skanningen; hela händelserna hämtas först för sidans id:n.
// Konsekvenser: (1) total är exakt bara när skanningen nådde slutet
// (TotalExakt=true), annars en nedre gräns - HasMore är det auktoritativa;
// (2) Polisen-händelser äldre än fönstret matchas inte i bevakningsläget;
// (3) sida N skannar om från början (kostnad ~ N * pageSize / träffandel).
public class UserFeedService : IUserFeedService
{
    public const string PolisenShortName = "Polisen";
    public const int PolisenFonsterDagar = 30;
    public const int BatchStorlek = 200;

    private readonly AppDbContext _db;
    private readonly TimeProvider _time;

    public UserFeedService(AppDbContext db, TimeProvider time)
    {
        _db = db;
        _time = time;
    }

    public async Task<FeedPage> GetMittFlodeAsync(Guid userId, int page, int pageSize, CancellationToken ct = default)
    {
        (page, pageSize) = Normalisera(page, pageSize);

        var kallor = await _db.UserSourcePreferences
            .Where(p => p.UserId == userId && p.IsActive && p.Source.IsPublished)
            .Select(p => new { p.SourceId, p.Source.ShortName })
            .ToListAsync(ct);

        if (kallor.Count == 0)
            return new FeedPage(0, page, pageSize, [], false, true);

        var polisenIds = kallor.Where(k => k.ShortName == PolisenShortName).Select(k => k.SourceId).ToList();
        var andraIds = kallor.Where(k => k.ShortName != PolisenShortName).Select(k => k.SourceId).ToList();

        var bevakningar = polisenIds.Count == 0
            ? new List<PolisenBevakning>()
            : await _db.PolisenBevakningar.Where(b => b.UserId == userId).ToListAsync(ct);

        if (bevakningar.Count == 0)
        {
            // Ingen matchning i minnet behövs: ren SQL, exakt total.
            var allaIds = kallor.Select(k => k.SourceId).ToList();
            return await SidaFranSqlAsync(_db.Events.Where(e => allaIds.Contains(e.SourceId)), page, pageSize, ct);
        }

        return await SkannaMedBevakningarAsync(andraIds, polisenIds, bevakningar, page, pageSize, ct);
    }

    public Task<FeedPage> GetSparatAsync(Guid userId, int page, int pageSize, CancellationToken ct = default)
    {
        (page, pageSize) = Normalisera(page, pageSize);

        var query =
            from s in _db.UserSavedEvents
            where s.UserId == userId
            join e in _db.Events on s.EventId equals e.Id
            where _db.Sources.Any(src => src.Id == e.SourceId && src.IsPublished)
            select e;

        return SidaFranSqlAsync(query, page, pageSize, ct);
    }

    private static (int page, int pageSize) Normalisera(int page, int pageSize) =>
        (Math.Max(page, 1), Math.Clamp(pageSize, 1, 100));

    // Samma sortering som EventsController (nyast först) plus Id som
    // tie-breaker, så att händelser med identisk tid aldrig hamnar på två sidor.
    private static async Task<FeedPage> SidaFranSqlAsync(IQueryable<CanonicalEvent> query, int page, int pageSize, CancellationToken ct)
    {
        var total = await query.CountAsync(ct);
        var events = await query
            .AsNoTracking()
            .OrderByDescending(e => e.PublishedAt).ThenBy(e => e.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new FeedPage(total, page, pageSize, events, page * pageSize < total, true);
    }

    private async Task<FeedPage> SkannaMedBevakningarAsync(
        List<int> andraIds, List<int> polisenIds, List<PolisenBevakning> bevakningar,
        int page, int pageSize, CancellationToken ct)
    {
        var fonster = _time.GetUtcNow().UtcDateTime.AddDays(-PolisenFonsterDagar);
        var polisenSet = polisenIds.ToHashSet();

        var kandidater = _db.Events
            .Where(e => andraIds.Contains(e.SourceId) || (polisenIds.Contains(e.SourceId) && e.PublishedAt >= fonster))
            .OrderByDescending(e => e.PublishedAt).ThenBy(e => e.Id)
            .Select(e => new { e.Id, e.SourceId, e.EventType, e.Geography });

        var skip = (page - 1) * pageSize;
        var behov = skip + pageSize + 1; // +1 = lookahead för "finns fler sidor?"
        var traffar = new List<Guid>();
        var slut = false;
        var offset = 0;

        while (traffar.Count < behov)
        {
            var batch = await kandidater.Skip(offset).Take(BatchStorlek).ToListAsync(ct);
            offset += batch.Count;

            foreach (var rad in batch)
            {
                if (polisenSet.Contains(rad.SourceId))
                {
                    var ev = new CanonicalEvent { EventType = rad.EventType, Geography = rad.Geography };
                    if (!PolisenBevakningMatcher.Explain(ev, bevakningar).Matchar) continue;
                }
                traffar.Add(rad.Id);
            }

            if (batch.Count < BatchStorlek) { slut = true; break; }
        }

        var sidaIds = traffar.Skip(skip).Take(pageSize).ToList();
        var handelser = await _db.Events.AsNoTracking()
            .Where(e => sidaIds.Contains(e.Id))
            .ToListAsync(ct);
        var perId = handelser.ToDictionary(e => e.Id);
        var sida = sidaIds.Where(perId.ContainsKey).Select(id => perId[id]).ToList();

        return new FeedPage(traffar.Count, page, pageSize, sida, traffar.Count > skip + pageSize, slut);
    }
}
