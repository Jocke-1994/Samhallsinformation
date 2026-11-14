namespace Samhallsinformation.Application.Events;

using System.Threading.RateLimiting;
using Samhallsinformation.Application.RateLimiting;

/// <summary>
/// Rate limit-policy för <c>GET /api/events/{id}/link-status</c>: 30 anrop/minut per klient-IP.
/// Endpointen är anonym (utloggade läsare ska också få länkkollen) och varje anrop gör en
/// utgående hämtning mot källans sida, så utan tak kan vem som helst få servern att hämta
/// externa sidor i hög takt. En riktig läsare kollar en länk per klick på "Läs mer hos källan".
/// Ett 429 tolkas av frontend som "unknown", så taket kan aldrig ge en felaktig varning.
/// Partitionen är per IP (IPv6 normaliserat till /64 via <see cref="ClientIpPartition"/>).
/// </summary>
public static class LinkStatusRateLimit
{
    public const string PolicyName = "link-status";
    public const int PermitLimit = 30;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    public static RateLimitPartition<string> GetPartition(HttpContext httpContext) =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ClientIpPartition.KeyFor(httpContext.Connection.RemoteIpAddress),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = PermitLimit,
                Window = Window,
                QueueLimit = 0,
            });
}
