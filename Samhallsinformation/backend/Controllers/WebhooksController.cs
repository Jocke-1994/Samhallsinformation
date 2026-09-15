namespace Samhallsinformation.Controllers;

using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Application.Aktivitetslogg;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

// Tar emot Resends inbound-webhook (event "email.received") — antingen ett
// svar på ett ärendesvar-mejl (svar+{ticketNumber}@samhallsinformation.se, se
// ResendEmailService.SendTicketReplyAsync) eller ett helt nytt mejl till
// info@samhallsinformation.se, som öppnar ett nytt ärende. Resends inbound-
// mottagning är kopplad på hela domänen (MX-nivå) — info@ landar redan här
// utan ytterligare DNS-arbete. Webhooken innehåller bara metadata — själva
// texten hämtas separat via Resends Received Emails-API.
//
// Signaturverifiering följer Svix egen dokumenterade algoritm (Resend
// levererar webhooks via Svix): hemligheten (RESEND_WEBHOOK_SECRET, format
// "whsec_<base64>") används som HMAC-SHA256-nyckel mot strängen
// "{svix-id}.{svix-timestamp}.{rå body}", jämförs mot svix-signature-headerns
// (mellanslagsseparerade, "v1,"-prefixade) värden. Se
// docs.svix.com/receiving/verifying-payloads/how-manual för källan.
[ApiController]
[Route("api/webhooks")]
[AllowAnonymous]
public class WebhooksController : ControllerBase
{
    private static readonly Regex TicketAdressMönster = new(@"^svar\+(\d+)@", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private const string InfoAdress = "info@samhallsinformation.se";

    private readonly AppDbContext _db;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;
    private readonly IAktivitetsloggService _aktivitetslogg;
    private readonly IPushNotificationService _push;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(AppDbContext db, IEmailService email, IConfiguration config, IAktivitetsloggService aktivitetslogg, IPushNotificationService push, ILogger<WebhooksController> logger)
    {
        _db = db;
        _email = email;
        _config = config;
        _aktivitetslogg = aktivitetslogg;
        _push = push;
        _logger = logger;
    }

    [HttpPost("resend-inbound")]
    public async Task<IActionResult> ResendInbound()
    {
        Request.EnableBuffering();
        string rawBody;
        using (var reader = new StreamReader(Request.Body, Encoding.UTF8, leaveOpen: true))
        {
            rawBody = await reader.ReadToEndAsync();
        }
        Request.Body.Position = 0;

        if (!VerifierarSignatur(rawBody))
        {
            _logger.LogWarning("Resend-webhook: ogiltig eller saknad signatur, avvisad.");
            return Unauthorized();
        }

        using var doc = JsonDocument.Parse(rawBody);
        var root = doc.RootElement;
        if (!root.TryGetProperty("type", out var typeEl) || typeEl.GetString() != "email.received")
            return Ok(); // andra event-typer (delivered, bounced m.fl.) ignoreras tyst

        var data = root.GetProperty("data");
        var emailId = data.TryGetProperty("email_id", out var idEl) ? idEl.GetString() : null;
        var fromRaw = data.TryGetProperty("from", out var fromEl) ? fromEl.GetString() ?? "" : "";
        var subjectRaw = data.TryGetProperty("subject", out var subjectEl) ? subjectEl.GetString() : null;
        var toAdresser = data.TryGetProperty("to", out var toEl)
            ? toEl.EnumerateArray().Select(e => e.GetString() ?? "").ToList()
            : [];
        if (emailId == null) return Ok();

        var ticketAdress = toAdresser.FirstOrDefault(a => TicketAdressMönster.IsMatch(a));
        if (ticketAdress != null)
        {
            await HanteraSvarPåBefintligtÄrendeAsync(emailId, fromRaw, ticketAdress);
            return Ok();
        }

        if (toAdresser.Any(a => ParseraEpostadress(a).Equals(InfoAdress, StringComparison.OrdinalIgnoreCase)))
        {
            await SkapaÄrendeFrånInfoMejlAsync(emailId, fromRaw, subjectRaw);
            return Ok();
        }

        return Ok(); // annan mottagaradress vi inte hanterar
    }

    private async Task HanteraSvarPåBefintligtÄrendeAsync(string emailId, string fromRaw, string ticketAdress)
    {
        var ticketNumber = int.Parse(TicketAdressMönster.Match(ticketAdress).Groups[1].Value);
        var fromEpost = ParseraEpostadress(fromRaw);

        var ticket = await _db.SupportTickets
            .Include(t => t.CreatedByUser)
            .FirstOrDefaultAsync(t => t.TicketNumber == ticketNumber);
        if (ticket == null) return;

        // Spoofing-skydd: bara den redan registrerade kontaktadressen för
        // ärendet får lägga till meddelanden via mejl.
        var kändEpost = ticket.ContactEmail ?? ticket.CreatedByUser?.Email;
        if (string.IsNullOrEmpty(kändEpost) || !string.Equals(kändEpost, fromEpost, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(
                "Resend-webhook: avsändare {From} matchar inte ärende {TicketNumber}s registrerade adress — avvisat.",
                fromEpost, ticketNumber);
            return;
        }

        var text = await _email.GetReceivedEmailTextAsync(emailId);
        if (string.IsNullOrWhiteSpace(text))
        {
            _logger.LogWarning(
                "Resend-webhook: inget text/html-innehåll kunde hämtas för email_id {EmailId}, ärende {TicketNumber} — inget svar sparat.",
                emailId, ticketNumber);
            return;
        }

        var sparadText = KlippBortCiterat(text);
        if (string.IsNullOrWhiteSpace(sparadText))
        {
            _logger.LogWarning(
                "Resend-webhook: hela innehållet för email_id {EmailId}, ärende {TicketNumber} tolkades som citerat/tidigare svar — inget nytt svar sparat. Rått innehåll (första 200 tecken): {RawPreview}",
                emailId, ticketNumber, text.Length > 200 ? text[..200] : text);
            return;
        }

        _db.SupportTicketMessages.Add(new SupportTicketMessage
        {
            TicketId   = ticket.Id,
            SenderType = "user",
            Text       = sparadText,
        });
        ticket.UpdatedAt = DateTime.UtcNow;
        ticket.LastUserMessageAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _aktivitetslogg.LogAsync(
            AktörTyper.System, LoggTyper.Ärende,
            $"Svar mottaget via e-post — {ticket.Subject}", $"Mottaget via Resend inbound — SUP-{ticket.TicketNumber:D4}",
            relateratÄrendeId: ticket.Id);

        try
        {
            var frontendUrl = _config["FRONTEND_URL"] ?? "https://samhallsinformation.se";
            await PushDispatcher.DispatchTicketReplyAsync(_db, _push, frontendUrl, ticket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kunde inte skicka push för inbound-svar på ärende {TicketNumber}", ticket.TicketNumber);
        }
    }

    // Ett förstagångsmejl till info@ (ingen svar+-adress, inget befintligt
    // ärende) — öppnar ett nytt ärende precis som SupportController.Create,
    // bara med avsändaren som kontaktadress istället för en inloggad användare.
    private async Task SkapaÄrendeFrånInfoMejlAsync(string emailId, string fromRaw, string? subjectRaw)
    {
        var fromAdress = ParseraEpostadress(fromRaw);
        var fromNamn = ParseraVisningsnamn(fromRaw);

        var text = await _email.GetReceivedEmailTextAsync(emailId);
        if (string.IsNullOrWhiteSpace(text))
        {
            _logger.LogWarning(
                "Resend-webhook: inget text/html-innehåll kunde hämtas för email_id {EmailId} till {InfoAdress} — inget ärende skapat.",
                emailId, InfoAdress);
            return;
        }

        var sparadText = KlippBortCiterat(text);
        if (string.IsNullOrWhiteSpace(sparadText))
        {
            _logger.LogWarning(
                "Resend-webhook: hela innehållet för email_id {EmailId} till {InfoAdress} tolkades som citerat — inget ärende skapat.",
                emailId, InfoAdress);
            return;
        }

        var nextNumber = (await _db.SupportTickets.MaxAsync(t => (int?)t.TicketNumber) ?? 0) + 1;
        var ticket = new SupportTicket
        {
            TicketNumber      = nextNumber,
            Subject           = string.IsNullOrWhiteSpace(subjectRaw) ? "Mejl till info@" : subjectRaw,
            Category          = "Allmän förfrågan",
            Channel           = "info-mejl",
            ContactName       = fromNamn,
            ContactEmail      = fromAdress,
            InboundAddress    = InfoAdress,
            LastUserMessageAt = DateTime.UtcNow,
        };
        _db.SupportTickets.Add(ticket);

        _db.SupportTicketMessages.Add(new SupportTicketMessage
        {
            Ticket     = ticket,
            SenderType = "user",
            Text       = sparadText,
        });

        await _db.SaveChangesAsync();

        await _aktivitetslogg.LogAsync(
            AktörTyper.System, LoggTyper.Ärende,
            $"Ärende öppnat via {InfoAdress} — {ticket.Subject}", $"{ticket.ContactName ?? "Okänd"} — {ticket.Category}",
            relateratÄrendeId: ticket.Id);

        try
        {
            var frontendUrl = _config["FRONTEND_URL"] ?? "https://samhallsinformation.se";
            await PushDispatcher.DispatchNewTicketAsync(_db, _push, frontendUrl, ticket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kunde inte skicka push för nytt info@-ärende {TicketNumber}", ticket.TicketNumber);
        }
    }

    private bool VerifierarSignatur(string rawBody)
    {
        var secret = _config["RESEND_WEBHOOK_SECRET"];
        if (string.IsNullOrEmpty(secret))
        {
            _logger.LogError("RESEND_WEBHOOK_SECRET saknas — kan inte verifiera inkommande webhooks.");
            return false;
        }

        var svixId        = Request.Headers["svix-id"].ToString();
        var svixTimestamp = Request.Headers["svix-timestamp"].ToString();
        var svixSignature = Request.Headers["svix-signature"].ToString();
        if (string.IsNullOrEmpty(svixId) || string.IsNullOrEmpty(svixTimestamp) || string.IsNullOrEmpty(svixSignature))
            return false;

        // Skydd mot replay-attacker — avvisa gamla eller "framtida" tidsstämplar.
        if (!long.TryParse(svixTimestamp, out var ts)) return false;
        var when = DateTimeOffset.FromUnixTimeSeconds(ts);
        if (Math.Abs((DateTimeOffset.UtcNow - when).TotalMinutes) > 5) return false;

        var secretUtanPrefix = secret.StartsWith("whsec_") ? secret["whsec_".Length..] : secret;
        byte[] secretBytes;
        try
        {
            secretBytes = Convert.FromBase64String(secretUtanPrefix);
        }
        catch (FormatException)
        {
            _logger.LogError("RESEND_WEBHOOK_SECRET är inte giltig Base64 — kan inte verifiera inkommande webhooks.");
            return false;
        }
        var signedContent = $"{svixId}.{svixTimestamp}.{rawBody}";

        using var hmac  = new HMACSHA256(secretBytes);
        var beräknad     = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signedContent)));
        var beräknadBytes = Encoding.UTF8.GetBytes(beräknad);

        foreach (var del in svixSignature.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            var sig = del.StartsWith("v1,") ? del["v1,".Length..] : del;
            if (CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(sig), beräknadBytes))
                return true;
        }
        return false;
    }

