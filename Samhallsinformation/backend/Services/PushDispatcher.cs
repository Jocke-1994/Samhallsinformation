namespace Samhallsinformation.Services;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

public static class PushDispatcher
{
    // PolisenRssIngestor.Source.Id (fast, kollisionsskyddat av IngestorSourceSeeder).
    // "Polisen Efterlysningar" (seedad i DatabaseBootstrapper) delar medvetet
    // ShortName "Polisen" för sidomenygruppering men är en helt annan källa med
    // ett annat Id — och saknar EventType/Geography (fritextrubriker, ingen
    // strukturerad extraktion). PolisenBevakningMatcher.Matches tolkar null som
    // "matchar allt", så att gate:a på ShortName här (som tidigare) skulle låta
    // VILKEN bevakning som helst "matcha" en Efterlysning och ge en missvisande
    // push-text som påstår att den matchade en specifik bevakning. Gate:a på
    // Id så bara den riktiga händelsekällan går via bevaknings-matchningen —
    // Efterlysningar (och ev. framtida "Polisen"-ShortName-källor) går via den
    // vanliga generiska batch-pushen istället, precis som alla andra källor.
    private const int PolisenHandelserSourceId = 1;


    // EN gemensam grundfilter för ALLA mottagarvägar (nya händelser, ny version,
    // nytt ärende, ärendesvar, ny användare) — en framtida dispatch-väg ska börja
    // härifrån istället för db.Users, annars glöms filtret. Ett konto får bara
    // push om det är aktivt och varken spärrat, GDPR-raderat eller schemalagt för
    // radering. (SuspendedAt/DeletionScheduledAt sätts alltid tillsammans med
    // IsActive=false idag — kontrolleras ändå så en framtida väg som bara sätter
    // tidsstämpeln inte råkar pusha ett konto som är på väg bort.)
    private static IQueryable<User> PushEligibleUsers(AppDbContext db) =>
        db.Users.Where(u => u.IsActive
                         && u.DeletedAt == null
                         && u.SuspendedAt == null
                         && u.DeletionScheduledAt == null);

    // Admin-/supportnotiser (nytt ärende, ärendesvar, ny användare) går bara till
    // aktiva Admin/Support-konton som inte tystat sin globala push (PushEnabled).
    private static Task<List<Guid>> GetStaffRecipientIdsAsync(AppDbContext db, CancellationToken ct) =>
        PushEligibleUsers(db)
            .Where(u => (u.Role == "Admin" || u.Role == "Support") && u.PushEnabled)
            .Select(u => u.Id)
            .ToListAsync(ct);

    // En batchad push per källa per ingestor-körning, aldrig en per enskild
    // händelse — beslutad princip från push-scopingen (session 25/26).
    // Mottagare = UserSourcePreference.IsActive för källan (= Mitt flöde) OCH
    // User.PushNyaHandelser (kategorin "Ny händelse" i Konto → Push-notiser).
    public static async Task DispatchNewEventsAsync(
        AppDbContext db, IPushNotificationService push, string frontendUrl,
        int sourceId, int insertedCount, List<CanonicalEvent> insertedEvents, CancellationToken ct = default)
    {
        if (insertedCount <= 0) return;

        var source = await db.Sources.FindAsync([sourceId], ct);
        if (source == null) return;

        // Samma regel som EventsController (IsPublished) — sandlåde-/avpublicerade
        // källor ska inte ge push även om användare har dem i sina preferenser.
        if (!source.IsPublished) return;

        var subscribedUserIds = await db.UserSourcePreferences
            .Where(p => p.SourceId == sourceId && p.IsActive)
            .Select(p => p.UserId)
            .ToListAsync(ct);

        if (subscribedUserIds.Count == 0) return;

        var recipientIds = await PushEligibleUsers(db)
            .Where(u => subscribedUserIds.Contains(u.Id) && u.PushNyaHandelser)
            .Select(u => u.Id)
            .ToListAsync(ct);

        if (recipientIds.Count == 0) return;

        // Polisen-mottagare filtreras dessutom mot varje användares egna
        // bevakningar (PolisenBevakningMatcher) — en delad batchtext funkar
        // inte längre här eftersom olika mottagare kan matcha olika
        // delmängder av samma insatta händelser. Övriga källor oförändrade.
        if (source.Id == PolisenHandelserSourceId)
        {
            await DispatchPolisenEventsAsync(db, push, frontendUrl, source, recipientIds, insertedEvents, ct);
            return;
        }

        var devices = await db.UserDevices
            .Where(d => recipientIds.Contains(d.UserId))
            .ToListAsync(ct);

        if (devices.Count == 0) return;

        var title = "Samhällsinformation";
        var body  = insertedCount == 1
            ? $"1 ny händelse från {source.Name}"
            : $"{insertedCount} nya händelser från {source.Name}";
        var url = $"{frontendUrl.TrimEnd('/')}/?shortName={Uri.EscapeDataString(source.ShortName)}";

        await SendToDevicesAsync(db, push, devices, title, body, url, sourceId, ct);
    }

