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
    // User.PushEnabled (den globala muten, oberoende av källfiltret).
    public static async Task DispatchNewEventsAsync(
        AppDbContext db, IPushNotificationService push, string frontendUrl,
        int sourceId, int insertedCount, CancellationToken ct = default)
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
            .Where(u => subscribedUserIds.Contains(u.Id) && u.PushEnabled)
            .Select(u => u.Id)
            .ToListAsync(ct);

        if (recipientIds.Count == 0) return;

        var devices = await db.UserDevices
            .Where(d => recipientIds.Contains(d.UserId))
            .ToListAsync(ct);

        if (devices.Count == 0) return;

        var title = "Samhällsinformation";
        var body  = insertedCount == 1
            ? $"1 ny händelse från {source.Name}"
            : $"{insertedCount} nya händelser från {source.Name}";
        var url = $"{frontendUrl.TrimEnd('/')}/?shortName={Uri.EscapeDataString(source.ShortName)}";

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
