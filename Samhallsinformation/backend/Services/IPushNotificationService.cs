namespace Samhallsinformation.Services;

using Samhallsinformation.Models;

public interface IPushNotificationService
{
    // Kastar WebPush.WebPushException vid leveransfel — anroparen ansvarar för
    // att tolka statuskoden (t.ex. 404/410 = subskriptionen är död).
    Task SendAsync(UserDevice device, string title, string body, string? url, CancellationToken ct = default);
}
