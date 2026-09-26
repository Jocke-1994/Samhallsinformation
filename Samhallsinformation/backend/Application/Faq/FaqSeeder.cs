namespace Samhallsinformation.Application.Faq;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Data;
using Samhallsinformation.Models;

/// <summary>
/// Startvärden för FAQ:n (V3-19, E2#1). Tidigare låg seeden direkt i Program.cs och matchade på
/// frågetexten vid VARJE uppstart, vilket skrev över adminens ändringar (Publicerad/FlagKey/Svar på
/// GDPR-frågorna) och återskapade frågor som admin raderat eller döpt om (=> dubbletter). FAQ:n är
/// levande, redigerbart innehåll (kundtjänstboten synkar mot den), så seeden får aldrig skriva över admin.
///
/// Regler:
///  1. Varje seedad fråga har en stabil seed-nyckel (INTE frågetexten) och en markör
///     <c>faq_seed_&lt;nyckel&gt;</c> i <c>AppliedSeeds</c>. En fråga seedas bara om markören saknas — och
///     markören skrivs i samma SaveChanges som frågan. En fråga som seedats en gång återskapas eller
///     skrivs aldrig över igen, även om admin raderat, avpublicerat eller skrivit om den.
///  2. Engångsuppdateringar av befintliga frågor (GDPR-frågorna) har egna nycklar och körs en gång.
///  3. Produktionsfallet: produktionen har redan kört alla seeds/uppdateringar under den gamla koden och
///     admin kan ha ändrat raderna sedan dess. Saknas baslinjemarkören <c>faq_seed_baseline</c> OCH
///     FAQ-tabellen redan har rader sätts baslinjen och ALLA kända nycklar markeras som gjorda — inga
///     FAQ-rader skrivs. Bara en helt tom FAQ-tabell (ny miljö/lokalt) seedas fullt ut.
///  4. Ett fel får aldrig stoppa uppstarten: allt fångas och loggas (Error).
/// </summary>
public static class FaqSeeder
{
    public const string MarkorPrefix = "faq_seed_";
    public const string BaslinjeMarkor = MarkorPrefix + "baseline";

    // Frågetexter som engångsuppdateringarna letar upp raden på (delas med seed-definitionen så de inte glider isär).
    private const string FragaRaderaKonto = "Hur tar jag bort mitt konto?";
    private const string FragaExporteraData = "Hur laddar jag ner min data?";

    private sealed record SeedFraga(string Nyckel, Func<FaqItem> Skapa);
    private sealed record Engangsuppdatering(string Nyckel, string Fraga, Action<FaqItem> Applicera);

