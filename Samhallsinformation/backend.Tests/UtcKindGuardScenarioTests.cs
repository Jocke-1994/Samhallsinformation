namespace Samhallsinformation.Tests;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Support;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Xunit;

/// <summary>
/// V3-6 (E2 #4, E4 #2): kör centrala skriv-/frågescenarier genom <see cref="DateTimeKindGuard"/> på
/// SQLite. Vakten fäller testet om något kommando skickar en DateTime-parameter med Kind != Utc —
/// exakt det Npgsql vägrar mot timestamptz (500 i produktion, grönt lokalt).
/// </summary>
public class UtcKindGuardScenarioTests
{
    // Kind=Unspecified — så binder ASP.NET/JSON ett datum utan "Z" (t.ex. "2026-09-01").
    private static DateTime Unspec(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Unspecified);

    private static ControllerContext AsUser(Guid id) => new()
    {
        HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id.ToString())], "TestAuth")),
        },
    };

    // ---- Vakten själv ----

    [Fact]
    public async Task Guard_CatchesUnspecifiedParameter_SoItIsNotSilentlyIneffective()
    {
        var guard = new DateTimeKindGuard { ThrowOnViolation = false };
        using var db = TestDb.Create(guard);

        await db.Database.ExecuteSqlRawAsync("SELECT 1 WHERE {0} IS NOT NULL", Unspec(new DateTime(2026, 9, 1)));

        Assert.NotEmpty(guard.Violations);
        Assert.Throws<InvalidOperationException>(() => guard.AssertNoViolations());
    }

    [Fact]
    public async Task Guard_AcceptsUtcParameter()
    {
        var guard = new DateTimeKindGuard();
        using var db = TestDb.Create(guard);

        await db.Database.ExecuteSqlRawAsync("SELECT 1 WHERE {0} IS NOT NULL", new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc));

        Assert.Empty(guard.Violations);
        Assert.True(guard.InspectedDateTimeParameters > 0);
    }

    // ---- Skrivning direkt mot EF (converterns skyddsnät) ----

    [Fact]
    public async Task Save_EntityWithUnspecifiedAndLocalDateTimes_WritesUtc()
    {
        var guard = new DateTimeKindGuard();
        using var db = TestDb.Create(guard);
        var unspec = Unspec(new DateTime(2026, 9, 1, 10, 0, 0));
        var local  = new DateTime(2026, 9, 2, 10, 0, 0, DateTimeKind.Local);
        db.SupportTickets.Add(new SupportTicket { TicketNumber = 1, Subject = "A", ReminderAt = unspec });
        db.SupportTickets.Add(new SupportTicket { TicketNumber = 2, Subject = "B", ReminderAt = local });

        await db.SaveChangesAsync();

        guard.AssertNoViolations();
        Assert.True(guard.InspectedDateTimeParameters > 0);
        using var db2 = TestDb.CreateSecondContext(db);
        var lästa = await db2.SupportTickets.OrderBy(t => t.Subject).ToListAsync();
        Assert.Equal(unspec.Ticks, lästa[0].ReminderAt!.Value.Ticks);
        Assert.Equal(local.ToUniversalTime().Ticks, lästa[1].ReminderAt!.Value.Ticks);
        Assert.All(lästa, t => Assert.Equal(DateTimeKind.Utc, t.ReminderAt!.Value.Kind));
    }

    [Fact]
    public async Task Query_ComparedAgainstUnspecifiedParameter_SendsUtcParameter()
    {
        var guard = new DateTimeKindGuard();
        using var db = TestDb.Create(guard);
        var gräns = Unspec(new DateTime(2026, 9, 1));

        var n = await db.SupportTickets.CountAsync(t => t.CreatedAt >= gräns);

        guard.AssertNoViolations();
        Assert.True(guard.InspectedDateTimeParameters > 0);
        Assert.Equal(0, n);
    }

    // ---- Controller-scenarier ----

    [Fact]
    public async Task MaintenanceBanner_CreateAndUpdate_WithUnspecifiedStartAndEnd_StoresUtc()
    {
        var guard = new DateTimeKindGuard();
        using var db = TestDb.Create(guard);
        var controller = new MaintenanceBannersController(db, Substitute.For<IAktivitetsloggService>());
        var start = Unspec(new DateTime(2026, 10, 1, 8, 0, 0));
        var slut  = Unspec(new DateTime(2026, 10, 1, 10, 0, 0));

        var created = Assert.IsType<OkObjectResult>(
            await controller.Create(new MaintenanceBannerRequest("Underhåll", start, slut, "Alla")));
        var id = ((dynamic)created.Value!).Id;
        Assert.IsType<OkObjectResult>(
            await controller.Update((Guid)id, new MaintenanceBannerRequest("Underhåll 2", start.AddDays(1), slut.AddDays(1), "Alla")));

        guard.AssertNoViolations();
        Assert.True(guard.InspectedDateTimeParameters > 0);
        using var db2 = TestDb.CreateSecondContext(db);
        var banner = await db2.MaintenanceBanners.SingleAsync();
        Assert.Equal(start.AddDays(1).Ticks, banner.StartUtc.Ticks); // ingen tidsförskjutning
        Assert.Equal(DateTimeKind.Utc, banner.EndUtc.Kind);
    }

    [Fact]
    public async Task SupportScheduledAction_WithUnspecifiedScheduledAt_IsAcceptedAndStoredUtc()
    {
        var guard = new DateTimeKindGuard();
        using var db = TestDb.Create(guard);
        var admin = new User { Email = "admin@test.se", Name = "Admin", Role = "Admin", IsActive = true };
        var ticket = new SupportTicket { Subject = "Hjälp", Status = "Öppet" };
        db.Users.Add(admin);
        db.SupportTickets.Add(ticket);
        await db.SaveChangesAsync();
        var controller = new AdminSupportController(db, Substitute.For<IAktivitetsloggService>(), Substitute.For<ISupportReplyDelivery>())
        {
            ControllerContext = AsUser(admin.Id),
        };
        var när = Unspec(DateTime.UtcNow.AddDays(2));

        var result = await controller.AddScheduledAction(ticket.Id,
            new AddScheduledActionRequest(SupportScheduledActionValidator.Intern, när, "Följ upp", null, null));

        Assert.IsType<OkObjectResult>(result);
        guard.AssertNoViolations();
        Assert.True(guard.InspectedDateTimeParameters > 0);
        using var db2 = TestDb.CreateSecondContext(db);
        Assert.Equal(DateTimeKind.Utc, (await db2.SupportTicketScheduledActions.SingleAsync()).ScheduledAt.Kind);
    }

    [Fact]
    public async Task SupportSetReminder_WithUnspecifiedReminderAt_StoresUtc()
    {
        var guard = new DateTimeKindGuard();
        using var db = TestDb.Create(guard);
        var ticket = new SupportTicket { Subject = "Hjälp" };
        db.SupportTickets.Add(ticket);
        await db.SaveChangesAsync();
        var controller = new AdminSupportController(db, Substitute.For<IAktivitetsloggService>(), Substitute.For<ISupportReplyDelivery>())
        {
            ControllerContext = AsUser(Guid.NewGuid()),
        };
        var påminnelse = Unspec(new DateTime(2026, 11, 3, 9, 0, 0));

        await controller.SetReminder(ticket.Id, new SetReminderRequest(påminnelse, "Ring"));

        guard.AssertNoViolations();
        Assert.Equal(påminnelse.Ticks, ticket.ReminderAt!.Value.Ticks);
        Assert.Equal(DateTimeKind.Utc, ticket.ReminderAt!.Value.Kind);
    }

    [Fact]
    public async Task AdminUsers_SetStatusSuspend_WithUnspecifiedReminderAt_StoresUtc()
    {
        var guard = new DateTimeKindGuard();
        using var db = TestDb.Create(guard);
        var admin  = new User { Email = "admin@test.se", Name = "Admin", Role = "Admin", IsActive = true };
        var target = new User { Email = "user@test.se",  Name = "User",  Role = "User",  IsActive = true };
        db.Users.AddRange(admin, target);
        await db.SaveChangesAsync();
        var controller = new AdminUsersController(db, Substitute.For<IAktivitetsloggService>(),
            Substitute.For<Samhallsinformation.Services.IEmailService>(),
            Substitute.For<Samhallsinformation.Application.Auth.IAuthService>(),
            Substitute.For<Microsoft.Extensions.Configuration.IConfiguration>())
        {
            ControllerContext = AsUser(admin.Id),
        };
        var påminnelse = Unspec(new DateTime(2026, 12, 1, 8, 0, 0));

        var result = await controller.SetStatus(target.Id, new SetUserStatusRequest(false, "Test", påminnelse, "Kolla"));

        Assert.IsNotType<BadRequestObjectResult>(result);
        guard.AssertNoViolations();
        using var db2 = TestDb.CreateSecondContext(db);
        var lagrad = (await db2.Users.SingleAsync(u => u.Id == target.Id)).SuspensionReminderAt!.Value;
        Assert.Equal(påminnelse.Ticks, lagrad.Ticks);
        Assert.Equal(DateTimeKind.Utc, lagrad.Kind);
    }

    [Fact]
    public async Task Uppdatering_Create_WithUnspecifiedDatumAndSchedule_StoresUtc()
    {
        var guard = new DateTimeKindGuard();
        using var db = TestDb.Create(guard);
        var controller = new UppdateringarController(db, Substitute.For<IAktivitetsloggService>());
        var datum = Unspec(new DateTime(2026, 9, 25));
        var schema = Unspec(DateTime.UtcNow.AddDays(3));

        var result = await controller.CreateUppdatering(new UppdateringRequest(
            "Version 1", datum, false, [new PunktRequest("ny-funktion", "Allmänt", "Text", "alla")],
            schema, ["kallor_lan_filter"]));

        Assert.IsType<OkObjectResult>(result);
        guard.AssertNoViolations();
        Assert.True(guard.InspectedDateTimeParameters > 0);
        using var db2 = TestDb.CreateSecondContext(db);
        var lagrad = await db2.Uppdateringar.SingleAsync();
        Assert.Equal(DateTimeKind.Utc, lagrad.Datum.Kind);
        Assert.Equal(schema.Ticks, lagrad.SchemalagdPubliceringUtc!.Value.Ticks);
    }

    [Fact]
    public async Task AdminActivityLog_GetLog_WithUnspecifiedFrånAndTill_DoesNotFailAndKeepsDayBounds()
    {
        var guard = new DateTimeKindGuard();
        using var db = TestDb.Create(guard);
        db.AdminActivityLogs.Add(new AdminActivityLog { Tid = new DateTime(2026, 8, 31, 23, 0, 0, DateTimeKind.Utc), Rubrik = "före" });
        db.AdminActivityLogs.Add(new AdminActivityLog { Tid = new DateTime(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc), Rubrik = "inom" });
        db.AdminActivityLogs.Add(new AdminActivityLog { Tid = new DateTime(2026, 9, 3, 12, 0, 0, DateTimeKind.Utc), Rubrik = "efter" });
        db.IngestorRunLogs.Add(new IngestorRunLog { SourceId = 1, RunAt = new DateTime(2026, 9, 1, 12, 0, 0, DateTimeKind.Utc), Success = true });
        await db.SaveChangesAsync();
        var controller = new AdminActivityLogController(db);

        // Exakt hur ASP.NET binder "?från=2026-09-01&till=2026-09-02" (Kind=Unspecified).
        var result = await controller.GetLog(
            aktörTyp: null, typ: null, sök: null,
            från: Unspec(new DateTime(2026, 9, 1)), till: Unspec(new DateTime(2026, 9, 2)));

        Assert.IsType<OkObjectResult>(result);
        guard.AssertNoViolations();
        Assert.True(guard.InspectedDateTimeParameters >= 4); // från+till för både admin- och ingestor-frågan
        var json = System.Text.Json.JsonSerializer.Serialize(((OkObjectResult)result).Value);
        Assert.Contains("inom", json);
        Assert.DoesNotContain("före", json);
        Assert.DoesNotContain("efter", json);
    }
}
