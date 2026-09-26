namespace Samhallsinformation.Tests;

using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
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

    private static readonly TicketReplyAddress ReplyAddress = new("test-jwt-secret-for-reply-token-0123456789");
    private static readonly ReceivedEmailAuthentication Verifierad = new("pass", "pass", "pass");

    // Ett svar på ett ärende hämtas via GetReceivedEmailAsync (text + SPF/DKIM/DMARC). Default: verifierad avsändare.
    private static void Verifierat(Harness h, string emailId, string text, ReceivedEmailAuthentication? auth = null) =>
        h.Email.GetReceivedEmailAsync(emailId).Returns(new ReceivedEmail(text, auth ?? Verifierad));

    private sealed class Harness
    {
        public required AppDbContext Db { get; init; }
        public required IEmailService Email { get; init; }
        public required IAktivitetsloggService Aktivitetslogg { get; init; }
        public required IPushNotificationService Push { get; init; }
        public required IConfiguration Config { get; init; }
    }

    private static Harness NewHarness(AppDbContext db, string? secret = null, bool withSecret = true, bool acceptLegacy = true, bool requireAuth = true)
    {
        var values = new Dictionary<string, string?>();
        if (withSecret) values["RESEND_WEBHOOK_SECRET"] = secret ?? Secret;
        if (!acceptLegacy) values["SUPPORT_REPLY_ACCEPT_LEGACY"] = "false";
        if (!requireAuth) values["SUPPORT_REPLY_REQUIRE_AUTH"] = "false";
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
        long? timestamp = null, string? signatureOverride = null, bool includeHeaders = true, ILogger<WebhooksController>? logger = null)
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
        return new WebhooksController(h.Db, h.Email, h.Config, h.Aktivitetslogg, h.Push, ReplyAddress, logger ?? NullLogger<WebhooksController>.Instance)
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
        await h.Email.DidNotReceiveWithAnyArgs().GetReceivedEmailAsync(default!);
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
        h.Email.GetReceivedEmailAsync(Arg.Any<string>()).Returns(new ReceivedEmail("Hej, ett svar", Verifierad));

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
        Verifierat(h, "em_1", "Tack för svaret\n> citat");
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
        Verifierat(h, "em_1", "Jag låtsas vara kunden");
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
        Verifierat(h, "em_1", "Tack för svaret");
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
        Verifierat(h, "em_2", "Tack!");
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
        Verifierat(h, "em_1", "Första svaret");
        Verifierat(h, "em_2", "Andra svaret");

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
        Verifierat(h, "em_1", "Tack för svaret");
        h.Aktivitetslogg
            .LogAsync(default!, default!, default!, default!, default, default, default, default)
            .ReturnsForAnyArgs<Task>(_ => throw new InvalidOperationException("loggen nere"));
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);

        var result = await NewController(h, body).ResendInbound();

        Assert.IsType<OkResult>(result);
        Assert.Single(db.SupportTicketMessages);
    }

    // ---- E1#10 / V3-16: avsändarautentisering (SPF/DKIM/DMARC från Resend) ----

    private static string TokenAdress(int ticket) => ReplyAddress.Build(ticket);

    [Fact]
    public async Task Svar_ForfalskadAvsandare_UtanAutentisering_LaggsInteInSomKundsvar()
    {
        // Angriparen känner ärendenumret (svar+12@) och kundens adress och skriver den som From.
        using var db = TestDb.Create();
        var h = NewHarness(db);
        var ticket = AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Jag är kunden, skicka pengar", new ReceivedEmailAuthentication("fail", "fail", "fail"));
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);

        var result = await NewController(h, body).ResendInbound();

        Assert.IsType<OkResult>(result);
        Assert.DoesNotContain(db.SupportTicketMessages, m => m.SenderType == "user");
        var uppdaterad = db.SupportTickets.Single(t => t.Id == ticket.Id);
        Assert.Null(uppdaterad.LastUserMessageAt);   // ingen "oläst" hos support
        Assert.Empty(h.Aktivitetslogg.ReceivedCalls());
        Assert.Empty(h.Push.ReceivedCalls());
    }

    [Fact]
    public async Task Svar_ForfalskadAvsandare_SparasSomFlaggadInternAnteckning()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        var ticket = AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_forged", "Falskt innehåll", new ReceivedEmailAuthentication("fail", "gray", "fail"));
        var body = Payload("em_forged", "kund@example.com", ["svar+12@samhallsinformation.se"]);

        await NewController(h, body).ResendInbound();

        var note = Assert.Single(db.SupportTicketMessages);
        Assert.Equal(ticket.Id, note.TicketId);
        Assert.True(note.IsInternal);                    // syns aldrig för kunden
        Assert.NotEqual("user", note.SenderType);
        Assert.StartsWith("Ej verifierat mejl", note.Text);
        Assert.Contains("kunde inte autentiseras", note.Text);
        Assert.Contains("em_forged", note.Text);
        Assert.Contains("spf=fail", note.Text);
        Assert.Contains("Falskt innehåll", note.Text);
    }

    [Fact]
    public async Task Svar_AutentiseringSaknasHelt_AccepterasSomKundsvarMedWarning()
    {
        // "authentication": null / fältet saknas (äldre mejl, API-svar utan fältet): kan inte verifieras -> accepteras
        // som förut, men loggas som Warning så vi ser hur ofta det händer.
        using var db = TestDb.Create();
        var h = NewHarness(db);
        var ticket = AddTicket(db, 12, "kund@example.com");
        h.Email.GetReceivedEmailAsync("em_1").Returns(new ReceivedEmail("Hej", null));
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);
        var logg = new LogCapture();

        await NewController(h, body, logger: logg).ResendInbound();

        var message = Assert.Single(db.SupportTicketMessages);
        Assert.Equal("user", message.SenderType);
        Assert.False(message.IsInternal);
        Assert.NotNull(db.SupportTickets.Single(t => t.Id == ticket.Id).LastUserMessageAt);
        Assert.Contains(logg.Entries, e => e.Level == LogLevel.Warning && e.Message.Contains("authentication saknas") && e.Message.Contains("accepterar"));
    }

    [Fact]
    public async Task Svar_AutentiseringSaknasHelt_RaknasIEnRaknare()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        h.Email.GetReceivedEmailAsync("em_1").Returns(new ReceivedEmail("Ett", null));
        h.Email.GetReceivedEmailAsync("em_2").Returns(new ReceivedEmail("Två", null));
        var logg = new LogCapture();

        await NewController(h, Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]), svixId: "msg_1", logger: logg).ResendInbound();
        await NewController(h, Payload("em_2", "kund@example.com", ["svar+12@samhallsinformation.se"]), svixId: "msg_2", logger: logg).ResendInbound();

        var antal = logg.Entries.Where(e => e.Message.Contains("authentication saknas")).Select(e => e.Message).ToList();
        Assert.Equal(2, antal.Count);
        Assert.Contains("sådana sedan uppstart", antal[1]);   // räknaren ingår i loggraden
    }

    [Fact]
    public async Task Svar_MejlSomInteKanHamtasAlls_SparasFortfarandeIngenting()
    {
        // Utan hämtat mejl finns ingen text att spara — kill-switchen/null-regeln gäller bara själva utfallet.
        using var db = TestDb.Create();
        var h = NewHarness(db, requireAuth: false);
        AddTicket(db, 12, "kund@example.com");
        h.Email.GetReceivedEmailAsync("em_1").Returns((ReceivedEmail?)null);

        await NewController(h, Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"])).ResendInbound();

        Assert.Empty(db.SupportTicketMessages);
    }

    // ---- Kill-switch SUPPORT_REPLY_REQUIRE_AUTH ----

    [Fact]
    public async Task Svar_RequireAuthAv_ForfalskatMejlAccepterasMenLoggas()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db, requireAuth: false);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Tack", new ReceivedEmailAuthentication("fail", "fail", "fail"));
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);
        var logg = new LogCapture();

        await NewController(h, body, logger: logg).ResendInbound();

        var message = Assert.Single(db.SupportTicketMessages);
        Assert.Equal("user", message.SenderType);
        Assert.False(message.IsInternal);
        Assert.Contains(logg.Entries, e => e.Level == LogLevel.Warning && e.Message.Contains("SUPPORT_REPLY_REQUIRE_AUTH=false") && e.Message.Contains("spf=fail"));
    }

    [Fact]
    public async Task Svar_RequireAuthPa_ForfalskatMejlFlaggasFortfarande()
    {
        // Default (true) är oförändrat: objektet finns men varken dmarc eller dkim är pass -> flaggad anteckning.
        using var db = TestDb.Create();
        var h = NewHarness(db, requireAuth: true);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Falskt", new ReceivedEmailAuthentication("fail", "fail", "fail"));

        await NewController(h, Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"])).ResendInbound();

        Assert.DoesNotContain(db.SupportTicketMessages, m => m.SenderType == "user");
        Assert.Single(db.SupportTicketMessages, m => m.IsInternal);
    }

    [Fact]
    public async Task Svar_RequireAuthAv_PaverkarInteTokenkravet()
    {
        // Kill-switchen gäller bara SPF/DKIM/DMARC — fel token avvisas fortfarande.
        using var db = TestDb.Create();
        var h = NewHarness(db, requireAuth: false);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Hej");

        await NewController(h, Payload("em_1", "kund@example.com", ["svar+12-00000000@samhallsinformation.se"])).ResendInbound();

        Assert.Empty(db.SupportTicketMessages);
    }

    [Theory]
    [InlineData("pass", "gray", "gray")]               // enbart SPF: envelope-from kan vara angriparens egen domän
    [InlineData("pass", "fail", "fail")]
    [InlineData("gray", "gray", "gray")]               // osignerat, ingen DMARC-policy
    [InlineData("unknown", "unknown", "unknown")]
    [InlineData("processing_failed", "processing_failed", "processing_failed")]
    [InlineData(null, null, null)]
    public async Task Svar_OtillrackligtAutentiseringsutfall_LaggsInteInSomKundsvar(string? spf, string? dkim, string? dmarc)
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Hej", new ReceivedEmailAuthentication(spf, dkim, dmarc));
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);

        await NewController(h, body).ResendInbound();

        Assert.DoesNotContain(db.SupportTicketMessages, m => m.SenderType == "user");
    }

    [Theory]
    [InlineData("pass", "pass", "pass")]
    [InlineData("pass", "gray", "pass")]               // DMARC pass räcker
    [InlineData("gray", "pass", "gray")]               // Gmail: DKIM pass i linje med From, DMARC gray (p=none)
    [InlineData("fail", "pass", "gray")]
    [InlineData("gray", "gray", "PASS")]               // skiftlägesokänsligt
    public async Task Svar_KorrektAvsandareMedGiltigtUtfall_LaggsInSomKundsvar(string spf, string dkim, string dmarc)
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        var ticket = AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Tack för svaret", new ReceivedEmailAuthentication(spf, dkim, dmarc));
        var body = Payload("em_1", "kund@example.com", [TokenAdress(12)]);

        await NewController(h, body).ResendInbound();

        var message = Assert.Single(db.SupportTicketMessages);
        Assert.Equal("user", message.SenderType);
        Assert.False(message.IsInternal);
        Assert.Equal("Tack för svaret", message.Text);
        Assert.NotNull(db.SupportTickets.Single(t => t.Id == ticket.Id).LastUserMessageAt);
    }

    [Fact]
    public async Task Svar_OverifieradeMejlFlaggasHogstEnGangPerTimmePerArende()
    {
        // Förfalskade mejl får inte fylla tråden med skräp.
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        var ingen = new ReceivedEmailAuthentication("fail", "fail", "fail");
        Verifierat(h, "em_1", "Skräp 1", ingen);
        Verifierat(h, "em_2", "Skräp 2", ingen);

        await NewController(h, Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]), svixId: "msg_1").ResendInbound();
        await NewController(h, Payload("em_2", "kund@example.com", ["svar+12@samhallsinformation.se"]), svixId: "msg_2").ResendInbound();

        Assert.Single(db.SupportTicketMessages);
    }

    [Fact]
    public async Task Svar_MejlKanInteHamtas_SparasIngenting()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        h.Email.GetReceivedEmailAsync("em_1").Returns((ReceivedEmail?)null);
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);

        var result = await NewController(h, body).ResendInbound();

        Assert.IsType<OkResult>(result);
        Assert.Empty(db.SupportTicketMessages);
    }

    // ---- Avsändarmatchning (a) ----

    [Theory]
    [InlineData("Kund@Example.COM", "kund@example.com")]        // From med versaler mot lagrad gemen adress
    [InlineData("kund@example.com", "Kund@Example.com")]        // lagrad adress med versaler (äldre rader)
    [InlineData("Kund Kundsson <kund@example.com>", "kund@example.com")]
    public async Task Svar_AvsandarmatchningArSkiftlagesokanslig(string from, string lagrad)
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, lagrad);
        Verifierat(h, "em_1", "Tack");
        var body = Payload("em_1", from, [TokenAdress(12)]);

        await NewController(h, body).ResendInbound();

        Assert.Single(db.SupportTicketMessages, m => m.SenderType == "user");
    }

    [Fact]
    public async Task Svar_AnnanAvsandare_AvvisasAvenMedGiltigTokenOchAutentisering()
    {
        // Ett vidarebefordrat mejl med token, skickat från en annan (äkta) adress, ska inte kunna skriva i ärendet.
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Hej");
        var body = Payload("em_1", "annan@example.com", [TokenAdress(12)]);

        await NewController(h, body).ResendInbound();

        Assert.Empty(db.SupportTicketMessages);
        await h.Email.DidNotReceiveWithAnyArgs().GetReceivedEmailAsync(default!);
    }

    // ---- Icke-gissningsbar ärendereferens (b) ----

    [Fact]
    public async Task Svar_GiltigToken_LaggsIn()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Tack");
        var body = Payload("em_1", "kund@example.com", [TokenAdress(12)]);

        await NewController(h, body).ResendInbound();

        Assert.Single(db.SupportTicketMessages, m => m.SenderType == "user");
    }

    [Fact]
    public async Task Svar_GiltigTokenIVersaler_LaggsIn()
    {
        // En mejlserver kan ändra skiftläge på adressen.
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Tack");
        var versaler = $"svar+12-{ReplyAddress.ComputeToken(12).ToUpperInvariant()}@samhallsinformation.se";
        var body = Payload("em_1", "kund@example.com", [versaler]);

        await NewController(h, body).ResendInbound();

        Assert.Single(db.SupportTicketMessages, m => m.SenderType == "user");
    }

    [Theory]
    [InlineData("svar+12-00000000@samhallsinformation.se")]   // fel token
    [InlineData("svar+12-@samhallsinformation.se")]           // tom token
    [InlineData("svar+12-abc@samhallsinformation.se")]        // för kort
    [InlineData("svar+12-zzzzzzzz@samhallsinformation.se")]   // inte hex
    [InlineData("svar+12--@samhallsinformation.se")]
    public async Task Svar_FelToken_AvvisasUtanAttHamtaMejlEllerSlaUppArendet(string adress)
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Hej");
        var body = Payload("em_1", "kund@example.com", [adress]);

        var result = await NewController(h, body).ResendInbound();

        Assert.IsType<OkResult>(result);
        Assert.Empty(db.SupportTicketMessages);          // varken kundsvar eller flaggad anteckning
        await h.Email.DidNotReceiveWithAnyArgs().GetReceivedEmailAsync(default!);
    }

    [Fact]
    public async Task Svar_TokenFranAnnatArende_AvvisasDaTokenBaraGallerSittEttArendenummer()
    {
        // Icke gissningsbart: token för ärende 12 fungerar inte på ärende 13.
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        AddTicket(db, 13, "kund@example.com");
        Verifierat(h, "em_1", "Hej");
        var token12 = ReplyAddress.ComputeToken(12);
        var body = Payload("em_1", "kund@example.com", [$"svar+13-{token12}@samhallsinformation.se"]);

        await NewController(h, body).ResendInbound();

        Assert.Empty(db.SupportTicketMessages);
    }

    [Fact]
    public async Task Svar_TokenFranAnnanHemlighet_Avvisas()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Hej");
        var annanHemlighet = new TicketReplyAddress("en-helt-annan-hemlighet-0123456789abc");
        var body = Payload("em_1", "kund@example.com", [annanHemlighet.Build(12)]);

        await NewController(h, body).ResendInbound();

        Assert.Empty(db.SupportTicketMessages);
    }

    // ---- Bakåtkompatibilitet: äldre adresser utan token ----

    private sealed class LogCapture : ILogger<WebhooksController>
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Entries.Add((logLevel, formatter(state, exception)));
    }

    [Fact]
    public async Task Svar_AldreAdressUtanToken_FungerarMenLoggasSomEjTokenVerifierad()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Tack för svaret");
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);
        var logg = new LogCapture();

        await NewController(h, body, logger: logg).ResendInbound();

        Assert.Single(db.SupportTicketMessages, m => m.SenderType == "user");
        Assert.Contains(logg.Entries, e => e.Level == LogLevel.Warning && e.Message.Contains("ej token-verifierad") && e.Message.Contains("12"));
    }

    [Fact]
    public async Task Svar_TokenverifieradAdress_LoggasInteSomEjTokenVerifierad()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Tack");
        var body = Payload("em_1", "kund@example.com", [TokenAdress(12)]);
        var logg = new LogCapture();

        await NewController(h, body, logger: logg).ResendInbound();

        Assert.DoesNotContain(logg.Entries, e => e.Message.Contains("ej token-verifierad"));
    }

    [Fact]
    public async Task Svar_AldreAdressUtanToken_MedForfalskadAvsandare_AvvisasFortfarandeAvAutentiseringen()
    {
        // Utan token är autentiseringen ensam skyddet — den får inte kringgås genom att utelämna token.
        using var db = TestDb.Create();
        var h = NewHarness(db);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Falskt", new ReceivedEmailAuthentication("fail", "fail", "fail"));
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);

        await NewController(h, body).ResendInbound();

        Assert.DoesNotContain(db.SupportTicketMessages, m => m.SenderType == "user");
    }

    [Fact]
    public async Task Svar_AldreAdressUtanToken_AvvisasNarAldreAdresserArAvstangda()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db, acceptLegacy: false);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Tack");
        var body = Payload("em_1", "kund@example.com", ["svar+12@samhallsinformation.se"]);

        await NewController(h, body).ResendInbound();

        Assert.Empty(db.SupportTicketMessages);
        await h.Email.DidNotReceiveWithAnyArgs().GetReceivedEmailAsync(default!);
    }

    [Fact]
    public async Task Svar_TokenAdress_FungerarNarAldreAdresserArAvstangda()
    {
        using var db = TestDb.Create();
        var h = NewHarness(db, acceptLegacy: false);
        AddTicket(db, 12, "kund@example.com");
        Verifierat(h, "em_1", "Tack");
        var body = Payload("em_1", "kund@example.com", [TokenAdress(12)]);

        await NewController(h, body).ResendInbound();

        Assert.Single(db.SupportTicketMessages, m => m.SenderType == "user");
    }

    [Fact]
    public async Task InfoMejl_HamtasFortfarandeViaTextmetoden_OchPaverkasInteAvAutentiseringskravet()
    {
        // Nya ärenden via info@ berörs inte av E1#10 (ingen befintlig tråd att injicera i).
        using var db = TestDb.Create();
        var h = NewHarness(db);
        h.Email.GetReceivedEmailTextAsync("em_1").Returns("Hej, jag har en fråga");
        var body = Payload("em_1", "anna@example.com", ["info@samhallsinformation.se"], "Fråga");

        await NewController(h, body).ResendInbound();

        Assert.Single(db.SupportTickets);
    }
}