    // Ordningen = den gamla seedens ordning (först de ursprungliga 9, sedan session 43, sedan session 49).
    private static readonly IReadOnlyList<SeedFraga> Fragor =
    [
        // --- Ursprungliga startvärden (tidigare faqStorage.ts i frontend) ---
        new("push_ingen_notis", () => new FaqItem { Kategori = "Konto", Publicerad = false, Fraga = "Varför fick jag ingen push-notis?", Svar = "Kontrollera att push-notiser är aktiverat under Konto → Push-notiser, och att kategorin Ny händelse är påslagen. Se också till att källan finns under Mina källor, och att din webbläsare/enhet tillåter notiser från sidan." }),
        new("push_aktivera", () => new FaqItem { Kategori = "Konto", Publicerad = false, Fraga = "Hur aktiverar jag push-notiser?", Svar = "Gå till Konto → Push-notiser och slå på Ny händelse för att få en notis när dina källor i Mitt flöde publicerar något nytt. Ingen separat \"aktivera push\"-knapp behövs — att slå på kategorin startar prenumerationen automatiskt." }),
        new("push_pausa", () => new FaqItem { Kategori = "Konto", Publicerad = false, Fraga = "Kan jag pausa notiser tillfälligt?", Svar = "Ja, stäng av Ny händelse under Konto → Push-notiser. Webbläsarens push-prenumeration avslutas automatiskt, och startas om nästa gång du slår på den igen." }),
        new("kallor_lagg_till", () => new FaqItem { Kategori = "Mina källor", Publicerad = true, Fraga = "Hur lägger jag till fler källor?", Svar = "Gå till Mina källor i profilmenyn. Där kan du söka efter och lägga till de myndigheter som finns tillgängliga." }),
        new("kallor_flera_myndigheter", () => new FaqItem { Kategori = "Mina källor", Publicerad = true, Fraga = "Kan jag följa flera myndigheter samtidigt?", Svar = "Ja, du kan lägga till hur många källor du vill i Mina källor. Alla visas i ditt nyhetsflöde." }),
        new("konto_ta_bort", () => new FaqItem { Kategori = "Konto", Publicerad = false, Fraga = FragaRaderaKonto, Svar = "Gå till Konto → Datahantering och välj Radera konto. Åtgärden är permanent och kan inte ångras." }),
        new("konto_ladda_ner_data", () => new FaqItem { Kategori = "Konto", Publicerad = false, Fraga = FragaExporteraData, Svar = "Gå till Konto → Datahantering och klicka på Ladda ner. Du får en JSON-fil med all data vi har om dig (GDPR art. 20)." }),
        new("uppdat_senaste_version", () => new FaqItem { Kategori = "Uppdateringar", Publicerad = false, Fraga = "Hur ser jag vad som är nytt i senaste versionen?", Svar = "Gå till Uppdateringar i profilmenyn. Under Senaste version ser du alla ändringar sedan förra uppdateringen." }),
        new("uppdat_rapportera_fel", () => new FaqItem { Kategori = "Uppdateringar", Publicerad = true, Fraga = "Hur rapporterar jag ett fel?", Svar = "Klicka på Feedback-knappen längst ner i sidomenyn och beskriv vad som hänt. Meddelandet skickas till oss, och du kan ange din e-post om du vill ha svar." }),

        // --- Kompletterande frågor inför öppen registrering (session 43) ---
        new("konto_byt_losenord", () => new FaqItem { Kategori = "Konto", Publicerad = true, FlagKey = "konto_losenord", Fraga = "Hur byter jag lösenord?",
            Svar = "Gå till Konto → Lösenordsbyte, ange ditt nuvarande lösenord och sedan det nya. Har du skapat kontot med Google finns inget lösenord att byta — logga in via Google-knappen istället." }),
        new("konto_andra_epost_namn", () => new FaqItem { Kategori = "Konto", Publicerad = true, FlagKey = "konto_info", Fraga = "Hur ändrar jag min e-postadress eller mitt namn?",
            Svar = "Gå till Konto → Kontoinformation. Ändrar du e-postadress skickar vi en bekräftelselänk till den nya adressen — bytet gäller först när du klickat på länken, och du loggas ut ur eventuella andra inloggade enheter av säkerhetsskäl." }),
        new("konto_google_login", () => new FaqItem { Kategori = "Konto", Publicerad = true, FlagKey = null, Fraga = "Kan jag logga in med Google?",
            Svar = "Ja. Välj \"Fortsätt med Google\" på inloggnings- eller registreringssidan — det fungerar både för att skapa ett nytt konto och för att logga in på ett befintligt." }),
        new("konto_epost_bekrafta", () => new FaqItem { Kategori = "Konto", Publicerad = true, FlagKey = "konto_epost_paminnelse", Fraga = "Varför ber ni mig bekräfta min e-postadress?",
            Svar = "En banderoll påminner dig om att klicka på bekräftelselänken vi skickade när du registrerade dig. Det bevisar att adressen faktiskt är din — du kan fortsätta använda tjänsten som vanligt under tiden, inget låses." }),
        new("kallor_alla_vs_mina", () => new FaqItem { Kategori = "Mina källor", Publicerad = true, FlagKey = "kallor_alla", Fraga = "Vad är skillnaden på Alla källor och Mina källor?",
            Svar = "Mina källor visar de myndigheter du redan följer och som syns i ditt flöde. Alla källor är den fullständiga listan att välja bland — där lägger du till fler." }),
        new("uppdat_var_nytt", () => new FaqItem { Kategori = "Uppdateringar", Publicerad = true, FlagKey = null, Fraga = "Var ser jag vad som är nytt i tjänsten?",
            Svar = "Klicka på Nyheter i sidomenyn om du är utloggad, eller Uppdateringar i profilmenyn om du är inloggad, för en lista över de senaste ändringarna." }),
        new("konto_angra_radering", () => new FaqItem { Kategori = "Konto", Publicerad = true, FlagKey = "konto_datahantering", Fraga = "Kan jag ångra en radering av mitt konto?",
            Svar = "Ja, under de första 24 timmarna. Så fort du begär radering skickar vi ett mejl med en \"Avbryt raderingen\"-länk — klicka på den så återaktiveras kontot direkt, ingen inloggning krävs. Efter 24 timmar är kontot anonymiserat och går inte att återställa." }),

        // --- Session 49 ---
        // Skräppost: flera redan live mejlflöden (bekräftelselänk, lösenordsåterställning, ärendesvar via Resend
        // inbound) saknade en förklaring av att mejl kan hamna i skräpposten, särskilt för Hotmail/Outlook
        // (känt domänrykte-problem, inte fixbart med en DNS-post). FlagKey = null: gäller flera oberoende funktioner.
        new("konto_skrappost", () => new FaqItem
        {
            Kategori   = "Konto",
            Publicerad = true,
            FlagKey    = null,
            Fraga      = "Varför hittar jag inte mejlet ni sagt att ni skickat?",
            Svar       = "Kolla din skräppost/spam-mapp — bekräftelselänkar, lösenordsåterställning och svar på supportärenden hamnar ibland där, särskilt om du har en Hotmail- eller Outlook-adress. Hittar du mejlet där, markera avsändaren som säker så hamnar framtida mejl rätt. Är det fortfarande borta efter några minuter, hör av dig via Feedback-knappen i sidomenyn.",
        }),
        // Polisen-bevakning: kallor_polisen_filter är aktiverad i produktion men saknade FAQ-post. FlagKey kopplad
        // till samma flagga så frågan döljs automatiskt om den någonsin stängs av igen.
        new("kallor_polisen_bevakning", () => new FaqItem
        {
            Kategori   = "Mina källor",
            Publicerad = true,
            FlagKey    = "kallor_polisen_filter",
            Fraga      = "Vad är en Polisen-bevakning?",
            Svar       = "En bevakning ger dig träffar på specifika typer av händelser i ett visst område, t.ex. \"trafikolyckor i Göteborg\" eller \"alla händelser i Stenungsund\". Du hittar den under Mina källor, på Polisen-kortet — lägg till upp till 5 oberoende bevakningar samtidigt. Har du ingen bevakning skapad visas och notifieras du om alla Polisens händelser som vanligt.",
        }),
    ];

