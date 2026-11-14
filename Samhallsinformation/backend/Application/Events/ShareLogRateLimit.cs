namespace Samhallsinformation.Application.Events;

using System.Threading.RateLimiting;
using Samhallsinformation.Application.RateLimiting;

/// <summary>
/// Rate limit-policy för <c>POST /api/events/{id}/share</c>: 20 anrop/minut per klient-IP.
/// Endpointen är anonym (delning ska fungera utloggad) och skriver en rad i EventShareLogs
/// per anrop, så utan tak kan vem som helst fylla tabellen och förstöra delningsstatistiken.
/// En riktig läsare klickar Dela några gånger per besök. Frontend (logEventShare) sväljer
/// alla fel tyst, så ett 429 stör aldrig själva delningen.
/// Partitionen är per IP (IPv6 normaliserat till /64 via <see cref="ClientIpPartition"/>).
/// </summary>
public static class ShareLogRateLimit
{
    public const string PolicyName = "share-log";
    public const int PermitLimit = 20;
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
