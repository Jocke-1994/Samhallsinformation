namespace Samhallsinformation.Ingestors;

using System.ServiceModel.Syndication;
using System.Xml;
using Samhallsinformation.Models;
using Samhallsinformation.Helpers;

public class PolisenRssIngestor : IIngestor
{
    private readonly HttpClient _httpClient;

    private const string FeedUrl =
        "https://polisen.se/aktuellt/rss/hela-landet/handelser-i-hela-landet/";

    public Source Source { get; } = new Source
    {
        Id = 1,
        Name = "Polisen",
        ShortName = "Polisen",
        BaseUrl = "https://polisen.se",
        Url = FeedUrl,
        Category = "Nationell",
        Type = SourceType.RSS,
        IsActive = true
    };

    public PolisenRssIngestor(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<List<CanonicalEvent>> FetchEventsAsync()
    {
        using var stream = await _httpClient.GetStreamAsync(FeedUrl);
        using var xmlReader = XmlReader.Create(stream);

        var feed = SyndicationFeed.Load(xmlReader);
        var events = new List<CanonicalEvent>();

        foreach (var item in feed.Items)
        {
            var rawTitle = item.Title?.Text ?? string.Empty;
            var link = item.Links.FirstOrDefault()?.Uri?.ToString() ?? string.Empty;

            var canonicalEvent = new CanonicalEvent
            {
                SourceId = Source.Id,
                ExternalId = item.Id ?? link,
                Title = rawTitle,
                Content = item.Summary?.Text ?? string.Empty,
                PublishedAt = item.PublishDate.UtcDateTime,
                Url = link,
                RawData = rawTitle + " | " + (item.Summary?.Text ?? string.Empty),
                Geography = ExtractGeographyFromTitle(rawTitle),
                Severity = MetadataFallbacks.DefaultSeverity
            };

            MetadataFallbacks.ApplyAll(canonicalEvent);

            events.Add(canonicalEvent);
        }

        return events;
    }

    private static string? ExtractGeographyFromTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
            return null;

        var parts = title.Split(',');
        if (parts.Length >= 3)
            return parts[^1].Trim();

        return null;
    }
}