    // Aktiverar och uppdaterar de två GDPR-frågorna nu när konto_datahantering slogs på (2026-09-11, PR #566):
    // de låg i den ursprungliga seed-datan men avpublicerade eftersom funktionen då var dold. Kopplas till
    // flaggan så de följer den framöver, och raderingssvaret får den nya ångra-länken. ENGÅNGS — körs aldrig
    // om (tidigare skrevs adminens ändringar över vid varje start).
    private static readonly IReadOnlyList<Engangsuppdatering> Uppdateringar =
    [
        new("uppdatera_radera_konto", FragaRaderaKonto, f =>
        {
            f.Publicerad = true;
            f.FlagKey    = "konto_datahantering";
            f.Svar       = "Gå till Konto → Datahantering och välj Radera konto. Kontot spärras direkt, men raderas inte förrän 24 timmar senare — vi skickar ett mejl med en länk du kan klicka för att ångra dig när som helst under de 24 timmarna.";
        }),
        new("uppdatera_exportera_data", FragaExporteraData, f =>
        {
            f.Publicerad = true;
            f.FlagKey    = "konto_datahantering";
        }),
    ];

    /// <summary>Alla kända seed-nycklar (utan prefix) — frågor och engångsuppdateringar. Används av testerna.</summary>
    public static IReadOnlyList<string> AllaNycklar { get; } =
        [.. Fragor.Select(f => f.Nyckel), .. Uppdateringar.Select(u => u.Nyckel)];

