namespace Samhallsinformation.Application.Monitoring;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

/// <summary>
/// En utvärderingscykel för övervakningen (V1-9): kör alla regler, skapar/uppdaterar/löser larm i
/// AdminAlerts och mejlar admins om NYA (eller återöppnade) larm. Utbruten från MonitoringService
/// så en hel cykel kan köras direkt i test med en given klocka (samma tanke som
/// IngestorBackgroundService.IngestAsync).
///
/// Regler:
///  - Ett undantag i EN regel loggas och hoppar över just den regeln; dess larm rörs inte (ett fel i
///    utvärderingen får aldrig tolkas som "problemet är borta" och lösa larmet).
///  - Dedupe: en rad per nyckel. Ett öppet larm får bara LastSeenAt/antal uppdaterat — inget nytt
///    mejl. Ett löst larm som återkommer öppnas igen (kvittering nollställs) och mejlas på nytt.
///  - Mejl: EN samlad utskick per admin och cykel (om många källor faller samtidigt, t.ex. när hela
///    ingestorn står still, blir det inte ett mejl per källa). NotifiedAt sätts först när minst ett
///    mejl gick iväg; annars försöker nästa cykel igen. Ett mejlfel stoppar aldrig cykeln.
/// </summary>
public class AdminAlertCycle
{
    private readonly AppDbContext _db;
    private readonly IEnumerable<IMonitoringRule> _rules;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;
    private readonly ILogger<AdminAlertCycle> _logger;

    public AdminAlertCycle(
        AppDbContext db,
        IEnumerable<IMonitoringRule> rules,
        IEmailService email,
        IConfiguration config,
        ILogger<AdminAlertCycle> logger)
    {
        _db = db;
        _rules = rules;
        _email = email;
        _config = config;
        _logger = logger;
    }

    public async Task RunAsync(DateTime nowUtc, CancellationToken ct = default)
    {
        foreach (var rule in _rules)
        {
            try
            {
                var candidates = await rule.EvaluateAsync(_db, nowUtc, ct);
                await ApplyAsync(rule, candidates, nowUtc, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // Rensa ev. halvfärdiga ändringar så nästa regel inte råkar spara dem.
                _db.ChangeTracker.Clear();
                _logger.LogError(ex, "Övervakningsregeln {RuleId} misslyckades — hoppar över den denna cykel", rule.RuleId);
            }
        }

        await NotifyPendingAsync(ct);
    }

    private async Task ApplyAsync(IMonitoringRule rule, IReadOnlyList<AlertCandidate> candidates, DateTime now, CancellationToken ct)
    {
        var existing = await _db.AdminAlerts.Where(a => a.RuleId == rule.RuleId).ToListAsync(ct);
        var byKey = existing.ToDictionary(a => a.Key);
        var activeKeys = new HashSet<string>();

        foreach (var c in candidates)
        {
            if (!activeKeys.Add(c.Key)) continue; // en regel som returnerar samma nyckel två gånger räknas en gång

            if (!byKey.TryGetValue(c.Key, out var alert))
            {
                _db.AdminAlerts.Add(new AdminAlert
                {
                    RuleId = rule.RuleId, Key = c.Key, Severity = c.Severity, Title = c.Title, Detail = c.Detail,
                    FirstRaisedAt = now, LastSeenAt = now, OccurrenceCount = 1,
                });
                continue;
            }

            if (rule.OneShot) continue; // larmar en gång: raden rörs aldrig mer

            if (alert.ResolvedAt != null)
            {
                // Problemet är tillbaka efter att ha lösts: öppna samma rad på nytt.
                alert.ResolvedAt      = null;
                alert.AcknowledgedAt  = null;
                alert.AcknowledgedBy  = null;
                alert.NotifiedAt      = null;
                alert.FirstRaisedAt   = now;
                alert.OccurrenceCount = 1;
            }
            else
            {
                alert.OccurrenceCount++;
            }

            alert.Severity   = c.Severity;
            alert.Title      = c.Title;
            alert.Detail     = c.Detail;
            alert.LastSeenAt = now;
        }

        if (!rule.OneShot)
        {
            foreach (var alert in existing.Where(a => a.ResolvedAt == null && !activeKeys.Contains(a.Key)))
                alert.ResolvedAt = now;
        }

        await _db.SaveChangesAsync(ct);
    }

    private async Task NotifyPendingAsync(CancellationToken ct)
    {
        List<AdminAlert> pending;
        List<(string Email, string Name)> admins;
        try
        {
            pending = await _db.AdminAlerts
                .Where(a => a.NotifiedAt == null && a.ResolvedAt == null && a.AcknowledgedAt == null)
                .ToListAsync(ct);
            if (pending.Count == 0) return;

            admins = await GetAdminRecipientsAsync(ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kunde inte förbereda larmmejl — försöker igen nästa cykel");
            return;
        }

        if (admins.Count == 0)
        {
            _logger.LogWarning("{Count} obevakade larm men inga aktiva Admin-konton att mejla", pending.Count);
            return;
        }

        var items = pending
            .OrderBy(a => AlertSeverity.Rank(a.Severity)).ThenBy(a => a.FirstRaisedAt)
            .Select(a => new AdminAlertMailItem(a.Severity, a.Title, a.Detail, a.FirstRaisedAt))
            .ToList();
        var adminUrl = (_config["FRONTEND_URL"] ?? "https://samhallsinformation.se").TrimEnd('/') + "/admin";

        var lyckades = false;
        foreach (var (email, name) in admins)
        {
            try
            {
                await _email.SendAdminAlertsAsync(email, name, items, adminUrl);
                lyckades = true;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Larmmejlet kunde inte skickas till en admin");
            }
        }

        if (!lyckades) return;

        var nu = DateTime.UtcNow;
        foreach (var a in pending) a.NotifiedAt = nu;
        try { await _db.SaveChangesAsync(ct); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Kunde inte markera larm som mejlade");
        }
    }

    // Alla aktiva, icke-raderade Admin-konton, med normaliserad e-post, utan dubbletter.
    private async Task<List<(string Email, string Name)>> GetAdminRecipientsAsync(CancellationToken ct)
    {
        var users = await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == "Admin" && u.IsActive && u.DeletedAt == null)
            .Select(u => new { u.Email, u.Name })
            .ToListAsync(ct);

        return users
            .Select(u => (Email: EmailNormalizer.Normalize(u.Email), u.Name))
            .Where(u => u.Email.Contains('@'))
            .DistinctBy(u => u.Email)
            .ToList();
    }
}
