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

        using var request = new HttpRequestMessage(HttpMethod.Get, Source.Url);
        request.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (compatible; Samhallsinformation/1.0)");
        request.Headers.TryAddWithoutValidation("Accept", "application/rss+xml, application/xml, text/xml, */*");
        using var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var contentType = response.Content.Headers.ContentType?.MediaType ?? string.Empty;
        if (contentType.Contains("html", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Källan {Source.Name} returnerade HTML istället för RSS (Content-Type: {contentType}). URL: {Source.Url}");

        using var stream = await response.Content.ReadAsStreamAsync();
        var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Parse };
        using var xmlReader = XmlReader.Create(stream, settings);

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
                ExternalId  = string.IsNullOrWhiteSpace(item.Id) ? link : item.Id,
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
