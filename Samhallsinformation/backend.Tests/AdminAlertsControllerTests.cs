namespace Samhallsinformation.Tests;

using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Samhallsinformation.Application.Monitoring;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

// V1-9: GET /api/admin/alerts och POST /api/admin/alerts/{id}/acknowledge.
public class AdminAlertsControllerTests
{
    private static readonly DateTime Nu = DateTime.UtcNow;

    private static AdminAlertsController NewController(AppDbContext db, string namn = "Anna Admin") =>
        new(db, new IMonitoringRule[] { new UsersThresholdRule(new MonitoringOptions()), new SourceFailingRule(new MonitoringOptions()) })
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim("name", namn), new Claim(ClaimTypes.Role, "Admin"),
                    }, "TestAuth")),
                },
            },
        };

    private static AdminAlert Larm(string ruleId, string key, DateTime? resolved = null, string severity = AlertSeverity.Warning) =>
        new() { RuleId = ruleId, Key = key, Severity = severity, Title = key, Detail = "d", FirstRaisedAt = Nu.AddHours(-1), LastSeenAt = Nu, ResolvedAt = resolved };

    // ── Auktorisering ─────────────────────────────────────────────────────────

    [Fact]
    public void Controller_IsAdminOnly_NoAnonymousEscapeHatches()
    {
        var authorize = typeof(AdminAlertsController).GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(authorize);
        Assert.Equal("Admin", authorize!.Roles); // Support och anonyma nekas av rollkravet

        Assert.Null(typeof(AdminAlertsController).GetCustomAttribute<AllowAnonymousAttribute>());
        foreach (var m in typeof(AdminAlertsController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            Assert.Null(m.GetCustomAttribute<AllowAnonymousAttribute>());
    }

    [Fact]
    public async Task AdminOnlyPolicy_DeniesSupportAndAnonymous_AllowsAdmin()
    {
        // Kör rollkravet i den riktiga auktoriseringsmotorn (samma [Authorize(Roles)] som controllern har).
        var authorize = typeof(AdminAlertsController).GetCustomAttribute<AuthorizeAttribute>()!;
        var policy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .RequireRole(authorize.Roles!.Split(','))
            .Build();

        static ClaimsPrincipal Med(string? role) => new(role is null
            ? new ClaimsIdentity()
            : new ClaimsIdentity(new[] { new Claim(ClaimTypes.Role, role) }, "TestAuth"));

        using var provider = new ServiceCollection().AddLogging().AddAuthorization().BuildServiceProvider();
        var authz = provider.GetRequiredService<IAuthorizationService>();

        Assert.True((await authz.AuthorizeAsync(Med("Admin"), null, policy)).Succeeded);
        Assert.False((await authz.AuthorizeAsync(Med("Support"), null, policy)).Succeeded);
        Assert.False((await authz.AuthorizeAsync(Med("Användare"), null, policy)).Succeeded);
        Assert.False((await authz.AuthorizeAsync(Med(null), null, policy)).Succeeded);
    }

    // ── GET ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetAlerts_ReturnsOpenAlertsSortedBySeverity_AndRecentlyResolvedOnly()
    {
        using var db = TestDb.Create();
        db.AdminAlerts.AddRange(
            Larm("push_failures", "push_failures", severity: AlertSeverity.Warning),
            Larm("source_failing", "source_failing:1", severity: AlertSeverity.Critical),
            Larm("source_failing", "source_failing:2", resolved: Nu.AddDays(-1)),   // nyligen löst
            Larm("source_failing", "source_failing:3", resolved: Nu.AddDays(-30))); // för gammalt
        await db.SaveChangesAsync();

        var ok = Assert.IsType<OkObjectResult>(await NewController(db).GetAlerts());
        var dto = Assert.IsType<AdminAlertsController.AlertListDto>(ok.Value);

        Assert.Equal(new[] { "source_failing:1", "push_failures" }, dto.Open.Select(a => a.Title));
        Assert.Equal(new[] { "source_failing:2" }, dto.RecentlyResolved.Select(a => a.Title));
    }

    [Fact]
    public async Task GetAlerts_NoAlerts_ReturnsEmptyLists()
    {
        using var db = TestDb.Create();

        var ok = Assert.IsType<OkObjectResult>(await NewController(db).GetAlerts());
        var dto = Assert.IsType<AdminAlertsController.AlertListDto>(ok.Value);

        Assert.Empty(dto.Open);
        Assert.Empty(dto.RecentlyResolved);
    }

    // ── Kvittering ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Acknowledge_SetsAcknowledgedAtAndBy_AndKeepsAlertOpen()
    {
        using var db = TestDb.Create();
        var alert = Larm("source_failing", "source_failing:1");
        db.AdminAlerts.Add(alert);
        await db.SaveChangesAsync();

        var ok = Assert.IsType<OkObjectResult>(await NewController(db, "Anna Admin").Acknowledge(alert.Id));
        var dto = Assert.IsType<AdminAlertsController.AlertDto>(ok.Value);

        Assert.NotNull(dto.AcknowledgedAt);
        Assert.Equal("Anna Admin", dto.AcknowledgedBy);
        Assert.Null(dto.ResolvedAt); // problemet består — kvittering löser det inte
        var saved = await TestDb.CreateSecondContext(db).AdminAlerts.FindAsync(alert.Id);
        Assert.Equal("Anna Admin", saved!.AcknowledgedBy);
    }

    [Fact]
    public async Task Acknowledge_IsIdempotent_FirstAcknowledgementWins()
    {
        using var db = TestDb.Create();
        var alert = Larm("source_failing", "source_failing:1");
        db.AdminAlerts.Add(alert);
        await db.SaveChangesAsync();

        await NewController(db, "Första").Acknowledge(alert.Id);
        var ok = Assert.IsType<OkObjectResult>(await NewController(db, "Andra").Acknowledge(alert.Id));

        Assert.Equal("Första", Assert.IsType<AdminAlertsController.AlertDto>(ok.Value).AcknowledgedBy);
    }

    [Fact]
    public async Task Acknowledge_OneShotAlert_ClosesIt()
    {
        using var db = TestDb.Create();
        var alert = Larm("users_threshold", "users_threshold");
        db.AdminAlerts.Add(alert);
        await db.SaveChangesAsync();

        var ok = Assert.IsType<OkObjectResult>(await NewController(db).Acknowledge(alert.Id));

        Assert.NotNull(Assert.IsType<AdminAlertsController.AlertDto>(ok.Value).ResolvedAt);
    }

    [Fact]
    public async Task Acknowledge_UnknownId_Returns404()
    {
        using var db = TestDb.Create();

        Assert.IsType<NotFoundResult>(await NewController(db).Acknowledge(Guid.NewGuid()));
    }
}
