namespace Samhallsinformation.Services;

using System.Text.Json;
using Samhallsinformation.Models;
using WebPush;

public class WebPushNotificationService : IPushNotificationService, IDisposable
{
    // Utan en explicit TTL defaultar WebPush-biblioteket till 4 VECKOR
    // (WebPush.WebPushClient.DefaultTtl) — en offline enhet skulle då kunna
    // visa en flera veckor gammal händelse som om den vore ny så fort den
    // kommer online igen. 24h täcker "telefonen var avstängd över natten"
    // utan att riskera gamla, irrelevanta notiser långt senare.
    private const int PushTtlSeconds = 24 * 60 * 60;

    private readonly WebPushClient _client = new();
    private readonly VapidDetails  _vapidDetails;

    public WebPushNotificationService(IConfiguration configuration)
    {
        var subject    = configuration["VAPID_SUBJECT"]     ?? "mailto:noreply@samhallsinformation.se";
        var publicKey  = configuration["VAPID_PUBLIC_KEY"]  ?? throw new InvalidOperationException("VAPID_PUBLIC_KEY saknas");
        var privateKey = configuration["VAPID_PRIVATE_KEY"] ?? throw new InvalidOperationException("VAPID_PRIVATE_KEY saknas");

        _vapidDetails = new VapidDetails(subject, publicKey, privateKey);
    }

    public Task SendAsync(UserDevice device, string title, string body, string? url, Guid? claimId = null, CancellationToken ct = default)
    {
        var subscription = new PushSubscription(device.Endpoint, device.P256dh, device.Auth);
        var payload = JsonSerializer.Serialize(new { title, body, url, claimId, deviceId = device.Id });
        var options = new Dictionary<string, object>
        {
            ["vapidDetails"] = _vapidDetails,
            ["TTL"]          = PushTtlSeconds,
        };
        return _client.SendNotificationAsync(subscription, payload, options, ct);
    }

    public void Dispose() => _client.Dispose();
}
