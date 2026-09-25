namespace Samhallsinformation.Application.Monitoring;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

/// <summary>
/// Hög andel misslyckade push-utskick. NotificationDeliveryLog.Status är "sent" | "failed" | "expired"
/// (PushDispatcher). "expired" (410/404 — webbläsaren har glömt prenumerationen) är normal städning och
/// räknas inte som fel; felandel = failed / (sent + failed) senaste fönstret. Kräver ett minsta antal
/// försök så ett enstaka fel (eller avstängd push, som i produktion idag) inte ger falsklarm.
/// </summary>
public sealed class PushFailuresRule : IMonitoringRule
{
    public const string Id = "push_failures";

    private readonly MonitoringOptions _options;
    public PushFailuresRule(MonitoringOptions options) => _options = options;

    public string RuleId => Id;
    public bool OneShot => false;

    public async Task<IReadOnlyList<AlertCandidate>> EvaluateAsync(AppDbContext db, DateTime nowUtc, CancellationToken ct)
    {
        var sedan = nowUtc.AddHours(-_options.PushWindowHours);
        var status = await db.NotificationDeliveryLogs
            .AsNoTracking()
            .Where(l => l.Channel == "push" && l.SentAt >= sedan && (l.Status == "sent" || l.Status == "failed"))
            .Select(l => l.Status)
            .ToListAsync(ct);

        var försök = status.Count;
        if (försök < _options.PushMinAttempts) return [];

        var fel = status.Count(s => s == "failed");
        var andel = (double)fel / försök;
        if (andel < _options.PushFailureShare) return [];

        return
        [
            new AlertCandidate(
                Id,
                AlertSeverity.Warning,
                "Många push-utskick misslyckas",
                $"{fel} av {försök} push-utskick misslyckades de senaste {_options.PushWindowHours} timmarna " +
                $"({(int)Math.Round(andel * 100)} %).")
        ];
    }
}
