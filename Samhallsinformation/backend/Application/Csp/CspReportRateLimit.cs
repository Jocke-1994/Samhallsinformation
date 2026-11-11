namespace Samhallsinformation.Application.Csp;

using System.Threading.RateLimiting;
using Samhallsinformation.Application.RateLimiting;

/// <summary>
/// Rate limit-policy för <c>POST /api/csp-report</c> (V3-22): 30 rapporter/minut per klient-IP.
/// En riktig besökare skickar en handfull rapporter per sidladdning (dubbletter per direktiv+källa);
/// taket finns för att en anonym endpoint inte ska kunna översvämmas. Partitionen är per IP
/// (IPv6 normaliserat till /64 via <see cref="ClientIpPartition"/>).
/// </summary>
public static class CspReportRateLimit
{
    public const string PolicyName = "csp-report";
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
