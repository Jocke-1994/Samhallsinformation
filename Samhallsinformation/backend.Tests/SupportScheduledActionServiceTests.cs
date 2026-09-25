namespace Samhallsinformation.Tests;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Support;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

public class SupportScheduledActionServiceTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static Task RunAsync(AppDbContext db)
    {
        var delivery = new SupportReplyDelivery(
            db, Substitute.For<IAktivitetsloggService>(), Substitute.For<IEmailService>(), NullLogger<SupportReplyDelivery>.Instance);
        return SupportScheduledActionService.ExecuteDueActionsAsync(db, delivery, NullLogger.Instance);
    }

    private static (User agent, SupportTicket ticket) SeedTicket(AppDbContext db)
    {
        var agent = new User { Name = "Joakim Rehn", Email = $"{Guid.NewGuid()}@example.com", PasswordHash = "x", Role = "Admin" };
        db.Users.Add(agent);
        var ticket = new SupportTicket { Subject = "Testärende", Category = "Tekniskt fel", Channel = "arendehantering" };
        db.SupportTickets.Add(ticket);
        db.SaveChanges();
        return (agent, ticket);
    }

    [Fact]
    public async Task ExecuteDueActionsAsync_SvarType_PostsPublicMessage()
    {
        using var db = NewDb();
        var (agent, ticket) = SeedTicket(db);
        db.SupportTicketScheduledActions.Add(new SupportTicketScheduledAction
        {
            TicketId = ticket.Id, Type = "svar", ScheduledAt = DateTime.UtcNow.AddMinutes(-1),
            CreatedByUserId = agent.Id, Text = "Ett automatiskt svar",
        });
        await db.SaveChangesAsync();

        await RunAsync(db);

        var message = Assert.Single(db.SupportTicketMessages);
        Assert.False(message.IsInternal);
        Assert.Equal("Ett automatiskt svar", message.Text);
        Assert.True(db.SupportTicketScheduledActions.Single().Executed);
    }

    [Fact]
    public async Task ExecuteDueActionsAsync_InternType_PostsInternalMessage()
    {
        using var db = NewDb();
        var (agent, ticket) = SeedTicket(db);
        db.SupportTicketScheduledActions.Add(new SupportTicketScheduledAction
        {
            TicketId = ticket.Id, Type = "intern", ScheduledAt = DateTime.UtcNow.AddMinutes(-1),
            CreatedByUserId = agent.Id, Text = "Intern notering",
        });
        await db.SaveChangesAsync();

        await RunAsync(db);

        var message = Assert.Single(db.SupportTicketMessages);
        Assert.True(message.IsInternal);
    }

    [Fact]
    public async Task ExecuteDueActionsAsync_TilldelaType_ReassignsAndLogsInternalNote()
    {
        using var db = NewDb();
        var (agent, ticket) = SeedTicket(db);
        var nyAgent = new User { Name = "Ny Agent", Email = $"{Guid.NewGuid()}@example.com", PasswordHash = "x", Role = "Admin" };
        db.Users.Add(nyAgent);
        db.SupportTicketScheduledActions.Add(new SupportTicketScheduledAction
        {
            TicketId = ticket.Id, Type = "tilldela", ScheduledAt = DateTime.UtcNow.AddMinutes(-1),
            CreatedByUserId = agent.Id, ReassignToUserId = nyAgent.Id, Instruction = "Ta över den här",
        });
        await db.SaveChangesAsync();

        await RunAsync(db);

        Assert.Equal(nyAgent.Id, db.SupportTickets.Single().AssignedToUserId);
        var message = Assert.Single(db.SupportTicketMessages);
        Assert.True(message.IsInternal);
        Assert.Contains("Ta över den här", message.Text);
    }

    [Fact]
    public async Task ExecuteDueActionsAsync_NotYetDue_IsSkipped()
    {
        using var db = NewDb();
        var (agent, ticket) = SeedTicket(db);
        db.SupportTicketScheduledActions.Add(new SupportTicketScheduledAction
        {
            TicketId = ticket.Id, Type = "svar", ScheduledAt = DateTime.UtcNow.AddHours(1),
            CreatedByUserId = agent.Id, Text = "Inte än",
        });
        await db.SaveChangesAsync();

        await RunAsync(db);

        Assert.Empty(db.SupportTicketMessages);
        Assert.False(db.SupportTicketScheduledActions.Single().Executed);
    }

    [Fact]
    public async Task ExecuteDueActionsAsync_AlreadyExecuted_IsSkipped()
    {
        using var db = NewDb();
        var (agent, ticket) = SeedTicket(db);
        db.SupportTicketScheduledActions.Add(new SupportTicketScheduledAction
        {
            TicketId = ticket.Id, Type = "svar", ScheduledAt = DateTime.UtcNow.AddMinutes(-1),
            CreatedByUserId = agent.Id, Text = "Redan gjort", Executed = true, ExecutedAt = DateTime.UtcNow.AddSeconds(-30),
        });
        await db.SaveChangesAsync();

        await RunAsync(db);

        Assert.Empty(db.SupportTicketMessages);
    }
}
