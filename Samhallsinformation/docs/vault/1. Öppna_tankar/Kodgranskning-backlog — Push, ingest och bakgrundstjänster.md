---
typ: rå-tanke
källa: "V4-5, uppföljning av enhet-3 'under rangordningsgränsen', 2026-09-27"
---

# Kodgranskning-backlog — Push, ingest och bakgrundstjänster

Rå tanke, del av V4-5 (se syskonfilen "Auth, sessioner och inloggning" för
bakgrund om varför den här filen finns). Allt nedan verifierat mot
NUVARANDE kod 2026-09-27 — det som redan var åtgärdat är inte med.

## ✅ Löst (2026-10-01): Polisen-bevakningar matchade fel för "Polisen Efterlysningar"

**`PushDispatcher.DispatchNewEventsAsync` grenade på
`source.ShortName == "Polisen"`** för att slå på per-användare
Polisen-bevaknings-filtrering. "Polisen Efterlysningar" (seedad i
`Program.cs`) delar MEDVETET samma `ShortName` ("Polisen") för att grupperas
under samma sidomeny-knapp — men har `EventType = null` och
`Geography = null`. `PolisenBevakningMatcher.Matches` tolkade `null` som
"matchar allt", så vilken bevakning som helst matchade en Efterlysning, och
pushtexten blev missvisande (påstod att den matchat en specifik bevakning
trots att bevakningen inte filtrerat bort något alls).

