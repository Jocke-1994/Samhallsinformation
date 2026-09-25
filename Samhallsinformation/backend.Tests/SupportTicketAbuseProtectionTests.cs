namespace Samhallsinformation.Tests;

using System.Net;
using System.Reflection;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Application.Support;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Services;
using Xunit;

// E1 #8: anonym POST /api/support/tickets saknade rate limit, längdgränser,
// e-postvalidering och kanal-/kategori-allowlist.
public class SupportTicketAbuseProtectionTests
{
    private static AppDbContext NewDb() => new(
        new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static SupportController NewController(AppDbContext db) =>
        new(db, Substitute.For<IPushNotificationService>(), Substitute.For<IConfiguration>(), Substitute.For<IAktivitetsloggService>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) } },
        };

    private static CreateTicketRequest Req(
        string? subject = null, string? category = null, string message = "Hej, jag har en fråga",
        string channel = "feedback", string? name = null, string? email = null) =>
        new(subject, category, message, channel, name, email);

    private static async Task AssertBadRequestAsync(CreateTicketRequest req, string expectedFragment)
    {
        using var db = NewDb();
        var result = await NewController(db).Create(req);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains(expectedFragment, bad.Value as string);
        Assert.Empty(db.SupportTickets);
        Assert.Empty(db.SupportTicketMessages);
    }

    // --- Längdgränser ---

    [Fact]
    public Task Create_MessageOver5000Chars_ReturnsBadRequest() =>
        AssertBadRequestAsync(Req(message: new string('a', SupportTicketValidator.MaxMessageLength + 1)), "Meddelandet");

    [Fact]
    public Task Create_SubjectOver200Chars_ReturnsBadRequest() =>
        AssertBadRequestAsync(Req(subject: new string('a', SupportTicketValidator.MaxSubjectLength + 1)), "Ämnet");

    [Fact]
    public Task Create_NameOver100Chars_ReturnsBadRequest() =>
        AssertBadRequestAsync(Req(name: new string('a', SupportTicketValidator.MaxNameLength + 1)), "Namnet");

    [Fact]
    public Task Create_EmailOver254Chars_ReturnsBadRequest() =>
        AssertBadRequestAsync(Req(email: new string('a', 250) + "@x.se"), "E-postadressen");

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\n\t ")]
    public Task Create_EmptyOrWhitespaceMessage_ReturnsBadRequest(string message) =>
        AssertBadRequestAsync(Req(message: message), "Message krävs");

    // --- E-postvalidering ---

    [Theory]
    [InlineData("inte-en-epost")]
    [InlineData("saknar@punkt")]
    [InlineData("Namn <offer@example.com>")]
    [InlineData("a@b.se, c@d.se")]
    [InlineData("@example.com")]
    public Task Create_InvalidContactEmail_ReturnsBadRequest(string email) =>
        AssertBadRequestAsync(Req(email: email), "Ogiltig e-postadress");

    // --- Allowlist: kanal och kategori ---

    [Theory]
    [InlineData("info-mejl")]      // sätts bara av inbound-webhooken
    [InlineData("nagot-annat")]
    [InlineData("")]
    public Task Create_UnknownChannel_ReturnsBadRequest(string channel) =>
        AssertBadRequestAsync(Req(channel: channel), "Okänd kanal");

    [Fact]
    public Task Create_UnknownCategory_ReturnsBadRequest() =>
        AssertBadRequestAsync(Req(category: "Hittepå"), "Okänd kategori");

    // --- Giltiga anrop fungerar som förut ---

    [Theory]
    [InlineData("feedback")]
    [InlineData("arendehantering")]
    [InlineData("kundtjanstbot")]
    public async Task Create_ValidRequestPerAllowedChannel_ReturnsOk(string channel)
    {
        using var db = NewDb();

        var result = await NewController(db).Create(Req(subject: "Ämne", category: "Konto", channel: channel, name: "Ada", email: "ada@example.com"));

        Assert.IsType<OkObjectResult>(result);
        var ticket = Assert.Single(db.SupportTickets);
        Assert.Equal(channel, ticket.Channel);
        Assert.Equal("ada@example.com", ticket.ContactEmail);
    }

    [Fact]
    public async Task Create_AllCategoriesUsedByFrontend_AreAccepted()
    {
        // Speglar KATEGORIER i frontend/src/components/Profile/Support/ArendehanteringKort.tsx
        // (inkl. beta-kategorin "Testare") + standardvärdet "Feedback".
        string[] kategorier = ["Notifieringar", "Inloggning", "GDPR & uppgifter", "Konto", "Tekniskt fel", "Önskemål", "Testare", "Annat", "Feedback"];
        using var db = NewDb();

        foreach (var k in kategorier)
            Assert.IsType<OkObjectResult>(await NewController(db).Create(Req(category: k, channel: "arendehantering")));

        Assert.Equal(kategorier.Length, db.SupportTickets.Count());
    }

    [Fact]
    public async Task Create_ValuesAtExactLimits_AreAccepted()
    {
        using var db = NewDb();

        var result = await NewController(db).Create(Req(
            subject: new string('s', SupportTicketValidator.MaxSubjectLength),
            message: new string('m', SupportTicketValidator.MaxMessageLength),
            name: new string('n', SupportTicketValidator.MaxNameLength),
            email: new string('a', 64) + "@" + new string('b', 60) + ".se"));

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Create_BlankOptionalFields_FallBackToDefaultsAndNullContact()
    {
        using var db = NewDb();

        var result = await NewController(db).Create(Req(subject: "  ", category: " ", name: "  ", email: "  "));

        Assert.IsType<OkObjectResult>(result);
        var ticket = Assert.Single(db.SupportTickets);
        Assert.Equal("Feedback", ticket.Subject);
        Assert.Equal("Feedback", ticket.Category);
        Assert.Null(ticket.ContactName);
        Assert.Null(ticket.ContactEmail);
    }

    // --- Rate limit ---

    [Fact]
    public void Create_IsBoundToSupportTicketRateLimitPolicy()
    {
        var method = typeof(SupportController).GetMethod(nameof(SupportController.Create))!;
        var attr = method.GetCustomAttribute<EnableRateLimitingAttribute>();

        Assert.NotNull(attr);
        Assert.Equal(SupportTicketRateLimit.PolicyName, attr!.PolicyName);
        Assert.Equal("support-ticket", attr.PolicyName);
    }

    private static HttpContext AnonymousFromIp(string ip)
    {
        var ctx = new DefaultHttpContext();
        ctx.Connection.RemoteIpAddress = IPAddress.Parse(ip);
        return ctx;
    }

    private static int CountPermits(RateLimitPartition<string> partition, int attempts)
    {
        // EN limiter ur partitionens fabrik — alla försök görs mot samma räknare.
        using var limiter = partition.Factory(partition.PartitionKey);
        var permitted = 0;
        for (var i = 0; i < attempts; i++)
        {
            using var lease = limiter.AttemptAcquire();
            if (lease.IsAcquired) permitted++;
        }
        return permitted;
    }

    [Fact]
    public void RateLimit_Anonymous_AllowsOnlyPermitLimitPerHour()
    {
        var partition = SupportTicketRateLimit.GetPartition(AnonymousFromIp("203.0.113.5"));

        Assert.Equal(SupportTicketRateLimit.AnonymousPermitLimit, CountPermits(partition, 50));
        Assert.Equal(TimeSpan.FromHours(1), SupportTicketRateLimit.Window);
    }

    [Fact]
    public void RateLimit_PartitionsPerIp_ButPerUserWhenAuthenticated()
    {
        var a = SupportTicketRateLimit.GetPartition(AnonymousFromIp("203.0.113.5")).PartitionKey;
        var b = SupportTicketRateLimit.GetPartition(AnonymousFromIp("203.0.113.6")).PartitionKey;
        Assert.NotEqual(a, b);

        var userId = Guid.NewGuid();
        var authed = AnonymousFromIp("203.0.113.5");
        authed.User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()) }, "TestAuth"));
        var partition = SupportTicketRateLimit.GetPartition(authed);

        Assert.Equal($"user:{userId}", partition.PartitionKey);
        Assert.NotEqual(a, partition.PartitionKey);
        Assert.Equal(SupportTicketRateLimit.AuthenticatedPermitLimit, CountPermits(partition, 100));
    }
}
