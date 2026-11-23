namespace Samhallsinformation.Application.Push;

using System.Threading.RateLimiting;
using Samhallsinformation.Application.RateLimiting;

/// <summary>
/// Rate limit-policy för <c>POST /api/push/claim</c>: 60 anrop/minut per klient-IP.
/// Endpointen är anonym (service workern har inte pålitligt en färsk JWT) och gör upp till
/// tre databasfrågor per anrop, så utan tak kan vem som helst belasta databasen gratis.
/// En riktig enhet anropar en gång per notis; även ett hushåll med flera enheter bakom samma
/// IP under en stor händelse ligger långt under taket. sw.js är fail-open: ett 429 visar
/// notisen ändå, så taket kan i värsta fall ge en dubblettnotis, aldrig en förlorad.
/// Partitionen är per IP (IPv6 normaliserat till /64 via <see cref="ClientIpPartition"/>).
/// </summary>
public static class PushClaimRateLimit
{
    public const string PolicyName = "push-claim";
    public const int PermitLimit = 60;
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