    private static async Task DispatchPolisenEventsAsync(
        AppDbContext db, IPushNotificationService push, string frontendUrl,
        Source source, List<Guid> recipientIds, List<CanonicalEvent> insertedEvents, CancellationToken ct)
    {
        // Sammanfattningar pushas aldrig (se PolisenBevakningMatcher.ArSammanfattning)
        // — syns fortfarande i Mitt flöde om en bevakning matchar, den filtreringen
        // rör bara frontend och är oberoende av det här.
        insertedEvents = insertedEvents.Where(ev => !PolisenBevakningMatcher.ArSammanfattning(ev.EventType)).ToList();
        if (insertedEvents.Count == 0) return;

        var bevakningarByUser = (await db.PolisenBevakningar
                .Where(b => recipientIds.Contains(b.UserId))
                .ToListAsync(ct))
            .GroupBy(b => b.UserId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var devicesByUser = (await db.UserDevices
                .Where(d => recipientIds.Contains(d.UserId))
                .ToListAsync(ct))
            .GroupBy(d => d.UserId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var url = $"{frontendUrl.TrimEnd('/')}/?shortName={Uri.EscapeDataString(source.ShortName)}";

        foreach (var userId in recipientIds)
        {
            if (!devicesByUser.TryGetValue(userId, out var devices) || devices.Count == 0) continue;

            var bevakningar = bevakningarByUser.TryGetValue(userId, out var b) ? b : [];
            var matchande = insertedEvents.Where(ev => PolisenBevakningMatcher.Matches(ev, bevakningar)).ToList();
            if (matchande.Count == 0) continue;

            var title = "Samhällsinformation";
            string body;
            if (matchande.Count == 1)
            {
                var typ = PolisenBevakningMatcher.ExtractTyp(matchande[0].EventType) ?? "Ny händelse";
                body = matchande[0].Geography != null
                    ? $"{typ} i {matchande[0].Geography} (Polisen)"
                    : $"{typ} (Polisen)";
            }
            else
            {
                body = $"{matchande.Count} nya händelser matchar dina bevakningar";
            }

            await SendToDevicesAsync(db, push, devices, title, body, url, source.Id, ct);
        }
    }

    // Notifierar alla Admin-användare när ETT NYTT supportärende/feedback-inskick
    // skapas (oavsett kanal — båda är lika viktiga att veta om direkt). Kompletterar
    // DispatchNewEventsAsync ovan, som bara rör källhändelser.
    public static async Task DispatchNewTicketAsync(
        AppDbContext db, IPushNotificationService push, string frontendUrl,
        SupportTicket ticket, CancellationToken ct = default)
    {
        var adminIds = await GetStaffRecipientIdsAsync(db, ct);

        if (adminIds.Count == 0) return;

        var devices = await db.UserDevices
            .Where(d => adminIds.Contains(d.UserId))
            .ToListAsync(ct);

        if (devices.Count == 0) return;

        var kanalNamn = ticket.Channel == "feedback" ? "Ny feedback" : "Nytt supportärende";
        var title = kanalNamn;
        var body  = ticket.Subject;
        var url   = $"{frontendUrl.TrimEnd('/')}/admin";

        await SendToDevicesAsync(db, push, devices, title, body, url, sourceId: null, ct);
    }

    // Notifierar alla Admin/Support-användare när en medborgare svarar på ett
    // BEFINTLIGT ärende — via inloggat konto (SupportController.Reply) eller
    // Resend inbound-mejl (WebhooksController.ResendInbound). Saknades helt
    // innan; bara nya ärenden/konton triggade push. Ett agentsvar (utgående,
    // AdminSupportController.Reply) triggar INTE detta — admin vet redan att
    // de själva svarade.
    public static async Task DispatchTicketReplyAsync(
        AppDbContext db, IPushNotificationService push, string frontendUrl,
        SupportTicket ticket, CancellationToken ct = default)
    {
        var adminIds = await GetStaffRecipientIdsAsync(db, ct);

        if (adminIds.Count == 0) return;

        var devices = await db.UserDevices
            .Where(d => adminIds.Contains(d.UserId))
            .ToListAsync(ct);

        if (devices.Count == 0) return;

        var title = "Nytt svar på ärende";
        var body  = $"SUP-{ticket.TicketNumber:D4} — {ticket.Subject}";
        var url   = $"{frontendUrl.TrimEnd('/')}/admin";

        await SendToDevicesAsync(db, push, devices, title, body, url, sourceId: null, ct);
    }

    // Notifierar alla Admin/Support-användare när ett NYTT konto skapas
    // (lösenord eller Google, spelar ingen roll) — samma mottagarmönster som
    // DispatchNewTicketAsync ovan.
    public static async Task DispatchNewUserAsync(
        AppDbContext db, IPushNotificationService push, string frontendUrl,
        User newUser, CancellationToken ct = default)
    {
        var adminIds = await GetStaffRecipientIdsAsync(db, ct);

        if (adminIds.Count == 0) return;

        var devices = await db.UserDevices
            .Where(d => adminIds.Contains(d.UserId))
            .ToListAsync(ct);

        if (devices.Count == 0) return;

        var title = "Ny användare";
        var body  = $"{newUser.Name} ({newUser.Email}) skapade ett konto";
        var url   = $"{frontendUrl.TrimEnd('/')}/admin";

        await SendToDevicesAsync(db, push, devices, title, body, url, sourceId: null, ct);
    }

    // Admin-triggad, fristående utskick för "Ny version"-kategorin — se
    // PushController.SendNewVersionNotice. Mottagare = User.PushNyVersion,
    // oberoende av källfilter (alla som opt:at in på kategorin, oavsett vilka
    // källor de följer). Returnerar antal enheter det skickades till.
    public static async Task<int> DispatchNewVersionAsync(
        AppDbContext db, IPushNotificationService push, string frontendUrl,
        string version, string message, CancellationToken ct = default)
    {
        var recipientIds = await PushEligibleUsers(db)
            .Where(u => u.PushNyVersion)
            .Select(u => u.Id)
            .ToListAsync(ct);

        if (recipientIds.Count == 0) return 0;

        var devices = await db.UserDevices
            .Where(d => recipientIds.Contains(d.UserId))
            .ToListAsync(ct);

        if (devices.Count == 0) return 0;

        var title = $"Ny version: {version}";
        var url   = $"{frontendUrl.TrimEnd('/')}/profil?section=uppdateringar";

        await SendToDevicesAsync(db, push, devices, title, message, url, sourceId: null, ct);
        return devices.Count;
    }

    private static async Task SendToDevicesAsync(
        AppDbContext db, IPushNotificationService push, List<UserDevice> devices,
        string title, string body, string url, int? sourceId, CancellationToken ct)
    {
        // Ett PushDispatchClaim per MOTTAGARE (inte ett delat för hela
        // anropet — devices kan spänna över flera användare, t.ex. alla
        // admins) — så en användares egna enheter kapplöper om att visa
        // notisen, utan att påverka någon annan användares kapplöpning.
        //
        // Claim-raderna sparas INNAN första utskicket (E3#4): en enhet som får sin
        // push inom några hundra ms anropar /api/push/claim direkt, och då måste
        // raden redan finnas i databasen — annars kan ingen dedupe ske.
        var claimByUser = devices
            .Select(d => d.UserId).Distinct()
            .ToDictionary(userId => userId, userId => new PushDispatchClaim { UserId = userId });
        db.PushDispatchClaims.AddRange(claimByUser.Values);
        await db.SaveChangesAsync(ct);

        // Parallellt med begränsad grad + timeout per enhet (E3#11). Fan-out rör
        // inte db — loggning och städning sker här, på en tråd, efteråt.
        var items = devices.Select(d => new PushSendItem(d, claimByUser[d.UserId].Id)).ToList();
        var results = await PushFanOut.SendAsync(push, items, title, body, url, PushFanOutOptions.Default, ct);

        foreach (var r in results)
        {
            db.NotificationDeliveryLogs.Add(new NotificationDeliveryLog
            {
                UserId       = r.Device.UserId,
                SourceId     = sourceId,
                Channel      = "push",
                Recipient    = r.Device.Endpoint,
                Subject      = title,
                Body         = body,
                Status       = r.Status,
                ErrorMessage = r.ErrorMessage,
            });

            // Död subskription — städa bort enheten.
            if (r.Status == "expired") db.UserDevices.Remove(r.Device);
        }

        await db.SaveChangesAsync(ct);
    }
}
