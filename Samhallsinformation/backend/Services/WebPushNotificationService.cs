namespace Samhallsinformation.Services;

using System.Text.Json;
using Samhallsinformation.Models;
using WebPush;

public class WebPushNotificationService : IPushNotificationService, IDisposable
{
    private readonly WebPushClient _client = new();
    private readonly VapidDetails  _vapidDetails;

    public WebPushNotificationService(IConfiguration configuration)
    {
        var subject    = configuration["VAPID_SUBJECT"]     ?? "mailto:noreply@samhallsinformation.se";
        var publicKey  = configuration["VAPID_PUBLIC_KEY"]  ?? throw new InvalidOperationException("VAPID_PUBLIC_KEY saknas");
        var privateKey = configuration["VAPID_PRIVATE_KEY"] ?? throw new InvalidOperationException("VAPID_PRIVATE_KEY saknas");

        _vapidDetails = new VapidDetails(subject, publicKey, privateKey);
    }

    public Task SendAsync(UserDevice device, string title, string body, string? url, CancellationToken ct = default)
    {
        var subscription = new PushSubscription(device.Endpoint, device.P256dh, device.Auth);
        var payload = JsonSerializer.Serialize(new { title, body, url });
        return _client.SendNotificationAsync(subscription, payload, _vapidDetails, ct);
    }

    public void Dispose() => _client.Dispose();
}
