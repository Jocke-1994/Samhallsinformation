namespace Samhallsinformation.Application.Monitoring;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

/// <summary>
/// Antal registrerade (icke-raderade) användare ≥ tröskel (default 500) → påminnelse om att stämma av
/// alt C. Larmar EN gång (<see cref="OneShot"/>): kvitteringen stänger milstolpen.
/// </summary>
public sealed class UsersThresholdRule : IMonitoringRule
{
    public const string Id = "users_threshold";

    private readonly MonitoringOptions _options;
    public UsersThresholdRule(MonitoringOptions options) => _options = options;

    public string RuleId => Id;
    public bool OneShot => true;

    public async Task<IReadOnlyList<AlertCandidate>> EvaluateAsync(AppDbContext db, DateTime nowUtc, CancellationToken ct)
    {
        var antal = await db.Users.CountAsync(u => u.DeletedAt == null, ct);
        if (antal < _options.UsersThreshold) return [];

        return
        [
            new AlertCandidate(
                Id,
                AlertSeverity.Warning,
                $"{_options.UsersThreshold} registrerade användare nådda",
                $"Stäm av alt C — refresh-token i httpOnly-cookie (Obsidian: Beslut - Alt C refresh-token i cookie). " +
                $"Just nu {antal} registrerade användare (tröskel {_options.UsersThreshold}).")
        ];
    }
}