    private static string ParseraEpostadress(string raw)
    {
        try { return new MailAddress(raw).Address; }
        catch { return raw.Trim(); }
    }

    private static string? ParseraVisningsnamn(string raw)
    {
        try
        {
            var namn = new MailAddress(raw).DisplayName;
            return string.IsNullOrWhiteSpace(namn) ? null : namn;
        }
        catch { return null; }
    }

    // Mejlklienter citerar ofta hela det tidigare svaret under det nya
    // ("> Hej ...", "Den 31 aug 2026 skrev ...", "On Aug 31 ... wrote:") —
    // klipper bort allt från och med första citat-raden så bara det faktiska
    // nya svaret sparas i ärendetråden. Enkel heuristik, täcker de vanligaste
    // klienterna (Gmail/Outlook/Apple Mail), inte garanterat 100% i alla fall.
    private static string KlippBortCiterat(string text)
    {
        var rader = text.Replace("\r\n", "\n").Split('\n');
        var klippVid = rader.Length;
        for (var i = 0; i < rader.Length; i++)
        {
            var rad = rader[i].TrimStart();
            if (rad.StartsWith('>')) { klippVid = i; break; }
            if (rad.StartsWith("On ") && rad.Contains("wrote:")) { klippVid = i; break; }
            if (rad.StartsWith("Den ") && rad.Contains("skrev")) { klippVid = i; break; }
            // Outlooks webbklient citerar utan ">"-prefix eller "skrev"-mening —
            // bara ett rubrikblock ("Från: ... Skickat: ... Till: ... Ämne: ...")
            // ofta föregånget av en understreckad avdelare.
            if (rad.StartsWith("Från:", StringComparison.OrdinalIgnoreCase)) { klippVid = i; break; }
            if (rad.Length >= 3 && rad.All(c => c == '_')) { klippVid = i; break; }
        }
        return string.Join('\n', rader.Take(klippVid)).Trim();
    }
}