**Fix:** [PR #666](https://github.com/Jocke-1994/Samhallsinformation/pull/666)
— gatear nu på `source.Id` (= `PolisenRssIngestor.Source.Id`, fast och
kollisionsskyddat) istället för `ShortName`. Nytt regressionstest. Mergad
2026-10-01.

**Sidofynd som löstes i samma veva:** Polisen/Polisen Efterlysningar (och
SMHI/SMHI Nyheter, samma mönster) visades som två separata rader i Aktiva
källor/Alla källor trots att de är en enhet. [PR #667](https://github.com/Jocke-1994/Samhallsinformation/pull/667)
— slog ihop dem till en rad (generisk ShortName-gruppering, samma princip
Sidebar redan använder), backend expanderar nu till-/bortval till hela
gruppen, och en idempotent backfill aktiverade Efterlysningar/SMHI Nyheter
åt användare som redan hade huvudkällan aktiv. Mergad 2026-10-01.

*(enhet-3, "Push/matchning")*

## Ingest-robusthet

- `GenericRssIngestor`: `DtdProcessing.Parse` fortfarande utan
  `MaxCharactersFromEntities` (entitets-expansion/XXE-liknande DoS-yta) och
  fortfarande obegränsad svarsstorlek (`ReadAsStreamAsync` utan cap). Källor
  läggs bara till av admin (låg risk idag), men värt att härda om fler
  källtyper öppnas upp bredare.
- `GenericRssIngestor` hämtar fortfarande godtycklig `Source.Url` (admin-
  satt) server-side med redirects, ingen spärr mot privata IP-intervall —
  samma SSRF-karaktär som `TestingController.DryRun` (se nedan). En
  komprometterad admin-session (eller ett misstag vid källinmatning) kan
  användas för att nå intern infrastruktur/metadata-endpoints.
- `GenericRssIngestor` sparar fortfarande `Content` med eventuell rå HTML
  (ingen `StripHtml`, till skillnad från Krisinformation-ingestorn), och
  `PublishedAt` faller fortfarande tillbaka på `DateTime.UtcNow` när
  `pubDate` saknas — vid en admin-resync (`overwriteExisting: true`) skrivs
  `PublishedAt` om till "nu" för ALLA befintliga poster från källan.
- `TestingController.DryRun` (Admin-only) — fortfarande ingen spärr mot
  privata IP-intervall/metadata-adresser och ingen egen timeout. Samma
  SSRF-karaktär som ovan, men admin-only så lägre prioritet.
- `TrafikverketApiIngestor`: saknad `TRAFIKVERKET_API_KEY` returnerar
  fortfarande en tom lista som `IngestorBackgroundService` tolkar som en
  LYCKAD körning (`LastFetchedAt` uppdateras, `LastFetchError = null`) —
  källan ser frisk ut i admin trots att inget hämtas, bara en varningsrad i
  loggen som ingen läser rutinmässigt.
- Alla `FetchEventsAsync()`-implementationer saknar fortfarande
  `CancellationToken` — ingen egen timeout utöver HttpClient-standarden
  (100 s), körs sekventiellt. En hängande källa fördröjer hela cykeln och
  en deploy-nedstängning.
- `SmhiApiIngestor`/`ResendEmailService`: statisk
  `TimeZoneInfo.FindSystemTimeZoneById("Europe/Stockholm")`-uppslagning
  fortfarande oskyddad. Fungerar idag (Debian-baserad container-image), men
  skulle fälla HELA ingestor-cykeln (alla källor, inte bara SMHI) om
  plattformen någon gång byter till en Alpine/chiseled-image utan tzdata.
  Samma anrop i `ResendEmailService` sväljs dessutom tyst av
  fire-and-forget (raderingsmejl skulle utebli utan spår).
- `SmhiApiIngestor`/`KrisinformationApiIngestor`: JSON läses fortfarande
  utan content-type-koll (till skillnad från `GenericRssIngestor`, som redan
  har det) — ett HTML-felsvar med 200 ger ett obegripligt `JsonException`
  i stället för ett beskrivande fel med URL+Content-Type.
- `PolisenRssIngestor`: saknar fortfarande samma `default`-datumkontroll
  som Generic-ingestorn (en saknad `pubDate` ger år 0001), och skickar
  fortfarande ingen User-Agent-header.

*(enhet-3, "Ingestors")*

## Push, övrigt

- `PolisenBevakningMatcher.Matches` (den faktiska push-vägen) saknar
  fortfarande länsmedvetenheten som `Explain` (admin-förklaringen) och
  frontend redan har — ofarligt idag (sammanfattningar med läns-geografi
  pushas aldrig), men de två reglerna kan glida isär över tid.
- Push-body byggs fortfarande av `ticket.Subject`/`newUser.Name` utan
  längdgräns — WebPush avvisar payloads över ~4 kB, och ett sådant utskick
  loggas bara tyst som `failed` (admin-notisen uteblir utan att någon märker
  det).
- `usePushSubscription.ts` (frontend): `navigator.serviceWorker.ready`
  löser fortfarande aldrig upp sig om service worker-registreringen
  misslyckas (ingen `.catch`) — push-knapparna hänger i "laddar" permanent.
  En befintlig prenumeration med en annan `applicationServerKey` (efter ett
  VAPID-nyckelbyte) ger fortfarande ett ohanterat `InvalidStateError`.
- `usePushSubscription.ts` `unsubscribe()`: anropar fortfarande
  `subscription.unsubscribe()` FÖRE `unsubscribeDevice(endpoint)` — om
  serveranropet fallerar är webbläsarens prenumeration redan borta men
  servern har kvar raden (pushar mot en död endpoint), och UI:t visar
  fortfarande "aktiv" eftersom `setSubscription(null)` aldrig körs.

*(enhet-3 "Push/matchning", enhet-5 "Push / service worker")*

## Bakgrundstjänster — poison-pill, delvis åtgärdat

- **`SupportScheduledActionService` har fått per-post `try`/`catch` i sin
  loop** (samma mönster som `UserDeletionBackgroundService`) — den delen av
  det ursprungliga "poison-pill"-fyndet är alltså redan löst.
- **`ScheduledReleaseBackgroundService.ExecuteDueAsync` saknar fortfarande
  motsvarande skydd**: `foreach (var uppdatering in due)` har ingen
  `try`/`catch` runt varje post. En trasig post (t.ex. ogiltig
  `SchemalagdaFlaggorJson`, som `FeatureFlagActivation.DeserialiseraFlaggor`
  kastar på) skulle stoppa hela loopen för den cykeln — alla senare
  förfallna schemalagda lanseringar blockeras tills posten rättas manuellt.
- **`AktivitetsloggService.LogAsync` kör fortfarande `SaveChangesAsync()`
  på den DELADE scoped `DbContext`en** — committar därmed anroparens ännu
  icke-sparade ändringar i förtid. Konkret, fortfarande reproducerbart:
  `UppdateringarController.ApplySchemaOchPubliceringAsync` → aktiverar
  flaggor → loggar (`LogAsync`, som committar) → sätter sedan
  `Publicerad`/schemafälten i ett ANDRA steg. Misslyckas det andra steget
  (fel, timeout, en `LogAsync` som kastar efter ett lyckat huvudsteg) ligger
  flaggorna redan aktiva för alla besökare medan releasen fortfarande visas
  som schemalagd/opublicerad i admin. Samma mönster nämns oberoende i både
  enhet-3 och enhet-4 — värt att åtgärda centralt (egen transaktion, eller
  skjut `SaveChangesAsync` till anroparen).

*(enhet-3 "Bakgrundstjänster", enhet-4 "Aktivitetslogg / audit")*

Ursprung: `docs/code-review/enhet-3.md` §"Under rangordningsgränsen",
korsreferenser i `enhet-4.md` §"Aktivitetslogg / audit".
