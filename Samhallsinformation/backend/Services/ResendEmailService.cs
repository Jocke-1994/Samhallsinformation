namespace Samhallsinformation.Services;

using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

public class ResendEmailService : IEmailService
{
    private readonly HttpClient _http;
    private readonly ILogger<ResendEmailService> _logger;
    private readonly string _fromNoreply = "noreply@samhallsinformation.se";
    private readonly string _fromSupport = "support@samhallsinformation.se";

    public ResendEmailService(IConfiguration config, ILogger<ResendEmailService> logger)
    {
        var apiKey = config["RESEND_API_KEY"] ?? throw new InvalidOperationException("RESEND_API_KEY saknas");
        _http = new HttpClient { BaseAddress = new Uri("https://api.resend.com") };
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        _logger = logger;
    }

    public async Task SendPasswordResetAsync(string toEmail, string toName, string resetLink)
    {
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Återställ ditt lösenord</h2>
              <p style="color:#334155">Hej {toName},</p>
              <p style="color:#334155">Vi fick en förfrågan om att återställa lösenordet för ditt konto. Klicka på knappen nedan för att välja ett nytt lösenord.</p>
              <a href="{resetLink}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
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
              <p style="color:#334155">Hej {toName},</p>
              <p style="color:#334155">Klicka på knappen nedan för att bekräfta att det här är din e-postadress.</p>
              <a href="{verifyLink}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
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
              <p style="color:#334155">Hej {toName},</p>
              <p style="color:#334155">Vi fick en förfrågan om att byta e-postadressen på ditt Samhällsinformation-konto till den här adressen. Klicka på knappen nedan för att bekräfta bytet.</p>
              <a href="{confirmLink}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
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
              <p style="color:#334155">Hej {toName},</p>
              <p style="color:#334155">Någon har begärt att byta e-postadressen på ditt Samhällsinformation-konto till <strong>{newEmail}</strong>. Bytet slår inte igenom förrän den nya adressen bekräftas.</p>
              <p style="color:#334155">Var det inte du som gjorde det här? Logga in och kontrollera ditt konto, eller använd Hjälp &amp; Feedback-knappen i appen för att höra av dig till oss.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        await SendAsync(_fromSupport, toOldEmail, "Din e-postadress håller på att bytas", html);
    }

    public async Task SendWelcomeAsync(string toEmail, string toName)
    {
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Välkommen till Samhällsinformation!</h2>
              <p style="color:#334155">Hej {toName},</p>
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

    public async Task SendTicketReplyAsync(string toEmail, int ticketNumber, string subject, string replyText)
    {
        var replyTo = $"svar+{ticketNumber}@samhallsinformation.se";
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Svar på ditt ärende — {subject}</h2>
              <p style="color:#334155;white-space:pre-wrap">{System.Net.WebUtility.HtmlEncode(replyText)}</p>
              <p style="color:#64748b;font-size:13px">Du kan svara direkt på det här mejlet om du har följdfrågor.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        await SendAsync(_fromSupport, toEmail, $"Svar på ditt ärende: {subject}", html, replyTo);
    }

    public async Task<string?> GetReceivedEmailTextAsync(string emailId)
    {
        var res = await _http.GetAsync($"/emails/receiving/{emailId}");
        var body = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "Resend: GET /emails/receiving/{EmailId} gav {StatusCode} — {Body}",
                emailId, (int)res.StatusCode, body.Length > 300 ? body[..300] : body);
            return null;
        }

        using var doc = JsonDocument.Parse(body);
        var text = doc.RootElement.TryGetProperty("text", out var textEl) ? textEl.GetString() : null;
        if (!string.IsNullOrWhiteSpace(text)) return text;

        // Resends "text"-fält är null om mejlet saknar en text/plain-del —
        // vanligt för svar skickade från Outlook/Hotmails webbklient (bara
        // HTML). Faller tillbaka på html-fältet istället för att tyst tappa
        // svaret helt.
        var html = doc.RootElement.TryGetProperty("html", out var htmlEl) ? htmlEl.GetString() : null;
        if (!string.IsNullOrWhiteSpace(html)) return HtmlTillText(html);

        _logger.LogWarning(
            "Resend: GET /emails/receiving/{EmailId} gav 200 men både text och html var tomma — {Body}",
            emailId, body.Length > 300 ? body[..300] : body);
        return null;
    }

    private static string HtmlTillText(string html)
    {
        var utanScriptStyle = Regex.Replace(html, @"<(script|style)[^>]*>[\s\S]*?</\1>", "", RegexOptions.IgnoreCase);
        var medRadbrytningar = Regex.Replace(utanScriptStyle, @"<(br|/p|/div|/li)\s*/?>", "\n", RegexOptions.IgnoreCase);
        var utanTaggar = Regex.Replace(medRadbrytningar, "<[^>]+>", "");
        var avkodad = System.Net.WebUtility.HtmlDecode(utanTaggar);
        return Regex.Replace(avkodad, @"\n{3,}", "\n\n").Trim();
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
