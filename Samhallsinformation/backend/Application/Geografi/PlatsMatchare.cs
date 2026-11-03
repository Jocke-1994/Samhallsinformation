namespace Samhallsinformation.Application.Geografi;

/// <summary>
/// Matchar ett händelse-<c>Geography</c>-fält mot en känd kommun eller ett
/// känt län, för det geografiska platsfiltret (se
/// docs/vault/Ideer/Geografiskt-platsfilter-besokare.md).
///
/// Medvetet BARA exakt (skiftlägesokänslig) matchning — ingen fuzzy-logik,
/// ingen textutvinning ur fria meningar. Verifierat mot riktig lokal data
/// 2026-10-09 innan den byggdes:
///  - Polisen: ~99% av händelserna har en ren kommun- eller länstext
///    ("Botkyrka", "Hallands län") — matchar rent.
///  - Trafikverket: länets grundnamn UTAN "län", ofta med ett vägnummer
///    bakom ("Skåne", "Västra Götaland Väg 1040", "Uppsala E18") — se
///    TrafikverketApiIngestor.CountyName. Matchas med en egen, källspecifik
///    regel (MatchaTrafikverket nedan, rättat 2026-11-03 — den ursprungliga
///    antagelsen "Stockholms län E4" stämde inte med verklig data, så ingen
///    Trafikverket-händelse träffade alls). En Trafikverket-träff gäller
///    BARA länets egen plupp, ärvs aldrig ut till kommunerna (beslut
///    2026-11-03: vägarbeten på E6 i Skåne är inte en varning för hela
///    länet, och skulle annars dränka varje kommun).
///  - Krisinformation: har i praktiken aldrig en Geography just nu —
///    redan hanterat av det befintliga "ingen plats = Nationellt"-fallet.
///  - SMHI: fritext (havsområden som "Skagerrak", hela meningar som
///    "Delar av Gävleborgs län", flerläns-beskrivningar) — matchar nästan
///    aldrig. MEDVETET under utredning för v1 (beslut 2026-10-09): en
///    riktig SMHI-specifik tolkning är ett eget, separat jobb. Tills
///    dess deltar SMHI:s händelser helt enkelt inte i platsfiltret — de
///    syns som vanligt i det ofiltrerade flödet.
///
/// En händelse utan matchning (null, tom sträng, eller text som inte
/// känns igen) returnerar null — den räknas varken som en kommun/län-
/// träff eller som "Nationellt". "Nationellt" gäller bara när Geography
/// helt saknas (beslut 5 i idé-noten), inte när den finns men inte går
/// att tolka — annars skulle t.ex. en SMHI-varning för "Delar av
/// Gävleborgs län" visas som att den gäller hela Sverige, vilket är fel.
/// </summary>
public enum PlatsNivå { Kommun, Lan }

/// <param name="ÄrvsTillKommuner">
/// Bara relevant för en länsträff: ska händelsen också räknas in under
/// varje kommun i länet (beslut 2)? Sant för en riktig länsvarning
/// ("Hallands län" från Polisen), falskt för Trafikverkets vägsituationer.
/// </param>
public sealed record PlatsTräff(PlatsNivå Nivå, string Namn, string Lan, bool ÄrvsTillKommuner = true);

public static class PlatsMatchare
{
    /// <summary>Samma värde som TrafikverketApiIngestor.Source.Id (låst av ett test).</summary>
    public const int TrafikverketSourceId = 4;

    // Trafikverkets länsnamn (TrafikverketApiIngestor.CountyName) → länets
    // fullständiga namn i KommunLan. Explicit tabell i stället för att
    // härleda ("Västra Götalands län" → "Västra Götaland"), så att varje
    // rad går att läsa och testa direkt.
    private static readonly IReadOnlyDictionary<string, string> TrafikverketLän =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Stockholm"]       = "Stockholms län",
            ["Uppsala"]         = "Uppsala län",
            ["Södermanland"]    = "Södermanlands län",
            ["Östergötland"]    = "Östergötlands län",
            ["Jönköping"]       = "Jönköpings län",
            ["Kronoberg"]       = "Kronobergs län",
            ["Kalmar"]          = "Kalmar län",
            ["Gotland"]         = "Gotlands län",
            ["Blekinge"]        = "Blekinge län",
            ["Skåne"]           = "Skåne län",
            ["Halland"]         = "Hallands län",
            ["Västra Götaland"] = "Västra Götalands län",
            ["Värmland"]        = "Värmlands län",
            ["Örebro"]          = "Örebro län",
            ["Västmanland"]     = "Västmanlands län",
            ["Dalarna"]         = "Dalarnas län",
            ["Gävleborg"]       = "Gävleborgs län",
            ["Västernorrland"]  = "Västernorrlands län",
            ["Jämtland"]        = "Jämtlands län",
            ["Västerbotten"]    = "Västerbottens län",
            ["Norrbotten"]      = "Norrbottens län",
        };

    /// <summary>Exponerad för testet som kontrollerar att varje mål finns i KommunLan.AllaLan.</summary>
    public static IReadOnlyCollection<string> TrafikverketLänMål => [.. TrafikverketLän.Values];

    /// <summary>
    /// Källmedveten matchning. Trafikverket har ett eget format och kan
    /// inte gå genom den vanliga regeln — "Uppsala"/"Kalmar"/"Stockholm"
    /// är där länet, men skulle annars tolkas som kommunen med samma namn.
    /// </summary>
    public static PlatsTräff? Matcha(string? geography, int sourceId) =>
        sourceId == TrafikverketSourceId ? MatchaTrafikverket(geography) : Matcha(geography);

    public static PlatsTräff? MatchaTrafikverket(string? geography)
    {
        if (string.IsNullOrWhiteSpace(geography)) return null;
        var text = geography.Trim();

        foreach (var (kort, län) in TrafikverketLän)
        {
            // Hela strängen ("Skåne") eller länet följt av ett mellanslag och
            // ett vägnummer ("Skåne E6"). Kräver mellanslaget så att ett namn
            // aldrig matchar början av ett annat.
            if (string.Equals(text, kort, StringComparison.OrdinalIgnoreCase)
                || text.StartsWith(kort + " ", StringComparison.OrdinalIgnoreCase))
                return new PlatsTräff(PlatsNivå.Lan, län, län, ÄrvsTillKommuner: false);
        }

        return null; // t.ex. bara "E4" eller "Väg 273" — inget län angivet
    }

    public static PlatsTräff? Matcha(string? geography)
    {
        if (string.IsNullOrWhiteSpace(geography)) return null;
        var text = geography.Trim();

        var kommunPost = KommunLan.Alla.FirstOrDefault(p => string.Equals(p.Kommun, text, StringComparison.OrdinalIgnoreCase));
        if (kommunPost != null)
            return new PlatsTräff(PlatsNivå.Kommun, kommunPost.Kommun, kommunPost.Lan);

        var länNamn = KommunLan.AllaLan.FirstOrDefault(l => string.Equals(l, text, StringComparison.OrdinalIgnoreCase));
        if (länNamn != null)
            return new PlatsTräff(PlatsNivå.Lan, länNamn, länNamn);

        return null;
    }

    /// <summary>Alla kommuner i ett givet län — för länsvarningens ärvning till varje kommun (beslut 2).</summary>
    public static IReadOnlyList<string> KommunerILan(string lan) =>
        [.. KommunLan.Alla.Where(p => string.Equals(p.Lan, lan, StringComparison.OrdinalIgnoreCase)).Select(p => p.Kommun)];
}
