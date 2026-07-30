# Projektöversikt – Samhällsinformation & Notifieringar

Detta projekt är ett fristående verktyg utvecklat i .NET som samlar samhällsinformation från svenska myndigheter på en gemensam plats. Syftet är att göra offentlig information mer tillgänglig via webb och kontrollerade notifieringar utan att tolka eller ändra källmaterialet.

## Grundprinciper (Låsta beslut)

Dessa principer utgör systemets kärna och bryts aldrig:

* **Ingen opinionsbildning:** Systemet skapar inget eget innehåll.
* **Ingen tolkning:** Information omformuleras aldrig; systemet fungerar som ett förmedlande lager.
* **Källkrav:** Ingen information visas utan en verifierad primär källa.
* **Transparens:** Systemet är tydligt med varför en notifiering skickas eller uteblir.

## Agent-arbetssätt (ClaudePM)

Den här chatten/sessionen är **ClaudePM** som standard — du kodar inte allt
själv rakt av, du håller koll på helheten och avgör vem som gör vad.

**Rostret:**
- `.claude/agents/ClaudeDB.md` — EF Core, migrationer, PostgreSQL/SQLite
- `.claude/agents/ClaudeBE.md` — ASP.NET Core-backend, Controllers, ingestors
- `.claude/agents/ClaudeFE.md` — React/TypeScript/Tailwind-frontend
- `.claude/skills/claude-ex/SKILL.md` — förklaringar (körs i egen terminal av
  användaren, inte något PM delegerar till)
- Review — ingen egen agent. PM triggar `/code-review`-skillen innan
  BE/FE/DB-arbete räknas klart.
- Test — ingen egen agent än. Backend har xUnit-infrastruktur sedan FAS 1
  (`backend.Tests/`, konvention `MethodName_Scenario_ExpectedResult`).
  Frontend har ingen testinfrastruktur alls — måste byggas upp först (t.ex.
  Vitest + React Testing Library) innan ett test-ansvar är meningsfullt.

**Innan en ny uppgift:**
1. Läs det här dokumentet (senaste sessionsloggen) + relevanta GitHub-issues
2. Bryt ner i atomära delar — en atomär del är **inte** bokstavligen "en fil",
   utan den minsta enhet som går att testa/granska oberoende. En
   databasändring utan den backend-endpoint som konsumerar den är sällan
   verifierbar isolerat — då hör de ihop i samma uppgift.
3. Förklara för användaren vad, varför, och vilken agents regelbok som gäller
   innan du börjar

**Hur delegeringen faktiskt går till:** för det mesta gör PM (den här
sessionen) jobbet direkt, men läser och följer rätt agents regelbok
(ClaudeFE.md/ClaudeBE.md/ClaudeDB.md) medan den gör det — att spawna en ny
subagent för varje enskild filändring slösar kontext och pengar i onödan. En
riktig subagent (via Agent-verktyget) används bara för genuint stora,
självständiga bitar där en färsk kontext faktiskt är värt det.

**Progress = det här dokumentet.** När en uppgift kopplad till ett
GitHub-issue är klar och mergad: **stäng issuet och meddela användaren att det
stängdes.** Anta aldrig att "PR mergad" = "issue helt klart" — kolla issuets
egen checklista/acceptanskriterier först. (Hittade 2026-07-25: #295 och #296
stod kvar som öppna trots mergade PR:ar — #295 saknar fortfarande rate
limiting enligt sin egen checklista, så den ska inte stängas förrän det är
löst.)

**Övriga regler:**
- Aldrig påbörja nästa sprint/FAS utan uttryckligt godkännande från användaren
- Vid visuella/UI-ändringar: vänta på godkännande innan nästa uppgift
- Vid oklarhet i vad som ska byggas: fråga användaren, anta aldrig
- Ingen separat spec- eller datamodell-fil — GitHub-issues är spec, koden i
  `Models/` är sanningen för datamodeller. Två parallella dokument som kan
  glida isär från koden är värre än inga alls.

---

## Teknisk Arkitektur

Projektet är byggt med en modern .NET-stack och följer en iterativ sprint-filosofi:

* **Backend:** ASP.NET Core Web API med bakgrundstjänst för datainsamling.
* **Datamodell:** En gemensam intern struktur (`CanonicalEvent`) för att standardisera metadata från olika källor.
* **Databas:** SQLite lokalt (planerad migrering till PostgreSQL vid publicering) via Entity Framework Core.
* **UI/UX:** Modern, "clean" design med stöd för mörkt/ljust tema.

## Informationsomfång & Metadata

Systemet hanterar information baserat på tillgänglig metadata:

* **Obligatorisk metadata:** Källa, publiceringsdatum, titel, innehåll och länk.
* **Valfri metadata:** Geografisk klassning, allvarlighetsgrad och kategori.
* **Fallback:** Om allvarlighetsgrad saknas används "Bra att veta". Om geografi saknas betraktas informationen som nationell.

## Projektstatus & Sprintar

### Sprint 1: Reality Check (Avslutad)

- [x] Definiera gemensam intern modell (`CanonicalEvent`).
- [x] Skapa grundläggande mappstruktur och C#-klasser.
- [x] Verifiera att testdata kan mappas korrekt till modellen.

### Sprint 2: Ingestor (Avslutad)

