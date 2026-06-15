namespace Samhallsinformation.Ingestors;

using System.ServiceModel.Syndication;
using System.Xml;
using Samhallsinformation.Models;
using Samhallsinformation.Helpers;

public class GenericRssIngestor : IIngestor
{
    private readonly HttpClient _httpClient;

    public Source Source { get; }

    public GenericRssIngestor(HttpClient httpClient, Source source)
    {
        _httpClient = httpClient;
        Source = source;
    }

    public async Task<List<CanonicalEvent>> FetchEventsAsync()
    {
        if (string.IsNullOrEmpty(Source.Url))
            return [];

        using var stream = await _httpClient.GetStreamAsync(Source.Url);
        using var xmlReader = XmlReader.Create(stream);

        var feed = SyndicationFeed.Load(xmlReader);
        var events = new List<CanonicalEvent>();

        foreach (var item in feed.Items)
        {
            var link    = item.Links.FirstOrDefault()?.Uri?.ToString() ?? string.Empty;
            var title   = System.Net.WebUtility.HtmlDecode(item.Title?.Text ?? string.Empty);
            var summary = System.Net.WebUtility.HtmlDecode(item.Summary?.Text ?? string.Empty);

            var canonicalEvent = new CanonicalEvent
            {
                SourceId    = Source.Id,
                ExternalId  = item.Id ?? link,
                Title       = title,
                Content     = summary,
                PublishedAt = item.PublishDate.UtcDateTime == default
                    ? DateTime.UtcNow
                    : item.PublishDate.UtcDateTime,
                Url         = link,
                RawData     = title + " | " + summary,
                Severity    = MetadataFallbacks.DefaultSeverity
            };

            MetadataFallbacks.ApplyAll(canonicalEvent);
            events.Add(canonicalEvent);
        }

        return events;
    }
}
