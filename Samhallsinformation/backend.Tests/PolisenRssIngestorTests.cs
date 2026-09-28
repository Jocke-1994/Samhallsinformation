namespace Samhallsinformation.Tests;

using System.Net;
using System.Text;
using Samhallsinformation.Ingestors;
using Xunit;

/// <summary>
/// Verklig lucka i enhet-8:s rangordnade lista (test 11): <see cref="PolisenRssIngestor"/> är
/// huvudkällan (enhet-8: "Medel-hög (huvudkällan)") men låg på 0 % täckning. Extra motiverat här:
/// titel-parsningen (<c>ExtractGeographyFromTitle</c>/<c>ExtractEventTypeFromTitle</c>) matar direkt
/// in i <c>PolisenBevakningMatcher</c> (push-matchning) — en tidigare, redan åtgärdad session-bugg
/// (session 35) visade att fel antagande om titelformatet gjorde att bevakningar aldrig matchade
/// någonting i produktion, tyst. HTTP fejkas med en <see cref="HttpMessageHandler"/>.
/// </summary>
public class PolisenRssIngestorTests
{
    private sealed class FakeHandler : HttpMessageHandler
    {
        private readonly string _rss;
        public FakeHandler(string rss) { _rss = rss; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_rss, Encoding.UTF8, "application/rss+xml"),
            });
    }

    private static string RssWithTitle(string title) => $"""
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Polisen</title>
            <item>
              <title>{System.Security.SecurityElement.Escape(title)}</title>
              <link>https://polisen.se/artikel</link>
              <guid>polisen-1</guid>
              <description>Sammanfattning</description>
            </item>
          </channel>
        </rss>
        """;

    private static PolisenRssIngestor Build(string title) =>
        new(new HttpClient(new FakeHandler(RssWithTitle(title))));

    // --- Titel-parsning (ExtractGeographyFromTitle / ExtractEventTypeFromTitle) ---

    [Fact]
    public async Task FetchEvents_StandardTitel_ExtraherarGeografiOchTyp()
    {
        var events = await Build("14 augusti 13.05, Trafikolycka, Kungälv").FetchEventsAsync();

        var evt = Assert.Single(events);
        Assert.Equal("Kungälv", evt.Geography);
        Assert.Equal("Trafikolycka", evt.EventType);
    }

    [Fact]
    public async Task FetchEvents_TitelMedKvalificerare_TypenBehallerKvalificeraren()
    {
        // "{tid}, {typ}, {kvalificerare}, {ort}" — allt mellan första och sista kommadelen
        // räknas som typen, ingen del av den tappas bort.
        var events = await Build("14 augusti 13.05, Misshandel, grov, Karlskrona").FetchEventsAsync();

        var evt = Assert.Single(events);
        Assert.Equal("Karlskrona", evt.Geography);
        Assert.Equal("Misshandel, grov", evt.EventType);
    }

    [Fact]
    public async Task FetchEvents_TitelUtanTillrackligtManga_Kommadelningar_GerNullGeografiOchTyp()
    {
        var events = await Build("Ett meddelande utan kommatecken").FetchEventsAsync();

        var evt = Assert.Single(events);
        Assert.Null(evt.Geography); // MetadataFallbacks.ApplyGeographyFallback slår sedan om till nationell
        Assert.True(evt.IsNational);
        Assert.Null(evt.EventType);
    }

    [Fact]
    public async Task FetchEvents_TomTitel_KrascharInte()
    {
        var events = await Build("").FetchEventsAsync();

        var evt = Assert.Single(events);
        Assert.Null(evt.Geography);
        Assert.Null(evt.EventType);
    }

    // --- Grundläggande fältmappning ---

    [Fact]
    public async Task FetchEvents_MapparIdLankOchSeverityFallback()
    {
        var events = await Build("14 augusti 13.05, Stöld, Göteborg").FetchEventsAsync();

        var evt = Assert.Single(events);
        Assert.Equal("polisen-1", evt.ExternalId); // guid finns -> vinner över länken
        Assert.Equal("https://polisen.se/artikel", evt.Url);
        Assert.Equal(1, evt.SourceId); // Source.Id är hårdkodad 1 för huvudkällan
        Assert.Equal(Samhallsinformation.Helpers.MetadataFallbacks.DefaultSeverity, evt.Severity);
    }

    [Fact]
    public void Source_ArAktivOchPublicerad()
    {
        var ingestor = new PolisenRssIngestor(new HttpClient(new FakeHandler(RssWithTitle("x, y, z"))));

        Assert.True(ingestor.Source.IsActive);
        Assert.True(ingestor.Source.IsPublished);
        Assert.Equal("Polisen", ingestor.Source.ShortName);
    }
}
