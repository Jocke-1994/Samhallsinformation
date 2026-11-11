namespace Samhallsinformation.Services;

using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

public class ResendEmailService : IEmailService
{
    private readonly HttpClient _http;
    private readonly ILogger<ResendEmailService> _logger;
    private readonly TicketReplyAddress _replyAddress;
    private readonly string _fromNoreply = "noreply@samhallsinformation.se";
    private readonly string _fromSupport = "support@samhallsinformation.se";

    public ResendEmailService(IConfiguration config, TicketReplyAddress replyAddress, ILogger<ResendEmailService> logger)
        : this(CreateClient(config), logger, replyAddress)
    {
    }

    // Test-seam: låter tester injicera en HttpClient med en fejkad handler
    // för att fånga den utgående mejlkroppen. Internal så DI:n bara ser den
    // publika konstruktorn.
    internal ResendEmailService(HttpClient http, ILogger<ResendEmailService> logger, TicketReplyAddress replyAddress)
    {
        _http = http;
        _logger = logger;
        _replyAddress = replyAddress;
    }

    private static HttpClient CreateClient(IConfiguration config)
    {
        var apiKey = config["RESEND_API_KEY"] ?? throw new InvalidOperationException("RESEND_API_KEY saknas");
        var http = new HttpClient { BaseAddress = new Uri("https://api.resend.com") };
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        return http;
    }

    public async Task SendPasswordResetAsync(string toEmail, string toName, string resetLink)
    {
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Återställ ditt lösenord</h2>
              <p style="color:#334155">Hej {EmailHtml.Encode(toName)},</p>
              <p style="color:#334155">Vi fick en förfrågan om att återställa lösenordet för ditt konto. Klicka på knappen nedan för att välja ett nytt lösenord.</p>
              <a href="{EmailHtml.Encode(resetLink)}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Återställ lösenord
              </a>
              <p style="color:#64748b;font-size:13px">Länken är giltig i 1 timme. Om du inte begärde detta kan du ignorera mejlet.</p>
              <p style="color:#64748b;font-size:13px">Har du frågor eller funderingar är du alltid välkommen att höra av dig till oss.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        await SendAsync(_fromNoreply, toEmail, "Återställ ditt lösenord", html);
    }

    public async Task SendEmailVerificationAsync(string toEmail, string toName, string verifyLink)
    {
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Bekräfta din e-postadress</h2>
              <p style="color:#334155">Hej {EmailHtml.Encode(toName)},</p>
              <p style="color:#334155">Klicka på knappen nedan för att bekräfta att det här är din e-postadress.</p>
              <a href="{EmailHtml.Encode(verifyLink)}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Bekräfta e-post
              </a>
              <p style="color:#64748b;font-size:13px">Länken är giltig i 48 timmar. Du kan fortsätta använda ditt konto som vanligt även utan att klicka, men vissa funktioner kan komma att kräva en bekräftad adress längre fram.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        await SendAsync(_fromNoreply, toEmail, "Bekräfta din e-postadress", html);
    }

    public async Task SendEmailChangeConfirmationAsync(string toNewEmail, string toName, string confirmLink)
    {
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Bekräfta din nya e-postadress</h2>
              <p style="color:#334155">Hej {EmailHtml.Encode(toName)},</p>
              <p style="color:#334155">Vi fick en förfrågan om att byta e-postadressen på ditt Samhällsinformation-konto till den här adressen. Klicka på knappen nedan för att bekräfta bytet.</p>
              <a href="{EmailHtml.Encode(confirmLink)}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Bekräfta ny e-postadress
              </a>
              <p style="color:#64748b;font-size:13px">Länken är giltig i 24 timmar. Din nuvarande adress fortsätter fungera som vanligt tills du klickar. Om du inte begärde det här kan du ignorera mejlet.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        await SendAsync(_fromNoreply, toNewEmail, "Bekräfta din nya e-postadress", html);
    }

    public async Task SendEmailChangeNoticeAsync(string toOldEmail, string toName, string newEmail)
    {
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Din e-postadress håller på att bytas</h2>
              <p style="color:#334155">Hej {EmailHtml.Encode(toName)},</p>
              <p style="color:#334155">Någon har begärt att byta e-postadressen på ditt Samhällsinformation-konto till <strong>{EmailHtml.Encode(newEmail)}</strong>. Bytet slår inte igenom förrän den nya adressen bekräftas.</p>
              <p style="color:#334155">Var det inte du som gjorde det här? Logga in och kontrollera ditt konto, eller använd Hjälp &amp; Feedback-knappen i appen för att höra av dig till oss.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        await SendAsync(_fromSupport, toOldEmail, "Din e-postadress håller på att bytas", html);
    }

