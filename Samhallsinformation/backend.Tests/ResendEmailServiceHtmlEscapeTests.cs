namespace Samhallsinformation.Tests;

using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Samhallsinformation.Services;
using Xunit;

// E3#8 / V2-13: användarstyrda värden (namn, ny e-post, ärendeämne, länkar) ska
// HTML-kodas i utgående mejl och radbrytningar i ämnesrader neutraliseras —
// annars kan en användare få in egen HTML/länkar i ett äkta mejl från oss.
public class ResendEmailServiceHtmlEscapeTests
{
    private const string Ond = "<a href=\"https://evil.example\">Klicka</a> <script>x</script> & \"q\" 'a'";
    private const string OndKodad =
        "&lt;a href=&quot;https://evil.example&quot;&gt;Klicka&lt;/a&gt; &lt;script&gt;x&lt;/script&gt; &amp; &quot;q&quot; &#39;a&#39;";

    private sealed class CapturingHandler : HttpMessageHandler
    {
        public string? Subject { get; private set; }
        public string? Html { get; private set; }
        public int Calls { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++;
            var body = await request.Content!.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(body);
            Subject = doc.RootElement.GetProperty("subject").GetString();
            Html = doc.RootElement.GetProperty("html").GetString();
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") };
        }
    }

    private static (ResendEmailService svc, CapturingHandler handler) Create()
    {
        var handler = new CapturingHandler();
        var http = new HttpClient(handler) { BaseAddress = new Uri("https://api.resend.com") };
        return (new ResendEmailService(http, NullLogger<ResendEmailService>.Instance), handler);
    }

    public static IEnumerable<object[]> MejlMedNamn()
    {
        yield return new object[] { "lösenordsåterställning", (Func<ResendEmailService, string, Task>)((s, n) => s.SendPasswordResetAsync("a@b.se", n, "https://x/reset")) };
        yield return new object[] { "e-postverifiering", (Func<ResendEmailService, string, Task>)((s, n) => s.SendEmailVerificationAsync("a@b.se", n, "https://x/verify")) };
        yield return new object[] { "e-postbyte (bekräfta)", (Func<ResendEmailService, string, Task>)((s, n) => s.SendEmailChangeConfirmationAsync("a@b.se", n, "https://x/confirm")) };
        yield return new object[] { "e-postbyte (varning)", (Func<ResendEmailService, string, Task>)((s, n) => s.SendEmailChangeNoticeAsync("a@b.se", n, "ny@b.se")) };
        yield return new object[] { "radering", (Func<ResendEmailService, string, Task>)((s, n) => s.SendAccountDeletionScheduledAsync("a@b.se", n, "https://x/cancel", new DateTime(2026, 9, 25, 12, 0, 0, DateTimeKind.Utc))) };
        yield return new object[] { "välkommen", (Func<ResendEmailService, string, Task>)((s, n) => s.SendWelcomeAsync("a@b.se", n)) };
    }

    [Theory]
    [MemberData(nameof(MejlMedNamn))]
    public async Task Namn_MedHtml_RenderasSomKodadText(string mejltyp, Func<ResendEmailService, string, Task> skicka)
    {
        var (svc, handler) = Create();

        await skicka(svc, Ond);

        Assert.Equal(1, handler.Calls);
        Assert.True(handler.Html!.Contains($"Hej {OndKodad},"), $"{mejltyp}: namnet ska vara HTML-kodat");
        Assert.DoesNotContain("<a href=\"https://evil.example\">", handler.Html);
        Assert.DoesNotContain("<script>", handler.Html);
    }

    [Fact]
    public async Task NyEpost_MedHtml_KodasIVarningsmejlet()
    {
        var (svc, handler) = Create();

        await svc.SendEmailChangeNoticeAsync("gammal@b.se", "Anna", Ond);

        Assert.Contains($"<strong>{OndKodad}</strong>", handler.Html);
        Assert.DoesNotContain("<script>", handler.Html);
    }

    [Fact]
    public async Task Arendesvar_AmneMedHtml_KodasIRubrikOchAmnesradenArRenText()
    {
        var (svc, handler) = Create();

        await svc.SendTicketReplyAsync("a@b.se", 42, Ond, "Hej");

        Assert.Contains($"Svar på ditt ärende — {OndKodad}</h2>", handler.Html);
        Assert.DoesNotContain("<script>", handler.Html);
        // Ämnesraden är ren text i JSON-fältet (klienten renderar den inte som HTML).
        Assert.StartsWith("Svar på ditt ärende: ", handler.Subject);
    }

    [Fact]
    public async Task Arendesvar_AmneMedRadbrytning_NeutraliserasIAmnesradOchRubrik()
    {
        var (svc, handler) = Create();

        await svc.SendTicketReplyAsync("a@b.se", 42, "Hej\r\nBcc: offer@example.com\nX: y", "Text");

        Assert.Equal("Svar på ditt ärende: Hej Bcc: offer@example.com X: y", handler.Subject);
        Assert.DoesNotContain('\r', handler.Subject!);
        Assert.DoesNotContain('\n', handler.Subject!);
        Assert.Contains("Svar på ditt ärende — Hej Bcc: offer@example.com X: y</h2>", handler.Html);
    }

    [Fact]
    public async Task Arendesvar_SvarstextMedHtml_ArFortfarandeKodad()
    {
        var (svc, handler) = Create();

        await svc.SendTicketReplyAsync("a@b.se", 1, "Ämne", Ond);

        Assert.Contains(OndKodad, handler.Html);
    }

    [Fact]
    public async Task Lank_MedCitatteckenOchTagg_KanInteBryta_UtUrHrefAttributet()
    {
        var (svc, handler) = Create();

        await svc.SendPasswordResetAsync("a@b.se", "Anna", "https://x/reset?token=a\"><script>alert(1)</script>&b=c");

        Assert.DoesNotContain("<script>", handler.Html);
        Assert.Contains("href=\"https://x/reset?token=a&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;b=c\"", handler.Html);
    }

    [Fact]
    public async Task VanligtNamn_MedSvenskaTecken_LamnasOforandrat()
    {
        var (svc, handler) = Create();

        await svc.SendWelcomeAsync("a@b.se", "Åsa Öberg");

        Assert.Contains("Hej Åsa Öberg,", handler.Html);
    }

    [Theory]
    [InlineData("a\r\nb", "a b")]
    [InlineData("a\nb\r\n\r\nc", "a b c")]
    [InlineData("  a\tb  ", "a b")]
    [InlineData("a\u2028b", "a b")]
    [InlineData(null, "")]
    public void SingleLine_TarBortRadbrytningarOchKontrolltecken(string? indata, string forvantat)
        => Assert.Equal(forvantat, EmailHtml.SingleLine(indata));

    [Fact]
    public void UrlEncode_KodarTeckenSomBrytUtUrQuery()
    {
        Assert.Equal("a%26b%3Dc%20d%23e%2F%22", EmailHtml.UrlEncode("a&b=c d#e/\""));
        Assert.Equal("abc123", EmailHtml.UrlEncode("abc123"));
    }
}
