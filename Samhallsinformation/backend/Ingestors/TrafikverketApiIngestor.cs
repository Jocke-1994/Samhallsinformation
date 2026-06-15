namespace Samhallsinformation.Ingestors;

using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Samhallsinformation.Models;
using Samhallsinformation.Helpers;

public class TrafikverketApiIngestor : IIngestor
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    private const string ApiUrl = "https://api.trafikinfo.trafikverket.se/v2/data.json";

    public Source Source { get; } = new Source
    {
        Id        = 4,
        Name      = "Trafikverket",
        ShortName = "Trafikverket",
        BaseUrl   = "https://www.trafikverket.se",
        Url       = ApiUrl,
        Category  = "Transport",
        Type      = SourceType.WebAPI,
        IsActive  = true,
    };

    public TrafikverketApiIngestor(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _apiKey     = Environment.GetEnvironmentVariable("TRAFIKVERKET_API_KEY") ?? string.Empty;
    }

    public async Task<List<CanonicalEvent>> FetchEventsAsync()
    {
        if (string.IsNullOrEmpty(_apiKey))
            return [];

        var xml = $"""
            <REQUEST>
              <LOGIN authenticationkey="{_apiKey}" />
              <QUERY objecttype="Situation" schemaversion="1.2" limit="100">
                <FILTER>
                  <EQ name="Deleted" value="false" />
                </FILTER>
              </QUERY>
            </REQUEST>
            """;

        using var body     = new StringContent(xml, Encoding.UTF8, "text/xml");
        using var response = await _httpClient.PostAsync(ApiUrl, body);
        response.EnsureSuccessStatusCode();

        var json   = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<TvRoot>(json);

        var situations = result?.RESPONSE?.RESULT
            ?.SelectMany(r => r.Situation ?? [])
            .ToList() ?? [];

        var events = new List<CanonicalEvent>();

        foreach (var s in situations)
        {
            var dev = s.Deviation?.FirstOrDefault();
            if (dev == null) continue;

            var title   = System.Net.WebUtility.HtmlDecode(dev.MessageCodeValue ?? dev.MessageCode ?? "Trafikhändelse");
            var content = System.Net.WebUtility.HtmlDecode(dev.Message ?? string.Empty);
            var geo     = CountyName(dev.CountyNo?.FirstOrDefault());

            var ev = new CanonicalEvent
            {
                SourceId    = Source.Id,
                ExternalId  = dev.Id ?? s.Id ?? Guid.NewGuid().ToString(),
                Title       = title,
                Content     = content,
                PublishedAt = ParseDate(s.StartTime),
                Url         = "https://www.trafikverket.se/trafikinformation/vag/?TrafficType=personalTraffic",
                RawData     = title + " | " + content,
                Geography   = geo,
                Severity    = MapSeverity(dev.SeverityCode),
            };

            MetadataFallbacks.ApplyAll(ev);
            events.Add(ev);
        }

        return events;
    }

    private static DateTime ParseDate(string? s)
    {
        if (s == null) return DateTime.UtcNow;
        return DateTimeOffset.TryParse(s, out var dto) ? dto.UtcDateTime : DateTime.UtcNow;
    }

    private static string MapSeverity(int? code) => code switch
    {
        >= 4 => "Kritisk",
        3    => "Viktigt",
        _    => "Bra att veta",
    };

    private static string? CountyName(int? no) => no switch
    {
        1  => "Stockholm",
        3  => "Uppsala",
        4  => "Södermanland",
        5  => "Östergötland",
        6  => "Jönköping",
        7  => "Kronoberg",
        8  => "Kalmar",
        9  => "Gotland",
        10 => "Blekinge",
        12 => "Skåne",
        13 => "Halland",
        14 => "Västra Götaland",
        17 => "Värmland",
        18 => "Örebro",
        19 => "Västmanland",
        20 => "Dalarna",
        21 => "Gävleborg",
        22 => "Västernorrland",
        23 => "Jämtland",
        24 => "Västerbotten",
        25 => "Norrbotten",
        _  => null,
    };
}

internal class TvRoot
{
    [JsonPropertyName("RESPONSE")] public TvResponse? RESPONSE { get; set; }
}

internal class TvResponse
{
    [JsonPropertyName("RESULT")] public List<TvResult>? RESULT { get; set; }
}

internal class TvResult
{
    [JsonPropertyName("Situation")] public List<TvSituation>? Situation { get; set; }
}

internal class TvSituation
{
    [JsonPropertyName("Id")]        public string?          Id        { get; set; }
    [JsonPropertyName("StartTime")] public string?          StartTime { get; set; }
    [JsonPropertyName("Deviation")] public List<TvDeviation>? Deviation { get; set; }
}

internal class TvDeviation
{
    [JsonPropertyName("Id")]               public string?    Id               { get; set; }
    [JsonPropertyName("Message")]          public string?    Message          { get; set; }
    [JsonPropertyName("MessageCode")]      public string?    MessageCode      { get; set; }
    [JsonPropertyName("MessageCodeValue")] public string?    MessageCodeValue { get; set; }
    [JsonPropertyName("SeverityCode")]     public int?       SeverityCode     { get; set; }
    [JsonPropertyName("CountyNo")]         public List<int>? CountyNo         { get; set; }
}
