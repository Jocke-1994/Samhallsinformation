namespace Samhallsinformation.Services;

using Samhallsinformation.Models;

public interface IPushNotificationService
{
    // Kastar WebPush.WebPushException vid leveransfel — anroparen ansvarar för
    // att tolka statuskoden (t.ex. 404/410 = subskriptionen är död).
    // claimId: om satt, skickas med i payloaden så service workern kan fråga
    // /api/push/claim innan den visar notisen — bara den enhet som claimar
    // FÖRST visar den, se PushDispatchClaim.
    Task SendAsync(UserDevice device, string title, string body, string? url, Guid? claimId = null, CancellationToken ct = default);
}
