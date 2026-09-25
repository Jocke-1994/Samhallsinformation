namespace Samhallsinformation.Tests;

using System.Net;
using System.Text;
using Microsoft.Extensions.Logging;
using Samhallsinformation.Ingestors;
using Xunit;

/// <summary>
/// V3-5 (E3#7): en post med tomt/ogiltigt <c>Published</c> fällde tidigare hela
/// <c>FetchEventsAsync</c> (<c>DateTimeOffset.Parse</c> kastade FormatException utanför varje
/// try/catch), så källan tystnade tills posten skjutits ut ur de 50 senaste. Nu hoppas bara
/// den trasiga posten över (med en Warning) och resten hämtas som vanligt. HTTP fejkas med en
/// <see cref="HttpMessageHandler"/>.
/// </summary>
public class KrisinformationIngestorTests
{
    private sealed class FakeHandler : HttpMessageHandler
    {
        private readonly string _json;
        public FakeHandler(string json) { _json = json; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_json, Encoding.UTF8, "application/json")
            });
    }

    private sealed class ListLogger : ILogger<KrisinformationApiIngestor>
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = new();

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception)));
    }

    private static (KrisinformationApiIngestor Ingestor, ListLogger Logger) Build(string json)
    {
        var logger = new ListLogger();
        var ingestor = new KrisinformationApiIngestor(new HttpClient(new FakeHandler(json)), logger);
        return (ingestor, logger);
    }

    private static string Item(string id, string? published, string headline = "Rubrik", bool isTest = false)
    {
        var publishedJson = published == null ? "null" : $"\"{published}\"";
        return $"{{\"Identifier\":\"{id}\",\"Headline\":\"{headline}\",\"Preamble\":\"Ingress\",\"BodyText\":\"<p>Text</p>\"," +
               $"\"Published\":{publishedJson},\"Web\":\"https://krisinformation.se/{id}\",\"IsTest\":{(isTest ? "true" : "false")}}}";
    }

    private static string Feed(params string[] items) => "[" + string.Join(",", items) + "]";

    [Fact]
    public async Task FetchEvents_TomtOchSkrapPublished_HoppasOverOchGiltigPostTolkas()
    {
        var (ingestor, _) = Build(Feed(
            Item("tom", ""),
            Item("skrap", "inte ett datum"),
            Item("giltig", "2026-09-25T10:00:00Z")));

        var events = await ingestor.FetchEventsAsync();

        var ev = Assert.Single(events);
        Assert.Equal("giltig", ev.ExternalId);
        Assert.Equal(new DateTime(2026, 9, 25, 10, 0, 0, DateTimeKind.Utc), ev.PublishedAt);
    }

    [Fact]
    public async Task FetchEvents_TrasigPostFoereGiltig_NyarePosterBehalls()
    {
        // Regression för själva fellägret: den trasiga posten ligger FÖRST, de nyare efter.
        var (ingestor, _) = Build(Feed(
            Item("trasig", "   "),
            Item("a", "2026-09-25T10:00:00Z"),
            Item("b", "2026-09-25T11:00:00Z")));

        var events = await ingestor.FetchEventsAsync();

        Assert.Equal(new[] { "a", "b" }, events.Select(e => e.ExternalId).ToArray());
    }

    [Fact]
    public async Task FetchEvents_NormalFil_OfoerandratBeteende()
    {
        var (ingestor, logger) = Build(Feed(
            Item("1", "2026-09-25T12:30:00+02:00", "Viktigt meddelande till allmänheten i Hörby kommun"),
            Item("2", "2026-09-24T08:00:00Z", "Vanlig nyhet")));

        var events = await ingestor.FetchEventsAsync();

        Assert.Equal(2, events.Count);
        Assert.Equal("1", events[0].ExternalId);
        Assert.Equal("Kritisk", events[0].Severity);
        Assert.Equal("Text", events[0].Content);
        Assert.Equal("https://krisinformation.se/1", events[0].Url);
        Assert.Equal("2", events[1].ExternalId);
        Assert.Equal(5, events[1].SourceId);
        Assert.DoesNotContain(logger.Entries, e => e.Level >= LogLevel.Warning);
    }

    [Fact]
    public async Task FetchEvents_AllaPosterOgiltiga_TomListaUtanUndantag()
    {
        var (ingestor, logger) = Build(Feed(
            Item("a", ""),
            Item("b", "skräp"),
            Item("c", null)));

        var events = await ingestor.FetchEventsAsync();

        Assert.Empty(events);
        Assert.Equal(3, logger.Entries.Count(e => e.Level == LogLevel.Warning));
    }

    [Fact]
    public async Task FetchEvents_PublishedSaknasHelt_HoppasOver()
    {
        // Fältet finns inte alls i JSON:en (inte ens null).
        var (ingestor, _) = Build("[{\"Identifier\":\"utan-datum\",\"Headline\":\"X\"}," + Item("ok", "2026-09-25T10:00:00Z") + "]");

        var events = await ingestor.FetchEventsAsync();

        Assert.Equal("ok", Assert.Single(events).ExternalId);
    }

    [Fact]
    public async Task FetchEvents_OgiltigtDatum_LoggarWarningMedKaellaOchIdentifierare()
    {
        var (ingestor, logger) = Build(Feed(Item("VMA-123", "skräp", "Trasig rubrik")));

        await ingestor.FetchEventsAsync();

        var warning = Assert.Single(logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains("Krisinformation.se", warning.Message);
        Assert.Contains("VMA-123", warning.Message);
    }

    [Fact]
    public async Task FetchEvents_TomIdentifierareOchOgiltigtDatum_LoggarUtanAttKrascha()
    {
        var (ingestor, logger) = Build(Feed(Item("", "skräp", "Rubrik utan id")));

        var events = await ingestor.FetchEventsAsync();

        Assert.Empty(events);
        var warning = Assert.Single(logger.Entries, e => e.Level == LogLevel.Warning);
        Assert.Contains("identifierare saknas", warning.Message);
    }

    [Fact]
    public async Task FetchEvents_TestpostOchNullPost_HoppasOverSomFoerr()
    {
        var (ingestor, _) = Build("[null," + Item("test", "2026-09-25T10:00:00Z", isTest: true) + "," + Item("ok", "2026-09-25T10:00:00Z") + "]");

        var events = await ingestor.FetchEventsAsync();

        Assert.Equal("ok", Assert.Single(events).ExternalId);
    }

    [Fact]
    public async Task FetchEvents_DatumMedOffset_OmvandlasTillUtcMedKindUtc()
    {
        var (ingestor, _) = Build(Feed(Item("x", "2026-09-25T14:00:00+02:00")));

        var ev = Assert.Single(await ingestor.FetchEventsAsync());

        Assert.Equal(new DateTime(2026, 9, 25, 12, 0, 0), ev.PublishedAt);
        Assert.Equal(DateTimeKind.Utc, ev.PublishedAt.Kind);
    }

    [Fact]
    public async Task FetchEvents_DatumUtanOffset_TolkasSomUtcOavsettServernsTidszon()
    {
        var (ingestor, _) = Build(Feed(Item("x", "2026-09-25T14:00:00")));

        var ev = Assert.Single(await ingestor.FetchEventsAsync());

        Assert.Equal(new DateTime(2026, 9, 25, 14, 0, 0), ev.PublishedAt);
        Assert.Equal(DateTimeKind.Utc, ev.PublishedAt.Kind);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("inte ett datum")]
    [InlineData("2026-13-45T99:99:99Z")]
    public void TryParsePublished_OgiltigtVaerde_ReturnerarFalse(string? raw)
    {
        Assert.False(KrisinformationApiIngestor.TryParsePublished(raw, out _));
    }

    [Theory]
    [InlineData("2026-09-25T10:00:00Z", "2026-09-25T10:00:00")]
    [InlineData("2026-09-25T10:00:00.123+02:00", "2026-09-25T08:00:00.123")]
    [InlineData("  2026-09-25T10:00:00Z  ", "2026-09-25T10:00:00")]
    public void TryParsePublished_GiltigtVaerde_GerUtcMedKindUtc(string raw, string expectedUtc)
    {
        Assert.True(KrisinformationApiIngestor.TryParsePublished(raw, out var utc));
        Assert.Equal(DateTime.Parse(expectedUtc, System.Globalization.CultureInfo.InvariantCulture), utc);
        Assert.Equal(DateTimeKind.Utc, utc.Kind);
    }
}
