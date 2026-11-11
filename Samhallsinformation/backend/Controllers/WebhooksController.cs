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
using Samhallsinformation.Application.Auth;
using Samhallsinformation.Data;
using Samhallsinformation.Models;
using Samhallsinformation.Services;

// Tar emot Resends inbound-webhook (event "email.received") — antingen ett
// svar på ett ärendesvar-mejl (svar+{ticketNumber}-{token}@samhallsinformation.se, se TicketReplyAddress och
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
    // svar+{ticketnummer}@ (äldre adresser, redan utskickade) eller svar+{ticketnummer}-{token}@ (E1#10).
    // Grupp 2 är bara "lyckad" när ett bindestreck fanns — då måste token vara giltig, även om den är tom eller skräp.
    private static readonly Regex TicketAdressMönster = new(@"^svar\+(\d+)(?:-([^@]*))?@", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private const string InfoAdress = "info@samhallsinformation.se";
    private const string OverifieratPrefix = "Ej verifierat mejl";

    // Högst 9 siffror i ärendenumret — alltid inom int-intervallet (int.MaxValue har 10).
    private const int MaxTicketSiffror = 9;

    // Idempotens utan schemaändring: webhooken sparar varken svix-id eller email_id, så samma
    // mejl som levereras igen (Resend-retry efter förlorat svar, replay inom signaturens
    // 5-minutersfönster) känns igen på samma avsändare + samma text inom detta fönster.
    // Avvägning: ett medvetet identiskt svar ("Tack!") inom timmen från samma ärende sväljs.
    // Den robusta lösningen är en unik kolumn för email_id (kräver migrering) — se PR-texten.
    private static readonly TimeSpan DubblettFönster = TimeSpan.FromHours(1);

    // Serialiserar dubblettkoll + insert (och MaxAsync+1) så två samtidiga leveranser av samma
    // mejl inte bägge passerar kollen. Gäller bara inom en processinstans.
    private static readonly SemaphoreSlim _bearbetningsLås = new(1, 1);

    // Antal svar sedan uppstart som accepterats trots att Resend inte levererade något authentication-objekt.
    private static long _utanAutentiseringAntal;

    private readonly AppDbContext _db;
    private readonly IEmailService _email;
    private readonly IConfiguration _config;
    private readonly IAktivitetsloggService _aktivitetslogg;
    private readonly IPushNotificationService _push;
    private readonly TicketReplyAddress _replyAddress;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(AppDbContext db, IEmailService email, IConfiguration config, IAktivitetsloggService aktivitetslogg, IPushNotificationService push, TicketReplyAddress replyAddress, ILogger<WebhooksController> logger)
    {
        _db = db;
        _email = email;
        _config = config;
        _aktivitetslogg = aktivitetslogg;
        _push = push;
        _replyAddress = replyAddress;
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

        // Payloaden är signerad av Svix men innehållet (t.ex. "to") styrs av mejlets
        // avsändare — parsningen måste tåla vilken form som helst. Resend/Svix
        // retriar på icke-2xx (och kan till slut stänga av endpointen), så en payload vi
        // inte kan tolka besvaras med 200 efter loggning: en retry skulle ge samma resultat.
        var payload = ParseraInkorgsPayload(rawBody);
        if (payload == null) return Ok();

        var (emailId, fromRaw, subjectRaw, toAdresser) = payload.Value;

        var ticketAdress = toAdresser.FirstOrDefault(a => TicketAdressMönster.IsMatch(a));
        if (ticketAdress != null)
        {
            var träff = TicketAdressMönster.Match(ticketAdress);
            var siffror = träff.Groups[1].Value;
            if (siffror.Length > MaxTicketSiffror || !int.TryParse(siffror, out var ticketNumber))
            {
                _logger.LogWarning(
                    "Resend-webhook: ogiltigt ärendenummer i mottagaradressen (för många siffror eller utanför intervall) för email_id {EmailId} — ignorerad.",
                    emailId);
                return Ok();
            }

            // Icke-gissningsbar komponent (E1#10): en adress MED token måste ha en giltig sådan. Kontrollen är ren
            // beräkning — ogiltiga försök avvisas innan något slås upp i databasen eller hämtas från Resend.
            // Adresser utan token är mejl som redan skickats innan token infördes och tillåts tills vidare
            // (de skyddas då bara av avsändarmatchningen och SPF/DKIM-kontrollen nedan) men flaggas i loggen.
            var harToken = träff.Groups[2].Success;
            if (harToken && !_replyAddress.IsValid(ticketNumber, träff.Groups[2].Value))
            {
                _logger.LogWarning(
                    "Resend-webhook: ogiltig token i svarsadressen för ärende {TicketNumber}, email_id {EmailId} — avvisat.",
                    ticketNumber, emailId);
                return Ok();
            }
            if (!harToken)
            {
                // SUPPORT_REPLY_ACCEPT_LEGACY=false stänger äldre adresser när de utskickade mejlen "gått ut" —
                // först då ger token ett faktiskt skydd (annars kan en angripare bara utelämna den).
                if (string.Equals(_config["SUPPORT_REPLY_ACCEPT_LEGACY"], "false", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning(
                        "Resend-webhook: svarsadress utan token för ärende {TicketNumber} (email_id {EmailId}) — äldre adresser är avstängda, avvisat.",
                        ticketNumber, emailId);
                    return Ok();
                }
                _logger.LogWarning(
                    "Resend-webhook: svar på ärende {TicketNumber} kom till en äldre svarsadress utan token (email_id {EmailId}) — ej token-verifierad.",
                    ticketNumber, emailId);
            }

            await HanteraSvarPåBefintligtÄrendeAsync(emailId, fromRaw, ticketNumber);
            return Ok();
        }

        if (toAdresser.Any(a => ParseraEpostadress(a).Equals(InfoAdress, StringComparison.OrdinalIgnoreCase)))
        {
            await SkapaÄrendeFrånInfoMejlAsync(emailId, fromRaw, subjectRaw);
            return Ok();
        }

        return Ok(); // annan mottagaradress vi inte hanterar
    }

    // Defensiv tolkning av Resends payload. Returnerar null (och loggar) om det inte är ett
    // "email.received"-event vi kan agera på: ogiltig JSON, fel form på root/data, saknat eller
    // felaktigt typat email_id eller from, annan event-typ. Fel typer på subject/to behandlas som
    // "saknas" i stället för att kasta.
    private (string EmailId, string From, string? Subject, List<string> To)? ParseraInkorgsPayload(string rawBody)
    {
        try
        {
            using var doc = JsonDocument.Parse(rawBody);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return LoggaOgiltig("root är inte ett objekt");

            if (!root.TryGetProperty("type", out var typeEl) || typeEl.ValueKind != JsonValueKind.String
                || typeEl.GetString() != "email.received")
                return null; // andra event-typer (delivered, bounced m.fl.) ignoreras tyst

            if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
                return LoggaOgiltig("data saknas eller är inte ett objekt");

            var emailId = HämtaSträng(data, "email_id");
            if (string.IsNullOrWhiteSpace(emailId)) return LoggaOgiltig("email_id saknas eller är inte en sträng");

            var toAdresser = new List<string>();
            if (data.TryGetProperty("to", out var toEl) && toEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var e in toEl.EnumerateArray())
                    if (e.ValueKind == JsonValueKind.String) toAdresser.Add(e.GetString() ?? "");
            }

            // Utan avsändare går varken spoofingkontrollen eller ett svar att göra något av.
            var from = HämtaSträng(data, "from");
            if (string.IsNullOrWhiteSpace(from)) return LoggaOgiltig("from saknas eller är inte en sträng");

            return (emailId, from, HämtaSträng(data, "subject"), toAdresser);
        }
        catch (JsonException ex)
        {
            return LoggaOgiltig($"ogiltig JSON ({ex.Message})");
        }

        (string, string, string?, List<string>)? LoggaOgiltig(string orsak)
        {
            _logger.LogWarning("Resend-webhook: payload kunde inte tolkas ({Orsak}) — ignorerad.", orsak);
            return null;
        }
    }

    private static string? HämtaSträng(JsonElement obj, string namn) =>
        obj.TryGetProperty(namn, out var el) && el.ValueKind == JsonValueKind.String ? el.GetString() : null;

    private async Task HanteraSvarPåBefintligtÄrendeAsync(string emailId, string fromRaw, int ticketNumber)
    {
        var fromEpost = ParseraEpostadress(fromRaw);

        var ticket = await _db.SupportTickets
            .Include(t => t.CreatedByUser)
            .FirstOrDefaultAsync(t => t.TicketNumber == ticketNumber);
        if (ticket == null) return;

        // Spoofing-skydd, steg 1: bara den redan registrerade kontaktadressen för
        // ärendet får lägga till meddelanden via mejl. Jämförs normaliserat (skiftlägesokänsligt).
        // Enbart detta räcker inte — From-headern kan förfalskas — därför steg 2 nedan.
        var kändEpost = EmailNormalizer.Normalize(ticket.ContactEmail ?? ticket.CreatedByUser?.Email);
        if (kändEpost.Length == 0 || kändEpost != EmailNormalizer.Normalize(fromEpost))
        {
            _logger.LogWarning(
                "Resend-webhook: avsändare {From} matchar inte ärende {TicketNumber}s registrerade adress — avvisat.",
                fromEpost, ticketNumber);
            return;
        }

        var mejl = await _email.GetReceivedEmailAsync(emailId);
        if (mejl == null || string.IsNullOrWhiteSpace(mejl.Text))
        {
            _logger.LogWarning(
                "Resend-webhook: inget text/html-innehåll kunde hämtas för email_id {EmailId}, ärende {TicketNumber} — inget svar sparat.",
                emailId, ticketNumber);
            return;
        }
        var text = mejl.Text;

        // Spoofing-skydd, steg 2 (E1#10): avsändarens From-domän ska ha klarat DMARC eller DKIM hos Resends
        // mottagande server. Annars läggs mejlet INTE in som kundens meddelande (ingen push, ingen oläst-markering,
        // ärendets status/tidsstämplar rörs inte) utan som en tydligt märkt intern anteckning som support kan bedöma.
        //  - SUPPORT_REPLY_REQUIRE_AUTH=false: kravet är avstängt (kill-switch), utfallet loggas bara.
        //  - authentication saknas helt (null/fältet finns inte, t.ex. äldre mejl): kan inte verifieras — accepteras som förut
        //    med en Warning och en räknare. Ett falskt mejl bedöms alltid av Resends mottagande server, så för det finns objektet.
        //  - objektet finns men varken dmarc eller dkim är pass: flaggad intern anteckning.
        var kravAktivt = !string.Equals(_config["SUPPORT_REPLY_REQUIRE_AUTH"], "false", StringComparison.OrdinalIgnoreCase);
        if (mejl.Authentication == null)
        {
            var antal = Interlocked.Increment(ref _utanAutentiseringAntal);
            _logger.LogWarning(
                "Resend-webhook: authentication saknas — kunde inte verifiera avsändaren, accepterar (ärende {TicketNumber}, email_id {EmailId}; {Antal} sådana sedan uppstart).",
                ticket.TicketNumber, emailId, antal);
        }
        else if (!mejl.Authentication.IsSenderVerified)
        {
            if (kravAktivt)
            {
                await SparaOverifieratMejlSomInternAnteckningAsync(ticket, emailId, fromEpost, text, mejl.Authentication);
                return;
            }
            _logger.LogWarning(
                "Resend-webhook: avsändaren {From} för ärende {TicketNumber} klarade inte SPF/DKIM/DMARC ({Utfall}), email_id {EmailId} — SUPPORT_REPLY_REQUIRE_AUTH=false, accepterar ändå.",
                fromEpost, ticket.TicketNumber, mejl.Authentication, emailId);
        }

        var sparadText = KlippBortCiterat(text);
        if (string.IsNullOrWhiteSpace(sparadText))
        {
            _logger.LogWarning(
                "Resend-webhook: hela innehållet för email_id {EmailId}, ärende {TicketNumber} tolkades som citerat/tidigare svar — inget nytt svar sparat. Rått innehåll (första 200 tecken): {RawPreview}",
                emailId, ticketNumber, text.Length > 200 ? text[..200] : text);
            return;
        }

        await _bearbetningsLås.WaitAsync();
        try
        {
            // Idempotens (Resend-retry / replay): samma text från samma ärende inom
            // dubblettfönstret är samma mejl levererat igen. Se DubblettFönster.
            var gräns = DateTime.UtcNow - DubblettFönster;
            var redanSparat = await _db.SupportTicketMessages.AnyAsync(m =>
                m.TicketId == ticket.Id && m.SenderType == "user" && m.Text == sparadText && m.CreatedAt >= gräns);
            if (redanSparat)
            {
                _logger.LogInformation(
                    "Resend-webhook: email_id {EmailId} redan mottaget för ärende {TicketNumber} (dubblettleverans) — hoppar över.",
                    emailId, ticketNumber);
                return;
            }

            _db.SupportTicketMessages.Add(new SupportTicketMessage
            {
                TicketId = ticket.Id,
                SenderType = "user",
                Text = sparadText,
            });
            ticket.UpdatedAt = DateTime.UtcNow;
            ticket.LastUserMessageAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
        finally
        {
            _bearbetningsLås.Release();
        }

        // Loggning och push är "best effort" efter lyckad SaveChanges: ett fel här får inte ge
        // 500, då retriar Resend och meddelandet sparas en gång till.
        try
        {
            await _aktivitetslogg.LogAsync(
                AktörTyper.System, LoggTyper.Ärende,
                $"Svar mottaget via e-post — {ticket.Subject}", $"Mottaget via Resend inbound — SUP-{ticket.TicketNumber:D4}",
                relateratÄrendeId: ticket.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kunde inte aktivitetsloggen för inbound-svar på ärende {TicketNumber}", ticket.TicketNumber);
        }

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

    // Ett svar vars avsändare Resend inte kunde autentisera (E1#10) sparas som en intern anteckning
    // (osynlig för kunden) i stället för som kundens meddelande. Ingen push, inget LastUserMessageAt/UpdatedAt —
    // en angripare ska inte kunna väcka support eller flytta ärendet. Högst en sådan anteckning per ärende och
    // timme (samma fönster som dubblettskyddet), så förfalskade mejl inte kan fylla tråden med skräp.
    private async Task SparaOverifieratMejlSomInternAnteckningAsync(
        SupportTicket ticket, string emailId, string fromEpost, string text, ReceivedEmailAuthentication? auth)
    {
        var utfall = auth?.ToString() ?? "utfall saknas";
        _logger.LogWarning(
            "Resend-webhook: avsändaren {From} för ärende {TicketNumber} kunde inte autentiseras ({Utfall}), email_id {EmailId} — sparas inte som kundsvar.",
            fromEpost, ticket.TicketNumber, utfall, emailId);

        var förhandsvisning = KlippBortCiterat(text);
        if (förhandsvisning.Length > 500) förhandsvisning = förhandsvisning[..500] + "…";

        await _bearbetningsLås.WaitAsync();
        try
        {
            var gräns = DateTime.UtcNow - DubblettFönster;
            var redanFlaggat = await _db.SupportTicketMessages.AnyAsync(m =>
                m.TicketId == ticket.Id && m.IsInternal && m.Text.StartsWith(OverifieratPrefix) && m.CreatedAt >= gräns);
            if (redanFlaggat) return;

            _db.SupportTicketMessages.Add(new SupportTicketMessage
            {
                TicketId = ticket.Id,
                SenderType = "agent",
                IsInternal = true,
                Text = $"{OverifieratPrefix} — avsändaren ({fromEpost}) kunde inte autentiseras (SPF/DKIM/DMARC: {utfall}). " +
                             $"Mejlet har INTE lagts in som kundens svar och ingen notis har skickats. Bedöm avsändaren innan du agerar. " +
                             $"[email_id {emailId}] Innehåll (klippt): {förhandsvisning}",
            });
            await _db.SaveChangesAsync();
        }
        finally
        {
            _bearbetningsLås.Release();
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

        SupportTicket ticket;
        await _bearbetningsLås.WaitAsync();
        try
        {
            // Idempotens (Resend-retry / replay): ett info-ärende från samma avsändare med
            // samma text inom dubblettfönstret är samma mejl levererat igen. Se DubblettFönster.
            var gräns = DateTime.UtcNow - DubblettFönster;
            var redanSkapat = await _db.SupportTicketMessages.AnyAsync(m =>
                m.Ticket.Channel == "info-mejl" && m.Ticket.ContactEmail == fromAdress
                && m.SenderType == "user" && m.Text == sparadText && m.CreatedAt >= gräns);
            if (redanSkapat)
            {
                _logger.LogInformation(
                    "Resend-webhook: email_id {EmailId} till {InfoAdress} har redan ett ärende (dubblettleverans) — hoppar över.",
                    emailId, InfoAdress);
                return;
            }

            // Obs: MaxAsync + 1 är racy mot samtidiga skapanden från andra instanser/SupportController
            // (unikt index ger då DbUpdateException). Låset här skyddar bara inbound-vägen i en instans.
            var nextNumber = (await _db.SupportTickets.MaxAsync(t => (int?)t.TicketNumber) ?? 0) + 1;
            ticket = new SupportTicket
            {
                TicketNumber = nextNumber,
                Subject = string.IsNullOrWhiteSpace(subjectRaw) ? "Mejl till info@" : subjectRaw,
                Category = "Allmän förfrågan",
                Channel = "info-mejl",
                ContactName = fromNamn,
                ContactEmail = fromAdress,
                InboundAddress = InfoAdress,
                LastUserMessageAt = DateTime.UtcNow,
            };
            _db.SupportTickets.Add(ticket);

            _db.SupportTicketMessages.Add(new SupportTicketMessage
            {
                Ticket = ticket,
                SenderType = "user",
                Text = sparadText,
            });

            await _db.SaveChangesAsync();
        }
        finally
        {
            _bearbetningsLås.Release();
        }

        try
        {
            await _aktivitetslogg.LogAsync(
                AktörTyper.System, LoggTyper.Ärende,
                $"Ärende öppnat via {InfoAdress} — {ticket.Subject}", $"{ticket.ContactName ?? "Okänd"} — {ticket.Category}",
                relateratÄrendeId: ticket.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Kunde inte aktivitetsloggen för nytt info@-ärende {TicketNumber}", ticket.TicketNumber);
        }

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

        var svixId = Request.Headers["svix-id"].ToString();
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

        using var hmac = new HMACSHA256(secretBytes);
        var beräknad = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signedContent)));
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
