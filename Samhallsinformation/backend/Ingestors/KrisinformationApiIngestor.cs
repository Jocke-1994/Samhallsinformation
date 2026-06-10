namespace Samhallsinformation.Ingestors;

using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Samhallsinformation.Models;
using Samhallsinformation.Helpers;

public class KrisinformationApiIngestor : IIngestor
{
    private readonly HttpClient _httpClient;

    private const string ApiUrl =
        "https://api.krisinformation.se/v3/news?numberOfNewsArticles=50&language=sv";

    public Source Source { get; } = new Source
    {
        Id = 5,
        Name = "Krisinformation.se",
        ShortName = "Krisinformation",
        BaseUrl = "https://krisinformation.se",
        Type = SourceType.WebAPI,
        IsActive = true
    };

    public KrisinformationApiIngestor(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<List<CanonicalEvent>> FetchEventsAsync()
    {
        var items = await _httpClient.GetFromJsonAsync<List<KrisinformationItem>>(ApiUrl)
            ?? new List<KrisinformationItem>();

        var events = new List<CanonicalEvent>();

        foreach (var item in items)
        {
            if (item.IsTest) continue;

            var canonicalEvent = new CanonicalEvent
            {
                SourceId   = Source.Id,
                ExternalId = item.Identifier,
                Title      = item.Headline ?? string.Empty,
                Content    = StripHtml(item.BodyText ?? item.Preamble ?? string.Empty),
                PublishedAt = DateTime.Parse(item.Published),
                Url        = item.Web ?? string.Empty,
                RawData    = item.Headline + " | " + item.Preamble,
                Geography  = ExtractGeography(item.Area),
                Severity   = MetadataFallbacks.DefaultSeverity
            };

            MetadataFallbacks.ApplyAll(canonicalEvent);

            events.Add(canonicalEvent);
        }

        return events;
    }

    private static string? ExtractGeography(List<KrisinformationArea>? areas)
    {
        if (areas == null || areas.Count == 0)
            return null;

        var county = areas.FirstOrDefault(a =>
            !string.Equals(a.Type, "Country", StringComparison.OrdinalIgnoreCase));

        return county?.Description;
    }

    private static string StripHtml(string html)
    {
        if (string.IsNullOrWhiteSpace(html)) return string.Empty;
        return Regex.Replace(html, "<[^>]+>", string.Empty).Trim();
    }
}

internal class KrisinformationItem
{
    [JsonPropertyName("Identifier")]   public string Identifier  { get; set; } = string.Empty;
    [JsonPropertyName("Headline")]     public string? Headline   { get; set; }
    [JsonPropertyName("Preamble")]     public string? Preamble   { get; set; }
    [JsonPropertyName("BodyText")]     public string? BodyText   { get; set; }
    [JsonPropertyName("Published")]    public string Published   { get; set; } = string.Empty;
    [JsonPropertyName("Web")]          public string? Web        { get; set; }
    [JsonPropertyName("Area")]         public List<KrisinformationArea>? Area { get; set; }
    [JsonPropertyName("IsTest")]       public bool IsTest        { get; set; }
}

internal class KrisinformationArea
{
    [JsonPropertyName("Type")]        public string? Type        { get; set; }
    [JsonPropertyName("Description")] public string? Description { get; set; }
}
