# Code review — Enhet 6: Frontend Admin (`components/Admin/`)

- **Granskad commit-SHA:** `a48685a` (main, 2026-09-25)
- **Nivå:** medium (endast läsning, ingen `--fix`)
- **Omfång:** alla 18 filer i `Samhallsinformation/frontend/src/components/Admin/` (8 255 rader): `Anvandare`, `Kallhantering`, `SupportInbox`, `AdminUppdateringar`, `Felsökning`, `Impersonation`, `Aktivitetslogg`, `Handelsesok`, `Oversikt`, `Rapporter`, `Sandlada`, `AdminFaq`, `FeatureFlagsAdmin`, `SiteSettingsAdmin`, `MaintenanceBannerAdmin`, `FunktionsIdePipeline`, `IdeDetaljModal`, `AdminSidebar`.
- **Metod:** varje fil lästes helt (de stora i delar). Misstänkta fynd spårades till de anropade funktionerna i `api/`, `hooks/`, `lib/`, `pages/AdminPage.tsx`, `App.tsx` och till backend-controllerna (`AdminUsersController`, `AdminUserDetailsController`, `SourcesController`, `SiteSettingsController`, `AdminFeatureIdeaController`, `StatsController`, `AdminHealthController`, `TestingController`, `AuthService` m.fl.) innan de skrevs upp. `npx tsc -b --noEmit` kördes: inga typfel. Enhet 1 och 4 lästes så att backend-fynd inte upprepas; frontend-sidan av kända backend-problem är markerad "(jfr enhet-N #x)". CONFIRMED = bevisat i koden (rader citerade). PLAUSIBLE = koden tillåter felet men utfallet beror på data/miljö som inte kunnat ses härifrån.
- **Inte gjort/kunde inte verifiera:** ingen dev-server, ingen webbläsare, inget körd mot produktion eller Postgres. Jag vet inte om det finns riktiga `Support`-konton, eller om produktionsdatabasen innehåller `UppdateringsPunkt.Typ`-värden utanför de fem kända. Renderingsbeteenden (t.ex. touch/hover) är härledda ur klasserna, inte testade på enhet. `AdminPage.tsx`, `App.tsx`, `hooks/useFeatureFlags.ts` och `api/*` ligger utanför omfånget men lästes för att förstå anropen; fynd där är bara rapporterade när de är orsaken till ett fel i en Admin-komponent.
- **Status:** ej fixade. Fixar = en PR per funktion (se PLAN.md).

## Sammanfattning

