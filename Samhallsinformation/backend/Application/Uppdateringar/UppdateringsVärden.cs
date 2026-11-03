namespace Samhallsinformation.Application.Uppdateringar;

/// <summary>
/// Tillåtna värden för <c>UppdateringsPunkt.Typ</c> och <c>.Synlighet</c>. Samma
/// uppsättning som seeden i Program.cs och frontendens typ-konfiguration
/// (api/uppdateringar.ts) använder. Jämförelsen är skiftlägeskänslig med
/// avsikt — "Alla" matchar varken "alla" eller "inloggade" i läsvägen, så det
/// ska avvisas redan vid skrivning.
///
/// Gäller bara SKRIVVÄGEN. Redan lagrade rader med okända värden returneras
/// oförändrade av läsvägen (frontend har en fallback).
/// </summary>
public static class UppdateringsVärden
{
    public const string SynlighetAlla      = "alla";
    public const string SynlighetInloggade = "inloggade";
    public const string TypKommerSnart     = "kommer-snart";

    public static readonly IReadOnlySet<string> Typer = new HashSet<string>(StringComparer.Ordinal)
    {
        "ny-funktion", "förbättring", "buggfix", "känt-problem", "kommer-snart",
    };

    public static readonly IReadOnlySet<string> Synligheter = new HashSet<string>(StringComparer.Ordinal)
    {
        SynlighetAlla, SynlighetInloggade,
    };

    /// <summary>
    /// "Prova själv"-mål. Samma nycklar som frontendens lib/provaSjalv.ts, som
    /// äger adress, etikett, flagga och om målet kräver konto.
    /// </summary>
    public static readonly IReadOnlySet<string> ProvaSjalvMål = new HashSet<string>(StringComparer.Ordinal)
    {
        "senaste-nytt-plats", "profil-uppdateringar", "konto-push", "aktivera-push", "mitt-flode-sparat", "mina-kallor", "support",
    };

    /// <summary>Returnerar ett felmeddelande för första ogiltiga punkten, annars null.</summary>
    public static string? ValideraPunkter(IEnumerable<(string? Typ, string? Synlighet, string? ProvaSjalv)> punkter)
    {
        var i = 0;
        foreach (var (typ, synlighet, provaSjalv) in punkter)
        {
            i++;
            if (typ is null || !Typer.Contains(typ))
                return $"Punkt {i}: okänd Typ '{typ}'. Tillåtna värden: {string.Join(", ", Typer.Order())}.";
            if (synlighet is null || !Synligheter.Contains(synlighet))
                return $"Punkt {i}: okänd Synlighet '{synlighet}'. Tillåtna värden: {string.Join(", ", Synligheter.Order())}.";
            if (provaSjalv is not null && !ProvaSjalvMål.Contains(provaSjalv))
                return $"Punkt {i}: okänt Prova själv-mål '{provaSjalv}'. Tillåtna värden: {string.Join(", ", ProvaSjalvMål.Order())}.";
        }
        return null;
    }
}
