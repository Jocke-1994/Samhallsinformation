namespace Samhallsinformation.Services;

// Server-side gränser för Polisen-bevakningar (V3-17 / E4#6). Varje ny
// Polisen-händelse matchas mot varje bevakning hos varje mottagare
// (PolisenBevakningMatcher, PushDispatcher), och listorna skrivs även till
// audit-loggen — utan tak kan ett enskilt konto förstärka CPU och lagring.
//
// Mängderna är SLUTNA: kategorier = PolisenBevakningMatcher.Kategorier,
// områden = de 290 kommunerna i SvenskaLan (identiska med frontendens
// kallorUtils.ts; det är bara de som klienten kan skicka). Efter dedupe kan
// en giltig lista därför aldrig bli längre än mängden — "alla kommuner i ett
// län" (och t.ex. alla utom en av 290) ryms alltid. Taken på RÅ listlängd
// nedan finns bara för att avvisa uppenbart skräp innan vi går igenom det.
//
// Gäller bara vid skapa/ändra — befintliga rader läses aldrig genom den här
// klassen, så en redan för stor bevakning kan fortfarande läsas.
public static class PolisenBevakningValidator
{
    public const int MaxKategorierIRequest = 50;   // giltig mängd: 16
    public const int MaxOmradenIRequest = 300;  // giltig mängd: 290
    public const int MaxStrangLangd = 100;  // längsta kommunnamn: 15

    private static readonly HashSet<string> KändaKommuner =
        new(SvenskaLan.LanKommuner.Values.SelectMany(k => k), StringComparer.Ordinal);

    public sealed record Resultat(List<string>? Kategorier, List<string>? Omraden, string? Fel)
    {
        public bool Ok => Fel == null;
    }

    // null = "ej begränsat" (alla typer/områden) och bevaras; en tom lista är ett
    // explicit tomt urval och bevaras också. Värden trimmas och dedupliceras
    // (första förekomstens ordning behålls).
    public static Resultat Validera(List<string>? kategorier, List<string>? omraden)
    {
        var kat = ValideraLista(kategorier, "kategorier", MaxKategorierIRequest,
            PolisenBevakningMatcher.Kategorier.ToHashSet(StringComparer.Ordinal), "kategori");
        if (kat.Fel != null) return new Resultat(null, null, kat.Fel);

        var omr = ValideraLista(omraden, "områden", MaxOmradenIRequest, KändaKommuner, "kommun");
        if (omr.Fel != null) return new Resultat(null, null, omr.Fel);

        return new Resultat(kat.Lista, omr.Lista, null);
    }

    private static (List<string>? Lista, string? Fel) ValideraLista(
        List<string>? lista, string namn, int maxRå, HashSet<string> kända, string enkelNamn)
    {
        if (lista == null) return (null, null);

        if (lista.Count > maxRå)
            return (null, $"För många {namn} — högst {maxRå} får skickas per bevakning.");

        var resultat = new List<string>();
        var sedda = new HashSet<string>(StringComparer.Ordinal);
        foreach (var rå in lista)
        {
            var värde = rå?.Trim();
            if (string.IsNullOrEmpty(värde))
                return (null, $"Listan med {namn} får inte innehålla tomma värden.");
            if (värde.Length > MaxStrangLangd)
                return (null, $"Ett värde i {namn} är för långt — högst {MaxStrangLangd} tecken.");
            if (!kända.Contains(värde))
                return (null, $"Okänd {enkelNamn}: \"{värde}\".");
            if (sedda.Add(värde)) resultat.Add(värde);
        }

        return (resultat, null);
    }
}
