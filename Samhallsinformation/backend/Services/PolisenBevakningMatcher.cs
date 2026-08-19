namespace Samhallsinformation.Services;

using System.Text.Json;
using Samhallsinformation.Models;

// Speglar frontend/src/components/Profile/MinaKallor/kallorUtils.ts
// (POLISEN_KATEGORIER + extraheraPolisenTyp) — hålls manuellt i synk, samma
// accepterade duplicering som redan finns för kategorilistan idag. Behövs
// på backend för att push (PushDispatcher) ska kunna matcha mot samma
// regler som avgör vad som visas i Mitt flöde.
public static class PolisenBevakningMatcher
{
    public static readonly string[] Kategorier =
    [
        "Trafikbrott", "Trafikolycka", "Trafikkontroll", "Trafikhinder",
        "Misshandel", "Våldtäkt", "Rån", "Stöld", "Narkotikabrott", "Vapenlagen",
        "Brand", "Fjällräddning", "Övrigt", "Ofredande/förargelse",
        "Sammanfattning natt", "Sammanfattning kväll och natt",
    ];

    // Matchar mot det redan strukturerade EventType-fältet (PolisenRssIngestor,
    // PR #373) — INTE Title. Verifierat mot skarp data (2026-08-19): titeln har
    // ett datumprefix ("14 augusti 13.05, Bedrägeri, ..."), så Title.StartsWith
    // hade aldrig matchat något. EventType kan ha en kvalificerare efter basen
    // ("Trafikolycka, personskada") — StartsWith hanterar det.
    public static string? ExtractTyp(string? eventType) =>
        eventType == null ? null : Kategorier.FirstOrDefault(eventType.StartsWith);

    // Tom lista = ingen bevakning skapad = oförändrat beteende (allt syns/pushas).
    // Annars ELLER mellan bevakningarna, AND inom varje bevakning mellan typ/område.
    public static bool Matches(CanonicalEvent ev, List<PolisenBevakning> bevakningar)
    {
        if (bevakningar.Count == 0) return true;

        var typ    = ExtractTyp(ev.EventType);
        var omrade = ev.Geography;

        foreach (var b in bevakningar)
        {
            var kategorier = b.KategorierJson == null ? null : JsonSerializer.Deserialize<List<string>>(b.KategorierJson);
            var omraden    = b.OmradenJson    == null ? null : JsonSerializer.Deserialize<List<string>>(b.OmradenJson);

            var typOk    = kategorier == null || typ    == null || kategorier.Contains(typ);
            var omradeOk = omraden    == null || omrade == null || omraden.Contains(omrade);

            if (typOk && omradeOk) return true;
        }

        return false;
    }
}
