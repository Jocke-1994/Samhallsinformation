namespace Samhallsinformation.Tests;

using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

public class SupportControllerTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static ClaimsPrincipal Anonymous() => new(new ClaimsIdentity());

    private static ClaimsPrincipal Authenticated(Guid userId) => new(
        new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "TestAuth"));

    private static SupportController NewController(AppDbContext db, ClaimsPrincipal user)
    {
        var push = Substitute.For<IPushNotificationService>();
        var config = Substitute.For<IConfiguration>();
        var aktivitetslogg = Substitute.For<IAktivitetsloggService>();
        return new SupportController(db, push, config, aktivitetslogg)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } },
        };
    }

    [Fact]
    public async Task Create_AnonymousWithoutContactEmail_StillCreatesTicket()
    {
        // E-post är frivilligt — bara nödvändigt om avsändaren vill ha svar,
        // inte ett krav för att skicka in feedback överhuvudtaget.
        using var db = NewDb();
        var controller = NewController(db, Anonymous());

        var result = await controller.Create(new CreateTicketRequest(null, null, "Hej, jag har en fråga", "feedback", null, null));

        Assert.IsType<OkObjectResult>(result);
        var ticket = Assert.Single(db.SupportTickets);
        Assert.Null(ticket.CreatedByUserId);
        Assert.Null(ticket.ContactEmail);
    }

    [Fact]
    public async Task Create_WithoutMessage_ReturnsBadRequest()
    {
        using var db = NewDb();
        var controller = NewController(db, Anonymous());

        var result = await controller.Create(new CreateTicketRequest(null, null, "", "feedback", null, null));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.SupportTickets);
    }

    [Fact]
    public async Task Create_AnonymousWithContactEmail_CreatesTicketWithNoOwner()
    {
        using var db = NewDb();
        var controller = NewController(db, Anonymous());

        var result = await controller.Create(new CreateTicketRequest(null, null, "Feedback-text", "feedback", null, "besokare@example.com"));

        Assert.IsType<OkObjectResult>(result);
        var ticket = Assert.Single(db.SupportTickets);
        Assert.Null(ticket.CreatedByUserId);
        Assert.Equal("besokare@example.com", ticket.ContactEmail);
        Assert.Equal("feedback", ticket.Channel);
        Assert.Equal("Feedback", ticket.Subject);
        var message = Assert.Single(db.SupportTicketMessages);
        Assert.Equal("Feedback-text", message.Text);
        Assert.Null(message.AuthorUserId);
    }

    [Fact]
    public async Task Create_Authenticated_LinksTicketToUserAndUsesAccountContactInfo()
    {
        using var db = NewDb();
        var user = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var controller = NewController(db, Authenticated(user.Id));

        var result = await controller.Create(new CreateTicketRequest("Mitt ärende", "Konto", "Jag behöver hjälp", "arendehantering", null, null));

        Assert.IsType<OkObjectResult>(result);
        var ticket = Assert.Single(db.SupportTickets);
        Assert.Equal(user.Id, ticket.CreatedByUserId);
        Assert.Equal("ada@example.com", ticket.ContactEmail);
        Assert.Equal("Mitt ärende", ticket.Subject);
    }

    [Fact]
    public async Task GetMyTickets_OnlyReturnsCurrentUsersOwnTickets()
    {
        using var db = NewDb();
        var mine = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        var others = new User { Name = "Bob", Email = "bob@example.com", PasswordHash = "x" };
        db.Users.AddRange(mine, others);
        db.SupportTickets.Add(new SupportTicket { Subject = "Mitt", Category = "Konto", Channel = "arendehantering", CreatedByUserId = mine.Id });
        db.SupportTickets.Add(new SupportTicket { Subject = "Någon annans", Category = "Konto", Channel = "arendehantering", CreatedByUserId = others.Id });
        await db.SaveChangesAsync();

        var controller = NewController(db, Authenticated(mine.Id));
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyTickets());
        var list = Assert.IsAssignableFrom<System.Collections.IEnumerable>(result.Value);
        Assert.Single(list.Cast<object>());
    }

    [Fact]
    public async Task Create_MultipleTickets_TicketNumberIncrements()
    {
        using var db = NewDb();
        var controller = NewController(db, Anonymous());

        await controller.Create(new CreateTicketRequest(null, null, "Först", "feedback", null, "a@example.com"));
        await controller.Create(new CreateTicketRequest(null, null, "Sen", "feedback", null, "b@example.com"));

        var numbers = db.SupportTickets.OrderBy(t => t.CreatedAt).Select(t => t.TicketNumber).ToList();
        Assert.Equal([1, 2], numbers);
    }

    [Fact]
    public async Task GetMyTicket_AgentReply_UsesDisplayNameOrFallsBackToSupport()
    {
        using var db = NewDb();
        var owner = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
        var agent = new User { Name = "Joakim Rehn", Email = "admin@example.com", PasswordHash = "x", Role = "Admin", DisplayName = "Nova" };
        var agent2 = new User { Name = "Support Two", Email = "support2@example.com", PasswordHash = "x", Role = "Admin" }; // ingen DisplayName satt
        db.Users.AddRange(owner, agent, agent2);
        var ticket = new SupportTicket { Subject = "Fråga", Category = "Konto", Channel = "arendehantering", CreatedByUserId = owner.Id };
        db.SupportTickets.Add(ticket);
        db.SupportTicketMessages.Add(new SupportTicketMessage { Ticket = ticket, SenderType = "user", AuthorUserId = owner.Id, Text = "Hej" });
        db.SupportTicketMessages.Add(new SupportTicketMessage { Ticket = ticket, SenderType = "agent", AuthorUserId = agent.Id, Text = "Hej tillbaka" });
        db.SupportTicketMessages.Add(new SupportTicketMessage { Ticket = ticket, SenderType = "agent", AuthorUserId = agent2.Id, Text = "Jag också" });
        await db.SaveChangesAsync();

        var controller = NewController(db, Authenticated(owner.Id));
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyTicket(ticket.Id));

        var messages = (System.Collections.IEnumerable)result.Value!.GetType().GetProperty("Messages")!.GetValue(result.Value)!;
        var names = messages.Cast<object>()
            .Select(m => m.GetType().GetProperty("AuthorName")!.GetValue(m) as string)
            .ToList();

        Assert.Equal([null, "Nova", "Support"], names);
    }

    // Ändrat avsiktligt i V3-10 (beslut D1): testet låste tidigare fast buggen att Support-inboxen
    // (Support-rollens startsida) var Admin-only och gav 403 för riktiga Support-konton. Nu ska
    // klassen tillåta Admin ELLER Support. Hela behörighetsytan bevisas i SupportRollBehorighetTests.
    [Fact]
    public void AdminSupportController_AllowsAdminAndSupportRoles()
    {
        var attr = typeof(AdminSupportController).GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(attr);
        Assert.Equal("Admin,Support", attr!.Roles);
    }
}
