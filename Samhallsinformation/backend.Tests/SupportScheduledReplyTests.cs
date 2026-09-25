namespace Samhallsinformation.Tests;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Support;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

// E3 #2 + E4 #8: schemalagda supportsvar mejlades aldrig (bara Reply gjorde det) och
// AddScheduledAction saknade all validering.
public class SupportScheduledReplyTests
{
    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<(LogLevel Level, string Message, Exception? Exception)> Entries { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception), exception));
    }

    private static int _nextTicketNumber;

    private static AppDbContext NewDb() => new(
        new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private sealed class Rig
    {
        public required AppDbContext Db { get; init; }
        public required IEmailService Email { get; init; }
        public required IAktivitetsloggService Logg { get; init; }
        public required CapturingLogger<SupportReplyDelivery> DeliveryLog { get; init; }
        public required SupportReplyDelivery Delivery { get; init; }
        public required User Agent { get; init; }
    }

    private static Rig NewRig()
    {
        var db = NewDb();
        var email = Substitute.For<IEmailService>();
        var logg = Substitute.For<IAktivitetsloggService>();
        var log = new CapturingLogger<SupportReplyDelivery>();
        var agent = new User { Name = "Joakim Rehn", Email = $"{Guid.NewGuid()}@example.com", PasswordHash = "x", Role = "Admin" };
        db.Users.Add(agent);
        db.SaveChanges();
        return new Rig { Db = db, Email = email, Logg = logg, DeliveryLog = log, Delivery = new SupportReplyDelivery(db, logg, email, log), Agent = agent };
    }

    private static SupportTicket AddTicket(Rig rig, string? contactEmail = "medborgare@example.com", string status = "Öppet", User? createdBy = null)
    {
        var ticket = new SupportTicket
        {
            Subject = "Testärende", Category = "Tekniskt fel", Channel = "arendehantering",
            ContactEmail = contactEmail, Status = status, InboundAddress = "info@samhallsinformation.se",
            CreatedByUserId = createdBy?.Id, TicketNumber = ++_nextTicketNumber,
        };
        rig.Db.SupportTickets.Add(ticket);
        rig.Db.SaveChanges();
        return ticket;
    }

    private static SupportTicketScheduledAction AddDue(Rig rig, SupportTicket ticket, string type = "svar", string text = "Hej, här är svaret")
    {
        var action = new SupportTicketScheduledAction
        {
            TicketId = ticket.Id, Type = type, ScheduledAt = DateTime.UtcNow.AddMinutes(-1),
            CreatedByUserId = rig.Agent.Id, Text = text,
        };
        rig.Db.SupportTicketScheduledActions.Add(action);
        rig.Db.SaveChanges();
        return action;
    }

    private static Task RunAsync(Rig rig, ILogger? logger = null) =>
        SupportScheduledActionService.ExecuteDueActionsAsync(rig.Db, rig.Delivery, logger ?? new CapturingLogger<SupportScheduledActionService>());

    private static AdminSupportController NewController(Rig rig) =>
        new(rig.Db, rig.Logg, rig.Delivery)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim(ClaimTypes.NameIdentifier, rig.Agent.Id.ToString())], "test")),
                },
            },
        };

    // ---------------------------------------------------------------- Leverans (E3 #2)

    [Fact]
    public async Task ScheduledSvar_WithContactEmail_SendsMailExactlyOnce()
    {
        using var rig = NewRigDisposable(out var r);
        var ticket = AddTicket(r);
        AddDue(r, ticket, text: "Tack för ditt ärende");

        await RunAsync(r);
        await RunAsync(r); // omkörning får inte mejla igen

        await r.Email.Received(1).SendTicketReplyAsync(
            "medborgare@example.com", ticket.TicketNumber, "Testärende", "Tack för ditt ärende", "info@samhallsinformation.se");
        var msg = Assert.Single(r.Db.SupportTicketMessages);
        Assert.Equal("agent", msg.SenderType);
        Assert.False(msg.IsInternal);
        Assert.True(r.Db.SupportTicketScheduledActions.Single().Executed);
    }

    [Fact]
    public async Task ScheduledSvar_TicketWithoutAddress_SavesMessageSendsNoMailAndDoesNotThrow()
    {
        using var rig = NewRigDisposable(out var r);
        var ticket = AddTicket(r, contactEmail: null);
        AddDue(r, ticket);

        await RunAsync(r);

        await r.Email.DidNotReceiveWithAnyArgs().SendTicketReplyAsync(default!, default, default!, default!, default);
        Assert.Single(r.Db.SupportTicketMessages);
        Assert.True(r.Db.SupportTicketScheduledActions.Single().Executed);
    }

    [Fact]
    public async Task ScheduledSvar_TicketWithoutContactEmailButWithAccount_MailsTheAccountAddress()
    {
        using var rig = NewRigDisposable(out var r);
        var citizen = new User { Name = "Medborgare", Email = "konto@example.com", PasswordHash = "x", Role = "User" };
        r.Db.Users.Add(citizen);
        r.Db.SaveChanges();
        var ticket = AddTicket(r, contactEmail: null, createdBy: citizen);
        AddDue(r, ticket);

        await RunAsync(r);

        await r.Email.Received(1).SendTicketReplyAsync("konto@example.com", ticket.TicketNumber, "Testärende", "Hej, här är svaret", "info@samhallsinformation.se");
    }

    [Fact]
    public async Task ScheduledSvar_EmailFails_ActionStillExecutedErrorLoggedAndNoDuplicateOnRetry()
    {
        using var rig = NewRigDisposable(out var r);
        r.Email.SendTicketReplyAsync(default!, default, default!, default!, default)
            .ReturnsForAnyArgs(Task.FromException(new InvalidOperationException("Resend nere")));
        var ticket = AddTicket(r);
        AddDue(r, ticket);

        await RunAsync(r); // får inte kasta
        await RunAsync(r); // nästa minut — ska inte försöka igen

        Assert.True(r.Db.SupportTicketScheduledActions.Single().Executed);
        Assert.Single(r.Db.SupportTicketMessages);
        await r.Email.ReceivedWithAnyArgs(1).SendTicketReplyAsync(default!, default, default!, default!, default);
        Assert.Contains(r.DeliveryLog.Entries, e => e.Level == LogLevel.Error && e.Exception is InvalidOperationException);
    }

    [Fact]
    public async Task ScheduledIntern_NeverSendsMail()
    {
        using var rig = NewRigDisposable(out var r);
        var ticket = AddTicket(r);
        AddDue(r, ticket, type: "intern", text: "Intern notering");

        await RunAsync(r);

        await r.Email.DidNotReceiveWithAnyArgs().SendTicketReplyAsync(default!, default, default!, default!, default);
        Assert.True(Assert.Single(r.Db.SupportTicketMessages).IsInternal);
    }

    [Fact]
    public async Task ScheduledSvar_LogsActivityAsSystem()
    {
        using var rig = NewRigDisposable(out var r);
        var ticket = AddTicket(r);
        AddDue(r, ticket);

        await RunAsync(r);

        await r.Logg.Received(1).LogAsync(
            AktörTyper.System, LoggTyper.Ärende, Arg.Is<string>(s => s.Contains("Testärende")),
            Arg.Is<string>(s => s.Contains("Schemalagt svar")), null, null, false, ticket.Id);
    }

    [Fact]
    public async Task OneBrokenAction_DoesNotStopTheNextOne()
    {
        using var db = NewDb();
        var agent = new User { Name = "A", Email = "a@example.com", PasswordHash = "x", Role = "Admin" };
        db.Users.Add(agent);
        var t1 = new SupportTicket { Subject = "Första", Category = "x", Channel = "arendehantering" };
        var t2 = new SupportTicket { Subject = "Andra", Category = "x", Channel = "arendehantering" };
        db.SupportTickets.AddRange(t1, t2);
        db.SupportTicketScheduledActions.AddRange(
            new SupportTicketScheduledAction { TicketId = t1.Id, Type = "svar", ScheduledAt = DateTime.UtcNow.AddMinutes(-2), CreatedByUserId = agent.Id, Text = "1" },
            new SupportTicketScheduledAction { TicketId = t2.Id, Type = "svar", ScheduledAt = DateTime.UtcNow.AddMinutes(-1), CreatedByUserId = agent.Id, Text = "2" });
        db.SaveChanges();

        var delivery = Substitute.For<ISupportReplyDelivery>();
        delivery.DeliverAsync(Arg.Is<SupportReplyDeliveryRequest>(r => r.Text == "1"), Arg.Any<Action?>(), Arg.Any<CancellationToken>())
            .Throws(new InvalidOperationException("kaputt"));
        var log = new CapturingLogger<SupportScheduledActionService>();

        await SupportScheduledActionService.ExecuteDueActionsAsync(db, delivery, log);

        await delivery.Received(1).DeliverAsync(Arg.Is<SupportReplyDeliveryRequest>(r => r.Text == "2"), Arg.Any<Action?>(), Arg.Any<CancellationToken>());
        Assert.Contains(log.Entries, e => e.Level == LogLevel.Error);
    }

    // ---------------------------------------------------------------- Reply och schemalagt delar logik

    [Fact]
    public async Task Reply_And_ScheduledSvar_ProduceTheSameMessageAndMail()
    {
        using var rig = NewRigDisposable(out var r);
        var viaReply = AddTicket(r);
        var viaSchedule = AddTicket(r);
        AddDue(r, viaSchedule, text: "Samma text");

        var result = await NewController(r).Reply(viaReply.Id, new AgentReplyRequest("Samma text", false));
        await RunAsync(r);

        Assert.IsType<OkResult>(result);
        var a = r.Db.SupportTicketMessages.Single(m => m.TicketId == viaReply.Id);
        var b = r.Db.SupportTicketMessages.Single(m => m.TicketId == viaSchedule.Id);
        Assert.Equal((a.SenderType, a.IsInternal, a.Text, a.AuthorUserId), (b.SenderType, b.IsInternal, b.Text, b.AuthorUserId));
        await r.Email.Received(1).SendTicketReplyAsync("medborgare@example.com", viaReply.TicketNumber, "Testärende", "Samma text", "info@samhallsinformation.se");
        await r.Email.Received(1).SendTicketReplyAsync("medborgare@example.com", viaSchedule.TicketNumber, "Testärende", "Samma text", "info@samhallsinformation.se");
    }

    [Fact]
    public async Task Reply_EmailFails_StillReturnsOkAndKeepsMessage()
    {
        using var rig = NewRigDisposable(out var r);
        r.Email.SendTicketReplyAsync(default!, default, default!, default!, default)
            .ReturnsForAnyArgs(Task.FromException(new InvalidOperationException("Resend nere")));
        var ticket = AddTicket(r);

        var result = await NewController(r).Reply(ticket.Id, new AgentReplyRequest("Svar", false));

        Assert.IsType<OkResult>(result);
        Assert.Single(r.Db.SupportTicketMessages);
        Assert.Contains(r.DeliveryLog.Entries, e => e.Level == LogLevel.Error);
    }

    [Fact]
    public async Task Reply_InternalNote_SendsNoMail()
    {
        using var rig = NewRigDisposable(out var r);
        var ticket = AddTicket(r);

        await NewController(r).Reply(ticket.Id, new AgentReplyRequest("Bara internt", true));

        await r.Email.DidNotReceiveWithAnyArgs().SendTicketReplyAsync(default!, default, default!, default!, default);
        Assert.True(Assert.Single(r.Db.SupportTicketMessages).IsInternal);
    }

    // ---------------------------------------------------------------- Validering (E4 #8)

    private static AddScheduledActionRequest Valid(
        string type = "svar", DateTime? at = null, string? text = "Ett svar", Guid? reassign = null, string? instruction = null) =>
        new(type, at ?? DateTime.UtcNow.AddHours(1), text, reassign, instruction);

    private static async Task<string> AssertBadAsync(Rig r, Guid ticketId, AddScheduledActionRequest req, string fragment)
    {
        var result = await NewController(r).AddScheduledAction(ticketId, req);
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        var msg = Assert.IsType<string>(bad.Value);
        Assert.Contains(fragment, msg);
        Assert.Empty(r.Db.SupportTicketScheduledActions);
        return msg;
    }

    [Fact]
    public async Task AddScheduledAction_UnknownType_Returns400()
    {
        using var rig = NewRigDisposable(out var r);
        var t = AddTicket(r);
        await AssertBadAsync(r, t.Id, Valid(type: "radera"), "Okänd åtgärdstyp");
    }

    [Fact]
    public async Task AddScheduledAction_InThePast_Returns400()
    {
        using var rig = NewRigDisposable(out var r);
        var t = AddTicket(r);
        await AssertBadAsync(r, t.Id, Valid(at: DateTime.UtcNow.AddMinutes(-5)), "framtiden");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task AddScheduledAction_SvarWithEmptyText_Returns400(string? text)
    {
        using var rig = NewRigDisposable(out var r);
        var t = AddTicket(r);
        await AssertBadAsync(r, t.Id, Valid(text: text), "inte vara tom");
    }

    [Fact]
    public async Task AddScheduledAction_SvarOver5000Chars_Returns400()
    {
        using var rig = NewRigDisposable(out var r);
        var t = AddTicket(r);
        await AssertBadAsync(r, t.Id, Valid(text: new string('a', 5001)), "5000");
    }

    [Fact]
    public async Task AddScheduledAction_UnknownTicket_Returns400()
    {
        using var rig = NewRigDisposable(out var r);
        await AssertBadAsync(r, Guid.NewGuid(), Valid(), "finns inte");
    }

    [Theory]
    [InlineData("Hanterat")]
    [InlineData("Stängt")]
    public async Task AddScheduledAction_ClosedTicket_Returns400(string status)
    {
        using var rig = NewRigDisposable(out var r);
        var t = AddTicket(r, status: status);
        await AssertBadAsync(r, t.Id, Valid(), "avslutat");
    }

    [Fact]
    public async Task AddScheduledAction_TilldelaWithoutOrUnknownAgent_Returns400()
    {
        using var rig = NewRigDisposable(out var r);
        var t = AddTicket(r);
        await AssertBadAsync(r, t.Id, Valid(type: "tilldela", text: null, reassign: null), "tilldelas");
        await AssertBadAsync(r, t.Id, Valid(type: "tilldela", text: null, reassign: Guid.NewGuid()), "handläggaren");
    }

    [Theory]
    [InlineData("svar")]
    [InlineData("intern")]
    public async Task AddScheduledAction_Valid_Returns200AndStoresUtcAction(string type)
    {
        using var rig = NewRigDisposable(out var r);
        var t = AddTicket(r, status: "Under behandling");

        var result = await NewController(r).AddScheduledAction(t.Id, Valid(type: type, text: new string('a', 5000)));

        Assert.IsType<OkObjectResult>(result);
        var stored = Assert.Single(r.Db.SupportTicketScheduledActions);
        Assert.Equal(type, stored.Type);
        Assert.Equal(DateTimeKind.Utc, stored.ScheduledAt.Kind);
    }

    [Fact]
    public async Task AddScheduledAction_ValidTilldela_Returns200()
    {
        using var rig = NewRigDisposable(out var r);
        var t = AddTicket(r);
        var res = await NewController(r).AddScheduledAction(t.Id, Valid(type: "tilldela", text: null, reassign: r.Agent.Id));
        Assert.IsType<OkObjectResult>(res);
    }

    [Fact]
    public async Task AddScheduledAction_UnspecifiedAndLocalKinds_AreNormalizedToUtc()
    {
        using var rig = NewRigDisposable(out var r);
        var t = AddTicket(r);
        var unspecified = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(2), DateTimeKind.Unspecified);
        var local = DateTime.UtcNow.AddHours(3).ToLocalTime();

        await NewController(r).AddScheduledAction(t.Id, Valid(at: unspecified));
        await NewController(r).AddScheduledAction(t.Id, Valid(at: local));

        var stored = r.Db.SupportTicketScheduledActions.OrderBy(a => a.ScheduledAt).ToList();
        Assert.All(stored, a => Assert.Equal(DateTimeKind.Utc, a.ScheduledAt.Kind));
        Assert.InRange((stored[1].ScheduledAt - DateTime.UtcNow).TotalHours, 2.9, 3.1);
    }

    [Fact]
    public async Task AddScheduledAction_LocalTimeInThePastEvenIfLooksFuture_IsRejected()
    {
        // Unspecified tolkas som UTC: en "framtida" lokal klocktid som i UTC redan passerat ska avvisas.
        using var rig = NewRigDisposable(out var r);
        var t = AddTicket(r);
        var pastUnspecified = DateTime.SpecifyKind(DateTime.UtcNow.AddMinutes(-1), DateTimeKind.Unspecified);
        await AssertBadAsync(r, t.Id, Valid(at: pastUnspecified), "framtiden");
    }

    private static IDisposable NewRigDisposable(out Rig rig)
    {
        rig = NewRig();
        return rig.Db;
    }
}
