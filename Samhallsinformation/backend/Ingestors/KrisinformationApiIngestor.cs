namespace Samhallsinformation.Ingestors;

using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Samhallsinformation.Models;
using Samhallsinformation.Helpers;

public class KrisinformationApiIngestor : IIngestor
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<KrisinformationApiIngestor> _logger;

    private const string ApiUrl =
        "https://api.krisinformation.se/v3/news?numberOfNewsArticles=50&language=sv";

    public Source Source { get; } = new Source
    {
        Id = 5,
        Name = "Krisinformation.se",
        ShortName = "Krisinformation",
        BaseUrl = "https://krisinformation.se",
        Url = ApiUrl,
        Category = "Nationell",
        Type = SourceType.WebAPI,
        IsActive    = true,
        IsPublished = true,
    };

    public KrisinformationApiIngestor(HttpClient httpClient, ILogger<KrisinformationApiIngestor> logger)
    {
        _httpClient = httpClient;
        _logger     = logger;
    }

    public async Task<List<CanonicalEvent>> FetchEventsAsync()
    {
        var items = await _httpClient.GetFromJsonAsync<List<KrisinformationItem>>(ApiUrl)
            ?? new List<KrisinformationItem>();

        var events = new List<CanonicalEvent>();

        foreach (var item in items)
        {
            if (item == null || item.IsTest) continue;

            // En post vars publiceringsdatum saknas eller inte går att tolka hoppas över i
            // stället för att fälla hela hämtningen — annars tystnar källan (den enda med
            // VMA/kritiska varningar) tills den trasiga posten skjutits ut ur de 50 senaste (V3-5).
            if (!TryParsePublished(item.Published, out var publishedAt))
            {
                _logger.LogWarning(
                    "{Source}: hoppar över post {Identifier} (\"{Headline}\") — ogiltigt Published-datum: \"{Published}\"",
                    Source.Name,
                    string.IsNullOrWhiteSpace(item.Identifier) ? "(identifierare saknas)" : item.Identifier,
                    item.Headline,
                    item.Published);
                continue;
            }

            var canonicalEvent = new CanonicalEvent
            {
                SourceId   = Source.Id,
                ExternalId = item.Identifier,
                Title      = item.Headline ?? string.Empty,
                Content    = StripHtml(item.BodyText ?? item.Preamble ?? string.Empty),
                PublishedAt = publishedAt,
                Url        = item.Web ?? string.Empty,
                RawData    = item.Headline + " | " + item.Preamble,
                Geography  = ExtractGeography(item.Area),
                Severity   = MapSeverity(item.Headline)
            };

            MetadataFallbacks.ApplyAll(canonicalEvent);

            events.Add(canonicalEvent);
        }

        return events;
    }

    // Invariant kultur (API:t levererar ISO 8601, aldrig svenska datumformat) och
    // AssumeUniversal så att ett datum utan offset tolkas som UTC, inte serverns lokala tid.
    // Resultatet är alltid Kind=Utc.
    internal static bool TryParsePublished(string? raw, out DateTime utc)
    {
        if (DateTimeOffset.TryParse(raw?.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto))
        {
            utc = dto.UtcDateTime;
            return true;
        }

        utc = default;
        return false;
    }

    // Krisinformation har ingen egen severity-kod i API-svaret, men VMA
    // ("Viktigt meddelande till allmänheten") och varningsnivåer (Röd/Orange/
    // Gul) är officiella termer Krisinformation själva använder i rubriken —
    // att läsa av dem är inte en egen bedömning, bara att sluta ignorera
    // information som redan finns (samma princip som SMHI:s severity-koder).
    // Mönstret "... i <plats>" krävs för VMA så att artiklar OM VMA-systemet
    // (t.ex. "SE-Alert: Ny kanal för Viktigt meddelande till allmänheten")
    // inte felaktigt räknas som en aktiv varning. \s+ istället för ett enda
    // mellanslag eftersom källans egen rubriktext ibland har dubbla mellanslag
    // (verifierat mot skarp data, t.ex. "allmänheten  i Hörby kommun").
    private static readonly Regex VmaMönster = new(@"viktigt meddelande till allmänheten\s+i\s", RegexOptions.IgnoreCase);
    private static readonly Regex RödVarningMönster = new(@"röd varning", RegexOptions.IgnoreCase);
    private static readonly Regex OrangeGulVarningMönster = new(@"orange varning|gul varning", RegexOptions.IgnoreCase);

    private static string MapSeverity(string? headline)
    {
        if (string.IsNullOrWhiteSpace(headline)) return MetadataFallbacks.DefaultSeverity;

        if (VmaMönster.IsMatch(headline) || RödVarningMönster.IsMatch(headline))
            return "Kritisk";
        if (OrangeGulVarningMönster.IsMatch(headline))
            return "Viktigt";

        return MetadataFallbacks.DefaultSeverity;
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
        var text = Regex.Replace(html, "<[^>]+>", string.Empty).Trim();
        text = Regex.Replace(text, @"\{\d+\}", "[länk]").Trim();
        return System.Net.WebUtility.HtmlDecode(text);
    }
}

internal class KrisinformationItem
{
    [JsonPropertyName("Identifier")]   public string Identifier  { get; set; } = string.Empty;
    [JsonPropertyName("Headline")]     public string? Headline   { get; set; }
    [JsonPropertyName("Preamble")]     public string? Preamble   { get; set; }
    [JsonPropertyName("BodyText")]     public string? BodyText   { get; set; }
    [JsonPropertyName("Published")]    public string? Published  { get; set; }
    [JsonPropertyName("Web")]          public string? Web        { get; set; }
    [JsonPropertyName("Area")]         public List<KrisinformationArea>? Area { get; set; }
    [JsonPropertyName("IsTest")]       public bool IsTest        { get; set; }
}

internal class KrisinformationArea
{
    [JsonPropertyName("Type")]        public string? Type        { get; set; }
    [JsonPropertyName("Description")] public string? Description { get; set; }
}
