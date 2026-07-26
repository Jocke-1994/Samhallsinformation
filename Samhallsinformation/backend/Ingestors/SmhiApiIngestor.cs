namespace Samhallsinformation.Ingestors;

using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Samhallsinformation.Models;
using Samhallsinformation.Helpers;

public class SmhiApiIngestor : IIngestor
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<SmhiApiIngestor> _logger;

    private const string ApiUrl = "https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json";

    private static readonly CultureInfo SvCulture = new("sv-SE");
    private static readonly TimeZoneInfo StockholmTz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Stockholm");

    public Source Source { get; } = new Source
    {
        Id        = 10,
        Name      = "SMHI",
        ShortName = "SMHI",
        BaseUrl   = "https://www.smhi.se",
        Url       = ApiUrl,
        Category  = "Väder",
        Type      = SourceType.WebAPI,
        IsActive    = true,
        IsPublished = false, // Testar i sandlådan först
    };

    public SmhiApiIngestor(HttpClient httpClient, ILogger<SmhiApiIngestor> logger)
    {
        _httpClient = httpClient;
        _logger     = logger;
    }

    public async Task<List<CanonicalEvent>> FetchEventsAsync()
    {
        using var response = await _httpClient.GetAsync(ApiUrl);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogInformation("SMHI API returned 404 — inga aktiva varningar");
            return [];
        }

        response.EnsureSuccessStatusCode();

        var warnings = await response.Content.ReadFromJsonAsync<List<SmhiWarning>>() ?? [];

        _logger.LogInformation("SMHI API returned {Count} warnings", warnings.Count);

        var events = new List<CanonicalEvent>();

        foreach (var warning in warnings)
        {
            foreach (var area in warning.WarningAreas ?? [])
            {
                var areaName  = area.AreaName?.Sv ?? "Sverige";
                var eventType = area.EventDescription?.Sv ?? "Varning";
                var levelCode = area.WarningLevel?.Code ?? "YELLOW";

                var title = eventType;

                var whenText = FormatPeriod(area.ApproximateStart, area.ApproximateEnd);

                var descParts = new List<string>();
                var whenInserted = whenText == null;
                foreach (var d in area.Descriptions ?? [])
                {
                    if (!whenInserted && d.Title?.Code == "WHERE")
                    {
                        descParts.Add($"När?: {whenText}");
                        whenInserted = true;
                    }

                    var part = string.IsNullOrWhiteSpace(d.Title?.Sv)
                        ? d.Text?.Sv
                        : $"{d.Title.Sv}: {d.Text?.Sv}";
                    if (!string.IsNullOrWhiteSpace(part))
                        descParts.Add(part);
                }
                if (!whenInserted)
                    descParts.Add($"När?: {whenText}");

                var content = string.Join("\n\n", descParts);

                var ev = new CanonicalEvent
                {
                    SourceId    = Source.Id,
                    ExternalId  = $"smhi-{warning.Id}-{area.Id}",
                    Title       = title,
                    Content     = content,
                    PublishedAt = ParseDate(area.Published ?? area.ApproximateStart),
                    Url         = "https://www.smhi.se/vadret/vadret-i-sverige/varningar",
                    RawData     = title + " | " + content,
                    Geography   = areaName,
                    Severity    = MapSeverity(levelCode),
                };

                MetadataFallbacks.ApplyAll(ev);
                events.Add(ev);
            }
        }

        return events;
    }

    private static DateTime ParseDate(string? s)
    {
        if (s == null) return DateTime.UtcNow;
        return DateTimeOffset.TryParse(s, out var dto) ? dto.UtcDateTime : DateTime.UtcNow;
    }

    private static string? FormatPeriod(string? startRaw, string? endRaw)
    {
        if (!DateTimeOffset.TryParse(startRaw, out var startUtc))
            return null;

        var start = TimeZoneInfo.ConvertTime(startUtc, StockholmTz);

        if (!DateTimeOffset.TryParse(endRaw, out var endUtc))
            return $"Från {start.ToString("d MMMM", SvCulture)} kl. {start:HH.mm}";

        var end = TimeZoneInfo.ConvertTime(endUtc, StockholmTz);

        return start.Date == end.Date
            ? $"{start.ToString("d MMMM", SvCulture)} kl. {start:HH.mm}–{end:HH.mm}"
            : $"{start.ToString("d MMMM", SvCulture)} kl. {start:HH.mm} – {end.ToString("d MMMM", SvCulture)} kl. {end:HH.mm}";
    }

    private static string MapSeverity(string? code) => code?.ToUpperInvariant() switch
    {
        "RED"    => "Kritisk",
        "ORANGE" => "Viktigt",
        "YELLOW" => "Viktigt",
        _        => "Bra att veta", // MESSAGE m.fl. — rena informationsmeddelanden, ingen officiell varningsnivå
    };
}

internal class SmhiWarning
{
    [JsonPropertyName("id")]           public int?                   Id           { get; set; }
    [JsonPropertyName("warningAreas")] public List<SmhiWarningArea>? WarningAreas { get; set; }
}

internal class SmhiWarningArea
{
    [JsonPropertyName("id")]               public int?                   Id               { get; set; }
    [JsonPropertyName("areaName")]         public SmhiLocalizedText?     AreaName         { get; set; }
    [JsonPropertyName("warningLevel")]     public SmhiWarningLevel?      WarningLevel     { get; set; }
    [JsonPropertyName("eventDescription")] public SmhiLocalizedText?     EventDescription { get; set; }
    [JsonPropertyName("descriptions")]     public List<SmhiDescription>? Descriptions     { get; set; }
    [JsonPropertyName("approximateStart")] public string?                ApproximateStart { get; set; }
    [JsonPropertyName("approximateEnd")]   public string?                ApproximateEnd   { get; set; }
    [JsonPropertyName("published")]        public string?                Published        { get; set; }
}

internal class SmhiWarningLevel
{
    [JsonPropertyName("code")] public string? Code { get; set; }
    [JsonPropertyName("sv")]   public string? Sv   { get; set; }
}

internal class SmhiLocalizedText
{
    [JsonPropertyName("sv")]   public string? Sv   { get; set; }
    [JsonPropertyName("code")] public string? Code { get; set; }
}

internal class SmhiDescription
{
    [JsonPropertyName("title")] public SmhiLocalizedText? Title { get; set; }
    [JsonPropertyName("text")]  public SmhiLocalizedText? Text  { get; set; }
}
