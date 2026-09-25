namespace Samhallsinformation.Controllers;

using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Monitoring;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

// Larmlistan i Systemhälsa (Felsökning) — V1-9. Larmen skapas av MonitoringService; här läses de
// och kvitteras. Admin-only.
[ApiController]
[Route("api/admin/alerts")]
[Authorize(Roles = "Admin")]
public class AdminAlertsController : ControllerBase
{
    // Hur länge ett löst larm visas kvar ("nyligen lösta").
    private static readonly TimeSpan RecentlyResolvedWindow = TimeSpan.FromDays(7);

    private readonly AppDbContext _db;
    private readonly IEnumerable<IMonitoringRule> _rules;

    public AdminAlertsController(AppDbContext db, IEnumerable<IMonitoringRule> rules)
    {
        _db = db;
        _rules = rules;
    }

    public record AlertDto(
        Guid Id, string RuleId, string Severity, string Title, string Detail,
        DateTime FirstRaisedAt, DateTime LastSeenAt, int OccurrenceCount,
        DateTime? AcknowledgedAt, string? AcknowledgedBy, DateTime? ResolvedAt);

    public record AlertListDto(List<AlertDto> Open, List<AlertDto> RecentlyResolved);

    [HttpGet]
    public async Task<IActionResult> GetAlerts()
    {
        var sedan = DateTime.UtcNow - RecentlyResolvedWindow;
        var alerts = await _db.AdminAlerts
            .AsNoTracking()
            .Where(a => a.ResolvedAt == null || a.ResolvedAt >= sedan)
            .ToListAsync();

        var open = alerts
            .Where(a => a.ResolvedAt == null)
            .OrderBy(a => AlertSeverity.Rank(a.Severity)).ThenByDescending(a => a.FirstRaisedAt)
            .Select(ToDto).ToList();
        var resolved = alerts
            .Where(a => a.ResolvedAt != null)
            .OrderByDescending(a => a.ResolvedAt)
            .Select(ToDto).ToList();

        return Ok(new AlertListDto(open, resolved));
    }

    [HttpPost("{id:guid}/acknowledge")]
    public async Task<IActionResult> Acknowledge(Guid id)
    {
        var alert = await _db.AdminAlerts.FirstOrDefaultAsync(a => a.Id == id);
        if (alert is null) return NotFound();

        // Idempotent: en redan kvitterad rad behåller sin första kvittering.
        if (alert.AcknowledgedAt is null)
        {
            alert.AcknowledgedAt = DateTime.UtcNow;
            alert.AcknowledgedBy = User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Email) ?? "Okänd";
        }

        // Ett "larmar en gång"-larm (t.ex. användartröskeln) är en milstolpe: kvitteringen stänger det.
        if (alert.ResolvedAt is null && _rules.Any(r => r.RuleId == alert.RuleId && r.OneShot))
            alert.ResolvedAt = alert.AcknowledgedAt;

        await _db.SaveChangesAsync();
        return Ok(ToDto(alert));
    }

    private static AlertDto ToDto(AdminAlert a) => new(
        a.Id, a.RuleId, a.Severity, a.Title, a.Detail,
        a.FirstRaisedAt, a.LastSeenAt, a.OccurrenceCount,
        a.AcknowledgedAt, a.AcknowledgedBy, a.ResolvedAt);
}
