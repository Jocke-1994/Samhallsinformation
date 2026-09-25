namespace Samhallsinformation.Tests;

using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Controllers;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;
using Xunit;

/// <summary>
/// Tester för Resends inbound-webhook (E1 #5/#10). DB-beteende (dubblettskydd, unika index)
/// bevisas mot riktig SQLite via <see cref="TestDb"/>; signaturen räknas ut med en riktig
/// HMAC mot en test-hemlighet i en in-memory-<see cref="IConfiguration"/>.
/// </summary>
public class WebhooksControllerTests
{
    private static readonly byte[] SecretBytes = Encoding.UTF8.GetBytes("test-webhook-secret-bytes-0123456789");
    private static readonly string Secret = "whsec_" + Convert.ToBase64String(SecretBytes);

    private sealed class Harness
    {
        public required AppDbContext Db { get; init; }
        public required IEmailService Email { get; init; }
        public required IAktivitetsloggService Aktivitetslogg { get; init; }
        public required IPushNotificationService Push { get; init; }
        public required IConfiguration Config { get; init; }
    }

    private static Harness NewHarness(AppDbContext db, string? secret = null, bool withSecret = true)
    {
        var values = new Dictionary<string, string?>();
        if (withSecret) values["RESEND_WEBHOOK_SECRET"] = secret ?? Secret;
        return new Harness
        {
            Db = db,
            Email = Substitute.For<IEmailService>(),
            Aktivitetslogg = Substitute.For<IAktivitetsloggService>(),
            Push = Substitute.For<IPushNotificationService>(),
            Config = new ConfigurationBuilder().AddInMemoryCollection(values).Build(),
        };
    }