    /// <summary>
    /// Kör FAQ-seeden enligt reglerna i klassdokumentationen. Kastar aldrig — ett fel loggas (Error), change
    /// trackern rensas (så en halvfärdig, osparad rad inte följer med till nästa SaveChanges i uppstarten)
    /// och uppstarten fortsätter.
    /// </summary>
    public static async Task SeedAsync(AppDbContext db, ILogger logger)
    {
        try
        {
            await KorAsync(db, logger);
        }
        catch (Exception ex)
        {
            try { db.ChangeTracker.Clear(); } catch { /* bäst-möjligt */ }
            logger.LogError(ex, "FAQ-seeden misslyckades — uppstarten fortsätter, FAQ-innehållet är oförändrat sedan senaste lyckade steg.");
        }
    }

    private static async Task KorAsync(AppDbContext db, ILogger logger)
    {
        var gjorda = (await db.AppliedSeeds.Select(a => a.Key).ToListAsync()).ToHashSet();

        if (!gjorda.Contains(BaslinjeMarkor))
        {
            db.AppliedSeeds.Add(new AppliedSeed { Key = BaslinjeMarkor });
            gjorda.Add(BaslinjeMarkor);

            if (await db.FaqItems.AnyAsync())
            {
                // Produktionsfallet: FAQ-tabellen har rader men inga markörer => allt körts redan under den
                // gamla koden. Markera allt som gjort och rör INGA FAQ-rader (admin kan ha ändrat dem sedan dess).
                foreach (var nyckel in AllaNycklar)
                {
                    db.AppliedSeeds.Add(new AppliedSeed { Key = MarkorPrefix + nyckel });
                }
                await db.SaveChangesAsync();
                logger.LogInformation("FAQ-seed: befintliga FAQ-rader utan markörer — baslinje satt, {Antal} seed-nycklar markerade som redan gjorda, inga FAQ-rader ändrade.", AllaNycklar.Count);
                return;
            }

            // Tom FAQ-tabell (ny miljö). Spara baslinjen FÖRST: kraschar något mitt i seedningen ser nästa start
            // en baslinje och fortsätter med de steg som återstår, i stället för att tro att det är produktion.
            await db.SaveChangesAsync();
        }

        var antalSeedade = 0;
        foreach (var fraga in Fragor)
        {
            var markor = MarkorPrefix + fraga.Nyckel;
            if (gjorda.Contains(markor)) continue;

            db.FaqItems.Add(fraga.Skapa());
            db.AppliedSeeds.Add(new AppliedSeed { Key = markor });
            await db.SaveChangesAsync();   // fråga + markör atomiskt
            gjorda.Add(markor);
            antalSeedade++;
        }

        var antalUppdaterade = 0;
        foreach (var uppd in Uppdateringar)
        {
            var markor = MarkorPrefix + uppd.Nyckel;
            if (gjorda.Contains(markor)) continue;

            var rad = await db.FaqItems.FirstOrDefaultAsync(f => f.Fraga == uppd.Fraga);
            if (rad != null)
            {
                uppd.Applicera(rad);
                rad.UpdatedAt = DateTime.UtcNow;
                antalUppdaterade++;
            }
            db.AppliedSeeds.Add(new AppliedSeed { Key = markor });
            await db.SaveChangesAsync();   // ändring + markör atomiskt
            gjorda.Add(markor);
        }

        if (antalSeedade > 0 || antalUppdaterade > 0)
            logger.LogInformation("FAQ-seed: {Seedade} frågor seedade, {Uppdaterade} engångsuppdateringar körda.", antalSeedade, antalUppdaterade);
    }
}
