namespace Samhallsinformation.Application.Csp;

using System.Text.Json;
using System.Text.RegularExpressions;

/// <summary>En sanerad CSP-överträdelse: bara direktivnamn och origin — ingen sökväg, query eller fragment.</summary>
public sealed record CspViolation(string Directive, string Origin);

/// <summary>
/// Defensiv parser för CSP-rapporter (V3-22). Tar emot båda format webbläsare skickar:
///  - Legacy <c>report-uri</c> (application/csp-report): <c>{"csp-report": {"blocked-uri": ..., "effective-directive": ...}}</c>
///  - Reporting API <c>report-to</c> (application/reports+json): <c>[{"type":"csp-violation","body":{"blockedURL": ..., "effectiveDirective": ...}}]</c>
///
/// Kastar aldrig: skräp, fel JSON-form, fel typer och för långa värden ger tom lista. Endpointen är anonym,
/// så ALLT i en rapport är opålitligt — vi behåller bara två fält och tvingar båda in i en snäv form:
///  - direktiv: bara [a-z-] (t.ex. "script-src-elem"), max 40 tecken
///  - origin: bara schema://värd[:port] för http/https/ws/wss, eller ett av några nyckelord ("inline", "eval", "data" ...)
/// Query-strängar, fragment, sökvägar och användarinfo tas alltså bort — ingen persondata sparas.
/// Webbläsartillägg (chrome-extension:// m.fl.) hoppas över: de är inte från vår sida och skulle bara ge brus.
/// </summary>
public static class CspReportParser
{
    public const int MaxViolationsPerBody = 10;
    public const int MaxOriginLength = 200;

    private static readonly Regex DirectivePattern = new("^[a-z][a-z-]{0,39}$", RegexOptions.Compiled);

    // Nyckelord som webbläsare skickar som blocked-uri i stället för en URL.
    private static readonly HashSet<string> Keywords = new(StringComparer.Ordinal)
    {
        "inline", "eval", "wasm-eval", "data", "blob", "about", "self", "http", "https", "ws", "wss",
        "trusted-types-policy", "trusted-types-sink",
    };

    // Scheman där bara schemat behålls även om resten är en hel URL ("data:text/javascript,…", "blob:https://…").
    private static readonly HashSet<string> SchemeOnly = new(StringComparer.Ordinal) { "data", "blob", "about" };

    public static IReadOnlyList<CspViolation> Parse(string? body)
    {
        if (string.IsNullOrWhiteSpace(body)) return [];

        try
        {
            using var doc = JsonDocument.Parse(body, new JsonDocumentOptions { MaxDepth = 8 });
            var result = new List<CspViolation>();
            Collect(doc.RootElement, result);
            return result;
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static void Collect(JsonElement root, List<CspViolation> result)
    {
        switch (root.ValueKind)
        {
            case JsonValueKind.Object:
                if (root.TryGetProperty("csp-report", out var legacy) && legacy.ValueKind == JsonValueKind.Object)
                    Add(result, Str(legacy, "effective-directive") ?? Str(legacy, "violated-directive"), Str(legacy, "blocked-uri"));
                else if (root.TryGetProperty("body", out var single) && single.ValueKind == JsonValueKind.Object)
                    AddReportingApi(result, root, single);
                break;

            case JsonValueKind.Array:
                foreach (var item in root.EnumerateArray())
                {
                    if (result.Count >= MaxViolationsPerBody) break;
                    if (item.ValueKind == JsonValueKind.Object
                        && item.TryGetProperty("body", out var body) && body.ValueKind == JsonValueKind.Object)
                        AddReportingApi(result, item, body);
                }
                break;
        }
    }

    private static void AddReportingApi(List<CspViolation> result, JsonElement report, JsonElement body)
    {
        // Andra rapporttyper (deprecation, intervention ...) kan dela samma kuvert — bara csp-violation räknas.
        if (Str(report, "type") is { } type && type != "csp-violation") return;
        Add(result, Str(body, "effectiveDirective") ?? Str(body, "violatedDirective"), Str(body, "blockedURL"));
    }

    private static void Add(List<CspViolation> result, string? rawDirective, string? rawBlocked)
    {
        if (result.Count >= MaxViolationsPerBody) return;

        var directive = NormalizeDirective(rawDirective);
        var origin = NormalizeOrigin(rawBlocked);
        if (directive == null || origin == null) return;

        result.Add(new CspViolation(directive, origin));
    }

    private static string? Str(JsonElement obj, string name) =>
        obj.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    /// <summary>Äldre webbläsare skickar "script-src 'self' https://…" som violated-directive — bara första ordet är direktivet.</summary>
    public static string? NormalizeDirective(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var first = raw.Trim().Split(' ', 2)[0].ToLowerInvariant();
        return DirectivePattern.IsMatch(first) ? first : null;
    }

    /// <summary>
    /// Origin (schema://värd[:port]) eller nyckelord. null = hoppa över rapporten (tomt, skräp,
    /// webbläsartillägg eller okänt schema).
    /// </summary>
    public static string? NormalizeOrigin(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw) || raw.Length > 2048) return null;

        var value = raw.Trim().ToLowerInvariant();

        var colon = value.IndexOf(':');
        var scheme = colon > 0 ? value[..colon] : value;

        if (SchemeOnly.Contains(scheme)) return scheme;
        if (!value.Contains("://") && Keywords.Contains(scheme)) return scheme;

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)) return null;
        if (uri.Scheme is not ("http" or "https" or "ws" or "wss")) return null;
        if (string.IsNullOrEmpty(uri.IdnHost)) return null;

        var origin = $"{uri.Scheme}://{uri.IdnHost}" + (uri.IsDefaultPort ? "" : $":{uri.Port}");
        return origin.Length <= MaxOriginLength ? origin : null;
    }
}