- [x] Fetch events from Polisen RSS (#4)
- [x] Parse RSS feed into CanonicalEvent (#5)
- [x] Handle missing metadata with fallbacks (#6)
- [x] Support multiple source types (#7)

### Sprint 3: Storage & API (Avslutad)

- [x] Persist events to database (#9)
- [x] Expose events via REST API (#10)
- [x] Deduplicate incoming events (#11)
- [x] Store and manage user notification preferences (#12)

### Sprint 4: Notifications & UI (Backlog)

- [ ] Send notifications based on user preferences (#13)
- [ ] Explain why a notification was sent (#14)
- [ ] View events on a clean web UI (#15)
- [ ] User filters events by geography (#16)

## Session Log

### Session 25 — 2026-07-29 / 2026-07-30
**What was done:**
- **Händelsesök/Aktivitetslogg-polish** (PR:ar #383–#385, mergade): Idag-filter-bugg fixad (jämförde mot ett hårdkodat datum istället för `new Date()`), sökord-fritextsök, "markera alla på sidan", klickbar "Sparad till X"-badge med navigering till Användarhantering, CSV fick en "Vem"-kolumn, två-stegs bekräftelse innan Ångra. Checkbox flyttad in i händelsekortet (låg utanför, användarrapporterad bugg)
- **Mina källor kopplat mot riktig backend** (PR #386): `GET/PUT /api/user/sources` (funnits sedan session 18, aldrig anropad) kopplad via ny `api/userSources.ts`. Nationell/Regional/Kommunal-gruppering plattades ut (backend har bara 8 riktiga källor, alla nationella idag). SPAR-adressförslag, "Nya"-fliken och "Planerat underhåll"-varningen togs bort — samtliga mockdata-bara, ingen motsvarighet i backend. Fullständig spec över de tre borttagna funktionerna sparad i `docs/MINA_KALLOR_BORTTAGNA_FUNKTIONER.md` (uttryckligt krav från användaren: inget raderas utan att sparas ner för framtida återuppbyggnad)
- **Mina källor-layout itererad efter merge:** Lägg till källa-kortet stängdes av live (för smalt, gav ett tomt hål) → Aktiva källor/Alla källor slogs ihop till en gemensam rad med låst, matchande höjd (523px) istället för fast/max-height-blandning
- **V1-lanseringsscope-genomgång** (hela Profil + Admin, kort för kort):
  - **Konto:** Datahantering ("Radera konto"/GDPR-export gjorde bokstavligen ingenting vid klick, bara en tom bekräftelse), Tvåfaktor (togglade "på" helt lokalt, inget i `AuthService` bryr sig) och Sessioner (payhittade enheter/platser, inkl. en fejkad misslyckad inloggning från Amsterdam) stängdes av som farliga/vilseledande. KontoInfo/LösenordByte lämnas kvar men **behöver kopplas mot befintlig `PUT /api/auth/me`/`/me/password`** (ej gjort). Övriga kort redan rätt av som standard
  - **Notifieringar-sektionen** redan helt dold (alla 5 flaggor av) — inget att ändra
  - **Support:** FAQ accepterad som är (kod+deploy för innehåll ok för V1), Systemstatus av, **Ärendehantering pausad på användarens uttryckliga begäran** — vill behålla den påkostade mock-varianten, inte skala ner. Löstes senare: appen har redan två riktiga kontaktkanalar (Feedback-knappen/Formspree, och en kundtjänstbot-widget i `index.html` sedan session 20) — ingen brådska med en tredje
  - **Viktig arkitekturupptäckt:** feature-flaggorna (`lib/featureFlags.ts`) är per webbläsare (localStorage), INTE en global backend-inställning — `defaultAktiv` i koden är den enda sanningen för vad riktiga besökare ser. `kallor_lagg_till` och `konto_datahantering` hade fel `defaultAktiv` i koden trots att admin trodde de redan var avstängda live (PR #389)
  - **Uppdateringar:** "Nyheter" (publik) ska bara synas utloggad, "Uppdateringar" (profil) bara inloggad — fixat (PR #388). `AdminUppdateringar` (changelog-redigeraren) visade sig vara 100% dekorativ — sparar bara till lokalt React-state, når varken Nyheter eller profil-Uppdateringar. Pausad i väntan på Push-samtalet, eftersom en hel spec för schemalagd publicering + push + djuplänkning + schemalagd källaktivering + förhandsprenumeration hänger ihop med den
  - **Admin Översikt** var 100% påhittad (bl.a. "1284 användare", källan "Regeringen.se" som inte finns, nedräkningsklockor som aldrig räknade ner) — Aktiva källor/Systemhälsa/Källstatus kopplade mot riktig `GET /api/admin/sources`-data, övriga fick MOCK-badge. "Kommande kontroller"s två påhittade jobbtyper (Event-drivet, Fullständigt flödestest) borttagna men fullspecade i `docs/OVERSIKT_KOMMANDE_KONTROLLER_BORTTAGNA.md` (PR #390)
- **Push-notiser (punkt 8) scopad, INGET byggt än** — fullständig teknisk + produktplan sparad i `.claude/plans/warm-rolling-penguin.md` för nästa session: Web Push/VAPID (gratis, kräver PWA-installation för att fungera på iPhone), trigger = nya händelser från valda källor, batching = en push per källa per ingestor-körning, innehåll = bara antal+källnamn (inget känsligt på låsskärmen), ingen severity-gating, ingen tyst-period-logik för V1. Ett separat framtida diagnosverktyg (upprepade testpushar till en specifik användare för att felsöka leveransproblem) specad men inte påbörjat

**Problem och lösningar denna session:**
- Feature-flaggarnas faktiska räckvidd missförstods av användaren (trodde admin-panelens toggle påverkade alla besökare) — upptäcktes när `kallor_lagg_till` skulle stängas av på riktigt och det visade sig bara vara satt i användarens egen localStorage. Löst genom att alltid uppdatera `defaultAktiv` i koden vid den här typen av beslut framöver, inte bara toggla i panelen
- Höll på att bygga en enkel Formspree-baserad "skalad ner"-ersättning för Ärendehantering innan användaren stoppade det ("jag är stolt över den, låt mig fundera") — filen återställdes till originalet direkt. Lärdom: fråga innan en uppskattad, redan byggd komponent görs om, även när den är mockad
- Glömde initialt att koda push-planeringsarbetet på en egen branch — gjorde flera oberoende V1-scope-ändringar direkt på `main` innan de commitades. Löst genom att dela upp i tre separata branches/PRs (#388, #389, #390) i efterhand istället för en enda blandad commit

**Etablerat mönster:**
- Innan en känslig UI-komponent (bekräftelsedialoger, "detta kan inte ångras"-knappar) antas vara klar: kontrollera om den faktiskt gör något vid klick, inte bara att den ser klar ut. Flera kort i Konto (Datahantering, Tvåfaktor, Sessioner) hade fullt utbyggd bekräftelse-UI utan någon backend-koppling alls
- Vid borttagning av mockdata-bara funktioner: spara alltid en fullständig spec (vad den gjorde, hur den såg ut, vad som krävs för att bygga den på riktigt) i `docs/`, aldrig bara radera — mönster etablerat med Mina källor (SPAR/Nya-fliken/Planerat underhåll) och återanvänt för Admin Översikts "Kommande kontroller"
- Feature-flaggar i det här projektet är en per-webbläsare-preferens, inte en produktionsbrytare — ett beslut om att stänga av något för riktiga användare måste alltid landa som en kodändring (`defaultAktiv`), aldrig bara en admin-panelstoggle
- Vid en stor ny funktion (push-notiser): utforska befintlig scaffolding/kodmönster grundligt FÖRE planering (här: fyra redan existerande men helt oanvända DB-tabeller sedan session 18), gå igenom både tekniska beslut (leveransmekanism, batching) OCH vardagliga produktbeslut (notisinnehåll, severity-gating, tysta timmar) innan kod skrivs — en ren teknisk plan är inte tillräcklig

**Next session:**
- Verifiera att PR #389 och #390 är mergade (öppna vid sessionens slut)
- Bygg push-notiser enligt den sparade planen i `.claude/plans/warm-rolling-penguin.md`, börja med backend-infrastrukturen (migration för `UserDevice`, `WebPush`-paket, `EventSync.SyncAsync`-utökning för att returnera faktiska inlagda händelser)
- Koppla KontoInfo/LösenordByte mot befintlig `PUT /api/auth/me`/`/me/password` (upptäckt under V1-scope, inte gjort än)
- Ärendehanterings öde — användaren funderar fortfarande, inget beslut

---

### Session 24 — 2026-07-27
**What was done:**
- **FAS 4-filterprototyp (Polisen kategori/kommun, #298) klar och testad:** vidareutvecklade prototypen från session 23 (`KategoriFilterModal.tsx`, `AktivaKallorKort.tsx`, `kallorUtils.ts`) med en kontextuell **prenumerationsklocka** per händelse i flödet (`PrenumerationsKlocka.tsx`) — i Allt-flödet en "lägg till"-meny (visar bara det som inte redan är valt, döljs helt om allt redan valt), i Mitt-flödet en "ta bort"-meny. Delat state lyft till `PolisenFilterContext.tsx`. Modell: två oberoende mängder (Typ ∩ Område), första klicket smalnar av från default "allt" till bara det valda, tomt urval matchar ingenting (inte reset). En stacking-bugg (menyn klipptes av kortets `overflow-hidden`) löstes med samma `createPortal`-mönster som `FeedbackModal` (session 7)
- **Allt/Mitt lyft från gömd pill-toggle till egna rader i sidomenyn** ("Alla händelser"/"Mitt flöde", namngivna efter diskussion), samt en ny **kollapsbar Inställningar-sektion** i sidomenyn (Adminpanel alltid synlig, resten fällbar, standard utfälld)
- **FAS 4-backend byggt på riktigt:** ny modell `UserPolisenFilter` (migration `AddUserPolisenFilter`, null-fält = ej anpassat/allt) + `GET/PUT /api/user/polisen-filter`, `PolisenFilterContext` kopplad mot riktiga endpoints. **Registrerings-seedningen borttagen** (`AuthService.cs`) — nya konton får inte längre alla källor automatiskt, verifierat med testkonto
- **Admin → Användarhantering fick en "Polisen-filter"-sektion** i Översikt-fliken (mockad — hela panelen visade sig vara 100% frikopplad från riktiga användare, ingen `GET /api/admin/users` finns). Mockdatan använder medvetet samma datastruktur som den riktiga endpointen, för smidig framtida koppling
- **Onboarding-mockup** (artifact, punkt-wizard: Konto→Källor→Klart) itererad flera varv med användaren — labeled stegbubblor, adress/ort-fält, SPAR borttaget helt (kräver personnummer+BankID som inte finns), riktig sammanfattning i steg 3
- **"Sparat"-funktion byggd:** ny modell `UserSavedEvent` (migration `AddUserSavedEvent`, unikt index förhindrar dubbelspar), `GET/POST/DELETE /api/user/saved-events`, `SavedEventsContext`, bokmärkesikon på alla källor i `NewsItem.tsx`, "Flöde/Sparat"-pill inuti Mitt flöde. Verifierat end-to-end mot riktig backend (curl) och i webbläsaren
- Omfattande designdiskussion: notis-volym-modell fastslagen (subscribe = samtycke till volym, filter är frivillig finjustering, inte en spärr — via en YouTube-liknelse från användaren), Google-konto-skapande klargjort som samma jobb som Google-inloggning (FAS 3, ej byggd), Support-ärendesystemets omfattning diskuterad (smeknamn/primärnamn, bildbilagor — stort, eget spår), monetisering flaggad som framtida fråga

**Problem och lösningar denna session:**
- Missförstod användarens svenska ("klockan bör bli av" = "borde byggas", inte "borde tas bort") — korrigerade innan fel beslut sparades till minnet
- CDP-skärmdumpar timeade ut sporadiskt vid artifact-testning (både på claude.ai/code/artifact och en lokal `serve`-server) — visade sig vara transient automationsflakighet, inte en bugg i koden; en kort väntan löste det varje gång
- Artifact-menyns stäng-knappar (×/Avbryt) var bara kopplade via `querySelector` (bara första träffen av tre element med samma `data-action`) — fixat med `querySelectorAll`
- Upptäckte att "Mina källor" (lägga till/ta bort myndigheter) fortfarande är 100% frikopplad från backend, trots att `GET/PUT /api/user/sources` finns sedan session 18 — ingen frontend-anropare någonsin byggd

**Etablerat mönster:**
- Notis-volym: att lägga till en källa är användarens samtycke till volymen från den — inga automatiska spärrar utöver att inget längre auto-seedas vid registrering. Typ/område-filtret är en frivillig finjustering, inte ett krav innan notiser får skickas
- Vid onboarding/design som är svårt att beskriva i ord: bygg en klickbar artifact-mockup med verklig kopia av existerande komponenters stil (samma mönster som session 22:s jämförelse-artifact)
- Ny backend-tabell som bara rör EN specifik källa (t.ex. Polisen): håll den källspecifik och enkel istället för ett generiskt "per källa, per dimension"-schema — billigare att generalisera senare om/när fler källor faktiskt behöver det, än att bygga generiskt i förväg
- Innan admin-funktioner byggs mot "en användares data": verifiera att adminsidan faktiskt är kopplad mot riktiga användare — den var det inte (varken `Anvandare.tsx` eller källistan i `Mina källor`)

**Allt overkommitterat på disk vid sessionens slut** — inga PR:ar, inga commits. Ändrade filer: `AuthService.cs`, `AppDbContext.cs`, `Program.cs`, `App.tsx`, `Anvandare.tsx`, `NewsFeed.tsx`, `NewsItem.tsx`, `AktivaKallorKort.tsx`, `kallorUtils.ts`, `Sidebar.tsx`, `main.tsx`, `OmPage.tsx`, `ProfilePage.tsx`, `UppdateringarPage.tsx`. Nya filer: `UserPolisenFilterController.cs`, `UserSavedEventsController.cs`, migrationerna för `AddUserPolisenFilter`/`AddUserSavedEvent`, `UserPolisenFilter.cs`, `UserSavedEvent.cs`, `polisenFilter.ts`, `savedEvents.ts`, `PrenumerationsKlocka.tsx`, `KategoriFilterModal.tsx`, `PolisenFilterContext.tsx`, `SavedEventsContext.tsx`.

**Next session (Session 25), bestämd ordning:**
1. Admin: "Sparat"-sektion i Användarhantering (samma plats/mönster som Polisen-filter) + fristående historisk händelsesökning (källa/tid/plats/datum) för admin+support
2. Koppla "Mina källor" (källistan) mot riktig backend (`GET/PUT /api/user/sources` finns redan, bara aldrig anropad)
3. Definiera V1-lanseringsscope (ingen sparad lista finns — gå igenom varje meny/kort och besluta in/ut, görs tidigt så resten av listan inte byggs i onödan)
4. Support-ärendesystem, full ombyggnad (smeknamn/primärnamn med "primär"-val, bildbilagor, riktig backend istället för dagens mock) — aktuellt när fler än användaren själv agerar support
5. Push-notiser (prioritera riktig push-notis, sen ev. e-post, SMS mycket senare) — `UserDevice`/`UserNotificationSetting`/`NotificationDeliveryLog` finns redan som oanvänd scaffolding sedan session 18
6. Onboarding-wizarden byggd på riktigt i registreringsflödet (mockup klar)
7. FAQ-innehållet rättat (två poster påstår idag att FAS 5 finns)
8. FAS 3: Google-inloggning (#297) — löser även "skapa konto via Google" i samma veva
9. Öppna login/registrering publikt (synliga knappar) — sist av allt
- Monetisering/affärsmodell — flaggad, inte påbörjad, förtjänar ett eget samtal

---

### Session 23 — 2026-07-26
**What was done:**
- **PWA-stöd (huvudapp):** `manifest.json` + genererade ikoner (192/512, maskable, apple-touch-icon) + `theme-color`/`mobile-web-app-capable`-metataggar i `index.html`. Verifierat på riktig Android-mobil via cloudflared-tunnel: installeras som egen app, eget namn, egen ikon, helskärmsläge (PR #363)
- Under samma PR upptäcktes och fixades ännu en gång react/react-dom-versionsmismatch (`19.2.8` vs `19.2.7`) — se "Problem och lösningar" för varför den kom tillbaka
- **PWA-identitet för adminsidan:** ny hook `usePwaIdentity` byter manifest/favicon/theme-color/apple-touch-icon/titel dynamiskt beroende på om man är på `/admin` eller inte, med separat `admin-manifest.json` och en egen ikonuppsättning (samma lila "S" + ett litet kugghjuls-badge i hörnet för att gå att skilja från huvudappen). Verifierat end-to-end på Android: separat installation bredvid huvudappen (PR #364). `id`-fält tillagt i båda manifesten på Chrome DevTools rekommendation
- Upptäckt under testet: Chrome **desktop** erbjuder inte en fristående installation av admin-identiteten via adressfältet eftersom huvudappens `scope: "/"` redan "äger" `/admin` i webbläsarens ögon — en Chrome-specifik begränsning, inte ett fel i manifesten. Mobilen har inte samma begränsning
- **SMHI-severity:** upptäckte vid granskning av redan publicerad källa (Id=10) att `MapSeverity` bara mappade RED/ORANGE, allt annat (inkl. `YELLOW` — en riktig officiell varningsnivå hos SMHI) hamnade i "Bra att veta" tillsammans med rena `MESSAGE`-meddelanden. Fixat: `YELLOW` → "Viktigt" (PR #365)
- **"Synka om"-knapp i Källhantering:** upptäckte i samband med SMHI-fixen att `EventSync.SyncAsync` bara uppdaterar befintliga händelser vid `overwriteExisting=true` (admin-triggad), och att det endpointet (`POST /api/admin/sources/{id}/resync`, byggt i session 22) saknade UI — behövde köras via en manuell fetch i DevTools-konsolen. Byggde en riktig knapp per källrad i Källhantering (PR #366)
- **AdminPage rules-of-hooks-bugg:** ett villkorligt `return null` (utloggad/redirect) satt mitt i komponenten, mellan de första hooksen och `useFeatureFlagsAdmin`/sju `useState`/ett andra `useEffect`/`useCallback` — bröt Reacts Rules of Hooks (olika antal hooks beroende på render). Flyttade samtliga hooks till att alltid köras, returnet efter dem istället (PR #367)
- Tog bort "Senaste nyhet"-raden från Aktiva källor-kortet på profilsidan (bedömning: sällan efterfrågat) — städade även bort de nu oanvända `nyhetFarg`/`fmt`-hjälparna (PR #368)
- Städade bort en övergiven `git stash` sen session 20 (lokal `package-lock.json`-drift) — testad och bekräftat stale/inte längre applicerbar, droppad
- **FAS 4-designdiskussion (källprenumerationer, #298):** byggde en klickbar prototyp i `AktivaKallorKort.tsx` (kugghjulsikon per rad → fäller ut Geografi-/Severity-väljare, progressiv disclosure) för att visualisera ett UI-koncept, testade live i webbläsaren, rev sedan ut den igen på användarens begäran (för tidigt att skicka något icke-funktionellt till produktion). Diskussionen ledde till en viktig arkitekturinsikt (se "Etablerat mönster")
- **Krisinformation-severity:** samma mönster som SMHI — `MapSeverity` läser nu av VMA ("Viktigt meddelande till allmänheten i ...") och Röd/Orange/Gul varning direkt ur rubriktexten, eftersom det är Krisinformations egna officiella termer (ingen egen severity-kod finns i API-svaret). Verifierat mot skarp data; hittade och fixade en bugg under verifieringen (källans rubriktext hade ibland dubbla mellanslag, `\s+` i regex istället för exakt mellanslag) (PR #369)
- Grupperade `react`/`react-dom` i `.github/dependabot.yml` — samma versionsmismatch-bugg som session 22 löste (PR #358) kom tillbaka eftersom rekommendationen aldrig genomfördes (PR #370)
- **Polisen `EventType` extraherad:** ny nullable `CanonicalEvent.EventType`, `PolisenRssIngestor` bryter ut händelsetypen (mittendelen av titeln, `"{tid}, {typ}, {ort}"`) till ett eget fält — underlag för användarstyrd kategorifiltrering, inte severity-klassning (se etablerat mönster nedan). Hittade och fixade samtidigt en bugg i `EventSync.SyncAsync`: uppdaterings-grenen kopierade inte det nya fältet alls, så en resync rapporterade "updated" utan att faktiskt sätta värdet (PR #373)
- **Mobilnavigering trasig på hela profilsidan:** `ProfilePage.tsx`/`ProfileLanding.tsx` saknade helt swipe-gest och hamburgerknapp för sidomenyn, till skillnad från `App.tsx`/`OmPage`/`UppdateringarPage` som redan hade det — användaren satt fast utan väg tillbaka till menyn på mobil. Lade till samma `useSwipeable`-mönster + hamburgerknapp (PR #375)
- **Osynliga raderingsknappar på touch:** "Ta bort"-knappar i Aktiva källor/Notifieringar använde `opacity-0 group-hover:opacity-100` — osynliga men fullt klickbara på touch-skärmar (ingen hover). Användaren bekräftade: tryck bredvid källnamnet raderade tyst utan varning. Ny `.hover-reveal`-CSS-klass (`@media (hover: hover)`) håller knappen alltid synlig på touch, hover-gömd bara där hover faktiskt finns (PR #375)
- **Mina källor mobilanpassad + surfplatte-bugg:** "Lägg till källa" hade fast bredd (`w-80`) som klämde "Aktiva källor" till en oanvändbar remsa på mobil (bekräftat med S20 Ultra-skärmdump) — fixat med `flex-col`-stapling under `sm` (PR #374). Upptäckte sedan via iPad-emulering i DevTools att `sm`-brytpunkten för kort-uppdelningen och Aktiva källors interna 3-kolumnsgrid krockade — vid just den bredden fanns plats för ingetdera ordentligt, text och knappar överlappade. Höjde båda till `lg` (PR #376)
- **FAS 4-filterdesign (källprenumerationer, #298) — omfattande designiteration, allt lokalt/overkommitterat:** byggde vidare på en klickbar prototyp i `AktivaKallorKort.tsx`/ny `KategoriFilterModal.tsx` tillsammans med användaren, många rundor skärmdump → feedback → justering:
  - Kugghjulsikon (hover-only) ersattes med en alltid synlig textknapp "Filter" (självförklarande > ikon, och hover fungerar inte på mobil)
  - Modal med två flikar: **Typ** (Polisens 16 kategorier, platt kryssrutelista) och **Område** — användaren visade en Paint-skiss av Arbetsförmedlingens platsväljare (Platsbanken) som referens, kikade jag på själv i webbläsaren: tvåkolumns län→kommun-mönster (klicka län vänster, kryssa kommuner höger, "Välj alla kommuner"). Byggde om Område-fliken till samma mönster med en fullständig Sveriges-lista (21 län / 290 kommuner, `LÄN_KOMMUNER` i `kallorUtils.ts`)
  - Knappens sammanfattningstext gick igenom flera iterationer: "döljer X typer/län" (räknade bortvalt) → **bytt till att räkna VALT** ("X typer, Y län") efter att användaren påpekade att det annars läses baklänges mot modalens egen fråga "Vad vill du se?" (skulle annars kräva att fråga "Vad vill du INTE se?" för att vara konsekvent)
  - Layoutbugg: den beskrivande filtertexten fick källnamnet att klippas av i den smala kortkolumnen — löst genom att bryta filterknappen till en egen rad under namnet (samma mönster som den befintliga "⚠️ Planerat underhåll"-varningen), medan en oanpassad "Filter" (kort text) stannar inline
  - Liten lila prick i länlistan visar vilket/vilka län som har aktiva val — räknas nu konsekvent på samma "valt"-sätt som knappen
  - Textstorlek/modalbredd höjd ett snäpp från `md`-brytpunkten (768px+) efter att texten kändes för liten/utzoomad på surfplatta
  - Titeln utökad till "...i ditt flöde?" för extra tydlighet
  - Diskuterade och **beslutade att vänta** med: onboarding-idé (låta nya användare välja källor/områden direkt i skapa-konto-flödet, med "allt ikryssat" som fallback om man hoppar över — löser "standard ska vara filterlöst"-principen utan att ändra befintliga användares upplevelse), och om andra källor (t.ex. SMHI) ska få samma typ-kryssrutor senare
  - Beslutat för framtida backend-design: filtret ska gälla **framåt** i tid, med en separat explicit knapp ("Vill du hämta tidigare händelser?") för valfri bakåtgående hämtning — inte automatiskt

**Problem och lösningar denna session:**
- React/react-dom-mismatchen (session 22, PR #358) var tillbaka igen vid sessionsstart trots att den redan fixats en gång — rotorsaken (Dependabot kan bumpa endast det ena paketet) hade identifierats men aldrig åtgärdats. Löst permanent nu genom att faktiskt gruppera dem i Dependabot (PR #370), inte bara flagga det som en idé
- Lokal testning av inloggningsflödet krockade med flera separata miljöproblem i rad: Vite dev-proxyn pekar mot `localhost:5000` (inget lyssnade där) → 500 pga saknad `RESEND_API_KEY` (samma kända problem som session 20) → 401 pga tom lokal SQLite-databas utan seedat konto. Löst genom att starta backend med `RESEND_API_KEY`+`ADMIN_EMAIL`+`ADMIN_PASSWORD` som miljövariabler vid lokal körning
- Cloudflared-tunneln (för att testa PWA-installation på riktig mobil) blockerades först av Vites `allowedHosts`-säkerhetsspärr för okända domäner — löst med `allowedHosts: ['.trycloudflare.com']` i `vite.config.ts` (dev-only, påverkar inte produktionsbygget)
- Chrome desktop visade "Öppna i [huvudappen]" istället för en installationsprompt när man försökte installera adminidentiteten, eftersom huvudappens `scope: "/"` redan matchar `/admin` i webbläsarens ögon — inte en bugg i vår kod, en plattformsbegränsning i Chromes UI-heuristik för "en app per scope". Fungerar som väntat på mobilen
- Resync-knappen verkade inte fungera vid första anblick efter merge ("taggarna ligger kvar") — visade sig vara en cache/laddningsfördröjning i gränssnittet, en andra sidladdning visade rätt data
- `EventSync`s begränsning (bara live/aktuell data i källans flöde kan rättas retroaktivt via resync, historik som redan lämnat RSS/API-flödet förblir orörd för alltid) upptäcktes och förklarades två gånger denna session (SMHI och Krisinformation) — värt att komma ihåg som en permanent begränsning, inte något att "fixa"
- Samma `EventSync.SyncAsync`-uppdaterings-gren missade det nya `EventType`-fältet helt (handskriven fält-för-fält-kopiering, ingen automatik) — upptäcktes bara för att resultatet verifierades mot faktisk data efteråt istället för att bara lita på "200 updated"-svaret. Lärdom: verifiera alltid den faktiska datan efter en resync, inte bara att endpointen svarade utan fel
- Två separata `sm`-brytpunkter (kort-uppdelning + intern 3-kolumnsgrid) som råkade dela samma tröskelvärde skapade en "ingen har plats"-zon mitt emellan mobil och stor skärm — upptäcktes bara för att surfplatta faktiskt testades (DevTools-emulering), inte bara mobil och desktop

**Etablerat mönster:**
- **Severity-klassificering får bara läsa av officiella signaler som redan finns i källans egen data (SMHI:s RED/ORANGE/YELLOW, Krisinformations VMA-text/varningsnivåer) — aldrig uppfinna en egen rangordning** (t.ex. att ranka Polisens brottstyper efter allvarlighet). Det senare bryter mot grundprincipen "ingen tolkning". Tumregel: finns en officiell urgency-signal inbyggd i källans data → fixa severity-mappningen rakt av. Finns bara ett kategorinamn utan inbyggd rangordning → lämna severity orört, bygg istället användarstyrd filtrering (kryssrutor per kategori, inte ett systemvalt severity-tröskelvärde) ovanpå
- PM byggde och testade UI-prototyper direkt i webbläsaren (via `mcp__claude-in-chrome__*`-verktygen, inloggad lokal session) genom hela sessionen, upprepade gånger, och höll dem konsekvent utanför commits tills de var uttryckligen godkända — även efter att de redan visats upp och testats live. Skärmdump → muntlig feedback → justering → ny skärmdump var den huvudsakliga arbetscykeln för all UI-design denna session, snabbare och mer träffsäkert än att gissa i kod
- Vid osäkerhet om ett UI-mönster (t.ex. län→kommun-väljare): fråga om användaren känner till en befintlig, beprövad implementation att utgå från istället för att designa från scratch — Arbetsförmedlingens Platsbanken-väljare (tvåkolumns län/kommun) blev referensen här, sparade en hel del designiteration
- När en kompakt sammanfattningstext ska visa "hur mycket är filtrerat": räkna alltid utifrån samma riktning som frågan i gränssnittet redan ställer ("Vad vill du SE?" → räkna vad som är valt, inte bortvalt) — annars läses siffrorna baklänges även om de tekniskt är korrekta
- Testa nya modaler/UI-mönster på fler brytpunkter än bara mobil/desktop — surfplatta (`md`-breddintervallet) avslöjade både en textstorleksfråga och en helt separat, redan-i-produktion liggande brytpunktsbugg (PR #376) som annars hade fortsatt osedd
- Lokal fullstack-testning (frontend + backend + admin-inloggning) kräver tre saker varje gång: `dotnet run` med `RESEND_API_KEY`+`ADMIN_EMAIL`+`ADMIN_PASSWORD` satta, Vite dev-servern pekande via proxy mot `localhost:5000` (redan konfigurerat), och `allowedHosts` i `vite.config.ts` om man vill nå den via en publik tunnel för mobiltest

**FAS 4-prototypens nuvarande skick (allt lokalt, overkommitterat på disk):**
- `KategoriFilterModal.tsx` (ny fil, untracked) + ändringar i `AktivaKallorKort.tsx`/`kallorUtils.ts` — inte pushat, medvetet, men ligger kvar på användarens lokala disk redo att fortsätta från
- Designen känns färdigdiskuterad för Polisen specifikt: textknapp "Filter" (alltid synlig) → modal med Typ-/Område-flikar → tvåkolumns län/kommun i Område. Nästa steg är att koppla det mot riktig backend-persistens (kräver `UserSourcePreference`-modellen från issue #298, plus en riktig inloggad session eftersom prototypen bara har lokalt React-state)

**Next session (Session 24):**
- **FAS 4:** koppla den redan designklara Polisen-filterprototypen (se ovan) mot riktig backend — `UserSourcePreference`-modell (per issue #298), spara vald kategori+kommunlista per användare, `GET/PUT`-endpoints. Filtrering ska gälla framåt i tid; lägg till en separat explicit "Vill du hämta tidigare händelser?"-knapp för valfri bakåtgående hämtning (inte automatiskt)
- **Ny idé, sparad för senare (inte påbörjad):** onboarding-steg i skapa-konto-flödet där nya användare väljer källor/områden direkt (återanvänder SPAR-infrastrukturen som redan finns i `LaggTillKort` men aldrig aktiverades som standard) — med "allt ikryssat" som fallback om man hoppar över steget. Skapa-konto-flödet är helt odesignat för detta ännu
- Eventuellt: samma typ-kryssrute-mönster för SMHI (har redan strukturerade typer som GALE_LOW/FOREST_FIRE) — inget beslutat
- FAS 3: Google OAuth (#297)
- FAS 5: Konto-sida, radera konto, GDPR-export (#299) — obs: "Glömt lösenord"-punkten i issuet är troligen redan byggd (session 18), verifiera innan den räknas som kvarstående
- Lågprioriterad lint-nit kvar i `AdminPage.tsx` (`react-hooks/set-state-in-effect`, rad ~83) — prestandanit, inte en korrekthetsrisk, `npm run lint` körs inte i CI
- Lågprioriterad lint-nit kvar i `AdminPage.tsx` (`react-hooks/set-state-in-effect`, rad ~83) — prestandanit, inte en korrekthetsrisk, `npm run lint` körs inte i CI

---

### Session 22 — 2026-07-25
**What was done:**
- Akut produktionsincident: användaren rapporterade vit skärm på `samhallsinformation.se`
- Felsökte utifrån (curl mot frontend/backend/assets — allt gav 200, uteslöt infra/deploy-fel), gick sedan igenom `AuthContext.tsx`/`ThemeContext.tsx` för riskabla `JSON.parse`/`localStorage`-lässtigar (inga hittades — redan skyddade med try/catch)
- Upptäckte att lokal branch låg 58 commits efter `origin/main` — bl.a. Fas 1/2-auth-refresh (session 20) och en react-router v7→v8-migrering (PR #355) hade redan gått live utan att synas i den lokala historiken
- Användaren delade webbläsarkonsolens faktiska fel (skärmdump): `Minified React error #527, args[19.2.8, 19.2.7]` — löste frågan direkt
- Rotorsak: Dependabot-PR #342 bumpade `react` till `19.2.8` men missade `react-dom`, som blev kvar på `19.2.7`. React 19 kräver exakt matchande versioner mellan paketen — mismatchen kraschar hela render-trädet vid uppstart. Appen har ingen ErrorBoundary, så kraschen syntes bara som en tom `#root` i webbläsaren, inget synligt felmeddelande
- Verifierade rotorsaken headless (Playwright/Chromium, `npx playwright install chromium`, körd mot en scratch-katalog för att inte påverka projektets `package-lock.json`): produktions-URL gav `#root` med 0 tecken + exakt samma `pageerror`; lokalt bygge med matchande versioner gav `#root` med ~37 000 tecken och inga fel
- PR #358 (`fix/react-dom-version-mismatch`): `react-dom` → `^19.2.8` i `package.json` + `package-lock.json`, byggt och testat lokalt (`npm run build` + `npm run preview` + headless-verifiering) innan push. Mergad av användaren, verifierad live direkt efter (headless-koll mot produktion gav 48 772 tecken i `#root`, 0 fel)
- Användaren tyckte SMHI-vädervarningstexten i sandlådan (formaterad enligt PR #344/#346, session 21) var svår att läsa — alla fyra fält (`Händelsebeskrivning`, `Vad ska jag tänka på?`, `När?`, `Var?`) låg som en enda löpande rad. Byggde en jämförelse-artifact (tre alternativ, mockad med appens faktiska korttypografi från `NewsItem.tsx`) innan kodändring — användaren valde "Alternativ B" (styckesbrytning + fetmarkerade etiketter)
- PR #360 (`feat/smhi-content-formatting`): `SmhiApiIngestor` separerar fälten med `\n\n` istället för mellanslag (inga ord ändrade); `NewsItem.tsx` delar `event.content` på `\n\n` och fetmarkerar delen fram till första `": "` — rent format-drivet, träffar bara källor vars content faktiskt innehåller `\n\n` (idag bara SMHI), övriga källor renderas oförändrat. `npm run build` + `dotnet build` gröna, split/bold-logiken verifierad mot verklig fältstruktur i ett fristående skript
- Användaren frågade om redan ingestad SMHI-data kunde få det nya formatet utan att vänta på nya varningar — förklarade att `IngestorBackgroundService` dedupar på `ExternalId` och aldrig uppdaterar befintliga rader. Föreslog två lösningar, användaren valde den återanvändbara: PR #361 (`feat/admin-resync-source`) — ny `POST /api/admin/sources/{id}/resync` (JWT Admin) som kör om en källas ingestor och **skriver över** befintliga rader istället för att bara hoppa över dem. Upsert-logiken extraherad till `EventSync.SyncAsync(db, ingestor, overwriteExisting, ct)`, och `IngestorBackgroundService` bytt till samma helper (`overwriteExisting: false`) — bakgrundstjänstens beteende oförändrat
- Användaren körde resync mot källa Id=10 (SMHI) via PowerShell (`Invoke-RestMethod`, efter några turer med fel verktyg — Railway-consolen saknar `curl`/`wget`, och bash-syntax funkar inte i Windows PowerShell): `{"inserted":0,"updated":17}` — alla 17 befintliga SMHI-händelser fick det nya formatet retroaktivt, verifierat fint i sandlådan. Källan aktiverad (`IsActive`/`IsPublished` → true)
- Diskuterade "SMHI Nyheter"-länken som bara visar en bild (samma vattenbrist-artikel som i session 21) — bekräftat samma kända, icke-åtgärdbara fall (SMHI:s egen artikel är tunn, "ingen tolkning"-principen förbjuder att kompensera på vår sida). Användaren beslutade att lämna SMHI Nyheter som den är (opublicerad) och låta vädervarningarna bära "SMHI" i sidebaren tills vidare
- En kryptisk fråga om att "städa .env-filen med lösenordet från chatten" (förslag från en annan, parallell terminalsession) utreddes — inget lösenord hittades i något incheckat `.env`-fil i det här repot (`frontend/.env.production` innehåller bara `VITE_USE_MOCK=true`, `.env.local` är gitignorad via `*.local`). Kunde inte kopplas till det här repot eller den här konversationen; användaren valde att ignorera det
- Upptäckte i samband med resync-arbetet att `ci.yml` bara triggar på `Samhallsinformation/frontend/**` — dagens rena backend-PR (#361) mergades utan någon automatisk byggkontroll. PR #362 (`ci/backend-build-test`): ny fristående `ci-backend.yml` med egen path-filter (`backend/**`, `backend.Tests/**`, `.slnx`), kör `dotnet restore/build/test` i Release-config mot hela lösningen. `include-prerelease: true` på `setup-dotnet` eftersom projektet kör .NET 10 preview. Verifierad lokalt (samma tre kommandon, 8/8 tester); första riktiga CI-körning sker vid nästa faktiska backend-ändring eftersom PR:en själv bara rörde `.github/workflows/`

**Problem och lösningar denna session:**
- En Dependabot-PR som bumpar `react` utan att samtidigt bumpa `react-dom` (eller tvärtom) ger inget CI-fel — `tsc -b && vite build` bryr sig inte om att versionerna matchar vid körning, bara vid rendering i webbläsaren. Lärdom: `react`/`react-dom`-par bör alltid bumpas ihop; överväg att slå ihop dem till en enda Dependabot-grupp
- Ingen ErrorBoundary i appen gjorde diagnosen svårare rent externt (curl visar alltid 200 och giltig HTML/JS oavsett klientkrasch) — webbläsarkonsolen var enda källan till den faktiska felsignaturen
- Lokal branch hade tappat kontakt med `main` i 58 commits (senast synkad vid session 19) — gjorde första felsökningsrundan onödigt lång innan avvikelsen upptäcktes
- Railway Console (fliken "Console" i Railway-UI) är en minimal bash-shell inuti containern utan `curl`/`wget` — fel plats för HTTP-anrop mot API:et. Rätt plats är en vanlig lokal terminal (Git Bash eller PowerShell) mot den publika URL:en
- Bash-syntax (`-X`, `-H`, `\`-radbrytning) fungerar inte i Windows PowerShell — `curl` är där ett alias för `Invoke-WebRequest` med annan parametersyntax. Gav färdiga `Invoke-RestMethod`-block istället
- Admin-inloggningen gav 401 första försöket — admin-kontot seedas bara en gång vid uppstart (`Program.cs`) om ingen användare med den e-posten redan finns, så ett `ADMIN_PASSWORD` som ändrats i Railway *efter* att kontot skapades slår inte igenom. Löstes genom att läsa av de faktiska env-variablerna direkt i Railway (`echo $ADMIN_EMAIL`/`$ADMIN_PASSWORD` i Console, eller Variables-fliken) istället för att gissa

**Etablerat mönster:**
- Vid "vit skärm"-rapporter: servern/CDN:n kan vara helt frisk (200 överallt) medan felet ändå är en klientkrasch under rendering. Fråga alltid efter webbläsarkonsolens faktiska felmeddelande tidigt — det är snabbaste vägen till rotorsaken, särskilt utan ErrorBoundary. Headless-verifiering (Playwright i en scratch-katalog, `--no-save`) är ett bra sätt att bekräfta både att felet reproduceras i produktion och att fixen faktiskt löser det, utan att röra projektets egna beroenden
- Vid textformat-/UI-ändringar som är svåra att beskriva i ord: bygg en jämförelse-mockup (artifact) med den faktiska komponentens verkliga styling innan kodändring, låt användaren välja alternativ — snabbare och säkrare än att gissa och iterera i kod
- `IngestorBackgroundService` dedupar på `ExternalId` och uppdaterar aldrig befintliga rader — en ingestor-fix syns bara på nyinkommen data. `POST /api/admin/sources/{id}/resync` (PR #361) är den återanvändbara lösningen för att se en fix slå igenom på redan hämtad data, för alla källor och alla framtida ingestor-ändringar
- CI:s `paths`-filter är per fil/mapp, inte automatiskt heltäckande — kontrollera regelbundet att nya kod-kataloger (som `backend.Tests/` sedan session 20) faktiskt omfattas av någon workflow, annars mergas ändringar där obemärkt utan byggkontroll

**Next session (Session 23):**
- Verifiera att `ci-backend.yml` (PR #362) faktiskt triggar och blir grön vid nästa backend-ändring
- Merga PR #359 (den här sessionloggen) om den inte redan är det
- Överväg en ErrorBoundary runt `<App />` i `main.tsx` så framtida renderingskrascher ger ett användarvänligt felmeddelande istället för vit skärm
- Överväg att gruppera `react`/`react-dom` i samma Dependabot-uppdatering (`.github/dependabot.yml`) för att förhindra framtida versions-mismatch
- Synka lokal arbetsbranch mot `main` oftare — 58 commits efter innebar att flera redan lösta saker (Fas 1/2-auth, react-router v8) undersöktes på nytt i onödan
- Övrigt från session 21 kvarstår: FAS 3–5 (#297–#299), stashad lokal drift sedan session 20

---

### Session 21 — 2026-07-24
**What was done:**
- Såg över SMHI-källan på användarens begäran — upptäckte att `SmhiApiIngestor` (Id=10, vädervarningar) aldrig levererat data sedan den byggdes i session 12–13
- Rotorsak: fel/utgången API-URL (`api/version/2/warnings.json`, hård 404 på hela subdomänen från Varnish) — inte "inga aktiva varningar" som antogs i session 15. Rätt endpoint hittad genom att prova varianter live: `https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json` (200 OK)
- Verifierade live mot skarp SMHI-data att JSON-strukturen matchar de befintliga DTO:erna nästan exakt, inkl. `descriptions[]` med `title.code` (INCIDENT/AFFECT/WHERE/COMMENTS) — precis det strukturerade "Vad ska jag tänka på?/Var?"-format användaren efterfrågade
- PR #344 (`fix/smhi-warnings-api-url`): rättade URL:en, lade till `approximateEnd` i DTO:n och en genererad "När?"-rad (svensk tid, Europe/Stockholm, infogad före "Var?"), förenklade titeln till bara händelsenamnet (t.ex. "Risk för skogsbrand" istället för "... — Meddelande varning")
- Testade ändringen mot ett fristående testprogram laddat med skarp SMHI-JSON — output matchade användarens exempel nästan ordagrant
- Klargjorde för användaren varför två SMHI-källor finns: `SmhiApiIngestor` (strukturerade varningar) byggdes men fick aldrig rätt URL, så "SMHI Nyheter" (redaktionellt RSS-flöde, `smhi.se/rss/nyheter-fran-smhi`) lades till som stopgap i session 15 och publicerades i session 18. Bådas behålls (olika syften: kontext vs. åtgärdbar varning) — beslutat med användaren via fråga
- PR #346 (`fix/smhi-warning-area-id-type`): akut hotfix efter att Railway-loggarna visade `JsonException` på varje ingest-tick — `SmhiWarningArea.Id` var deklarerad som `string?` men SMHI:s JSON skickar den som tal (`"id": 9873`). Fanns redan innan PR #344 men triggades aldrig eftersom fel URL gjorde att JSON-parsningen aldrig nåddes. Verifierat genom att köra hela DTO-uppsättningen (inte en förenklad kopia) mot alla 16 aktuella varningar
- Kodgranskning av PR #347 (`/code-review`, hög nivå): rent lockfile-diff, inga applikationskodfynd. Två mindre anmärkningar — `brace-expansion@5.0.8` tappar Node 18 ur sitt `engines`-fält (inget aktivt problem, CI kör Node 20), och ett faktafel i PR-beskrivningen (postcss-versionen jag angav stämde inte) — rättat i efterhand
- PR #347 (`chore/npm-audit-fix-dev-deps`): `npm audit fix` för tre dev-dependency-sårbarheter (`brace-expansion` 5.0.6→5.0.8 hög, `postcss` 8.5.15→8.5.23 hög, `@babel/core` 7.29.0→7.29.7 låg). `react-router` (hög, RSC Mode CSRF, GHSA-qwww-vcr4-c8h2) medvetet lämnad — kräver major-uppgradering till v8, appen använder inte RSC-läge
- CI-fix i samma PR: `Security audit`-steget (`npm audit --omit=dev --audit-level=high`) blockerade på just den kända react-router-sårbarheten eftersom `react-router-dom` är en produktionsdependency (`--omit=dev` filtrerar inte bort den). La till en riktad grep-baserad undantagslogik i `.github/workflows/ci.yml` som bara accepterar GHSA-qwww-vcr4-c8h2 specifikt — nya oväntade höga sårbarheter fångas fortfarande. Testat lokalt mot både skarp och simulerad audit-output innan push

**Problem och lösningar denna session:**
- Den ursprungliga slutsatsen i session 15 ("404 = inga aktiva varningar, sommar i Sverige") hade aldrig testats mot om *andra* paths på samma subdomän också 404:ar — de gjorde det, vilket avslöjade att det var fel URL, inte tomt resultat. Lärdom: ett 404 som tolkas som "korrekt tomt svar" bör verifieras mot leverantörens dokumentation eller alternativa endpoints innan det antas vara avsiktligt beteende
- "Länken visar bara en pytteliten bild"-klagomålet på SMHI Nyheter visade sig bero på att SMHI:s egen artikel för den specifika vattenbrist-nyheten är tunn (mest ett diagram) — inget vi kan åtgärda utan att bryta grundprincipen "ingen tolkning, alltid länk till primärkälla"
- Ett eget fristående testprogram (PR #344) missade `SmhiWarningArea.Id`-typfelet eftersom `id`-fältet av misstag uteslöts ur den förenklade test-DTO:n — löst i uppföljningen (PR #346) genom att köra den *fullständiga*, verbatim-kopierade DTO-uppsättningen mot skarp data istället för en förenklad variant. Lärdom: ett test som bygger en egen förenklad kopia av produktionstyperna kan dölja precis den typen av fel det är tänkt att fånga
- CI-workflowens `paths`-filter (`Samhallsinformation/frontend/**`) gjorde att react-router-sårbarheten legat olöst på `main` sedan den publicerades utan att synas, eftersom ingen frontend-PR hade körts sedan session 20 — upptäcktes bara för att PR #347 råkade röra frontend

**Etablerat mönster:**
- Vid en källa som ger oväntat tomt resultat (404/tom lista): verifiera alltid mot flera paths på samma domän eller leverantörens dokumentation innan "tomt är korrekt" antas — annars kan en trasig URL gömma sig bakom antagandet i flera sessioner (skedde här i ~8 sessioner, 12→21)
- Testprogram som verifierar parsningslogik mot skarp extern data bör alltid använda de *faktiska* DTO-klasserna (kopia eller referens), aldrig en förenklad egen variant — annars testar man inte det man tror man testar

**Next session (Session 22):**
- Verifiera SMHI-varningarna i sandlådan (Förhandsvisning i admin) mot Railway-backend, publicera källan (Id=10) när det ser bra ut
- React Router v8-migrering: egen genomgång av breaking changes, ta bort CI-undantaget för GHSA-qwww-vcr4-c8h2 när den är klar
- FAS 3: Google OAuth (#297) — beror på Fas 2 (klar)
- FAS 4: Källprenumerationer + geografifilter per källa (#298) — uttryckligen "kärnan i kontokonceptet", beror på Fas 1–2 (klara)
- FAS 5: Konto-sida, radera konto, GDPR-export (#299)
- Eventuellt: bygg en formell `ProtectedRoute`-wrapper (skippad medvetet i session 20)
- Ta ställning till den stashade lokala `package-lock.json`-driften och `.vscode/`/`Properties/`-filerna (ligger i `git stash` sedan session 20)

---

### Session 20 — 2026-07-18
**What was done:**
- Diskuterade om projektet borde byggas om till Clean Architecture — landade i en pragmatisk "CA-light"-ansats (lagerindelade mappar i samma projekt, inte separata assemblies) istället för fullskalig CA, given projektets storlek och att det är en ensam utvecklare
- Gick igenom hela GH-backloggen (85 issues) och läste in full text på Sprint 5 "Auth & Settings" (FAS 1–5, #295–#299) för att förankra arkitekturbeslutet i faktisk kommande komplexitet
- **FAS 1** (PR #336, mergad): backend-auth med refresh-tokens byggd som första CA-light-referensvertikal
  - Nya mappar `Application/Auth/` (`IAuthService`, `AuthService`, `AuthResult`, `ITokenService`) och `Infrastructure/Auth/` (`JwtTokenService`)
  - Ny `RefreshToken`-entitet + migration, SHA-256-hashad lagring, rotation vid varje `/api/auth/refresh`-anrop
  - Access-token-livslängd 30 dagar → 15 minuter
  - Nya endpoints: `POST /api/auth/refresh`, `POST /api/auth/logout`
  - `AuthController` gjord tunn, `IPasswordHasher<User>` injiceras nu via DI istället för `new PasswordHasher<User>()`
  - Nytt testprojekt `backend.Tests` (xUnit + NSubstitute + EF Core InMemory) — första testprojektet i repot, 8 tester för `AuthService`
- **FAS 2** (PR #337, mergad): `AuthContext.tsx` uppdaterad för `accessToken`/`refreshToken`, schemalagd auto-refresh (~2 min innan access-token går ut), riktig `/api/auth/logout`-anrop vid utloggning
  - Upptäckte att det mesta av Fas 2:s checklista (`/login`, `/register`, `/forgot-password`, `/reset-password`, logout-knapp, inline skyddad routing i `AdminPage`/`ProfilePage`) redan fanns sedan tidigare sessioner — bara `AuthContext` behövde fixas
  - Skippade medvetet en formell `ProtectedRoute`-wrapper (fanns på #296:s checklista) — befintliga inline-guards fungerar redan
- Mergade 5 öppna Dependabot-PR:ar (#328–#332): eslint, eslint-plugin-react-refresh, react-router-dom, @eslint/js, @tailwindcss/vite — alla patch/minor, grön CI
- Städade bort 4 lokalt mergade branches (`feat/fas1-auth-refresh-tokens`, `feat/fas2-auth-token-refresh`, `feat/kundtjanstbot-widget`, `feat/nyheter-chatt-hjalp`)
- Verifierade att inget annat är kritiskt: inga öppna `bug`-taggade issues, bara ett Dependabot-alert med low severity (`@babel/core`)

**Problem och lösningar denna session:**
- **Breaking change utan matchande frontend-fix:** Fas 1:s svarsfältbyte (`token` → `accessToken`/`refreshToken`) mergades separat från Fas 2 → admin-inloggningen bröts live i produktion. `AuthContext` läste `data.token` som blev `undefined`, vilket gjorde `isLoggedIn` sant (`undefined !== null`) trots trasig token, medan `parseRole` tyst föll tillbaka till `'Användare'`. Löst med akut-PR #337. Lärdom: släpp aldrig en backend-kontraktsändring utan den matchande minimala frontend-fixen samtidigt.
- Samma SQLite-genererade `HasColumnType("TEXT")`-problem som i session 19 dök upp igen, nu för `AddRefreshTokens`-migrationen — löst med samma etablerade mönster (raw-SQL-block i `Program.cs` + markera migrationen som körd i `__EFMigrationsHistory` innan `MigrateAsync()`)
- CORS blockerade test av produktions-API från en lokal dev-port (5183) som inte fanns i Railways `ALLOWED_ORIGINS` ("Failed to fetch") — löste genom att testa mot lokal backend istället för att ändra produktionens CORS-config
- Lokal `ResendEmailService` kraschade vid varje auth-endpoint lokalt pga saknad `RESEND_API_KEY` — löst med en dummy-nyckel vid lokal körning
- Kvarhängande dev-serverprocess höll kvar portarna 59848/59849 efter omstart, `pkill` matchade inte processen i Git Bash på Windows — löste genom att hitta PID via `netstat -ano` och döda den via PowerShell `Stop-Process`
- Sedan tidigare oincheckad lokal drift i `package-lock.json` samt oincheckade `.vscode/`- och `backend/Properties/`-filer blockerade `git pull` efter Dependabot-mergeserna — löst med `git stash -u` (finns kvar i stash, inte borttaget)

**Etablerat mönster:**
CA-light-lagerindelning (`Application/<domän>/`, `Infrastructure/<domän>/` som mappar i samma .NET-projekt, inte separata assemblies) introducerad som mönster för nya verticaler, med Auth som referens. Vid nya EF Core-migrationer skapade lokalt mot SQLite: förvänta `HasColumnType("TEXT")` för Guid/DateTime-kolumner i snapshotten, och lägg alltid till ett matchande raw-SQL-block i `Program.cs` (samma mönster som `AddUserSystem`/`AddPasswordResetToken`/`AddRefreshTokens`) innan det når produktion.

**Next session (Session 21):**
- FAS 3: Google OAuth (#297) — beror på Fas 2 (klar)
- FAS 4: Källprenumerationer + geografifilter per källa (#298) — uttryckligen "kärnan i kontokonceptet", beror på Fas 1–2 (klara)
- FAS 5: Konto-sida, radera konto, GDPR-export (#299)
- Eventuellt: bygg en formell `ProtectedRoute`-wrapper (skippad medvetet denna session) om det känns motiverat
- Ta ställning till den stashade lokala `package-lock.json`-driften och `.vscode/`/`Properties/`-filerna (ligger i `git stash`)

---

### Session 19 — 2026-06-30
**What was done:**
- Felsökte och åtgärdade PostgreSQL-krasch (42804) vid backend-start efter PR #321-merge
- Rotorsak: SQLite-genererade migrationer skriver `HasColumnType("TEXT")` i Designer.cs-snapshot. EF Core använder snapshot — inte `Up()`-metoden — för att bestämma kolumntyper vid körning. `Users.Id` var `text` och nya `UserId`-kolumner skapades som `text`; efter DO-block-konvertering av `Users.Id` till `uuid` kraschade FK text→uuid.
- PR #323: DO-block i migrationen för att konvertera `Users.Id` text→uuid
- PR #324: tog bort explicit `type: "TEXT"` från Guid-kolumner i migrationen (hjälpte inte — snapshot vinner)
- PR #325: flyttade `Users.Id`-konverteringen till före `MigrateAsync()` i Program.cs (hjälpte inte — tabellerna skapades fortfarande med TEXT)
- PR #326 (definitiv fix): kör `AddUserSystem` och `AddPasswordResetToken` som raw SQL i Program.cs med korrekta PostgreSQL-typer (`uuid`, `timestamptz`, `boolean`) och markerar dem i `__EFMigrationsHistory` — `MigrateAsync()` hoppar sedan över dem

**Problem och lösningar:**
- 4 PRs krävdes för att lösa ett enda migrationsproblem pga att EF Core/Npgsql beter sig annorlunda än förväntat med SQLite-genererade migrationer mot PostgreSQL

**Inga UI-ändringar** — hela sessionen var backend/migrationsfix

**Next session (Session 20):**
- Faktisk inloggning och kontoregistrering i UI: testa hela flödet login → register → lösenordsåterställning end-to-end
- Koppla profilsidan (KontoInfo, LösenordByte) mot `GET/PUT /api/auth/me`
- Ersätt `useSourceOrder` localStorage-hook med `GET/PUT /api/user/sources`
- Synliga login/register-knappar i sidebaren när flödet känns stabilt
- Planerad kodgenomgång: hela stacken, vad varje del gör och varför

---

### Session 18 — 2026-06-30
**What was done:**
- SMHI Nyheter aktiverad (IsPublished=true) via admin — nu 6 aktiva källor live
- Genomgång av hela användarsystemet: beslutade tabellstruktur, auditlogg, notisleveranslogg, DB som enda källan till sanning (ingen localStorage för inställningar)
- Resend uppsatt: domän `samhallsinformation.se` verifierad via Cloudflare auto-configure, API-nyckel skapad med Sending access, `RESEND_API_KEY` + `FRONTEND_URL` inlagda i Railway
- PR #321 (feat/auth-login-register): fullt login/register-flöde med e-post och lösenordsåterställning

**Backend (PR #321):**
- `POST /api/auth/register` — skapar konto, hashar lösenord, seedar `UserSourcePreference` med alla aktiva källor, skickar välkomstmejl
- `PUT /api/auth/me` + `/me/password` — uppdatera profil och byta lösenord, allt loggas i `UserSettingAuditLog`
- `GET/PUT /api/user/sources` — källordning och aktiv/inaktiv per användare
- `POST /api/auth/forgot-password` + `/reset-password` — återställningstoken (1 h giltighetstid), mejl via Resend
- `IEmailService` + `ResendEmailService` — `noreply@samhallsinformation.se`, välkomst- och återställningsmejl
- Nya modeller + migrationer: `UserDevice`, `UserSourcePreference`, `UserNotificationSetting`, `UserDoNotDisturbSchedule`, `UserSettingAuditLog`, `NotificationDeliveryLog`, `PasswordResetToken`

**Frontend (PR #321):**
- `/login` — inloggning med länk till register och glömt lösenord
- `/register` — skapa konto med länk tillbaka till login
- `/forgot-password` — ange e-post, visa bekräftelse
- `/reset-password?token=` — sätt nytt lösenord, redirect till login efter 3 s
- `register()` tillagd i `AuthContext`
- `AdminPage` redirectar till `/login?redirect=/admin` om ej inloggad
- Inga synliga knappar i UI — sidorna nås via direktlänk tills vidare

**Problem och lösningar denna session:**
- CI-fel: `FormEvent` måste importeras med `import { type FormEvent }` pga `verbatimModuleSyntax` — fixat i alla fyra auth-sidor

**Etablerat mönster:**
DB är källan till sanning för alla användarinställningar — ingen localStorage för inställningar. `UserSettingAuditLog` loggas automatiskt vid varje inställningsändring med tidsstämpel, gammalt/nytt värde och vem som ändrade.

**E-posttjänst:**
- Resend med domän `samhallsinformation.se` (eu-west-1, Cloudflare)
- `noreply@samhallsinformation.se` för transaktionsmejl
- `support@samhallsinformation.se` reserverad för framtida ticket-notiser

**Next session (Session 19):**
- Koppla profilsidan mot riktigt backend-data (KontoInfo, LösenordByte)
- Koppla källordning (drag-and-drop) mot `GET/PUT /api/user/sources` istället för localStorage
- Synliga knappar för login/register när flödet känns stabilt
- Användare-sektionen i admin mot riktigt API

---

### Session 17 — 2026-06-29
**What was done:**
- FAQ-admin kopplad mot användarsidan via delad localStorage (PR #317): ny `faqStorage.ts` med `laddaFaq()` / `sparaFaq()` + `INITIAL_FAQ`. `AdminFaq` initieras från localStorage och sparar vid varje toggle/spara/ta bort. `FaqKort` läser från samma `laddaFaq()` och renderar enbart frågor med `publicerad: true`.
- Felsökning källkontroller live (PR #319): källlistan hämtar från `fetchAdminSources` (delar query-cache med Källhantering). Toggle Aktiv skriver via `updateAdminSource`. Testa-knappen kör riktig `dryRunSource` och visar faktiska händelseantal i pipeline-trace. `senastHämtad`/`färskhetStatus` beräknas från `lastFetchedAt`, auto-refresh var 60 s. Mock-toggle (inget backend-stöd) borttagen.

**Problem och lösningar denna session:**
- Fältnamn-mismatch: `AdminFaqItem` använder `fråga`/`svar`, `FaqKort` använde `q`/`a` (gamla `FaqItem`-typen). Löst genom att `FaqKort` nu importerar `AdminFaqItem` och refererar `item.fråga`/`item.svar` direkt.

**Etablerat mönster:**
Delad localStorage-modul för feature-data: en fil med `INITIAL_FAQ`, `laddaFaq()` (läser → parser → mergar nyinlagda poster), `sparaFaq()`. Admin skriver, användarsida läser. Gör att admin-ändringar slår igenom utan backend.

**Vad som fortfarande är mock i Felsökning:**
- Systemhälsa (ping-simulering — kräver `/api/health`-endpoint)
- Kommande kontroller, Kontrollhistorik, Felloggar (kräver scheduler/logging-backend)

**Next session (Session 18):**
- Koppla källordning mot användarkonto när backend-profiler (Issue #298) byggs
- Login-flödet: `/login`-sida, skyddade routes, auto-refresh av JWT
- Aktivera SMHI Nyheter via admin (IsPublished=true) efter verifiering

---

### Session 16 — 2026-06-29
**What was done:**
- FAQ publicera/dölj-toggle (PR #309): toggle-pill i admin-tabellraden (grön "Publicerad" / grå "Dold"), opublicerade rader dimmas visuellt, nytt stat-kort "Publicerade", FaqKort filtrerar bort opublicerade frågor för användaren
- Centrera FAQ-kort (PR #310): FAQ renderas med `max-w-2xl` centrerat när systemstatus-flaggan är av — i grid med båda aktiva som förut
- Nytt-pill på källknapp (PR #311): uppgraderade oläst-indikatorn från liten prick till "Nytt"-pill, gated bakom `isLoggedIn`
- Drag-and-drop källsortering (PR #312): installerade `@dnd-kit/core` + `@dnd-kit/sortable`, ny `useSourceOrder`-hook (sparar i localStorage, hanterar nya källor automatiskt), `SortableSourceButton` med 6-punkts grip-handtag (visas vid hover), bara för inloggade. CI-fix: bytte `npm ci` → `npm install` pga cross-platform optional deps (Windows genererar inte `@emnapi/core`/`@emnapi/runtime` i lock-filen)
- Mobil header-fix (PR #313): "Markera alla som lästa"-texten gömd på mobil, pillet självt klickbart som ersättning

**Problem och lösningar denna session:**
- FAQ `replace_all` ersatte variabeldeklaration: `const FAQ_ITEMS` döptes om till `PUBLICERADE_FAQ` + filter skapade en andra `const PUBLICERADE_FAQ` → dubbeldeklaration → TypeScript-fel. Löst med separat namn på arrayen.
- CI `npm ci` kraschade med `Missing: @emnapi/core@1.11.1` — Windows npm installerar inte Linux-specifika optional deps i lock-filen → `npm ci` på Linux kräver dem. Bytte till `npm install` i CI-workflowen.
- Oanvänd `group`-variabel i utloggad källlista (TS6133) — löst med `.keys()` istället för `.entries()`.

**Etablerat mönster:**
Drag-and-drop med `@dnd-kit`: ge varje item ett `id` (shortName), använd `arrayMove` på `DragEndEvent`, spara till localStorage direkt. Separera drag-handtag (egna listeners) från klickbar knapp så att klick och drag inte konfliktar.

**Next session (Session 17):**
- Koppla källordning mot användarkonto när backend-profiler (Issue #298) byggs
- Login-flödet: `/login`-sida, skyddade routes, auto-refresh av JWT
- Aktivera SMHI Nyheter via admin (IsPublished=true) efter verifiering

---

### Session 15 — 2026-06-29
**What was done:**
- Diagnostiserade varför SMHI inte levererade data: varnings-API:et returnerar 404 när inga aktiva varningar finns (korrekt beteende, sommar i Sverige)
- SMHI Nyheter (PR #304): seedade `https://www.smhi.se/rss/nyheter-fran-smhi` som kompletterande RSS-källa (IsPublished=false, activeras via admin)
- IsPublished-bugfix (PR #304): seed-loopen uppdaterade `IsPublished` från koden vid varje Railway-restart → admin-ändringar nollställdes. Fixat — `IsPublished` skrivs nu bara vid initial insert
- Multi-feed-stöd per myndighet (PR #305): sidebaren grupperar nu källor per `shortName` — en knapp per myndighet oavsett antal feeds. Backend fick ny `?shortName=`-filter i EventsController. Frontend: `selectedSourceId` → `selectedShortName` i App → Sidebar → NewsFeed
- Bakåtkompatibilitetsfix (PR #306): Railway deployade ny backend men Vercel hade inte hunnit deploya ny frontend → `?source=<id>` ignorerades → alla händelser visades oavsett källval. Backend stödjer nu båda parametrarna tills Vercel är i kapp
- Nyheter-sidan uppdaterad: ny post "SMHI är tillagd som källa" med förbättrings- och fixat-entries

**Problem och lösningar denna session:**
- SMHI 404: korrekt beteende (inga aktiva varningar) — löstes med kompletterande nyhets-RSS
- IsPublished resetades vid varje backend-deploy: `existing.IsPublished = source.IsPublished` togs bort från update-path i seed-loopen
- Två "SMHI"-knappar i sidebaren: Railway och Vercel deployade i otakt → gammal frontend + ny backend pratade inte samma språk. Bakåtkompatibilitetsfix i backend löste akutproblemet
- PR #305 missade OmPage, ProfilePage och UppdateringarPage som också använde gamla `selectedSourceId`-prop → CI-fel → fixades i uppföljande commit

**Etablerat mönster:**
Multi-feed per myndighet: ge alla feeds från samma organisation samma `shortName` i databasen. Sidebaren grupperar automatiskt, backend filtrerar med `?shortName=` och hämtar alla sourceIds för gruppen. Ingen databasändring krävs vid nya feeds.

**Next session (Session 16):**
- Aktivera SMHI Nyheter via admin (IsPublished=true) efter verifiering i sandlådan
- Verifiera att "SMHI"-knappen i sidebaren visar händelser från båda feeds korrekt
- Eventuellt: städa bort bakåtkompatibilitets-`?source=`-parametern när Vercel är stabilt deployad

---

### Session 14 — 2026-06-24
**What was done:**
- Sidebar UX-förbättringar baserade på feedback från senior utvecklare (PR #279):
  - Om, Nyheter och Feedback flyttade direkt under källlistan med subtil avgränsare — scrollar med källorna om de blir många
  - Färgswatchar (4 teman) ersatta med sol/måne-toggle för mörkt/ljust läge
  - Toggle flyttad till headerraden bredvid centrerad Samhällsinfo-logotyp
  - Om och Nyheter-knappar framhävda i mörkt läge (`dark:bg-slate-600`) — fixade CSS-specificitetskonflikt i `index.css`
  - Filterbar döljs helt om flödet bara innehåller en allvarlighetsgrad
- Mockdata uppdaterad med alla 6 live-källor och representativa händelser (Folkhälsomyndigheten, Livsmedelsverket, Läkemedelsverket, Trafikverket)
- Folkhälsomyndighetens kortnamn ändrat till fullständigt "Folkhälsomyndigheten"
- Nyheter-sidan uppdaterad (PR #280): ny post "Förbättrad sidmeny", tematext ändrad från fyra teman till mörkt/ljust-toggle

**Problem och lösningar denna session:**
- `dark:bg-slate-600` hade ingen effekt — `html.dark .bg-slate-100` i `index.css` har högre CSS-specificitet och överskriver Tailwinds `dark:`-prefix. Löst med explicita regler i `index.css` för de nya dark-klasserna.
- Knappar hamnade längst ned i sidebar (inte direkt under källorna) — `flex-1` på källlistan tog all höjd. Löst genom att lägga hela innehållsytan i en scrollbar `flex-1 overflow-y-auto`-container och ha profilknappen utanför.

**Etablerat mönster:**
I detta projekt har `index.css` manuella dark-mode-overrides med högre specificitet än Tailwinds `dark:`-prefix. Vid nya dark-mode-klasser: lägg alltid till en explicit regel i `index.css` på formen `html.dark .dark\:bg-[klass] { ... }`.

**Next session (Session 15):**
- Genomgång av sandlådan live mot Railway-backend
- SMHI-ingestor: hitta rätt warnings-endpoint och bygg SmhiApiIngestor

---

### Session 13 — 2026-06-19
**What was done:**
- Sandlåda (PR #277): ny admin-sektion med två flikar
  - Förhandsvisning: visar händelser från IsActive=true + IsPublished=false källor (redan ingestade, dolda för besökare)
  - Testa källa: dry-run av valfri RSS-URL via GenericRssIngestor utan att spara till DB
- TestingController: GET /api/admin/testing/preview och POST /api/admin/testing/dryrun — JWT Admin-roll krävs
- NewsItem: länktext "Se trafikläget hos Trafikverket" visas när URL innehåller "trafikinformation" (Trafikverkets fallback-URL)

**Problem och lösningar denna session:**
- Inga tekniska problem — backend och frontend byggde rent från start

**Etablerat mönster:**
Sandlådan är det naturliga testverktyget för alla nya ingestors. Flödet: lägg till källa med IsActive=true + IsPublished=false → se händelser i Förhandsvisning → när det ser bra ut, publicera.

**Next session (Session 14):**
- Genomgång av sandlådan live (se att Förhandsvisning och Testa källa fungerar mot Railway-backend)
- SMHI-ingestor: hitta rätt warnings-endpoint och bygg SmhiApiIngestor (sandlådan används för att testa innan publicering)
- Eventuellt: koppla "Testa källa"-knapp direkt från källhanteringen för smidigare workflow

---

### Session 12 — 2026-06-17
**What was done:**
- Trafikverket-ingestor: fullständig fix och live (PR #267, #268, #269, #270)
  - Schemaversion 1.2 → 1.6 (rätt version per dokumentationen)
  - API v1 → v2
  - Lagt till `namespace="road.trafficinfo"` — detta var rotorsaken till "ObjectType does not exist"
  - `StartTime` flyttad från `TvSituation` till `TvDeviation` (rätt nivå i datamodellen)
  - `PublicationTime` används nu som `PublishedAt` (istället för `StartTime` som kan vara i framtiden)
  - Filtrerar bort `Deleted` och `Suspended` händelser
  - Titel: `Header` → `MessageCode` (svenska) → `MessageType` som fallback
  - URL: `WebLink` från API, fallback till Trafikverkets trafiksida
  - Geografi: länsnamn + vägnummer (t.ex. "Västra Götaland Väg 570")
  - `SeverityCode` justerad: 5=Kritisk, 4=Viktigt (dokumenterade värden är 1,2,4,5)
- Livsmedelsverket: URL uppdaterad i admin till `/rss/rss-aterkallanden/`
- Läkemedelsverket: URL uppdaterad i admin till Atom-flöde `/api/newslist/newsrss?query=&pageTypeId=1&from=&to=` — fungerar och artiklarna flödar in
- SMHI: hittade rätt API (vädervarningar med RED/ORANGE/YELLOW nivåer) men inte rätt endpoint-URL än — fick 404

**Problem och lösningar denna session:**
- Trafikverket "ObjectType does not exist": rotorsaken var saknad `namespace="road.trafficinfo"` i QUERY-elementet — gäller sedan mars 2026 enligt Trafikverkets portal
- Trafikverket framtida datum i flödet: `StartTime` kan vara i framtiden (planerade arbeten) → bytte till `PublicationTime` som `PublishedAt`
- "roadworks" på engelska: `MessageCodeValue` är engelska, `MessageCode` är svenska — bytte fallback-ordning

**Etablerat mönster:**
Trafikverkets Situation-API (v2): kräver `namespace="road.trafficinfo"` och `schemaversion="1.6"` i QUERY-elementet. Utan namespace → "ObjectType does not exist".

**Next session (Session 13):**
- Hitta rätt SMHI warnings endpoint-URL och bygg `SmhiApiIngestor`
- Trafikverket länktext: ändra "Läs mer hos källan" → "Se trafikläget hos Trafikverket" (frontend)
- `/testing`-sida: JWT-skyddad förhandsgranskningsvy för opublicerade källor
- Verifiera att Livsmedelsverket återkallanden-flöde hämtar data

---

### Session 11 — 2026-06-15
**What was done:**
- PR #260: fix för `IsPublished`-boolean-konvertering i PostgreSQL — `ALTER COLUMN TYPE` kraschar när kolumnen har ett `DEFAULT`-värde av fel typ. Löst med DROP DEFAULT → ALTER TYPE → SET DEFAULT (true)

**Problem och lösningar denna session:**
- Server kraschade med `42804: default for column "IsPublished" cannot be cast automatically to type boolean` — PostgreSQL kan inte casta INTEGER DEFAULT (1) till boolean automatiskt. Måste droppas explicit innan ALTER TYPE.

**Etablerat mönster:**
Vid `ALTER COLUMN TYPE` i PostgreSQL: om kolumnen har DEFAULT av fel typ → DROP DEFAULT → ALTER TYPE USING → SET DEFAULT (rätt typ). Gäller alla framtida boolean-fixar.

**Next session (Session 12):**
- Merge PR #260 (om inte redan mergad) och verifiera att Railway startar rent
- Uppdatera Livsmedelsverkets URL i DB via admin till `/rss/rss-aterkallanden/`, aktivera i testläge, verifiera i Railway-loggar
- Hitta och uppdatera Läkemedelsverkets rätta RSS-URL
- Trafikverket: verifiera API-nyckelns behörighet i Trafikverkets developer portal
- Zoho Mail (`info@samhallsinformation.se`)
- SMHI-ingestor

---

### Session 10 — 2026-06-15
**What was done:**
- Trafikverket-ingestor: diagnostik av 400-fel — response body loggas nu vid fel (PR #252, #253)
- Trafikverket objecttype: testade `Situation` (v2) → `TrafficSituation` (v2) → `Situation` (v1) — alla avvisas med "does not exist", API-nyckelns behörighet oklar (PR #254, #257)
- Sidebar: fix navigationsbugg — klick på källa från `/om` och `/uppdateringar` navigerade till startsida utan vald källa (PR #247)
- Sidebar: Adminpanel-länk visas för admin-inloggade direkt i inställningssektionen (PR #255)
- JWT-autentisering: `/admin`-routen var gömd bakom `VITE_ADMIN_ENABLED`-flagga som aldrig sattes i Vercel → sidan var blank. Flaggan borttagen, auth-guard i AdminPage via JWT-roll istället (PR #256)
- GenericRssIngestor: detekterar HTML-svar och kastar beskrivande fel med Content-Type och URL (PR #253)
- Livsmedelsverket/Läkemedelsverket: returnerar HTML oavsett User-Agent — URL:erna i DB pekar på HTML-sidor, rätta RSS-URL:er hittade (t.ex. `/rss/rss-aterkallanden/`)
- `IsPublished`-flagga på Source: ersätter `IsTestOnly`-konceptet med tydligare semantik — Aktiv = ingestorn kör, Publicerad = synlig för besökare. Möjliggör testning av nya källor skarpt utan att exponera data (PR #258)
- Återkommande boolean-fix: `IsPublished` skapades som `INTEGER` av SQLite-migration, ALTER-block i Program.cs konverterar till `boolean` i PostgreSQL (PR #259)

**Problem och lösningar denna session:**
- `/admin` blank utan inloggning → `VITE_ADMIN_ENABLED` saknades i Vercel → borttagen, JWT-rollkontroll i AdminPage
- `ImpersonationBanner` unused → CI-fel → återlagd utan adminEnabled-gate (returnerar null när params saknas)
- Trafikverket 400: `objecttype="Situation"` och `"TrafficSituation"` avvisas båda — API-nyckelns behörighet troligen begränsad
- Livsmedelsverket/Läkemedelsverket HTML: URL:erna i DB är HTML-sidor, inte RSS-flöden — behöver uppdateras via admin till rätta URL:er
- `IsPublished` krasch: SQLite-migration → INTEGER, MigrateAsync kör innan DO-blocken → kolumnen förblev INTEGER → crash. Fixat med ALTER-block som kontrollerar fel typ (inte om saknas)

**Etablerat mönster för boolean-kolumner:**
DO-blocket ska kontrollera `data_type='integer'` och ALTER:a till boolean — INTE kontrollera om kolumnen saknas (migrationen hinner lägga till den som INTEGER först).

**Next session (Session 11):**
- Uppdatera Livsmedelsverkets URL i DB via admin till `/rss/rss-aterkallanden/` och verifiera med testläge
- Hitta och uppdatera Läkemedelsverkets rätta RSS-URL
- Trafikverket: verifiera API-nyckelns behörighet i Trafikverkets developer portal
- Zoho Mail (`info@samhallsinformation.se`)
- SMHI-ingestor

### Session 9 — 2026-06-15
**What was done:**
- Kuraterad källlista i admin: ersatte fri URL-inmatning med en lista över verifierade källkandidater — RSS-klara källor aktiveras med ett klick, API-källor visas med förklaringstext (PR #241)
- `GenericRssIngestor` hanterar de nya källorna utan koddeploy
- `fix/sources-id-sequence`: `Sources.Id` saknade PostgreSQL sequence (SQLite-annotation ignorerades vid migration) — INSERT av nya källor kraschade med NOT NULL violation. Löst med idempotent DO-block i `Program.cs` som skapar sequence vid första start (PR #242)
- Folkhälsomyndigheten, Livsmedelsverket och Läkemedelsverket aktiverade i produktion via admin
- CORS: lade till `http://localhost:5174` i Railway `ALLOWED_ORIGINS` för lokal testning mot Railway-backend
- `/uppdateringar`: ny entry "Tre nya myndigheter" tillagd

**Problem och lösningar denna session:**
- CORS blockerade POST från localhost:5174 → lade till i Railway ALLOWED_ORIGINS (CORS skyddar bara browsern, inte backend — ingen säkerhetsrisk)
- POST /api/admin/sources → 500: NOT NULL violation på Sources.Id → PostgreSQL hade ingen sequence eftersom InitialCreate-migration använde `Sqlite:Autoincrement`-annotation som PostgreSQL ignorerar → löst med DO-block i Program.cs

**Next session (Session 10):**
- Backend-auth: koppla AuthContext mot riktig autentisering (JWT)
- Zoho Mail: sätta upp `info@samhallsinformation.se`
- SMHI-ingestor (eget API-format, nästa naturliga källa)

### Session 8 — 2026-06-13
**What was done:**
- `samhallsinformation.se` live och verifierad — DNS propagerat, sidan fungerar
- SEO: meta description, canonical, Open Graph-taggar, Twitter Card-taggar i `index.html` (PR #236)
- `robots.txt`: tillåter alla crawlers, blockerar `/admin`, pekar på sitemap (PR #236)
- `sitemap.xml`: `/` (hourly, 1.0) och `/om` (monthly, 0.7) — `/profil` och `/admin` exkluderade (PR #236)
- `Source`-modellen: lade till `Url?` och `Category?` — migration `AddSourceUrlCategory` (PR #237)
- `GenericRssIngestor`: ny generisk ingestor som tar `Source` från DB och läser dess `Url`-fält — möjliggör nya RSS-källor utan koddeploy (PR #237)
- `IngestorBackgroundService`: skapar nu dynamiskt `GenericRssIngestor` för aktiva RSS-källor i DB som saknar dedikerad ingestor (PR #237)
- Admin-API: `GET /api/admin/sources` (med händelseräkning), `POST`, `PATCH`, `DELETE /api/admin/sources/{id}` (PR #237)
- `Kallhantering.tsx`: ersatte all hårdkodad mockdata med `useQuery` + `useMutation` mot backend-API (PR #237)
- LIVE/MOCK-badges: tydliga badges i admin-UI — grön "LIVE" på sektioner med riktig data, grå "MOCK" på hårdkodade sektioner; Status-kolumn markerad "(simulerat)" (PR #237)
- Tumregel etablerad: LIVE-badge = riktig data, ingen badge/MOCK = hårdkodad testdata
- `StatsController`: ny `GET /api/admin/stats` — totalEvents, eventsLast24h, activeSources, eventsByDay (7 dagar fyllda), eventsBySource, eventsBySeverity
- `Rapporter.tsx`: rewritten — LIVE-sektioner med riktig statistik, MOCK-badges på användare/notifikationer, "Besökare & trafik" Kort med länk till Google Analytics (PR feat/admin-rapporter)
- Aktivitetslogg + Felsökning: MOCK-badges tillagda för tydlighet
- `WelcomeModal`: visas vid första besök (localStorage `si_welcome_seen`), förklarar navigation inkl. swipe på mobil, försvinner permanent efter "Kom igång" (PR #238)
- `/uppdateringar`: publik changelog-sida med beskrivande titlar istället för semver, startar från live-datum — manuellt underhållen (PR #238)
- Sidebar: "Om" och "Nyheter" som två pills bredvid varandra (PR #238)
- `fix/database-url-parsing`: suppressar `PendingModelChangesWarning` i Railway-loggarna (PR #239)
- Gamla branches städade — 27 lokala branches raderade, bara `main` kvar
- Google Search Console: domän verifierad via Cloudflare, kopplad till GA4, sitemap `https://samhallsinformation.se/sitemap.xml` inskickad

**Problem och lösningar denna session:**
- Dependabot: 2 high-severity alerts på `flatted` (prototype pollution + DoS) — transitiv dev-dependency via ESLint, körs aldrig i produktion, ignoreras tills vidare
- `git stash`-behov vid pull: CLAUDE.md hade unstaged ändringar — löstes med stash/pull/pop-mönster
- Backend låst av bakgrundsprocess vid `dotnet build` → stoppades via PowerShell `Get-Process | Stop-Process -Force`

**Next session (Session 9):**
- Zoho Mail: sätta upp `info@samhallsinformation.se`
- Backend-auth: koppla AuthContext mot riktig autentisering
- Fler källor: nästa ingestor (MSB, SMHI eller liknande)

---

### Session 7 — 2026-06-12
**What was done:**
- Migration-fix: tog bort SQLite-specifika `type:`-strängar (TEXT/INTEGER) från `InitialCreate` och snapshot — EF Core väljer nu rätt typ per provider (PR #227)
- Smart migrationslogik: droppar bara tabeller om `__EFMigrationsHistory` saknas, sedan `MigrateAsync()` — data försvinner aldrig vid framtida deploys (PR #227)
- ALTER TABLE-fix: `DO $$`-block som en gång fixar bool/uuid/datetime-kolumner om de har fel typ från gammal migration — utan dataförlust (PR #228)
- EF Core-loggning: filtrerar SQL-kommandon till Warning-nivå, eliminerar ~500 logs/sek på Railway (PR #227)
- GA4 intern trafik: `traffic_type: 'internal'` sätts vid GA-init om `si_logged_in=true` i localStorage (PR #227)
- GA4 UI: Internal Traffic-filter aktiverat (Admin → Datafilter), schemalagda vecko- och månadsrapporter till Gmail (GA4 kräver Google-konto som mottagare)
- DNS: `www.samhallsinformation.se` fixad via Vercel Auto Configure — bytte CNAME från `cname.vercel-dns.com` till `3eefa53b97d41c65.vercel-dns-017c0m.` + TXT-post för verifiering
- Railway: bytt region från US West till EU West (användaren ändrade manuellt i Railway-inställningarna)
- Om-sida (`/om`): ny sida med info om tjänsten, principer, källor och integritetspolicy; länk i sidebaren ovanför feedback-knappen (PR #229)
- Swipe-fix: `preventScrollOnSwipe: true` + `passive: false` förhindrar native browser back-gesture; `select-none md:select-auto` förhindrar markörpil på mobil men behåller textmarkering på desktop (PR #229)
- FeedbackModal via `createPortal` till `document.body` — förhindrar att sidebars CSS-transform (translate) skapar stacking context som trapper `fixed`-modalen (PR #230)
- Om-knapp och Feedback-knapp: pill-knappar med ikon, `w-full justify-center` (PR #230)
- Polisen `ShortName`: ändrat från `"polisen.se"` till `"Polisen"` (konsekvent med Krisinformation) (PR #231)
- Mörkt läge som standard: ThemeContext default `true`; anti-FOUC inline-script i `index.html` sätter `dark`-klass synkront (PR #231)
- "Samhällsinfo"-färgfix: alltid violett i alla teman (förut `text-slate-900` som CSS-override färgade vit i dark mode) (PR #231)
- 4 teman: `true-black`, `dark`, `tan`, `light` — ThemeContext utökat med `theme/setTheme`; `data-theme`-attribut på `<html>` (PR #231)
- Tema-swatches: 4 färgcirklar längst ner i sidebaren med violett ring på aktivt tema (PR #231)
- ThemeKort på profilsidan: visar 4 klickbara rutor med temafärger (PR #231)
- GA4 `theme_change`-event skickas vid temabyte med `theme`-parameter — synligt under Händelser i GA4 (PR #231)
- `docs/ROADMAP.md` skapad med sprintstruktur: nuläge, Sprint 4 (SEO + fler källor), Sprint 5 (auth + notis), Sprint 6 (tillväxt) (PR #231)
- Polisen `ShortName` ändrat från `"polisen.se"` → `"Polisen"` — seeding fixad i `Program.cs` så befintliga rader uppdateras (inte bara add-if-missing) (PR #232)
- `lang="sv"` satt i `index.html` (var `lang="en"`) (PR #233)
- `favicon.svg` skapad i `public/` — lila (#7c3aed) rektangel med "S" (PR #233)
- `docs/kallor/OVERSIKT.md` utökad med 7 nya källkandidater: Folkhälsomyndigheten, Livsmedelsverket, Läkemedelsverket, SSM (alla RSS, V2 planerade), Jordbruksverket, Naturvårdsverket, Sjöfartsverket (V3, svår ingest) (PR #234)
- Admin-säkerhet diskuterad: `VITE_ADMIN_SECRET`-ansatsen avfärdad (VITE_-prefix = bundlas in i JS, läsbar för alla) — beslut: håll admin lokalt tills backend-auth finns
- Arkitekturplan för generisk RSS-ingestor diskuterad: en `RssIngestor` som läser URL från databasen istället för hårdkodade klasser — gör "Lägg till källa"-knapp möjlig för RSS-källor

**Problem och lösningar denna session:**
- `__EFMigrationsHistory` hade `InitialCreate` registrerad med SQLite-typer → smart check såg `alreadyMigrated = true` och hoppade över drop → INSERT krashade → löst med ALTER TABLE DO-block (PR #228)
- `www.samhallsinformation.se` visade SSL-fel efter DNS-byte → Vercel Auto Configure bytte CNAME till korrekt värde
- GA4 schemalagda rapporter kräver Google-konto som mottagare — `jocke.94@hotmail.se` fungerar inte direkt; rapporter skickas till Gmail
- FeedbackModal täckte bara sidebar och inte hela skärmen → CSS-transform på `<nav>` skapar stacking context som trapper `fixed` → löst med `createPortal`
- ThemeKort-komponenten använde det gamla `{ dark, toggle }`-gränssnittet → uppdaterad till `{ theme, setTheme }` när ThemeContext byttes till 4-tema-system

**Next session (Session 8):**
- Verifiera att `samhallsinformation.se` fungerar live (DNS bör ha propagerat)
- SEO: meta description, Open Graph-taggar, robots.txt, sitemap
- Admin källhantering → kopplad till riktig backend:
  1. Generisk `RssIngestor` som läser URL från DB (ersätter hårdkodade klasser för RSS-källor)
  2. `POST /api/admin/sources` + `PATCH /api/admin/sources/{id}` endpoints
  3. Källhantering-UI anropar riktigt API (inte mockdata)
- Admin rapportsida: snygg UI med faktisk data (händelsestatistik från backend, ev. GA4-integration)
- Zoho Mail: sätta upp `info@samhallsinformation.se`

---

### Session 6 — 2026-06-11
**What was done:**
- Mobilvy: Sidebar konverterad till slide-in drawer på mobil med hamburger-knapp i NewsFeed-headern (PR #196)
- Edge swipe: `react-swipeable` installerat, swipa höger från ≤30px vänsterkant öppnar sidebar, swipa vänster stänger (PR #196)
- Dark mode: `ThemeContext` läser nu `prefers-color-scheme` som fallback för alla användare; lyssnar på OS-ändringar dynamiskt; sparar bara manuellt val till localStorage (PR #196)
- Responsiv padding i header, filter och händelselista (`px-4 md:px-10`) (PR #196)
- Fixat Vercel-byggfel: `ProfilePage.tsx` saknades `isOpen`/`onClose` props till Sidebar (PR #196)
- GitHub CI-pipeline: `ci.yml` bygger och type-checkar frontend på varje PR mot main (PR #197)
- Dependabot: `dependabot.yml` skapar automatiska PR:ar för npm och NuGet varje vecka (PR #197)
- `npm audit --omit=dev --audit-level=high` i CI — ignorerar dev-beroenden som aldrig når produktion (PR #207)
- Mergat 15 Dependabot-säkerhets-PR:ar, inklusive react-router 7.13.1→7.17.0 som fixade majoriteten av sårbarheterna
- CodeQL ej tillgängligt på privat personligt repo (kräver GitHub Advanced Security för organisationer)
- Secret scanning ej tillgängligt av samma anledning; Dependabot alerts aktiverat och täcker det viktigaste
- Skapat `docs/kallor/OVERSIKT.md` med alla 8 källor, API-info, rate limits och licenser (PR #209)
- Skapat `docs/kallor/CHANGELOG.md` för att logga källändringar över tid (PR #210)
- Lagt till långsiktig vision i OVERSIKT.md: roadmap V1–V5 mot ~340 svenska källor, PSI-direktivet, datapartnerskap med myndigheter
- Lagt till långsiktig vision i PROJEKT.md: kommuner som manuella användare via ticket-funktion, "Ansök om att bli källa" får konkret syfte som B2G-onboarding-flöde

- Ändrat "Bra att veta"-filterflik och händelsepill från grå till sky-blå för tydligare visuell distinktion (PR #213)
- Lagt till `CookieConsent`-banner med accordion som visar vilken data som samlas in (nödvändiga vs analys); sparar val i localStorage (PR #213)
- Lagt till `FeedbackModal` via Formspree (ID: `xpqeyzjj`) kopplad till lila pill-knapp längst ner i sidebaren (PR #213)
- Lagt till `Npgsql.EntityFrameworkCore.PostgreSQL 10.0.*` i backend (PR #215)
- Uppdaterat `Program.cs`: PostgreSQL via `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` när `PGHOST` finns, annars SQLite; CORS via `ALLOWED_ORIGINS` env-var; `MigrateAsync()` vid start (PR #215, #216, #217)
- Skapat `Dockerfile` i `backend/` — Railway kan inte auto-detekta .NET 10 med Nixpacks (PR #215)
- Railway: skapat projekt `Samhallsinformation`, lagt till PostgreSQL-plugin, Root Directory satt till `Samhallsinformation/backend`
- Vercel: lagt till `VITE_API_URL=https://samhallsinformation-production.up.railway.app` och `VITE_USE_MOCK=false`; tvingad cache-fri redeploy för att baka in Vite env-vars (PR #218)
- Köpt domän `samhallsinformation.se` från Loopia (9 SEK/år)
- Lagt till `samhallsinformation.se` i Vercel Domains; A-record `216.198.79.1` och CNAME `www → 3eefa53b97d41c65.vercel-dns-017c0m.`
- Påbörjat Cloudflare-setup för gratis DNS (Loopia kräver betaluppgradering för DNS-redigering)

- Cloudflare DNS aktivt — Loopias nameservers bytta till `dante.ns.cloudflare.com` + `perla.ns.cloudflare.com`
- A-record `samhallsinformation.se → 216.198.79.1`, CNAME `www → cname.vercel-dns.com` (DNS only)
- `ALLOWED_ORIGINS` i Railway utökad med `https://samhallsinformation.vercel.app`, `https://samhallsinformation.se`, `https://www.samhallsinformation.se`
- Appen live med riktig data på `https://samhallsinformation.vercel.app` (PR #220–225)
- GA4 (G-CT3BYVS6JQ) med Consent Mode v2 — analytics blockeras tills cookie-samtycke ges (PR #223)
- Sidtiteln fixad från "frontend" till "Samhällsinformation" (PR #223)
- `globals.d.ts` tillagd för `window.gtag` TypeScript-typer (PR #223)

**Problem och lösningar denna session:**
- `Npgsql 9.0.*` kräver EF Core 9.x → uppgraderat till `10.0.*`
- Railway byggde från repo-roten och hittade inte Dockerfile → Root Directory satt till `Samhallsinformation/backend`
- Railway injicerar bara `DATABASE_URL` (URI-format), inte `PGHOST` → kod uppdaterad att parsa `DATABASE_URL` med `Uri`-klassen (PR #220)
- EF Core 10 kastar `PendingModelChangesWarning` — SQLite-migration vs PostgreSQL-provider → suppressad (PR #221)
- `InitialCreate`-migration har SQLite-specifika typer (INTEGER för bool) → EF Core kraschar vid INSERT → bytt till `EnsureCreated` för PostgreSQL, droppar tabeller vid redeploy (PR #222)
- `PublishedAt` skickades med `Kind=Local` → PostgreSQL kräver UTC → `.LocalDateTime` → `.UtcDateTime`, `DateTime.Parse` → `DateTimeOffset.Parse(...).UtcDateTime` (PR #224)
- Krisinformation API skickar `{0}`, `{1}` som ej interpolerade platshållare → ersatta med `[länk]` (PR #225)
- CORS blockerade `samhallsinformation.vercel.app` (produktions-URL) → ej med i `ALLOWED_ORIGINS` → tillagd
- `VITE_API_URL` saknades `https://`-prefix → URL byggdes fel → fixat i Vercel env-vars
- Loopia DNS kräver betaluppgradering → Cloudflare som gratis DNS-lösning
- `www.samhallsinformation.se` SSL-certifikat provisioneras — klart inom 30 min (Vercel hanterar automatiskt)

**Next session:**
- Verifiera att `https://samhallsinformation.se` och `https://www.samhallsinformation.se` fungerar
- **Migrationsfixen** — skriva om `InitialCreate` utan SQLite-specifika typer så `EnsureCreated`-hacket kan tas bort och data inte försvinner vid redeploy
- **Minska Railway-loggarna** — EF Core loggar varje SQL-query, 500 logs/sec är för mycket; sätt log level till Warning i produktion
- **Railway till Europa** — flytta från US West till Europe för bättre prestanda för svenska användare
- **Zoho Mail** — sätta upp `info@samhallsinformation.se`

---

### Session 5 — 2026-06-10
**What was done:**
- Frikopplat alla UI-funktioner från versionsstyrning (`versionAtLeast` borttagen från `App.tsx` och `Sidebar.tsx`)
- Etablerat tydlig rolldelning: versioner = rollback/deployment-spårning, feature flags = explicit aktivering av funktioner
- Skapat `src/lib/version.ts` (versionssystem) på egen branch
- Skapat `src/lib/featureFlags.ts`, `useFeatureFlags`-hook och `FeatureFlagsAdmin`-komponent på egen branch
- Kopplat in Feature flags-sektionen i admin-panelen (AdminSidebar + AdminPage)
- Löst merge-konflikt i `AdminPage.tsx` mellan rollvaljare- och feature-flags-brancherna
- Mergat PR #186 (version-gates), PR #187 (feature-flags), PR #188 (rollvaljare) till main
- Dolt inställningar och profilknapp i sidebaren för utloggade användare — visas bara när `isLoggedIn` är true (PR #189)
- Centrerat app-namnet "Samhällsinfo" i sidebaren (PR #190)
- Begränsat mockdata till V1-källor: Polisen + Krisinformation aktiva, övriga 6 inaktiva (PR #191)
- Lagt till `KrisinformationApiIngestor` mot `api.krisinformation.se/v3/news` (PR #192)
- Uppdaterat `IngestorBackgroundService` och `Program.cs` för stöd av flera ingestors
- Rensat 8 stale lokala branches (remote borttagna)
- Kombinerat flöde: "Samhällsinfo" klickbar → alla källor samlade sorterade på tid (PR #194)
- Färgad vänsterkant per källa (blå=Polisen, orange=Krisinformation), källnamn i grå text höger
- Datumseparatorer i prickad stil med "Idag 10 juni" / "Igår" / datum
- Filterbadges med pill-siffra, tomt-state vid tomma filterval
- Klockslag istället för datum på varje rad, geografi-duplikat borttaget
- "lästa"-separator gömd för utloggade + max en per lista
- "Samhällsinformation" som rubrik i stora ytan, separator under app-namn i sidebar
- Mockdatum uppdaterade till juni 2026

**Next session:**
- Google Analytics
- Hosting: Neon PostgreSQL + Railway (BE)
- Koppla frontend mot live-backend (VITE_USE_MOCK=false)

---

### Session 4 — 2026-02-16
**What was done:**
- Sprint 3 completed: Storage & API
- Converted project from Console app to ASP.NET Core Web API
- Added Entity Framework Core with SQLite provider
- Created `AppDbContext` with `Events`, `Sources`, and `UserPreferences` tables
- Indexed `ExternalId`, `Geography`, `PublishedAt` for performance
- Created `IngestorBackgroundService` — runs every 5 min, fetches events, deduplicates by `ExternalId` (#9, #11)
- Created `EventsController` — `GET /api/events` with filtering (geography, source, date, national, pagination) and `GET /api/events/{id}` (#10)
- Created `SourcesController` — `GET /api/sources`
- Created `PreferencesController` — full CRUD for user notification preferences (#12)
- Created `UserPreference` model with geography/source/severity filters
- Added `IngestedAt` timestamp to `CanonicalEvent`
- Added `.gitignore` for SQLite database files
- Verified: 200 live Polisen events fetched, deduplicated, and queryable via API

**Next session:**
- Start Sprint 4: Notifications & UI
- Send notifications based on user preferences (#13)
- View events on a clean web UI (#15)

---

### Session 3 — 2026-02-12
**What was done:**
- Sprint 2 completed: RSS ingestor for Polisen
- Created `IIngestor` interface for pluggable source types (#7)
- Implemented `PolisenRssIngestor` — fetches and parses live RSS into `CanonicalEvent` (#4, #5)
- Created `MetadataFallbacks` helper with geography/severity fallback logic (#6)
- Added `System.ServiceModel.Syndication` NuGet package for RSS parsing
- Updated `Program.cs` to fetch and display 200 live police events
- Geography extracted from title (last comma-segment), severity defaults to "Bra att veta"
- Merged PRs #17 (Sprint 2) and #18 (CLAUDE.md)

---

### Session 2 — 2026-02-12
**What was done:**
- Created CLAUDE.md with full project overview
- Set up GitHub Project Board ("Samhällsinformation Roadmap") linked to the repo
- Created 12 custom labels (user-story, use-case, feature, bug, infrastructure, sprint-1–4, priority levels)
- Created 14 issues across 4 sprints with user stories and use cases
- Added all issues to the project board with correct statuses
- Configured 9 board columns: Brainstorming, Backlog, Features, Todo, In Progress, In Review, Testing, Blocked, Done
- Sprint 1 issues closed (already completed), Sprint 2 set to Todo, Sprint 3–4 set to Backlog

---

### Session 1 — (Prior to CLAUDE.md)
**What was done:**
- Sprint 1 completed: CanonicalEvent, Source, Enums models created
- Basic folder structure established
- Test data verification in Program.cs

---

## GitHub Resources

* **Repo:** https://github.com/Jocke-1994/Samhallsinformation
* **Project Board:** https://github.com/users/Jocke-1994/projects/4
* **Labels:** user-story, use-case, feature, bug, infrastructure, sprint-1–4, priority:high/medium/low
* **Board Columns:** Brainstorming, Backlog, Features, Todo, In Progress, In Review, Testing, Blocked, Done

## Workflow Preferences

* Always create a new branch for new work
* Always explain changes and ask before pushing to remote
