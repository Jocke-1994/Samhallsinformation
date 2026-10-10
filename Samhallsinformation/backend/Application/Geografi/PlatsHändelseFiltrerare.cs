namespace Samhallsinformation.Application.Geografi;

/// <summary>
/// Avgör om en enskild händelse "gäller" en vald plats, för platsfiltrets
/// sektionerade resultatvy (docs/vault/Ideer/Geografiskt-platsfilter-besokare.md,
/// beslut 3+4). Flervalsbart med ELLER-logik — anropas en gång per vald
/// plats, varje plats får sin egen sektion.
///
/// Samma matchningsregler som PlatsKatalogBygger (medvetet separat metod,
/// inte en omskrivning av räknarlogiken) — en kommunträff gäller bara sin
/// egen kommun, en länsträff gäller BÅDE länet självt OCH varje kommun i
/// länet (beslut 2).
/// </summary>
public static class PlatsHändelseFiltrerare
{
    public static bool GällerPlats(string plats, string? geography, bool isNational)
    {
        if (string.Equals(plats, "Nationellt", StringComparison.OrdinalIgnoreCase))
            return isNational;

        if (isNational) return false;

        var träff = PlatsMatchare.Matcha(geography);
        if (träff is null) return false;

        if (string.Equals(träff.Namn, plats, StringComparison.OrdinalIgnoreCase))
            return true; // direkt kommun- eller länsträff

        // Länsvarningen ärvs in för varje kommun i länet — men bara i den
        // riktningen, en enskild kommunhändelse gäller aldrig hela länet.
        return träff.Nivå == PlatsNivå.Lan
            && KommunLan.LanForKommun.TryGetValue(plats, out var platsLän)
            && string.Equals(platsLän, träff.Namn, StringComparison.OrdinalIgnoreCase);
    }
}
