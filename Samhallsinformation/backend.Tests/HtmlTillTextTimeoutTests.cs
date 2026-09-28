namespace Samhallsinformation.Tests;

using System.Net;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Samhallsinformation.Services;
using Xunit;

// V4-1b (E3#12): ResendEmailService.HtmlTillText konverterar HTML från Resends
// inbound-webhook (info@-svaret till ett supportärende) till text via fyra Regex-anrop.
// Signaturen bevisar bara att Resend skickade mejlet, inte att avsändaren (vem som
// helst) skrev ofarlig HTML — utan matchTimeout kan patologisk indata låsa en
// request-tråd. Testerna simulerar timeouten deterministiskt via matchTimeout-
// parametern istället för att bygga en verkligt patologisk sträng i produktionsstorlek.
public class HtmlTillTextTimeoutTests
{
    private sealed class NoopHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") });
    }

    private static ResendEmailService Create(ILogger<ResendEmailService>? logger = null)
    {
        var http = new HttpClient(new NoopHandler()) { BaseAddress = new Uri("https://api.resend.com") };
        return new ResendEmailService(http, logger ?? NullLogger<ResendEmailService>.Instance);
    }

    // Många "<" utan matchande ">" — precis den formen enhet-3-fyndet pekar ut som
    // kvadratisk i <[^>]+>. En så extremt kort matchTimeout att den nästan alltid
    // slår till oavsett indata (uppmätt/verifierat lokalt: en hel millisekund var INTE
    // pålitlig — .NET:s interna kontrollintervall skalas efter den begärda timeouten,
    // så en "1 ms"-gräns kunde ibland hinnas även efter ~10 ms verklig körtid. En
    // mikrosekund (10 ticks) är pålitlig och gör testerna deterministiska utan att
    // behöva bygga en verkligt patologisk sträng i produktionsstorlek eller vänta
    // sekunder på en riktig timeout).
    private static readonly TimeSpan ReliableTimeout = TimeSpan.FromTicks(10);
    private static string PatologiskHtml(int antal = 20_000) => new string('<', antal);

    [Fact]
    public void HtmlTillText_RegexTimeout_DoesNotThrow_ReturnsTruncatedText()
    {
        var svc = Create();

        var text = svc.HtmlTillText(PatologiskHtml(), matchTimeout: ReliableTimeout);

        Assert.NotNull(text);
        Assert.True(text.Length <= 5000, "fallback-texten ska vara avkortad, inte hela indatan");
    }

    [Fact]
    public void HtmlTillText_RegexTimeout_LogsWarning()
    {
        var logger = new CapturingLogger<ResendEmailService>();
        var svc = Create(logger);

        svc.HtmlTillText(PatologiskHtml(), matchTimeout: ReliableTimeout);

        Assert.Contains(logger.Entries, e => e.Level == LogLevel.Warning);
    }

    [Fact]
    public void HtmlTillText_RegexTimeout_FallbackStripsTags()
    {
        var svc = Create();
        // Taggar runt en synlig text — fallbacken (enkel, icke-regex-baserad
        // tagg-strippning) ska fortfarande ta bort dem, bara utan radbrytnings-/
        // entitetsfiness.
        var html = "<div>" + new string('<', 20_000) + "</div><p>Synlig text</p>";

        var text = svc.HtmlTillText(html, matchTimeout: ReliableTimeout);

        Assert.DoesNotContain("<div>", text);
        Assert.DoesNotContain("<p>", text);
    }

    [Fact]
    public void HtmlTillText_NormalHtml_StillConvertsCorrectly_WithDefaultTimeout()
    {
        var svc = Create();

        var text = svc.HtmlTillText("<div>Hej <b>världen</b><br>Rad 2</div>");

        Assert.Equal("Hej världen\nRad 2", text);
    }

    [Fact]
    public void HtmlTillText_NormalHtml_NeverLogsWarning()
    {
        var logger = new CapturingLogger<ResendEmailService>();
        var svc = Create(logger);

        svc.HtmlTillText("<div>Helt normal text</div>");

        Assert.DoesNotContain(logger.Entries, e => e.Level == LogLevel.Warning);
    }
}
