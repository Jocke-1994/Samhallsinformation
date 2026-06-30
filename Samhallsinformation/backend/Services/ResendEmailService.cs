namespace Samhallsinformation.Services;

using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

public class ResendEmailService : IEmailService
{
    private readonly HttpClient _http;
    private readonly string _fromNoreply = "noreply@samhallsinformation.se";

    public ResendEmailService(IConfiguration config)
    {
        var apiKey = config["RESEND_API_KEY"] ?? throw new InvalidOperationException("RESEND_API_KEY saknas");
        _http = new HttpClient { BaseAddress = new Uri("https://api.resend.com") };
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
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
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        await SendAsync(_fromNoreply, toEmail, "Återställ ditt lösenord", html);
    }

    public async Task SendWelcomeAsync(string toEmail, string toName)
    {
        var html = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#7c3aed;margin-bottom:8px">Välkommen till Samhällsinformation!</h2>
              <p style="color:#334155">Hej {toName},</p>
              <p style="color:#334155">Ditt konto är nu skapat. Du kan nu följa svenska myndigheter och hålla dig uppdaterad om viktig samhällsinformation.</p>
              <a href="https://samhallsinformation.se" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
                Gå till Samhällsinformation
              </a>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#94a3b8;font-size:12px">Samhällsinformation &mdash; opartisk myndighetsinformation</p>
            </div>
            """;

        await SendAsync(_fromNoreply, toEmail, "Välkommen till Samhällsinformation", html);
    }

    private async Task SendAsync(string from, string to, string subject, string html)
    {
        var payload = JsonSerializer.Serialize(new { from, to, subject, html });
        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var res = await _http.PostAsync("/emails", content);
        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync();
            throw new Exception($"Resend-fel {res.StatusCode}: {body}");
        }
    }
}
