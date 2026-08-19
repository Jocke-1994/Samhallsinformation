namespace Samhallsinformation.Services;

using System.Net;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using WebPush;

public static class PushDispatcher
{
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

        var subscribedUserIds = await db.UserSourcePreferences
            .Where(p => p.SourceId == sourceId && p.IsActive)
            .Select(p => p.UserId)
            .ToListAsync(ct);

        if (subscribedUserIds.Count == 0) return;

        var recipientIds = await db.Users
            .Where(u => subscribedUserIds.Contains(u.Id) && u.PushNyaHandelser)
            .Select(u => u.Id)
            .ToListAsync(ct);

        if (recipientIds.Count == 0) return;

        // Polisen-mottagare filtreras dessutom mot varje användares egna
        // bevakningar (PolisenBevakningMatcher) — en delad batchtext funkar
        // inte längre här eftersom olika mottagare kan matcha olika
        // delmängder av samma insatta händelser. Övriga källor oförändrade.
        if (source.ShortName == "Polisen")
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
        var adminIds = await db.Users
            .Where(u => (u.Role == "Admin" || u.Role == "Support") && u.PushEnabled)
            .Select(u => u.Id)
            .ToListAsync(ct);

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

    // Notifierar alla Admin/Support-användare när ett NYTT konto skapas
    // (lösenord eller Google, spelar ingen roll) — samma mottagarmönster som
    // DispatchNewTicketAsync ovan.
    public static async Task DispatchNewUserAsync(
        AppDbContext db, IPushNotificationService push, string frontendUrl,
        User newUser, CancellationToken ct = default)
    {
        var adminIds = await db.Users
            .Where(u => (u.Role == "Admin" || u.Role == "Support") && u.PushEnabled)
            .Select(u => u.Id)
            .ToListAsync(ct);

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
        var recipientIds = await db.Users
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
        foreach (var device in devices)
        {
            var log = new NotificationDeliveryLog
            {
                UserId    = device.UserId,
                SourceId  = sourceId,
                Channel   = "push",
                Recipient = device.Endpoint,
                Subject   = title,
                Body      = body,
            };

            try
            {
                await push.SendAsync(device, title, body, url, ct);
                log.Status = "sent";
            }
            catch (WebPushException ex) when (ex.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
            {
                // Subskriptionen är död (webbläsaren har glömt den) — städa bort enheten.
                log.Status = "expired";
                log.ErrorMessage = ex.Message;
                db.UserDevices.Remove(device);
            }
            catch (Exception ex)
            {
                log.Status = "failed";
                log.ErrorMessage = ex.Message.Length > 500 ? ex.Message[..500] : ex.Message;
            }

            db.NotificationDeliveryLogs.Add(log);
        }

        await db.SaveChangesAsync(ct);
    }
}
