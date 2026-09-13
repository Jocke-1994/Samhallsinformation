namespace Samhallsinformation.Tests;

using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Xunit;

public class EventsControllerTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static EventsController NewController(AppDbContext db, Guid? callerId = null)
    {
        var identity = callerId.HasValue
            ? new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, callerId.Value.ToString()) }, "TestAuth")
            : new ClaimsIdentity();

        return new EventsController(db, Substitute.For<IHttpClientFactory>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) } },
        };
    }

    [Fact]
    public async Task LogShare_Anonymous_WritesLogWithNullUserId()
    {
        using var db = NewDb();
        var eventId = Guid.NewGuid();

        var result = await NewController(db).LogShare(eventId);

        Assert.IsType<OkResult>(result);
        var log = Assert.Single(db.EventShareLogs);
        Assert.Equal(eventId, log.EventId);
        Assert.Null(log.UserId);
    }

    [Fact]
    public async Task LogShare_LoggedIn_WritesLogWithUserId()
    {
        using var db = NewDb();
        var eventId = Guid.NewGuid();
        var userId  = Guid.NewGuid();

        await NewController(db, userId).LogShare(eventId);

        var log = Assert.Single(db.EventShareLogs);
        Assert.Equal(userId, log.UserId);
    }
}
