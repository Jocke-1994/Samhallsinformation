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

    // Sammanfattningar taggas av Polisen med ett HELT LÄN som Geography,
    // aldrig en kommun — en kommun-baserad bevakning kan därför aldrig
    // begränsa dem meningsfullt. Enda sättet att matcha dem alls är en
    // bevakning utan områdesbegränsning, vilket ger sammanfattningar från
    // HELA Sverige istället för bara den egna regionen (upptäckt 2026-09-12).
    // Avslagna som push-standard av det skälet — fortsätter synas i Mitt
    // flöde precis som förut om en bevakning matchar, bara push-utskicket
    // exkluderar dem.
    public static readonly string[] SammanfattningsKategorier =
    [
        "Sammanfattning natt", "Sammanfattning kväll och natt",
    ];

    public static bool ArSammanfattning(string? eventType) =>
        ExtractTyp(eventType) is string typ && SammanfattningsKategorier.Contains(typ);

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

        var typ = ExtractTyp(ev.EventType);
        var omrade = ev.Geography;

        foreach (var b in bevakningar)
        {
            var kategorier = b.KategorierJson == null ? null : JsonSerializer.Deserialize<List<string>>(b.KategorierJson);
            var omraden = b.OmradenJson == null ? null : JsonSerializer.Deserialize<List<string>>(b.OmradenJson);

            var typOk = kategorier == null || typ == null || kategorier.Contains(typ);
            var omradeOk = omraden == null || omrade == null || omraden.Contains(omrade);

            if (typOk && omradeOk) return true;
        }

        return false;
    }

    // Som Matches(), men för admin-förklaringen (AdminUserDetailsController.
    // ExplainEvent) — säger VILKEN bevakning som matchade och varför, i
    // klartext, istället för bara sant/falskt. Läns-medveten på samma sätt
    // som frontendens matcharLän (PolisenBevakningarContext.tsx, fixad
    // 2026-09-14) — en sammanfattnings läns-geografi ("Jönköpings län")
    // matchar en kommun-baserad bevakning om NÅGON av bevakningens kommuner
    // ligger i det länet, aldrig via en exakt strängjämförelse.
    public static (bool Matchar, string Anledning, Guid? BevakningId) Explain(CanonicalEvent ev, List<PolisenBevakning> bevakningar)
    {
        if (bevakningar.Count == 0)
            return (true, "Ingen bevakning satt — allt från Polisen syns i Mitt flöde.", null);

        var typ = ExtractTyp(ev.EventType);
        var lan = ev.Geography != null && SvenskaLan.LanKommuner.ContainsKey(ev.Geography) ? ev.Geography : null;
        var omrade = lan == null ? ev.Geography : null;

        foreach (var b in bevakningar)
        {
            var kategorier = b.KategorierJson == null ? null : JsonSerializer.Deserialize<List<string>>(b.KategorierJson);
            var omraden = b.OmradenJson == null ? null : JsonSerializer.Deserialize<List<string>>(b.OmradenJson);

            var typOk = kategorier == null || typ == null || kategorier.Contains(typ);
            var omradeOk =
                omraden == null ? true :
                lan != null ? SvenskaLan.KommunerILan(lan).Any(omraden.Contains) :
                omrade == null ? true :
                omraden.Contains(omrade);

            if (typOk && omradeOk)
            {
                var typDel = kategorier == null ? "alla typer" : string.Join(", ", kategorier);
                var omradeDel = omraden == null ? "alla områden" : string.Join(", ", omraden);
                return (true, $"Matchar bevakningen: {typDel} · {omradeDel}.", b.Id);
            }
        }

        return (false, $"Matchar ingen av dina {bevakningar.Count} bevakning(ar).", null);
    }
}
