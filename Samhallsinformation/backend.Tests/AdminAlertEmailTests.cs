namespace Samhallsinformation.Tests;

using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Samhallsinformation.Services;
using Xunit;

// V1-9: driftlarmsmejlet. Källnamn och feltexter kommer från externa källor och ska aldrig
// passera som HTML (samma regel som V2-13).
public class AdminAlertEmailTests
{
    private sealed class CapturingHandler : HttpMessageHandler
    {
        public string? To { get; private set; }
        public string? Subject { get; private set; }
        public string? Html { get; private set; }
        public int Calls { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++;
            var body = await request.Content!.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            To      = doc.RootElement.GetProperty("to").GetString();
            Subject = doc.RootElement.GetProperty("subject").GetString();
            Html    = doc.RootElement.GetProperty("html").GetString();
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") };
        }
    }

    private static (ResendEmailService svc, CapturingHandler handler) Create()
    {
        var handler = new CapturingHandler();
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://api.resend.com") };
        return (new ResendEmailService(http, NullLogger<ResendEmailService>.Instance, new TicketReplyAddress("test-secret-0123456789")), handler);
    }

    [Fact]
    public async Task SendAdminAlerts_HtmlInTitleDetailAndName_IsEncoded()
    {
        var (svc, handler) = Create();
        var ond = "<script>alert(1)</script>";
        var larm = new[] { new AdminAlertMailItem("critical", $"Källan \"{ond}\"", $"Fel: {ond}", DateTime.UtcNow) };

        await svc.SendAdminAlertsAsync("admin@example.se", ond, larm, "https://samhallsinformation.se/admin");

        Assert.Equal(1, handler.Calls);
        Assert.DoesNotContain("<script>", handler.Html);
        Assert.Contains("&lt;script&gt;alert(1)&lt;/script&gt;", handler.Html);
        Assert.Equal("admin@example.se", handler.To);
        Assert.Contains("https://samhallsinformation.se/admin", handler.Html);
    }

    [Fact]
    public async Task SendAdminAlerts_SubjectIsSingleLine_AndCountsMultipleAlerts()
    {
        var (svc, handler) = Create();

        await svc.SendAdminAlertsAsync("a@b.se", "Anna",
            new[] { new AdminAlertMailItem("warning", "Rad ett\r\nBcc: evil@x.se", "d", DateTime.UtcNow) }, "https://x/admin");
        Assert.DoesNotContain('\n', handler.Subject!);
        Assert.DoesNotContain('\r', handler.Subject!);

        await svc.SendAdminAlertsAsync("a@b.se", "Anna",
            new[]
            {
                new AdminAlertMailItem("warning", "A", "d", DateTime.UtcNow),
                new AdminAlertMailItem("critical", "B", "d", DateTime.UtcNow),
            }, "https://x/admin");
        Assert.Equal("Driftlarm: 2 nya larm", handler.Subject);
    }
}
