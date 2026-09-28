namespace Samhallsinformation.Services;

/// <summary>
/// Validerar en Web Push-endpoint (URL:en servern senare POST:ar till) mot en
/// allowlist över kända push-tjänster. Skyddar mot blind SSRF: utan kontrollen
/// kan en registrerad användare få servern att anropa godtyckliga adresser
/// (interna tjänster, molnets metadata-endpoint, en långsam server som stör
/// utskicksloopen).
///
/// Regler: absolut https-URL, max 2000 tecken, inga blanktecken, ingen
/// userinfo (user:pass@), endast standardport 443, värden ska vara ett
/// DNS-namn (aldrig IP-adress) och tillhöra en känd push-tjänst.
///
/// Värdmatchning sker på hela etikettgränser:
///  - "host.tld"   = exakt värd
///  - "*.host.tld" = valfri underdomän till host.tld (men inte host.tld själv)
/// "fcm.googleapis.com.evil.com" matchar därför ingen post.
/// </summary>
public static class PushEndpointValidator
{
    public const int MaxLength = 2000;

    // Chrome/Edge/Opera/Brave/Samsung (FCM), Firefox (autopush), Safari/iOS (APNs Web Push),
    // äldre Edge (WNS).
    public static readonly IReadOnlyList<string> DefaultAllowedHosts = new[]
    {
        "fcm.googleapis.com",
        "android.googleapis.com",
        "*.push.services.mozilla.com",
        "web.push.apple.com",
        "*.push.apple.com",
        "*.notify.windows.com",
    };

    /// <summary>
    /// Kommaseparerad extra allowlist (samma syntax som DefaultAllowedHosts),
    /// t.ex. via miljövariabeln PUSH_ALLOWED_ENDPOINT_HOSTS. Tillägg — ersätter aldrig standardlistan.
    /// </summary>
    public const string ExtraHostsConfigKey = "PUSH_ALLOWED_ENDPOINT_HOSTS";

    public static IReadOnlyList<string> ParseExtraHosts(string? configValue) =>
        string.IsNullOrWhiteSpace(configValue)
            ? Array.Empty<string>()
            : configValue.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    public static bool IsValid(string? endpoint, IEnumerable<string>? extraAllowedHosts = null) =>
        TryValidate(endpoint, out _, extraAllowedHosts);

    public static bool TryValidate(string? endpoint, out string? error, IEnumerable<string>? extraAllowedHosts = null)
    {
        error = null;

        if (string.IsNullOrEmpty(endpoint))
        {
            error = "Push-endpoint saknas.";
            return false;
        }
        if (endpoint.Length > MaxLength)
        {
            error = "Push-endpointen är för lång.";
            return false;
        }
        if (endpoint.Any(c => char.IsWhiteSpace(c) || char.IsControl(c)))
        {
            error = "Push-endpointen innehåller ogiltiga tecken.";
            return false;
        }
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri))
        {
            error = "Push-endpointen är inte en giltig absolut URL.";
            return false;
        }
        if (uri.Scheme != Uri.UriSchemeHttps)
        {
            error = "Push-endpointen måste använda https.";
            return false;
        }
        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            error = "Push-endpointen får inte innehålla användaruppgifter.";
            return false;
        }
        if (!uri.IsDefaultPort)
        {
            error = "Push-endpointen får inte använda en icke-standardport.";
            return false;
        }
        // IP-adresser (IPv4/IPv6, även hex/oktal-varianter som Uri normaliserar) avvisas alltid.
        if (uri.HostNameType != UriHostNameType.Dns)
        {
            error = "Push-endpointen måste ha ett domännamn, inte en IP-adress.";
            return false;
        }

        var host = uri.IdnHost.ToLowerInvariant();
        var allowed = DefaultAllowedHosts.Concat(extraAllowedHosts ?? Array.Empty<string>());
        if (!allowed.Any(pattern => HostMatches(host, pattern)))
        {
            error = "Push-endpointen tillhör ingen känd push-tjänst.";
            return false;
        }

        return true;
    }

    private static bool HostMatches(string host, string pattern)
    {
        pattern = pattern.Trim().ToLowerInvariant();
        if (pattern.Length == 0) return false;

        if (pattern.StartsWith("*.", StringComparison.Ordinal))
        {
            var suffix = pattern[1..]; // ".push.apple.com" — inkluderar punkten = etikettgräns
            return suffix.Length > 1 && host.EndsWith(suffix, StringComparison.Ordinal);
        }
        return host == pattern;
    }
}
