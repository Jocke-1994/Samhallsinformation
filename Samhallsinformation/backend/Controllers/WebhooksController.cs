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

// Tar emot Resends inbound-webhook (event "email.received") när någon svarar
// på ett ärendesvar-mejl skickat till svar+{ticketNumber}@samhallsinformation.se
// (se ResendEmailService.SendTicketReplyAsync). Webhooken innehåller bara
// metadata — själva texten hämtas separat via Resends Received Emails-API.
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

    private readonly AppDbContext _db;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;
    private readonly IAktivitetsloggService _aktivitetslogg;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(AppDbContext db, IEmailService email, IConfiguration config, IAktivitetsloggService aktivitetslogg, ILogger<WebhooksController> logger)
    {
        _db = db;
        _email = email;
        _config = config;
        _aktivitetslogg = aktivitetslogg;
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
        var toAdresser = data.TryGetProperty("to", out var toEl)
            ? toEl.EnumerateArray().Select(e => e.GetString() ?? "").ToList()
            : [];

        var ticketAdress = toAdresser.FirstOrDefault(a => TicketAdressMönster.IsMatch(a));
        if (ticketAdress == null || emailId == null) return Ok();

        var ticketNumber = int.Parse(TicketAdressMönster.Match(ticketAdress).Groups[1].Value);
        var fromEpost = ParseraEpostadress(fromRaw);

        var ticket = await _db.SupportTickets
            .Include(t => t.CreatedByUser)
            .FirstOrDefaultAsync(t => t.TicketNumber == ticketNumber);
        if (ticket == null) return Ok();

        // Spoofing-skydd: bara den redan registrerade kontaktadressen för
        // ärendet får lägga till meddelanden via mejl.
        var kändEpost = ticket.ContactEmail ?? ticket.CreatedByUser?.Email;
        if (string.IsNullOrEmpty(kändEpost) || !string.Equals(kändEpost, fromEpost, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(
                "Resend-webhook: avsändare {From} matchar inte ärende {TicketNumber}s registrerade adress — avvisat.",
                fromEpost, ticketNumber);
            return Ok();
        }

        var text = await _email.GetReceivedEmailTextAsync(emailId);
        if (string.IsNullOrWhiteSpace(text)) return Ok();

        _db.SupportTicketMessages.Add(new SupportTicketMessage
        {
            TicketId   = ticket.Id,
            SenderType = "user",
            Text       = KlippBortCiterat(text),
        });
        ticket.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _aktivitetslogg.LogAsync(
            AktörTyper.System, LoggTyper.Ärende,
            $"Svar mottaget via e-post — {ticket.Subject}", $"Mottaget via Resend inbound — SUP-{ticket.TicketNumber:D4}",
            relateratÄrendeId: ticket.Id);

        return Ok();
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
        var secretBytes      = Convert.FromBase64String(secretUtanPrefix);
        var signedContent    = $"{svixId}.{svixTimestamp}.{rawBody}";

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
        }
        return string.Join('\n', rader.Take(klippVid)).Trim();
    }
}
