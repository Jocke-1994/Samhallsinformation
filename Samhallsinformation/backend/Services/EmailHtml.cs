namespace Samhallsinformation.Services;

using System.Text;

/// <summary>
/// Hjälpare för att lägga användarstyrda värden säkert i utgående mejl.
/// Allt som en användare kan påverka (namn, e-post, ärendeämne m.m.) ska
/// passera <see cref="Encode"/> innan det interpoleras i HTML-kroppen, och
/// <see cref="SingleLine"/> innan det hamnar i en ämnesrad/rubrik.
/// </summary>
internal static class EmailHtml
{
    /// <summary>
    /// HTML-kodar de fem tecknen som kan bryta ut ur text eller attribut
    /// (&amp; &lt; &gt; " apostrof). Övriga tecken (å, ä, ö m.fl.) lämnas orörda —
    /// WebUtility.HtmlEncode hade gjort om dem till numeriska entiteter.
    /// </summary>
    public static string Encode(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        var sb = new StringBuilder(value.Length + 16);
        foreach (var ch in value)
        {
            switch (ch)
            {
                case '&': sb.Append("&amp;"); break;
                case '<': sb.Append("&lt;"); break;
                case '>': sb.Append("&gt;"); break;
                case '"': sb.Append("&quot;"); break;
                case '\'': sb.Append("&#39;"); break;
                default: sb.Append(ch); break;
            }
        }
        return sb.ToString();
    }

    /// <summary>
    /// Gör om ett värde till en enda rad: radbrytningar och andra
    /// kontrolltecken ersätts med mellanslag (skyddar mot header-injektion i
    /// ämnesrader) och upprepade mellanslag slås ihop.
    /// </summary>
    public static string SingleLine(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        var sb = new StringBuilder(value.Length);
        var lastWasSpace = false;
        foreach (var ch in value)
        {
            var c = char.IsControl(ch) || ch == '\u2028' || ch == '\u2029' ? ' ' : ch;
            if (c == ' ')
            {
                if (lastWasSpace) continue;
                lastWasSpace = true;
            }
            else lastWasSpace = false;
            sb.Append(c);
        }
        return sb.ToString().Trim();
    }

    /// <summary>Ett enradsvärde som dessutom är HTML-kodat (för rubriker i kroppen).</summary>
    public static string EncodeSingleLine(string? value) => Encode(SingleLine(value));

    /// <summary>URL-kodar ett värde som läggs som query-parameter i en länk.</summary>
    public static string UrlEncode(string? value) => Uri.EscapeDataString(value ?? string.Empty);
}