Ingen renderingskrasch i normalflödet och inga typfel. Det värsta är i **Användare**: massåtgärderna kan stänga av samtliga admin-konton (inklusive ditt eget) utan spärr, och en massradering kan halvvägs slå igenom med en felruta som säger att inget hände. Den djuplänkade användaren i `AdminPage` rensas aldrig, så detaljpanelen hoppar tillbaka till en gammal användare mitt under en åtgärd. Två destruktiva globala åtgärder saknar bekräftelse (**Ta bort källa**, **Återställ flaggor**). **Impersonation** är en ren mock som påstår sig logga sessioner och visa användarens vy. Mönstret som går igen över hela panelen är att mutationer saknar `onError`, formulär stänger före svar, och misslyckade hämtningar visas som "0", "100 % frisk" eller "Inga poster" i stället för fel. Support-rollen får 403 på användarlistan (frontend-sidan av enhet-4 #7 och en ny del i enhet-1-vägen).

## Fynd (rangordnade, mest allvarligt först)

### 1. Massavstängning kan stänga av alla admin-konton, inklusive ditt eget — CONFIRMED, hög

- `Anvandare.tsx:523-525` (`toggleAllaMarkerade` markerar ALLA `filtrerade`, även egna raden och andra admins), `:790-795` (`stängAv`), `:919-922` (bulkknapparna); backend `AdminUsersController.cs:76-96` (`SetStatus`, ingen kontroll av `id == CurrentUserId`, ingen adminspärr; jfr enhet-1 #7).
- **Fel:** listans rubrikcheckbox markerar varje rad, och "Stäng av" skickar `setAdminUserStatus(id, false, …)` för alla. Varken frontend eller backend stoppar självspärr eller spärr av sista admin. `Delete` (`:107`) har en självspärr, `SetStatus` har ingen.
- **Scenario:** admin filtrerar "Alla", kryssar rubrikcheckboxen, klickar Stäng av, skriver en anledning och bekräftar. Alla konton (inklusive admin) har `IsActive=false`. Access-token gäller i högst 15 min, sedan blockerar `AuthService.cs:85/131/147` login/refresh. Ingen kan aktivera kontot igen i UI:t. Admin-seeden (`Program.cs:1500`) skapar bara konto om e-posten saknas, så återställning kräver DB-ändring eller en deploy med ny `ADMIN_EMAIL`. Samma sak går att göra med ett enda konto via "Stäng av konto" i detaljpanelen (`:1420-1424`).
- **Fix:** backend avvisar `SetStatus(IsActive=false)` för `id == CurrentUserId` och för sista aktiva admin; frontend döljer/inaktiverar checkboxen och åtgärdsknapparna för egen rad (behöver ett `userId`-claim från `AuthContext`, som idag bara exponerar e-post/namn) och undantar `Admin`-rollen från bulkåtgärder.

### 2. Massradering/-avstängning med `Promise.all` ger halvt utfört resultat och ett felmeddelande som säger att inget hände — CONFIRMED, medel-hög

- `Anvandare.tsx:797-809` (`raderaMarkerade`), `:790-795` (`stängAv`, ingen try/catch alls).
- **Fel:** `await Promise.all(markerade.map(deleteAdminUser))` avvisas vid första felet, men övriga anrop är redan skickade och fullföljs. `await refetch()`, `setVald(null)`, `setMarkerade(new Set())` och `setModal(null)` hoppas över. Listan är inaktuell och de lyckade raderingarna är osynliga. För `stängAv` finns inte ens ett felmeddelande.
- **Scenario:** admin markerar 5 konton inklusive sitt eget och klickar Radera. Backend svarar 400 "Du kan inte radera ditt eget konto" för egen rad, men de 4 andra är nu schemalagda för anonymisering (`AdminUsersController.cs:107-136`) och användarna har fått mejlet "ditt konto raderas" (`SendAccountDeletionScheduledAsync`). Modalen visar bara felet från den avvisade. Ett omförsök ger "Radering är redan schemalagd" på resten. En rad som redan är `Raderat` (anonymiserad) i markeringen ger 400 varje gång ("Kontot är redan raderat"), så massradering med "markera alla" kan aldrig lyckas rent.
- **Fix:** `Promise.allSettled`, sammanställ lyckade och misslyckade per konto, `refetch()` alltid, filtrera bort `Raderat`/`Raderas snart`/egen rad ur markeringen redan i `toggleAllaMarkerade`, och visa en resultatlista. Bekräftelsedialogen (`RaderaModal`) bör lista vilka konton som berörs.

### 3. Djuplänk-state rensas aldrig: detaljpanelen hoppar tillbaka till en gammal användare och Support-inbox öppnar ett gammalt ärende vid varje besök — CONFIRMED, medel-hög (fel mål för en åtgärd)

- `Anvandare.tsx:685-692` (effect med deps `[defaultÖppnaEpost, defaultFlik, användare]`), `SupportInbox.tsx:586` (`useState(defaultOpenId ?? null)`); orsaken ligger i `pages/AdminPage.tsx:115-116` (state) och `:164,172,384,395` (sätts, återställs aldrig; `key={öppnaAnvEpost}`/`key={inboxOpenId}` på `:376,388`).
- **Fel:** när en admin en gång följt en djuplänk (Händelsesök "Sparad till Anna", notisklockan, "Notifieringsinställningar →" i ett ärende, "Öppna ärende") ligger `öppnaAnvEpost`/`inboxOpenId` kvar i `AdminPage` under hela sessionen. Effekten i `Anvandare` körs om varje gång `användare` får ny referens (varje ändrad `adminUsers`-data efter `refetch()`, dvs. efter varje status-/raderingsåtgärd, ny registrering eller fönsterfokus-refetch med ändrad data) och gör då `setVald(u)` på den gamla e-posten och `setDetaljFlik(defaultFlik ?? 'notifinstallningar')`. `SupportInbox` initieras med det gamla ärende-id:t varje gång sektionen monteras.
- **Scenario A (fel mål):** admin öppnade Anna via Händelsesök tidigare. Senare öppnar admin Bertil ur listan, klickar "Stäng av konto" och bekräftar. `stängAvEnkild` → `refetch()` → `användare` ändras → effekten byter panelen till Anna (och flik). Admin tittar på panelen som påstår "Aktiv" och kan trycka Radera/Stäng av på fel person.
- **Scenario B:** admin klickar Support-inbox i sidomenyn och får ärendemodalen för ett ärende från en timme sedan uppslaget. `GET ticket` sätter `LastViewedAt` (enhet-4 lägre observation), så ett nytt medborgarsvar på det ärendet markeras läst utan att agenten valt att öppna det.
- **Fix:** nollställ `öppnaAnvEpost`/`inboxOpenId` när panelen stängs eller efter första konsumtionen (callback `onDjuplänkKonsumerad` eller `useRef`-flagga), och kör effekten bara vid ändrad `defaultÖppnaEpost` (inte vid varje `användare`-ändring).

### 4. "Ta bort" källa har ingen bekräftelse och sitter bakom hover — CONFIRMED, medel-hög

- `Kallhantering.tsx:338-341` (`taBort` anropar `deleteMutation.mutate(id)` direkt), `:577-582` (knappen, `opacity-0 group-hover:opacity-100`), `:258-261` (ingen `onError`).
- **Fel:** ett klick raderar källan. Backend (`SourcesController.cs:154-168`) tar bort `Sources`-raden och därmed via `Cascade` allas prenumerationer (`UserSourcePreference`) på källan, men lämnar kvar alla `Events` som föräldralösa (enhet-4 #12). En seedad källa kommer tillbaka vid nästa start med nytt id och utan användarnas prenumerationer. Knappen är osynlig men klickbar; på touch (adminpanelen används på mobil enligt session 29) räcker en tryckning på fel ställe i radens högerkant.
- **Scenario:** admin trycker på "Redigera" eller raden på telefon, träffar "Ta bort" bredvid. Polisen tas bort: alla användares Polisen-val försvinner, händelserna ligger kvar osynliga, ingenting varnar och ingenting går att ångra (en dedikerad källa återskapas dessutom automatiskt med `IsPublished=true`).
- **Fix:** bekräftelsedialog som visar antal händelser och att prenumerationer raderas (samma mönster som `TaBortModal` i FAQ/Uppdateringar), gör knapparna synliga permanent på touch, och överväg att bara tillåta `IsActive=false`/`IsPublished=false` för dedikerade källor (enhet-4 #12).

### 5. "Återställ standardvärden" i Feature flags saknar bekräftelse och slår globalt — CONFIRMED, medel-hög

- `FeatureFlagsAdmin.tsx:49-54`, `hooks/useFeatureFlags.ts:37-40,47-50` (`resetMutation`), backend `FeatureFlagsController.ResetOverrides` (enhet-4: tar även bort alla `RedoAttLanseras`-markeringar).
- **Fel:** en knapp direkt i sidhuvudet raderar samtliga flagg-overrides i databasen. Flaggorna är globala (session 34), så varje funktion som slagits på via override (t.ex. `kallor_polisen_filter`) stängs av för alla besökare i samma ögonblick, och tvärtom för flaggor med `defaultAktiv: true` som admin stängt av. Ingen dialog, ingen sammanfattning av vad som ändras, ingen `onError`.
- **Scenario:** admin klickar "Återställ standardvärden" i tron att det bara nollställer den egna vyn (texten på knappen är oförändrad sedan localStorage-tiden) → alla live-överridade funktioner försvinner för besökarna och alla "redo att lanseras"-markeringar rensas.
- **Fix:** bekräftelsedialog som listar de flaggor vars värde faktiskt ändras (`overrides` jämfört med `defaultAktiv`), byt knapptext till att säga "för alla besökare".

### 6. Impersonation är en mock som påstår att den loggar sessioner och visar användarens vy — CONFIRMED, medel-hög (känd mock, men presenterad som funktion)

- `Impersonation.tsx:36-47` (hårdkodade 10 användare med påhittade telefonnummer), `:49-55` (`MOCK_SESSIONER`), `:139-143` och `:230-233` (löften i texten), `:208-213` (`startaSession` öppnar bara `/?impersonating=<id>&namn=<namn>` och skriver `console.info`); `Anvandare.tsx:419-471,881-890,1048` ("Logga in som" på riktiga användare med samma löften); `App.tsx:101-121` (bannern).
- **Fel:** sidan är synlig i admin-sidomenyn (🎭) utan MOCK-märkning, till skillnad från Källhanterings mock-sektioner. Texten säger "Sessionen loggas i aktivitetsloggen", "Användaren märker ingenting" och "Öppnar användarens vy", och en "Sessionshistorik" med fem påhittade rader ser ut som ett riktigt audit-spår. Inget av det finns: ingen token för annan användare, ingen loggrad (`createActivityLogEntry` anropas inte), ingen backend (jfr enhet-1). Den nya fliken är admins EGEN session med en gul banner som påstår "Du är inloggad som Erik Lindqvist — adminläge". Bannern triggas dessutom av vilken URL som helst med `?impersonating=1&namn=Valfri text` (spoofbar UI-text för vem som helst, `App.tsx:104`).
- **Scenario:** en supportagent klickar "Logga in som" på ett riktigt ärende, ser en tom "Mitt flöde" (sitt eget konto) och drar slutsatsen att användaren inte har några källor. Ingen aktivitetsloggrad finns för att stödja en senare granskning.
- **Fix:** tills funktionen byggs på riktigt: dölj sidan och "Logga in som"-knappen (eller märk dem tydligt MOCK och ta bort löftena), ta bort `MOCK_SESSIONER`. När den byggs: se enhet-1 (tidsbegränsad token, `act`-claim, audit-logg).

### 7. Support-rollen ser Användare och Händelsesök, men användarlistan ger 403 — CONFIRMED, medel

- `AdminSidebar.tsx:27,29` och `AdminPage.tsx:62` (Support ser `anvandare`, `handelsesok`), `Anvandare.tsx:487-490` och `Handelsesok.tsx:93-96` (`fetchAdminUsers` → `GET /api/admin/users`), `AdminUsersController.cs:14` (`[Authorize(Roles = "Admin")]`, gäller `GET`, `status`, `delete`, `send-password-reset`, `notifications`, `lookup`); detaljendpoints i `AdminUserDetailsController.cs:19` är däremot `Admin,Support`.
- **Fel:** detaljpanelen (bevakningar, källor, push, sparat, notishistorik) byggdes medvetet för Support, men panelen nås bara via användarlistan (`GET /api/admin/users`, Admin-only). För Support ger listan "Kunde inte hämta användarlistan", djuplänkar från Händelsesök/Support-inbox hittar ingen användare (`användare.find(...)` blir tom), och Händelsesöks "Spara till användare" visar "Inga användare hittades" (felet visas aldrig, `useQuery` saknar felhantering). Dessutom `AdminUsersController.notifications` (`fetchUserNotifications`, `:550-554`) och `AdminSupportController` (`fetchAdminTickets({userId})`, `:556-560`) → tomt/403. Om listan laddades (Admin) visas Radera/Stäng av-knapparna utan rollstyrning i UI:t.
- **Scenario:** Support-agent öppnar Användare → felruta; öppnar Händelsesök → hittar en händelse, försöker spara den åt en användare → tom lista utan förklaring.
- **Fix:** flytta `GET /api/admin/users` (och `lookup`) till en `Admin,Support`-controller med en smalare projektion (utan roll/spärrfält om produkten kräver det), lämna `status/delete/send-password-reset` Admin-only, och dölj destruktiva knappar för `aktivVy === 'Support'`. Samma ändring löser enhet-4 #7 (Support-inbox). Beslutet Support-vs-Admin per funktion bör tas explicit.

### 8. Misslyckade hämtningar visas som tomt, noll eller "100 % frisk" — CONFIRMED, medel

Flera komponenter destrukturerar `data = []`/`?? 0` och saknar `isError`:
- `Oversikt.tsx:37-45,62-66,78-81`: om `GET /api/admin/sources` misslyckas (401/500, DB nere) blir `aktivaKallor.length === 0` och `systemhälsaProcent` sätts till `100` ("Systemhälsa 100 % — 0/0 källor utan fel"). Användare visas som `0 +0`, öppna ärenden som `0`.
- `Aktivitetslogg.tsx:148-157,316-327`: bara `isLoading` hanteras. Tidsfiltren "Idag/7 dagar/30 dagar" skickar `från=YYYY-MM-DD` och ger 500 mot Postgres (enhet-4 #2). Efter tre retries blir `data` undefined och sidan visar "Inga poster matchar filtret" (plus de fyra mockade Notis-raderna om datum matchar). Felet ser ut som att ingen aktivitet finns.
- `SupportInbox.tsx:595-599,761`: `GET tickets` ger 403 för Support (enhet-4 #7) eller 500 → "Inga ärenden matchar filtret", stat-korten står på 0. Ärendemodalen (`:107-111,158`) returnerar `null` när `data` saknas: ett klick på en rad ger ingen modal och inget felmeddelande.
- `Felsökning.tsx:276-281,44-74,341-342`: om `/api/admin/health` misslyckas (vilket enhet-4 säger sker just när DB är nere) är `health` undefined och `isFetching` false, så alla fyra tjänster visas som pulserande "Kontrollerar..." och toppbadgen blir "Varningar finns". Det finns aldrig en röd/felstatus.
- `Rapporter.tsx:93-116` (`stats`/`felSummary` saknas → 0), `IdeDetaljModal.tsx:29,57` och `FunktionsIdePipeline.tsx:52` (`return null` respektive tom lista utan felmeddelande).
- **Scenario:** Railway-DB är nere en kväll. Admin öppnar Översikt och ser "Systemhälsa 100 %" och 0 användare/ärenden, öppnar Felsökning och ser "Varningar finns".
- **Fix:** en delad `useQuery`-wrapper/`<QueryState>` som visar felbanner + "Försök igen" vid `isError`, och undvik `= []`-default där en tom lista och ett fel behöver skiljas åt. Översikts hälsoprocent ska bli "okänd" när källistan inte laddats.

### 9. Uppdateringar-listan kraschar (vit skärm) vid okänd punkt-`Typ` — CONFIRMED (kod), medel

- `AdminUppdateringar.tsx:623-624` (`TYP_PILL_LISTA[typ]` och `TYP_CONFIG[typ].label` för varje punkt i varje uppdatering), `:33-42` (`typSummary`), `api/uppdateringar.ts` (`PunktTyp`), backend `UppdateringarController.cs:165-180` (godtycklig `Typ` sparas; enhet-4 #9). Det finns ingen `ErrorBoundary` någonstans i `src/` (sökt), så ett kastat render-fel river hela appen (React 19 avmonterar roten).
- **Fel:** `TYP_CONFIG['nytt'].label` → `TypeError: Cannot read properties of undefined`. Listan renderar ALLA uppdateringar inklusive utkast, så en enda dålig punkt gör hela admin-sidan (och allt annat i `AdminPage`) oanvändbar tills raden rättas. Det är exakt samma buggklass som redan orsakat en vit skärm (PR #583) och som `Program.cs:1477-1493` kommenterar. Detsamma gäller besökarsidan (enhet-4 #9), så admin kan inte ens rätta det i UI:t (öppna formuläret → `TYP_CONFIG[t]` är ok där, men listan hinner aldrig renderas).
- **Scenario:** en gammal flik/skript eller ett manuellt API-anrop sparar en punkt med `Typ = "nytt"` (eller versalt "Buggfix") → `/admin` → Uppdateringar → vit skärm.
- **Fix:** `TYP_CONFIG[typ] ?? FALLBACK` och `TYP_PILL_LISTA[typ] ?? ...` i listan, en `ErrorBoundary` runt varje admin-sektion i `AdminPage`, och validering i backend (enhet-4 #9).

### 10. Formulär stänger före svaret och tappar inmatningen vid fel; ingen mutation har `onError` — CONFIRMED, medel

- `AdminUppdateringar.tsx:504-511` (`spara` → `mutate` → `stängPanel()`), `AdminFaq.tsx:197-204`, `MaintenanceBannerAdmin.tsx:241-245`, `Kallhantering.tsx:308-316` (`sparaRedigering` → `setRedigerar(null)`), `SupportInbox.tsx:189-193` (`handleSkicka` gör `setText('')` direkt efter `mutate`), `:195-199` (påminnelse), `:207-221` (schema). Ingen av dessa mutationer har `onError`.
- **Fel:** vid 403/500/nätverksfel finns varken felmeddelande eller kvarstående formulär. Ett långt svar till en medborgare eller en uppdateringspost med flera rader är borta. I Support-inboxen tappar en agent som skriver ett svar det tyst (även när backend svarar 200 men mejlet inte gick iväg, enhet-4 lägre obs: ingen `emailSent`-signal).
- **Scenario:** access-token går ut mitt i ett långt svar (`adminFetch` förnyar inte, `api/adminFetch.ts:7-17`; en 401 kommer aldrig som fel i UI:t). Agenten trycker Skicka, rutan töms, inget nytt svar dyker upp i konversationen.
- **Fix:** stäng/töm först i `onSuccess` (använd `mutateAsync` eller `mutate(..., { onSuccess })`), visa `mutation.error` i formuläret, och låt `adminFetch` hantera 401 (enhet 5).

### 11. Notisklockan: två komponenter skriver över varandras lista — CONFIRMED, medel

- `Anvandare.tsx:562-567` (`onPendingNotiser(kontoNotiser…)`), `SupportInbox.tsx:607-610` (`onPendingNotiser(notiser…)`), `pages/AdminPage.tsx:112,128-130` (`setNotiser(items)` ERSÄTTER hela listan).
- **Fel:** klockans innehåll ägs av två olika komponenter som bara körs när de är monterade (queries `['support-notifications']`/`['user-notifications']` bor inuti komponenterna). Landar admin på Översikt (default för Admin, `AdminPage.tsx:108-110`) är `notiser` tom: förfallna påminnelser och "Tilldelad till dig" syns inte förrän Support-inbox öppnats. Öppnas därefter Användare ersätts ärende-notiserna av kontospärrnings-notiser och tvärtom. `lästaNyckar`/`borttagnaNyckar` är i `AdminPage`, så en läst-markering försvinner inte, men listan flippar.
- **Scenario:** ett ärende har en påminnelse som förföll i går. Admin loggar in, ser klockan utan siffra (Översikt) och missar påminnelsen; efter ett besök i Användare försvinner den igen.
- **Fix:** flytta båda queries (`support-notifications`, `user-notifications`) till `AdminPage` (eller en delad hook) och slå ihop listorna där, i stället för att bubbla upp från sektioner.

### 12. Fliken "Notifieringsinställningar" (och "Aktivitet") i Användare visar mock som sanning — CONFIRMED, medel

- `Anvandare.tsx:115-129` (`MOCK_AKTIVITET`), `:142-164` (`MOCK_NOTIF`, nycklar `3`, `6`, `1`), `:1445-1449` och `:1640-1643` (slår upp på `vald.id`, som är ett GUID), `:95` (`senastAktiv: '—'`).
- **Fel:** kommentaren i filen säger att nycklarna aldrig matchar, men för en riktig användare blir uppslaget alltid `undefined`, så fliken skriver "Användaren har inga aktiva notifieringar." även när användaren har aktiva källor, push på och Polisen-bevakningar (som visas på fliken bredvid, `:1122-1174`). Ingen MOCK-märkning i UI:t. En supportagent får ett direkt felaktigt påstående. "Aktivitet" säger "Ingen aktivitet registrerad" på samma sätt; översiktens "Senast aktiv" är `—`.
- **Scenario:** användare skriver "jag får inga notiser", agenten öppnar fliken, läser "har inga aktiva notifieringar" och svarar att användaren själv stängt av dem.
- **Fix:** ersätt med riktig data (`fetchAdminUserSources` + `fetchAdminUserPushSettings` finns redan i panelen) eller ta bort fliken; märk annars fliken MOCK och visa "Ej tillgängligt". Ta bort `MOCK_AKTIVITET`/`MOCK_NOTIF`.

### 13. Felsökning: stora block fabricerad data utan MOCK-märkning, och "Testa" ger vilseledande resultat — CONFIRMED, medel

- `Felsökning.tsx:90-99` (`KOMMANDE`: "19:07 om 1 min"), `:158-164` (`FELLOGGAR`: bl.a. "Oväntad exception i EventsController.GetById — NullReferenceException", "SMS-utskick till +46701234567"), `:218-224` (`HISTORIK`), `:534-536` ("Exportera" utan `onClick`), `:292-295` (`körNu` växlar bara en knapptext i 2 s), `:297-339` (`testaAnslutning`); `TestingController.cs:50-80` (`DryRun` kör alltid `GenericRssIngestor` på en RSS-URL).
- **Fel 1:** sidan har LIVE-badgar på Systemhälsa/Källkontroller, men Kommande kontroller, Kontrollhistorik och Felloggar är konstanter utan märkning (till skillnad från `Rapporter.tsx`/`Kallhantering.tsx`). I ett felsökningsverktyg vilseleder "Backend-API: Fel, NullReferenceException" och en påhittad kontrollhistorik.
- **Fel 2:** "Testa" anropar samma RSS-dryrun för varje källa och animerar sedan steg 2-5 med fasta 250 ms-pauser ("HTTP 200", "N/N mappade korrekt", "Deduplicering klar", "N händelser inlästa"), trots att ett enda anrop gjorts och inget sparas. För API-källorna (Krisinformation `KrisinformationApiIngestor.cs:13`, SMHI, Trafikverket, alla `SourceType.WebAPI`) är URL:en ett JSON-API, så en frisk källa får "Anslutning ✕" (falskt negativt), och "Kör nu" gör ingenting.
- **Scenario:** Krisinformation fungerar, admin klickar Testa och ser rött fel; eller Polisen får fem gröna steg trots att bara anslutning testats.
- **Fix:** märk/dölj de fyra mockade blocken och de döda knapparna, visa bara det dryrun faktiskt mätte (antal poster, HTTP-fel), och blockera "Testa" för källor utan RSS-typ eller anropa källans egen ingestor på servern.

### 14. Redigering av schemalagd åtgärd = avbryt + skapa parallellt, utan validering — CONFIRMED, medel

- `SupportInbox.tsx:172-185` (`handleSparaEdit`: `cancelScheduleMutation.mutate(å.id)` och `addScheduleMutation.mutate(...)` startas samtidigt), `:187-193` för jämförelse.
- **Fel:** två oberoende anrop utan ordning eller gemensam felhantering. Lyckas `cancel` men `add` misslyckas (t.ex. ogiltig `reassignToUserId`, 500) är den ursprungliga åtgärden borta och ingen ersättare finns. Lyckas `add` men `cancel` misslyckas (eller åtgärden hann köras av bakgrundstjänsten inom 60 s) får ärendet dubbla åtgärder. Formuläret validerar bara `editDatum`: en schemalagd "svar"/"intern" kan sparas med tom text och en "tilldela" med tom agent (`editAgent` tomt → tilldelning tas bort). Backend saknar validering (enhet-4 #8).
- **Scenario:** support ändrar tiden på ett schemalagt tilldelningsjobb och råkar lämna agenten tom: originalet avbryts och en åtgärd som avassignar ärendet skapas.
- **Fix:** ny `PUT`-endpoint (eller `mutateAsync` i följd: `add` först, sedan `cancel`, med rollback), och samma valideringsregler som i skapa-formuläret (`:209-210`).

### 15. Sparar redigering av källa skriver över `isPublished` med en gammal kopia — CONFIRMED, medel-låg

- `Kallhantering.tsx:572` (`setRedigerar({ ...k })` tar en kopia av raden), `:308-316` (`sparaRedigering` skickar alltid `isPublished: redigerar.publicerad`), `:303-306` (`togglePublicerad` i tabellraden).
- **Fel:** kopian får inte uppdateringar från tabellen. Skickar man in `name/url/category` skickas även den gamla `isPublished`.
- **Scenario:** admin öppnar Redigera på en sandlådekälla (Opublicerad), byter i tabellen Publicerad-togglen fel eller rätt och sedan Spara i formuläret, eller två admins arbetar samtidigt: formulärets gamla `false`/`true` skriver tillbaka det gamla värdet. Sandlåderegeln ("testas med `IsPublished=false`") kan brytas, eller en avpublicering hävas (ingen aktivitetsloggrad om inget ändrats i backend-diffen).
- **Fix:** skicka bara de fält som faktiskt ändrats i formuläret (`isPublished` bara om formulärtogglen rörts), eller läs om raden vid Spara.

### 16. CSV-exporten i Aktivitetsloggen: ej escapad, formelinjektion och mockrader — CONFIRMED, medel-låg

- `Aktivitetslogg.tsx:116-127` (`"${r.rubrik}"`, `"${r.detalj}"`, ingen dubbelcitat-escapning eller neutralisering av `= + - @`), `:30-35,165-168,215` (`exporteraCsv(visade)` inkluderar `NOTIS_MOCK`), `Anvandare.tsx:757` och `Handelsesok.tsx:25` (detalj innehåller `"Titel"` med citattecken); `AuthService.cs:58,128` (`detalj = $"{user.Name} — via Lösenord"`, användarens fria namn först i cellen).
- **Fel:** (a) värden med `"` bryter CSV-strukturen (varje "Tog bort sparad händelse"-rad). (b) `Name` sätts vid öppen registrering utan validering (enhet-1 #9). Ett namn som `=HYPERLINK(...)` hamnar först i `detalj`-cellen och tolkas som formel när admin öppnar CSV:n i Excel/Sheets (CSV-injektion, citattecken hindrar inte). (c) De fyra fabricerade Notis-raderna exporteras som en del av "sanningskällan" (`Notis skickad — MSB … 12 mottagare`).
- **Fix:** escapa `"` → `""`, prefixa celler som börjar med `= + - @ \t \r` med `'`, ta bort mockraderna ur exporten (eller hela mocken), och använd `;`-separator konsekvent.

### 17. "Skicka 'Ny version'-notis" skickar riktig push utan bekräftelse — CONFIRMED, medel-låg

- `AdminUppdateringar.tsx:49-72,100-106`, `api/push.ts sendNewVersionNotice`.
- **Fel:** ett enda klick skickar en push till alla som slagit på "Ny version" och kan inte återkallas. Ingen sammanfattning av text/mottagare före utskick och ingen dubblettkontroll (fälten töms efter, men samma text kan skickas igen).
- **Scenario:** admin testar formuläret med "test"/"0.0.0" och trycker Skicka nu; riktiga användare får en push.
- **Fix:** bekräftelsedialog med förhandsvisning och antal mottagare (kräver ett dry-run-svar från backend), eller skicka först till admins egna enheter.

### 18. Tömt datum-/tidsfält kastar `RangeError` och gör knappen "död" — CONFIRMED, låg

- `AdminUppdateringar.tsx:218` (`new Date(datum).toISOString()`; `kanSpara` kontrollerar inte `datum`), `SupportInbox.tsx:68-70,197,213` (`combineDateTimeToIso(datum, '')` när tidsfältet tömts).
- **Fel:** `type="date"`/`type="time"` går att tömma; `new Date('')` är Invalid Date och `toISOString()` kastar i klickhanteraren. Inget felmeddelande, inget händer.
- **Fix:** validera `datum`/tid innan (`Number.isNaN(d.getTime())`), och inkludera det i `kanSpara`.

### 19. "Ångra" i Aktivitetsloggen: ingen felhantering, dubbelklick och halvt resultat — CONFIRMED, låg

- `Aktivitetslogg.tsx:186-197`, `:374-386`.
- **Fel:** `saveAdminUserEvent`/`unsaveAdminUserEvent` (den riktiga ändringen) följs av ett separat `undoMutation` som markerar raden ångrad. Ingen try/catch: om det första lyckas men det andra misslyckas (eller nätverket bryts) är händelsen återställd men raden inte markerad, och ett nytt "Ångra" ger ett nytt (nu felaktigt) anrop. "Bekräfta ångra?"-knappen har ingen pending-spärr, så dubbelklick skickar två `save`-anrop (två parallella `POST` mot ett unikt index ger 500 på det andra, enhet-4 lägre obs). Ångra mot en användare som hunnit anonymiseras kan ge FK-fel utan meddelande.
- **Fix:** sätt "ångrad" i backend i samma anrop som ändringen (enhet-4 lägre obs: `MarkUndone` görs klientsidigt), disable under pågående anrop, visa fel.

### 20. Massfunktionen "Spara till användare" saknar catch (Handelsesök) — CONFIRMED, låg

- `Handelsesok.tsx:16-39`.
- **Fel:** `try { await Promise.all(...) } finally { setSparar(false) }` utan `catch`. Misslyckas en händelse avvisas hela `Promise.all`, de övriga sparas och loggas ändå, och `setÖppen(false)`/`onKlar()` (`refetchSparade`) körs aldrig. Ingen indikation på vilka som sparades. Varje händelse skapar sin egen aktivitetsloggrad.
- **Fix:** `allSettled` + resultatsammanfattning ("4 av 5 sparade"), kör `onKlar()` alltid.

### 21. `SiteSettingsAdmin`: vid laddfel visas "på" och ett klick skickar inversen; globalt utan bekräftelse — CONFIRMED (kod), låg

- `SiteSettingsAdmin.tsx:17-18,45-46,64-65`.
- **Fel:** `data?.showLoginButton ?? true`. Om `GET /api/settings/site` misslyckas visas båda knapparna som PÅ (och en röd banner), men reglagen är aktiva (`disabled={isLoading || …}` täcker bara laddning) och ett klick skickar `false` utifrån gissningen. Ändringen slår direkt igenom för alla besökare utan bekräftelse, och `updateMutation` saknar `onError`.
- **Fix:** inaktivera reglagen när `isError`, och en bekräftelse för avstängning av Logga in-knappen (en av launch-flaggorna).

### 22. Triage-motivering går inte att tömma, och flagg-nyckeln är fri text — CONFIRMED, låg

- `IdeDetaljModal.tsx:75-77` (`motivering.trim() || idea.triageMotivering || null`), `:147-151` och `:71` (`flagKey` som fri textinmatning), jämför `AdminFaq.tsx:122-131` (valbar lista ur `FLAG_DEFINITIONER`).
- **Fel:** ett tomt textfält faller tillbaka på det gamla värdet, så motiveringen kan inte raderas. En felstavad `flagKey` skapar (vid stadiet lanseringsklar) en override-rad med `RedoAttLanseras=true` för en flagga som inte finns (`AdminFeatureIdeaController.cs:170-176`), som sedan dyker upp som valbar i Uppdateringars schemaläggning (`AdminUppdateringar.tsx:185`).
- **Fix:** skilj tom sträng från "inget värde" (`null` bara om fältet aldrig rörts), och byt `flagKey` till en `<select>` av `FLAG_DEFINITIONER`.

## Under rangordningsgränsen (mindre observationer, sparade så de inte förloras)

**Layout / mobil (adminpanelen används på telefon, session 29)**
- `AdminFaq.tsx:64` (`w-[520px]`) och `AdminUppdateringar.tsx:229` (`w-[560px]`) är fasta sidopaneler utan `w-full md:`-brytpunkt; på 384 px-skärm hamnar vänstra delen av formuläret utanför skärmen (samma fel som fixades för `Anvandare` i PR #450). `AdminFaq.tsx:239` `grid grid-cols-6` utan brytpunkt.
- `Kallhantering.tsx:526-528` returnerar `<>…</>` med `key` bara på inre `<tr>`; fragmentet saknar `key` (React-varning, sämre omritning). `Kallhantering.tsx:563-582` "Synka om/Redigera/Ta bort" är hover-only, vilket gör dem svåra att hitta på touch (utöver fynd 4).

**Datum/tid**
- `Aktivitetslogg.tsx:99-113` (`postTillRad`): `tid` är lokal tid men `datum` är `toISOString().slice(0,10)` (UTC-datum); rader mellan 00:00 och 02:00 svensk sommartid får fel datum (även i CSV) och sorteringen (`datum + tid`, `:170-173`) blandar UTC-datum med lokal tid. `datumGräns('Idag')` (`:80`) har samma UTC-datum (enhet-4 #2 nämner detsamma).
- `Rapporter.tsx:129-134` visar "Denna vecka" och en 7-dagars stapel som **exkluderar idag**: `StatsController.cs:24,64` bygger `Range(0,7)` från `now.AddDays(-7).Date`, dvs. dagarna −7…−1. Ingestor-loggen (`AdminIngestorLogController.cs:26-28`) har rättat samma sak med `-(days - 1)`. Backend-fix i en rad.
- `MaintenanceBannerAdmin.tsx:79-82`: UTC-omvandlaren bygger `${value}:00Z` av `datetime-local`; ett värde som redan innehåller sekunder ger ogiltigt datum. Tider tolkas i webbläsarens lokala zon (medvetet "admin jobbar från Sverige").
- `AdminUppdateringar.tsx:213-224`: en schemalagd publicering kan sparas med tid i det förflutna (bakgrundstjänsten publicerar och aktiverar flaggor inom ~60 s); ingen varning. Vald flagga som inte längre är `redoAttLanseras && !value` försvinner ur listan men ligger kvar i `valdaFlaggor` och kan inte avmarkeras (`:185,190`).

**Övriga korrekthets-/robusthetsobservationer**
- `Anvandare.tsx:1145` (Ta bort Polisen-bevakning) och `:1356-1361` (Ta bort sparad händelse) utan bekräftelse; bevakningsraderingen loggas bara i `UserSettingAuditLog` och kan inte ångras, sparat-raderingen kan ångras via loggen. `:648-671` (`sokForklaraHandelse`/`valjForklaraHandelse`) saknar catch och ett sent svar kan visas för en annan vald användare.
- `Anvandare.tsx:503,768-781,873-877,919-920,1395-1398`: `RollModal`, `applicerapRoller`, `applicerapRollerEnkild` och `enkildRollÄndring` är död kod (knapparna är `disabled`, ändringar bara lokala); ta bort så att ingen kopplar in dem mot lokalt state.
- `Anvandare.tsx:491,536-548`: `användare` är en lokal kopia av react-query-data via effekt (två sanningskällor); `applicerapRoller` mutera den lokalt, och kopian ersätts vid nästa refetch. Fungerar idag, men är en fälla när fler lokala mutationer läggs till.
- `Anvandare.tsx:1625`, `SupportInbox.tsx:350,747`: `STATUS_CLS[status as …]` för okänd status blir `undefined` i `className` (ingen krasch; backend tar godtycklig status, enhet-4 lägre obs). `SupportInbox.tsx:475` visar "→ null" när `reassignToName` saknas.
- `SupportInbox.tsx:126-135`: "Skapa idé av det här ärendet" kan tryckas flera gånger (state per modal, ingen dubblettkontroll mot `sourceTicketId`, backend `AdminFeatureIdeaController.cs:70`).
- `Handelsesok.tsx:132-145,360,368`: sidbyte (`sök(page±1)`) läser de ANDRA, ej inskickade, formulärfälten, så en ändrad plats/sökord + "Nästa" ger sida 2 av en annan fråga än den som visades.
- `Felsökning.tsx:281`: `isFetching` (även bakgrundsrefetch var 60 s) sätter alla rader till "Kontrollerar..." (flimmer). `toKällKontroll` (`:232-256`) visar en avsiktligt inaktiv källa som "Nere/Kritisk".
- `Kallhantering.tsx:318-336`: `aktiveraKälla` skapar alltid `type: 0` (RSS), även för kuraterade API-poster (SMHI); de är dolda så länge dedikerade källor finns (namnmatch), men efter `DeleteSource` av den dedikerade källan skapas en RSS-källa mot ett JSON-API. `Kallhantering.tsx:284-290` (`INITIAL_ÄNDRINGAR`/`INITIAL_FLÖDEN` med `källId` 1–7 som inte behöver finnas) är märkta MOCK.
- `AdminFaq.tsx:197-204`: en ny fråga skapas alltid `publicerad: true` (kundtjänstboten synkas mot FAQ) — utan utkastläge i formuläret.
- `App.tsx:104` (utanför omfånget): `ImpersonationBanner` visas för vem som helst med `?impersonating=1&namn=…` (se fynd 6). `api/adminFetch.ts:7-17` (enhet 5): ingen 401-hantering/refresh, vilket förstärker fynd 10.
- Kända backend-problem som syns i Admin-UI:t och redan rapporterats: `AdminSupportController` Admin-only (enhet-4 #7, se fynd 7-8), tidsfilter 500 (enhet-4 #2, se fynd 8), `IsActive` verkningslös för dedikerade ingestorer (enhet-4 #4; `Felsökning.tsx:288-290` och `Kallhantering.tsx:298-301` visar en "Aktiv"-toggle som inte stoppar hämtning), "avpublicera" stoppar inte push (enhet-4 #4), `Reply` returnerar 200 vid mejlfel (enhet-4 lägre obs, se fynd 10).

## Rekommenderad fix-ordning (en PR per funktion)

1. Användare: skydd för massåtgärder (fynd 1 + 2), backend + frontend i samma release (spärr av självspärr/sista admin).
2. Djuplänk-state (fynd 3), liten frontend-PR i `AdminPage`/`Anvandare`/`SupportInbox`.
3. Bekräftelser för Ta bort källa och Återställ flaggor (fynd 4 + 5), två små PR:ar.
4. Impersonation: ta bort/märk mocken (fynd 6) och mockflikarna i Användare (fynd 12) samt Felsökning (fynd 13).
5. Support-rollens åtkomst i Användare/Händelsesök (fynd 7) tillsammans med enhet-4 #7.
6. Delad felhantering (`QueryState`, `onError`, formulär stänger efter svar) (fynd 8 + 10) och `ErrorBoundary` + `Typ`-fallback (fynd 9).
7. Notisklockan (fynd 11), schemalagda åtgärder (fynd 14), källredigering (fynd 15).
8. CSV-export (fynd 16), Ny version-bekräftelse (fynd 17), övriga lägre.
