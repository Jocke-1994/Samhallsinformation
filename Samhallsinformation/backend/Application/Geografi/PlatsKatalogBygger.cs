namespace Samhallsinformation.Application.Geografi;

/// <summary>
/// Bygger pluppkatalogen för det geografiska platsfiltret (se
/// docs/vault/Ideer/Geografiskt-platsfilter-besokare.md, beslut 6+13+14).
///
/// Katalogen innehåller ALLTID alla 290 kommuner + 21 län + "Nationellt" —
/// inte bara de med en aktiv händelse — eftersom sökfältet (beslut 13) ska
/// kunna matcha mot alla svenska platser och visa en gråmarkerad "(0)"-plupp
/// för de utan träff. <c>AntalHändelser</c> avgör om en plupp är aktiv.
///
/// En länsvarning räknas automatiskt in för varje kommun i länet (beslut 2)
/// — därav KommunRäknare-inkrementeringen i Lan-grenen nedan.
/// </summary>
public enum PlatsKatalogNivå { Kommun, Lan, Nationellt }

public sealed record PlatsKatalogPost(string Namn, PlatsKatalogNivå Nivå, string? Lan, int AntalHändelser)
{
    public bool Aktiv => AntalHändelser > 0;
}

public static class PlatsKatalogBygger
{
    public static IReadOnlyList<PlatsKatalogPost> Bygg(IEnumerable<(string? Geography, bool IsNational)> händelser)
    {
        var kommunRäknare = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var länRäknare = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var nationelltAntal = 0;

        foreach (var (geography, isNational) in händelser)
        {
            if (isNational)
            {
                nationelltAntal++;
                continue;
            }

            var träff = PlatsMatchare.Matcha(geography);
            if (träff is null) continue;

            if (träff.Nivå == PlatsNivå.Kommun)
            {
                kommunRäknare[träff.Namn] = kommunRäknare.GetValueOrDefault(träff.Namn) + 1;
            }
            else
            {
                länRäknare[träff.Namn] = länRäknare.GetValueOrDefault(träff.Namn) + 1;
                foreach (var kommun in PlatsMatchare.KommunerILan(träff.Namn))
                    kommunRäknare[kommun] = kommunRäknare.GetValueOrDefault(kommun) + 1;
            }
        }

        var resultat = new List<PlatsKatalogPost>(KommunLan.Alla.Count + KommunLan.AllaLan.Count + 1);

        foreach (var post in KommunLan.Alla)
            resultat.Add(new PlatsKatalogPost(post.Kommun, PlatsKatalogNivå.Kommun, post.Lan, kommunRäknare.GetValueOrDefault(post.Kommun)));

        foreach (var lan in KommunLan.AllaLan)
            resultat.Add(new PlatsKatalogPost(lan, PlatsKatalogNivå.Lan, lan, länRäknare.GetValueOrDefault(lan)));

        resultat.Add(new PlatsKatalogPost("Nationellt", PlatsKatalogNivå.Nationellt, null, nationelltAntal));

        return resultat;
    }
}
