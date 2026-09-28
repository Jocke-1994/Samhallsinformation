namespace Samhallsinformation.Tests;

using System.Net;
using System.Text;
using Samhallsinformation.Helpers;
using Samhallsinformation.Ingestors;
using Samhallsinformation.Models;
using Xunit;

/// <summary>
/// Verklig lucka i enhet-8:s rangordnade lista (test 11, "Generic_HtmlResponse_..."):
/// <see cref="GenericRssIngestor"/> låg på 0 % täckning. Testar backend-regeln som gäller alla
/// ingestorer (rollens egen regel, se ClaudeBE.md): en extern källa som svarar med HTML i stället
/// för RSS/JSON ska ge ett explicit, beskrivande fel (Content-Type + URL) — aldrig krascha tyst
/// eller returnera tomt. HTTP fejkas med en <see cref="HttpMessageHandler"/>, samma mönster som
/// <c>KrisinformationIngestorTests</c>.
/// </summary>
public class GenericRssIngestorTests
{
    private sealed class FakeHandler : HttpMessageHandler
    {
        private readonly string _body;
        private readonly string _contentType;
        public FakeHandler(string body, string contentType) { _body = body; _contentType = contentType; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var content = new StringContent(_body, Encoding.UTF8);
            content.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse(_contentType);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = content });
        }
    }

    private static Source NewSource(string url = "https://exempel.se/rss") => new()
    {
        Id = 7, Name = "Exempelkällan", ShortName = "Exempel", Url = url, IsActive = true, IsPublished = true,
    };

    private const string ValidRss = """
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Exempelflöde</title>
            <item>
              <title>Rubrik &amp; mer</title>
              <link>https://exempel.se/artikel-1</link>
              <guid>artikel-1</guid>
              <description>Ingress&lt;br/&gt;text</description>
            </item>
          </channel>
        </rss>
        """;

    [Fact]
    public async Task FetchEvents_HtmlContentType_ThrowsDescriptiveErrorWithContentTypeAndUrl()
    {
        var source = NewSource("https://exempel.se/nedlagd-flode");
        var ingestor = new GenericRssIngestor(new HttpClient(new FakeHandler("<html><body>Sidan flyttad</body></html>", "text/html")), source);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => ingestor.FetchEventsAsync());

        Assert.Contains("text/html", ex.Message);
        Assert.Contains(source.Url!, ex.Message);
        Assert.Contains(source.Name, ex.Message);
    }

    [Theory]
    [InlineData("text/html; charset=utf-8")]
    [InlineData("application/xhtml+html")]
    public async Task FetchEvents_AnyHtmlVariantContentType_Throws(string contentType)
    {
        var ingestor = new GenericRssIngestor(new HttpClient(new FakeHandler("<html></html>", contentType)), NewSource());

        await Assert.ThrowsAsync<InvalidOperationException>(() => ingestor.FetchEventsAsync());
    }

    [Fact]
    public async Task FetchEvents_ValidRss_ParsesTitleLinkAndAppliesFallbacks()
    {
        var ingestor = new GenericRssIngestor(new HttpClient(new FakeHandler(ValidRss, "application/rss+xml")), NewSource());

        var events = await ingestor.FetchEventsAsync();

        var evt = Assert.Single(events);
        Assert.Equal("Rubrik & mer", evt.Title); // HTML-avkodat (&amp; -> &)
        Assert.Equal("https://exempel.se/artikel-1", evt.Url);
        Assert.Equal("artikel-1", evt.ExternalId); // guid vinner över länken när den finns
        Assert.Equal(7, evt.SourceId);
        Assert.True((DateTime.UtcNow - evt.PublishedAt).Duration() < TimeSpan.FromMinutes(1)); // ingen pubDate -> faller tillbaka på UtcNow
        Assert.True(evt.IsNational); // MetadataFallbacks.ApplyAll: ingen geografi -> nationell
        Assert.Equal(MetadataFallbacks.DefaultSeverity, evt.Severity);
    }

    [Fact]
    public async Task FetchEvents_EmptySourceUrl_ReturnsEmptyListWithoutCallingHttp()
    {
        var handlerCalled = false;
        var ingestor = new GenericRssIngestor(
            new HttpClient(new DelegatingFakeHandler(() => handlerCalled = true)),
            NewSource(url: ""));

        var events = await ingestor.FetchEventsAsync();

        Assert.Empty(events);
        Assert.False(handlerCalled);
    }

    private sealed class DelegatingFakeHandler : HttpMessageHandler
    {
        private readonly Action _onSend;
        public DelegatingFakeHandler(Action onSend) { _onSend = onSend; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            _onSend();
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("") });
        }
    }
}