    // Skapar en ny controller-instans med en färsk HttpContext för ett enskilt anrop.
    private static WebhooksController NewController(Harness h, string body, string svixId = "msg_1",
        long? timestamp = null, string? signatureOverride = null, bool includeHeaders = true)
    {
        var ts = (timestamp ?? DateTimeOffset.UtcNow.ToUnixTimeSeconds()).ToString();
        var ctx = new DefaultHttpContext();
        ctx.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
        if (includeHeaders)
        {
            ctx.Request.Headers["svix-id"] = svixId;
            ctx.Request.Headers["svix-timestamp"] = ts;
            ctx.Request.Headers["svix-signature"] = signatureOverride ?? "v1," + Sign(svixId, ts, body);
        }
        return new WebhooksController(h.Db, h.Email, h.Config, h.Aktivitetslogg, h.Push, NullLogger<WebhooksController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = ctx },
        };
    }

    private static string Sign(string svixId, string ts, string body)
    {
        using var hmac = new HMACSHA256(SecretBytes);
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{svixId}.{ts}.{body}")));
    }

    private static string Payload(string emailId, string from, string[] to, string? subject = "Hej")
    {
        var toJson = "[" + string.Join(",", to.Select(t => $"\"{t}\"")) + "]";
        var subjectJson = subject == null ? "null" : $"\"{subject}\"";
        return $$$"""{"type":"email.received","data":{"email_id":"{{{emailId}}}","from":"{{{from}}}","to":{{{toJson}}},"subject":{{{subjectJson}}}}}""";
    }

    private static SupportTicket AddTicket(AppDbContext db, int number, string contactEmail)
    {
        var ticket = new SupportTicket
        {
            TicketNumber = number,
            Subject = "Ärende",
            Category = "Allmän förfrågan",
            ContactEmail = contactEmail,
        };
        db.SupportTickets.Add(ticket);
        db.SaveChanges();
        return ticket;
    }

    // ---- Signatur (karakteriseringstester — beteendet fanns redan) ----

    [Fact]
    public async Task ResendInbound_MissingSignatureHeaders_Returns401()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        var body = Payload("em_1", "kund@example.com", ["info@samhallsinformation.se"]);

        var result = await NewController(h, body, includeHeaders: false).ResendInbound();

        Assert.IsType<UnauthorizedResult>(result);
        Assert.Empty(db.SupportTickets);
    }

    [Fact]
    public async Task ResendInbound_WrongSignature_Returns401()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        var body = Payload("em_1", "kund@example.com", ["info@samhallsinformation.se"]);

        var result = await NewController(h, body, signatureOverride: "v1," + Convert.ToBase64String(new byte[32])).ResendInbound();

        Assert.IsType<UnauthorizedResult>(result);
        Assert.Empty(db.SupportTickets);
    }

    [Fact]
    public async Task ResendInbound_SignatureForDifferentBody_Returns401()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        var body = Payload("em_1", "kund@example.com", ["info@samhallsinformation.se"]);
        var sigForOtherBody = "v1," + Sign("msg_1", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), body + " ");

        var result = await NewController(h, body, signatureOverride: sigForOtherBody).ResendInbound();

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task ResendInbound_OldTimestamp_Returns401()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        var body = Payload("em_1", "kund@example.com", ["info@samhallsinformation.se"]);
        var gammal = DateTimeOffset.UtcNow.AddMinutes(-10).ToUnixTimeSeconds();

        var result = await NewController(h, body, timestamp: gammal).ResendInbound();

        Assert.IsType<UnauthorizedResult>(result);
        Assert.Empty(db.SupportTickets);
    }

    [Fact]
    public async Task ResendInbound_NoSecretConfigured_FailsClosedWith401()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db, withSecret: false);
        var body = Payload("em_1", "kund@example.com", ["info@samhallsinformation.se"]);

        var result = await NewController(h, body).ResendInbound();

        Assert.IsType<UnauthorizedResult>(result);
        Assert.Empty(db.SupportTickets);
    }

    // ---- Trasig indata ger aldrig 500 ----

    [Theory]
    [InlineData("svar+99999999999999999999@samhallsinformation.se")] // overflow i Int64 också
    [InlineData("svar+2147483648@samhallsinformation.se")]          // int.MaxValue + 1
    [InlineData("svar+0000000000000000001@samhallsinformation.se")] // för många siffror (ledande nollor)
    public async Task ResendInbound_TicketNumberOverflow_Returns200AndSavesNothing(string toAdress)
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 1, "kund@example.com");
        var body = Payload("em_1", "kund@example.com", [toAdress]);

        var result = await NewController(h, body).ResendInbound();

        Assert.IsType<OkResult>(result);
        Assert.Empty(db.SupportTicketMessages);
        Assert.Single(db.SupportTickets);
        await h.Email.DidNotReceiveWithAnyArgs().GetReceivedEmailTextAsync(default!);
    }

    [Fact]
    public async Task ResendInbound_MalformedJson_Returns200NotThrow()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);

        var result = await NewController(h, "{ detta är inte json").ResendInbound();

        Assert.IsType<OkResult>(result);
        Assert.Empty(db.SupportTickets);
    }

    [Theory]
    [InlineData("")]
    [InlineData("[]")]
    [InlineData("\"bara en sträng\"")]
    [InlineData("null")]
    [InlineData("42")]
    [InlineData("{}")]
    [InlineData("""{"type":123}""")]
    [InlineData("""{"type":"email.received"}""")]
    [InlineData("""{"type":"email.received","data":null}""")]
    [InlineData("""{"type":"email.received","data":"text"}""")]
    [InlineData("""{"type":"email.received","data":[]}""")]
    [InlineData("""{"type":"email.received","data":{}}""")]
    [InlineData("""{"type":"email.received","data":{"email_id":123,"from":"a@b.se","to":["info@samhallsinformation.se"]}}""")]
    [InlineData("""{"type":"email.received","data":{"email_id":"em_1","from":42,"to":["info@samhallsinformation.se"]}}""")]
    [InlineData("""{"type":"email.received","data":{"email_id":"em_1","from":"a@b.se","to":"info@samhallsinformation.se"}}""")]
    [InlineData("""{"type":"email.received","data":{"email_id":"em_1","from":"a@b.se","to":7}}""")]
    [InlineData("""{"type":"email.received","data":{"email_id":"em_1","from":"a@b.se","to":[1,null,{"x":1}]}}""")]
    [InlineData("""{"type":"email.received","data":{"email_id":"em_1","from":"a@b.se","to":null,"subject":{"a":1}}}""")]
    public async Task ResendInbound_UnexpectedPayloadStructure_Returns200NotThrow(string body)
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        h.Email.GetReceivedEmailTextAsync(Arg.Any<string>()).Returns("Hej, ett svar");

        var result = await NewController(h, body).ResendInbound();

        Assert.IsType<OkResult>(result);
        // Ingen av payloaderna har en giltig kombination av email_id (sträng) och to (array av strängar).
        Assert.Empty(db.SupportTickets);
        Assert.Empty(db.SupportTicketMessages);
    }

    [Fact]
    public async Task ResendInbound_OtherEventType_Returns200AndSavesNothing()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);

        var result = await NewController(h, """{"type":"email.delivered","data":{}}""").ResendInbound();

        Assert.IsType<OkResult>(result);
        Assert.Empty(db.SupportTickets);
    }

    // ---- Normalflöden ----

    [Fact]
    public async Task ResendInbound_InfoAddress_CreatesTicketWithMessage()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        h.Email.GetReceivedEmailTextAsync("em_1").Returns("Hej, jag har en fråga");
        var body = Payload("em_1", "Anna Andersson <anna@example.com>", ["info@samhallsinformation.se"], "Fråga");

        var result = await NewController(h, body).ResendInbound();

        Assert.IsType<OkResult>(result);
        var ticket = Assert.Single(db.SupportTickets);
        Assert.Equal("anna@example.com", ticket.ContactEmail);
        Assert.Equal("Fråga", ticket.Subject);
        Assert.Equal("info-mejl", ticket.Channel);
        var message = Assert.Single(db.SupportTicketMessages);
        Assert.Equal(ticket.Id, message.TicketId);
        Assert.Equal("Hej, jag har en fråga", message.Text);
    }

    [Fact]
    public async Task ResendInbound_ReplyFromKnownSender_AddsMessageToExistingTicket()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        var ticket = AddTicket(db, 12, "kund@example.com");
        h.Email.GetReceivedEmailTextAsync("em_1").Returns("Tack för svaret\n> citat");
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);

        var result = await NewController(h, body).ResendInbound();

        Assert.IsType<OkResult>(result);
        var message = Assert.Single(db.SupportTicketMessages);
        Assert.Equal(ticket.Id, message.TicketId);
        Assert.Equal("Tack för svaret", message.Text);
    }

    [Fact]
    public async Task ResendInbound_ReplyFromOtherSender_IsIgnoredAndSavesNoMessage()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        h.Email.GetReceivedEmailTextAsync("em_1").Returns("Jag låtsas vara kunden");
        var body = Payload("em_1", "angripare@example.com", ["svar+12@samhallsinformation.se"]);

        var result = await NewController(h, body).ResendInbound();

        Assert.IsType<OkResult>(result);
        Assert.Empty(db.SupportTicketMessages);
    }

    // ---- Idempotens: samma webhook levererad flera gånger ----

    [Fact]
    public async Task ResendInbound_SameInfoMailDeliveredTwice_CreatesExactlyOneTicketAndMessage()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        h.Email.GetReceivedEmailTextAsync("em_1").Returns("Hej, jag har en fråga");
        var body = Payload("em_1", "anna@example.com", ["info@samhallsinformation.se"], "Fråga");

        // Retry: samma svix-id, samma body, ny controller-instans (ny request).
        var first = await NewController(h, body, svixId: "msg_1").ResendInbound();
        var second = await NewController(h, body, svixId: "msg_1").ResendInbound();

        Assert.IsType<OkResult>(first);
        Assert.IsType<OkResult>(second);
        Assert.Single(db.SupportTickets);
        Assert.Single(db.SupportTicketMessages);
    }

    [Fact]
    public async Task ResendInbound_SameReplyDeliveredTwice_CreatesExactlyOneMessage()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        h.Email.GetReceivedEmailTextAsync("em_1").Returns("Tack för svaret");
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);

        await NewController(h, body, svixId: "msg_1").ResendInbound();
        var second = await NewController(h, body, svixId: "msg_1").ResendInbound();

        Assert.IsType<OkResult>(second);
        Assert.Single(db.SupportTicketMessages);
    }

    [Fact]
    public async Task ResendInbound_SameReplyTextAfterDedupeWindow_IsSavedAsNewMessage()
    {
        // Dubblettskyddet är tidsbegränsat: ett medvetet identiskt svar ("Tack!") långt senare
        // ska inte sväljas.
        using var db = TestDb.Create();
        var h = NewHarness(db);
        var ticket = AddTicket(db, 12, "kund@example.com");
        db.SupportTicketMessages.Add(new SupportTicketMessage
        {
            TicketId = ticket.Id,
            SenderType = "user",
            Text = "Tack!",
            CreatedAt = DateTime.UtcNow.AddHours(-5),
        });
        db.SaveChanges();
        h.Email.GetReceivedEmailTextAsync("em_2").Returns("Tack!");
        var body = Payload("em_2", "kund@example.com", ["svar+12@samhallsinformation.se"]);

        await NewController(h, body, svixId: "msg_2").ResendInbound();

        Assert.Equal(2, db.SupportTicketMessages.Count());
    }

    [Fact]
    public async Task ResendInbound_DifferentTextsFromSameSender_AreBothSaved()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        h.Email.GetReceivedEmailTextAsync("em_1").Returns("Första svaret");
        h.Email.GetReceivedEmailTextAsync("em_2").Returns("Andra svaret");

        await NewController(h, Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]), svixId: "msg_1").ResendInbound();
        await NewController(h, Payload("em_2", "kund@example.com", ["svar+12@samhallsinformation.se"]), svixId: "msg_2").ResendInbound();

        Assert.Equal(2, db.SupportTicketMessages.Count());
    }

    [Fact]
    public async Task ResendInbound_ActivityLogThrowsAfterSave_StillReturns200AndKeepsMessage()
    {
        // En 500 efter lyckad SaveChanges får Resend att retria -> dubblett. Loggningen är
        // "best effort" och får inte välta anropet.
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        h.Email.GetReceivedEmailTextAsync("em_1").Returns("Tack för svaret");
        h.Aktivitetslogg
            .LogAsync(default!, default!, default!, default!, default, default, default, default)
            .ReturnsForAnyArgs<Task>(_ => throw new InvalidOperationException("loggen nere"));
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);

        var result = await NewController(h, body).ResendInbound();

        Assert.IsType<OkResult>(result);
        Assert.Single(db.SupportTicketMessages);
    }
}