    public async Task SendAccountDeletionScheduledAsync(string toEmail, string toName, string cancelLink, DateTime deletionScheduledAtUtc)
    {
        var stockholmTz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Stockholm");
        var lokalTid = TimeZoneInfo.ConvertTimeFromUtc(deletionScheduledAtUtc, stockholmTz);
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Ditt konto raderas snart</h2>
              <p style="color:#334155">Hej {EmailHtml.Encode(toName)},</p>
              <p style="color:#334155">Vi har tagit emot en begäran om att radera ditt Samhällsinformation-konto. Om du inte avbryter kommer kontot att raderas <strong>{lokalTid:d MMMM yyyy 'kl.' HH:mm}</strong>.</p>
              <a href="{EmailHtml.Encode(cancelLink)}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Avbryt raderingen
              </a>
              <p style="color:#64748b;font-size:13px">Var det inte du som begärde det här, eller har du ändrat dig? Klicka på knappen ovan när som helst innan tidpunkten ovan. Efter det går raderingen inte att ångra.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        await SendAsync(_fromSupport, toEmail, "Ditt konto raderas snart — klicka för att avbryta", html);
    }

    public async Task SendWelcomeAsync(string toEmail, string toName)
    {
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Välkommen till Samhällsinformation!</h2>
              <p style="color:#334155">Hej {EmailHtml.Encode(toName)},</p>
              <p style="color:#334155">Ditt konto är nu skapat. Du kan nu följa svenska myndigheter och hålla dig uppdaterad om viktig samhällsinformation.</p>
              <p style="color:#334155">Har du frågor eller funderingar är du alltid välkommen att höra av dig till oss.</p>
              <a href="https://samhallsinformation.se" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Gå till Samhällsinformation
              </a>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        await SendAsync(_fromNoreply, toEmail, "Välkommen till Samhällsinformation", html);
    }

    public async Task SendTicketReplyAsync(string toEmail, int ticketNumber, string subject, string replyText, string? fromAddress = null)
    {
        var replyTo = _replyAddress.Build(ticketNumber);
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Svar på ditt ärende — {EmailHtml.EncodeSingleLine(subject)}</h2>
              <p style="color:#334155;white-space:pre-wrap">{EmailHtml.Encode(replyText)}</p>
              <p style="color:#64748b;font-size:13px">Du kan svara direkt på det här mejlet om du har följdfrågor.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        await SendAsync(fromAddress ?? _fromSupport, toEmail, $"Svar på ditt ärende: {EmailHtml.SingleLine(subject)}", html, replyTo);
    }

