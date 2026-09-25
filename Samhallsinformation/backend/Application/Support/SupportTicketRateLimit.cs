namespace Samhallsinformation.Application.Support;

using System.Security.Claims;
using System.Threading.RateLimiting;

/// <summary>
/// Rate limit-policy för <c>POST /api/support/tickets</c>. Endpointen är öppen
/// för anonyma och triggar push till alla admins per ärende (E1 #8).
/// Inloggade räknas per användar-id (så en delad IP — kontor, mobiloperatörs-NAT —
/// inte stryper legitima användare), anonyma per IP. Anonymt tak är 10/tim och
/// inte 5: kundtjänstboten anropar från EN server-IP, så 5 vore för snävt för
/// legitima överlämningar till människa.
/// </summary>
public static class SupportTicketRateLimit
{
    public const string PolicyName = "support-ticket";
    public const int AnonymousPermitLimit     = 10;
    public const int AuthenticatedPermitLimit = 20;
    public static readonly TimeSpan Window = TimeSpan.FromHours(1);

    public static RateLimitPartition<string> GetPartition(HttpContext httpContext)
    {
        var userId = httpContext.User.Identity?.IsAuthenticated == true
            ? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
            : null;

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: userId != null
                ? $"user:{userId}"
                : $"ip:{httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown"}",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = userId != null ? AuthenticatedPermitLimit : AnonymousPermitLimit,
                Window      = Window,
                QueueLimit  = 0,
            });
    }
}
