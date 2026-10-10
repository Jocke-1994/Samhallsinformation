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
///  - Trafikverket: länsnamn, ibland med en vägsträcka bakom
///    ("Stockholms län E4") — matchar när det bara är länet, annars null.
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

public sealed record PlatsTräff(PlatsNivå Nivå, string Namn, string Lan);

public static class PlatsMatchare
{
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