    public async Task SendAdminAlertsAsync(string toEmail, string toName, IReadOnlyList<AdminAlertMailItem> alerts, string adminUrl)
    {
        var rader = new StringBuilder();
        foreach (var a in alerts)
        {
            var (etikett, färg) = a.Severity switch
            {
                "critical" => ("Kritisk", "#dc2626"),
                "warning" => ("Varning", "#d97706"),
                _ => ("Info", "#2563eb"),
            };
            rader.Append($"""
                <div style="border:1px solid #e2e8f0;border-left:4px solid {färg};border-radius:8px;padding:12px 16px;margin:12px 0">
                  <p style="margin:0 0 4px;color:{färg};font-size:12px;font-weight:700;text-transform:uppercase">{etikett}</p>
                  <p style="margin:0 0 4px;color:#0f172a;font-weight:600">{EmailHtml.EncodeSingleLine(a.Title)}</p>
                  <p style="margin:0;color:#475569;font-size:14px">{EmailHtml.Encode(a.Detail)}</p>
                </div>
                """);
        }

        var html = $"""
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Driftlarm</h2>
              <p style="color:#334155">Hej {EmailHtml.Encode(toName)},</p>
              <p style="color:#334155">Övervakningen har upptäckt {(alerts.Count == 1 ? "ett nytt larm" : $"{alerts.Count} nya larm")}:</p>
              {rader}
              <a href="{EmailHtml.Encode(adminUrl)}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Öppna adminpanelen
              </a>
              <p style="color:#64748b;font-size:13px">Kvittera larmet under Felsökning &rarr; Larm när du har tagit hand om det. Du får bara ett mejl per nytt larm.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        var subject = alerts.Count == 1
            ? $"Driftlarm: {EmailHtml.SingleLine(alerts[0].Title)}"
            : $"Driftlarm: {alerts.Count} nya larm";

        await SendAsync(_fromNoreply, toEmail, subject, html);
    }

    public async Task<string?> GetReceivedEmailTextAsync(string emailId) =>
        (await GetReceivedEmailAsync(emailId))?.Text;

    public async Task<ReceivedEmail?> GetReceivedEmailAsync(string emailId)
    {
        var res = await _http.GetAsync($"/emails/receiving/{Uri.EscapeDataString(emailId)}");
        var body = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "Resend: GET /emails/receiving/{EmailId} gav {StatusCode} — {Body}",
                emailId, (int)res.StatusCode, body.Length > 300 ? body[..300] : body);
            return null;
        }

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var authentication = ParseraAutentisering(root);

        var text = HämtaSträng(root, "text");
        if (!string.IsNullOrWhiteSpace(text)) return new ReceivedEmail(text, authentication);

        // Resends "text"-fält är null om mejlet saknar en text/plain-del —
        // vanligt för svar skickade från Outlook/Hotmails webbklient (bara
        // HTML). Faller tillbaka på html-fältet istället för att tyst tappa
        // svaret helt.
        var html = HämtaSträng(root, "html");
        if (!string.IsNullOrWhiteSpace(html)) return new ReceivedEmail(HtmlTillText(html), authentication);

        _logger.LogWarning(
            "Resend: GET /emails/receiving/{EmailId} gav 200 men både text och html var tomma — {Body}",
            emailId, body.Length > 300 ? body[..300] : body);
        return new ReceivedEmail(null, authentication);
    }

    // "authentication": { "spf": "pass", "dkim": "pass", "dmarc": "pass" } — eller null/saknas (äldre mejl).
    // Okända former behandlas som "ingen autentisering" (fail-closed hos anroparen), aldrig som ett fel.
    private static ReceivedEmailAuthentication? ParseraAutentisering(JsonElement root)
    {
        if (!root.TryGetProperty("authentication", out var auth) || auth.ValueKind != JsonValueKind.Object) return null;
        return new ReceivedEmailAuthentication(HämtaSträng(auth, "spf"), HämtaSträng(auth, "dkim"), HämtaSträng(auth, "dmarc"));
    }

    private static string? HämtaSträng(JsonElement obj, string namn) =>
        obj.TryGetProperty(namn, out var el) && el.ValueKind == JsonValueKind.String ? el.GetString() : null;

    // V4-1b (E3#12): den här HTML:en kommer från Resends inbound-webhook — signaturen
    // bevisar att Resend skickade den, men INTE att avsändaren (vem som helst som mejlar
    // info@) skrev ofarlig HTML. Utan matchTimeout kan patologisk indata (t.ex. många
    // oavslutade <script>/< utan matchande stängning) låsa en request-tråd i sekunder
    // till minuter via kvadratisk körtid. matchTimeout är en parameter (inte bara en
    // konstant) så tester kan simulera en timeout utan att bygga en riktigt patologisk
    // sträng eller vänta på den verkliga gränsen.
    private static readonly TimeSpan DefaultHtmlRegexTimeout = TimeSpan.FromSeconds(2);
    private const int HtmlFallbackMaxLength = 5000;

    internal string HtmlTillText(string html, TimeSpan? matchTimeout = null)
    {
        var timeout = matchTimeout ?? DefaultHtmlRegexTimeout;
        try
        {
            var utanScriptStyle = Regex.Replace(html, @"<(script|style)[^>]*>[\s\S]*?</\1>", "", RegexOptions.IgnoreCase, timeout);
            var medRadbrytningar = Regex.Replace(utanScriptStyle, @"<(br|/p|/div|/li)\s*/?>", "\n", RegexOptions.IgnoreCase, timeout);
            var utanTaggar = Regex.Replace(medRadbrytningar, "<[^>]+>", "", RegexOptions.None, timeout);
            var avkodad = System.Net.WebUtility.HtmlDecode(utanTaggar);
            return Regex.Replace(avkodad, @"\n{3,}", "\n\n", RegexOptions.None, timeout).Trim();
        }
        catch (RegexMatchTimeoutException ex)
        {
            _logger.LogWarning(ex,
                "HtmlTillText: regex-timeout på {Length} tecken HTML — faller tillbaka på en enkel, avkortad text utan regex",
                html.Length);
            return StripTagsUtanRegex(html, HtmlFallbackMaxLength);
        }
    }

    // Fallback när den vanliga vägen timeoutar: en enkel, garanterat linjär
    // tagg-strippning (ingen bakåtspårning möjlig) plus en hård längdgräns. Mindre
    // snygg än den vanliga vägen (ingen radbrytnings-/entitetshantering utöver
    // HtmlDecode), men kan aldrig hänga.
    private static string StripTagsUtanRegex(string html, int maxLength)
    {
        var kapad = html.Length > maxLength ? html[..maxLength] : html;
        var sb = new StringBuilder(kapad.Length);
        var inneITagg = false;
        foreach (var c in kapad)
        {
            if (c == '<') { inneITagg = true; continue; }
            if (c == '>') { inneITagg = false; continue; }
            if (!inneITagg) sb.Append(c);
        }

        var text = System.Net.WebUtility.HtmlDecode(sb.ToString());
        return (text.Length > maxLength ? text[..maxLength] : text).Trim();
    }

    private async Task SendAsync(string from, string to, string subject, string html, string? replyTo = null)
    {
        object payload = replyTo == null
            ? new { from, to, subject, html }
            : new { from, to, subject, html, reply_to = replyTo };
        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var res = await _http.PostAsync("/emails", content);
        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync();
            throw new Exception($"Resend-fel {res.StatusCode}: {body}");
        }
    }
}
