namespace Samhallsinformation.Tests;

using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NSubstitute;
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
        return new SupportController(db, push, config)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } },
        };
    }

    [Fact]
    public async Task Create_AnonymousWithoutContactEmail_ReturnsBadRequest()
    {
        using var db = NewDb();
        var controller = NewController(db, Anonymous());

        var result = await controller.Create(new CreateTicketRequest(null, null, "Hej, jag har en fråga", "feedback", null, null));

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
        var mine   = new User { Name = "Ada", Email = "ada@example.com", PasswordHash = "x" };
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
    public void AdminSupportController_RequiresAdminRole()
    {
        var attr = typeof(AdminSupportController).GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(attr);
        Assert.Equal("Admin", attr!.Roles);
    }
}
