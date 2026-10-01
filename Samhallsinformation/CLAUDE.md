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
1. Läs det här dokumentet (senaste sessionsloggen) + relevanta GitHub-issues.
   När åtgärdsplanen (`docs/code-review/FIXPLAN.md`) tas upp: läs även
   Obsidian-beslutet `docs/vault/Beslut/Väntar på beslut/Beslut - Alt C
   refresh-token i cookie.md` (bevakning av alt C — refresh-token i
   httpOnly-cookie) och stäm av villkoren
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

**När flera lager (frontend/backend/databas) faktiskt ska delas upp på
riktiga subagenter** (bekräftat 2026-09-21): om ett jobb spänner över
flera lager och att göra allt själv som PM markant skulle ta längre tid
än att dela upp det — dela upp det på riktiga ClaudeBE/ClaudeFE/ClaudeDB-
subagenter. Vilka lager som faktiskt får en egen subagent avgörs från
fall till fall utifrån vad uppgiften kräver — finns inget behov av en
egen DB-agent för just den uppgiften, spawnas ingen, även om möjligheten
finns. Ingen fast mall (t.ex. "DB+backend alltid ihop") — bedöm varje
gång.

**Progress = det här dokumentet.** När en uppgift kopplad till ett
GitHub-issue är klar och mergad: **stäng issuet och meddela användaren att det
stängdes.** Anta aldrig att "PR mergad" = "issue helt klart" — kolla issuets
egen checklista/acceptanskriterier först. (Hittade 2026-07-25: #295 och #296
stod kvar som öppna trots mergade PR:ar — #295 saknar fortfarande rate
limiting enligt sin egen checklista, så den ska inte stängas förrän det är
löst.)

**Nytt arbete (sedan 2026-09-12):** skapa inte nya GitHub-issues för framtida
idéer/uppgifter — skriv dem direkt som en `Ideer/`-not i Obsidian-valvet
(`docs/vault/Ideer/`) istället. GitHub-issues krävde disciplin att hålla
synkade (stänga i rätt ögonblick, uppdatera när scope glider) som visade sig
kosta mer än det gav — 20 av 60 öppna issues visade sig redan vara klara vid
2026-09-11-genomgången. Befintliga öppna issues stängs fortfarande löpande när
de är klara (se regeln ovan), men inga nya skapas. Se
`docs/vault/Verktyg/Claudes-tankar.md` i valvet för resonemanget.

**Övriga regler:**
- Aldrig påbörja nästa sprint/FAS utan uttryckligt godkännande från användaren
- Vid visuella/UI-ändringar: vänta på godkännande innan nästa uppgift
- Vid oklarhet i vad som ska byggas: fråga användaren, anta aldrig
- Ingen separat spec- eller datamodell-fil — GitHub-issues är spec, koden i
  `Models/` är sanningen för datamodeller. Två parallella dokument som kan
  glida isär från koden är värre än inga alls.
- **Periodisk liveverifiering** (sedan 2026-09-12): ungefär var 5-10:e session,
  kör ett par snabba liveverifieringar mot produktion av sånt som är svårt att
  enhetstesta men lätt att tro fungerar (rate limiting, CORS, riktiga
  DNS/mejlleveranser). Grundorsaken: rate limiting-buggen (session 45) låg
  odetekterad i produktion i över ett halvår trots grönt enhetstest — testet
  bevisade att LOGIKEN var rätt, inte att den faktiskt kördes mot rätt data i
  produktionens nätverkstopologi.
- **Håll CLAUDE.md lagom stort** (sedan 2026-09-12): filen arkiverades
  2026-09-12 (1372 → ~590 rader, sessioner 1–28 flyttade till
  `docs/SESSIONSLOGG_ARKIV.md`) eftersom den blivit för lång för att faktiskt
  läsas inför en ny session. Det här är en löpande vana, inte en engångsstädning
  — nästa gång "## Session Log" börjar närma sig samma storlek igen, arkivera
  proaktivt de äldsta sessionerna på nytt (samma arkivfil, lägg dem sist) utan
  att vänta på att användaren påpekar det.
- **Håll `docs/vault/1. Öppna_tankar/Öppna frågor.md` i synk** (sedan
  2026-09-12): varje gång en `## Öppna frågor`-sektion läggs till i en
  vault-not, lägg samtidigt till en rad i den filen. När användaren
  besvarar en fråga i notens egen fil, ta bort raden härifrån. Grundorsaken:
  användaren tappade bort vilka anteckningar som väntade på svar när
  frågorna bara låg utspridda i enskilda filer — en enda samlad lista löser
  det, men bara om den faktiskt hålls uppdaterad varje gång, inte bara vid
  skapandet.
- **Nämn aldrig en GitHub-issue bara med sitt nummer** (sedan 2026-09-12):
  skriv alltid vad den handlar om också, t.ex. "#116 (Standardinställningar
  för allvarlighetsfilter)". Användaren går inte gärna in på GitHub för att
  slå upp vad ett nummer betyder.

## Papercuts (sedan 2026-09-21)

Ingen officiell Claude Code-funktion — bara en löpande logg över småsaker
som saktar ner arbetet i den här sessionen, värda att åtgärda eller bara ha
i bakhuvudet. Lägg till en rad så fort en irriterar, ta bort/kryssa av när
den är löst eller inte längre relevant. Inget krav på att åtgärda varje
punkt — poängen är att inget glöms bort bara för att det kändes för litet
att nämna i stunden.

**Aktiv flaggning, inte bara passiv loggning:** så fort något faktiskt
märkbart saktar ner arbetet under en session (ett upprepat verktygsfel,
en klumpig workaround som körs flera gånger, en process som tar
orimligt lång tid) — säg till direkt i chatten, inte bara en tyst rad
här: "Jag har identifierat att [X] saktar ner arbetet, hur vill du att
vi hanterar det?" Lägg till i listan nedan oavsett om användaren vill
lösa det direkt eller skjuta upp det.

- (tom — fylls på allteftersom)

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

### Session 51 — 2026-10-01
**Obs:** Sessionerna 48–50 (Dela händelse + kundtjänstbot-sök-endpoint, launch-avslut (login/register-knappar bekräftat live) + Uppdateringar databas-backad, hela kodbasens code review + FIXPLAN med 59/60 PR:ar mergade) skedde men loggades bara i minnessystemet, aldrig hit. Se `project_session48_dela_kundtjanstbot_2026-09-13.md`, `project_session49_launch_och_uppdateringar_databas_2026-09-15.md` och `project_code_review_fixplan_2026-09-25.md` i minnet för detaljerna.

**What was done:**
- **Beroende-genomgång** (det som inte syns i GitHub): `npm outdated`/`dotnet list package --outdated` körda direkt. Lockfilen låg redan steget före lokal `node_modules` (inte ominstallerad efter senaste pull) — synkad, sedan `npm update`/`npm audit fix` för de sista patch/minor-bumparna (globals, vite, @types/node, typescript-eslint, @tanstack/react-query) plus en hög-severity `brace-expansion`-DoS-sårbarhet. TypeScript (5.9.3 → 7.0.2, Go-omskrivningen) och ESLint 10 medvetet lämnade — majors som kräver egen utvärdering. `Google.Apis.Auth` 1.76.0 → 1.77.0 på backend. Två separata PR:ar (#664 frontend, #665 backend, en per oberoende del enligt gränsrutinen)
- **Merge-konflikt på PR #664 löst och förklarad**: medan PR:en låg öppen hann Dependabot merga sex egna PR:ar direkt mot `main` som bytte nästan exakt samma paket (inkl. en egen `jsdom` 29→30-major och samma Google.Apis.Auth-bump som #665). Löst genom att ta `main`s lockfile som bas och köra `npm update`/`npm audit fix` ovanpå istället för att handredigera hundratals konflikthunkar — säkrare än att välja sida per rad i en fil där paket refererar till varandra med checksummor. Förklarade efteråt varför merge (inte rebase) var rätt val: branchen var redan pushad/PR:en redan öppen (rebase hade krävt force-push), och "ours"/"theirs" byter betydelse vid rebase jämfört med merge — lätt att råka invertera upplösningen
- **Obsidian-genomgång**: senaste tillägget var fyra nya V4-5-uppföljningsnoter (2026-09-27, kodgranskningens "under rangordningsgränsen"-fynd kontrollerade mot kod efter 52 mergade PR:ar). "Viktigast"-fyndet flaggat som en live-risk: `PushDispatcher` gatade på `source.ShortName == "Polisen"`, vilket lät `PolisenBevakningMatcher` tolka Polisen Efterlysningars `null` EventType/Geography som "matchar allt"
- **Push-fixen** (PR #666): gatear nu på `source.Id` (= `PolisenRssIngestor.Source.Id`, fast och kollisionsskyddat) istället för `ShortName`. Sidofynd under arbetet: tre befintliga testhjälpare skapade en `Source` utan explicit Id, vilket EF Core InMemory/SQLite auto-tilldelar 1 (första raden i en fräsch testdatabas) — kolliderade tyst med den nya Id-grenen och fick fyra befintliga tester att sluta skicka push helt. Fixat med explicita Id:n skilda från 1, plus ett nytt regressionstest för Efterlysningar-fallet
- **Källmerget** (PR #667), efter en kort avstämning (tre AskUserQuestion-frågor, alla rekommenderade alternativ valda): Polisen och Polisen Efterlysningar (och generiskt SMHI/SMHI Nyheter, samma mönster) visades som två separata rader i Aktiva källor/Alla källor trots att de delar `ShortName` och grupperas till en sidomenyknapp sedan session 15. Ny delad `kallGrupper.ts` (`grupperaKallor`/`representant`, huvudkällan = den vars `Name === ShortName`) — samma princip `Sidebar.tsx` redan använder, nu återanvänd i `AktivaKallorKort`/`AllaKallorKort`. Lägg till/Ta bort skickar nu alla gruppens id:n i ett enda anrop. Backend (`UserSourcesController.SaveSources`) expanderar varje begärd ändring till hela `ShortName`-gruppen (aktivering bara mot publicerade syskon, avaktivering alltid alla), och en idempotent engångsbackfill i `DatabaseBootstrapper` aktiverade Efterlysningar/SMHI Nyheter åt användare som redan hade huvudkällan aktiv innan grupperingen fanns
- Alla fyra PR:ar (#664, #665, #666, #667) verifierade med fullständiga test-/byggkörningar innan push (backend 1099/1103 gröna inkl. nya tester, frontend 508/508 gröna inkl. nya tester för `kallGrupper`), mergade av användaren, lokala grenar städade bort direkt efteråt
- Obsidian-backloggen (`Kodgranskning-backlog — Push, ingest och bakgrundstjänster.md`) uppdaterad: "Viktigast"-fyndet markerat ✅ löst med länkar till båda PR:arna

**Problem och lösningar:**
- En hardkodad `source.Id == 1`-gren i produktionskod kolliderade tyst med EF Core InMemory/SQLite-providerns beteende att auto-tilldela Id=1 till den FÖRSTA entiteten i en fräsch testdatabas — tre testhjälpare som skapade en `Source` utan explicit Id fick alltså av misstag samma Id som den riktiga Polisen-källan, utan att något i testkoden avsåg det. Löst genom att explicit sätta ett Id skilt från 1 på alla `Source`-rader i testhjälpare som inte MENAR att vara huvudkällan — värt att komma ihåg nästa gång en gren gatear på ett specifikt databas-Id i stället för ett namn/en flagga
- Push-buggens faktiska allvarlighetsgrad omvärderades under utredningen: den beskrevs först (i granskningsnoten) som en risk för OBEHÖRIGA mottagare, men kodläsningen visade att mottagarkretsen redan var strikt gated av `UserSourcePreference.SourceId` — bara den som FAKTISKT aktiverat Efterlysningar separat kunde beröras alls. Den verkliga bristen var en MISSVISANDE pushtext (påstod en bevakningsmatchning som inte skett), inte en läckande mottagarlista. Rapporterades till användaren med den mer precisa beskrivningen i stället för att upprepa granskningsnotens ursprungliga formulering okritiskt

**Etablerat mönster:**
- Vid en merge-konflikt i en stor, maskingenererad fil (lockfile, snapshot) där Dependabot eller en parallell session kan ha gjort överlappande ändringar: ta ena sidans version av HELA filen som bas och kör om det verktyg som genererade den (här `npm install`/`npm update`), i stället för att handredigera enskilda konflikthunkar — garanterar en internt konsekvent fil
- Merge föredras framför rebase för en redan pushad/öppen PR-branch: ingen force-push krävs, och "ours"/"theirs" har samma betydelse hela vägen (rebase byter betydelse på dem och är lätt att invertera av misstag)
- En kodgranskningsnots beskrivna allvarlighetsgrad ("obehöriga mottagare") ska verifieras mot den faktiska koden innan den upprepas till användaren — kodläsningen här visade att den verkliga bristen var mindre allvarlig (en missvisande text, inte en läckande mottagarkrets) än ursprungsformuleringen antydde
- När en kodändring gatear på ett databas-ID i stället för ett namn: kontrollera att INGEN testhjälpare i hela testsviten förlitar sig på providerns auto-tilldelade ID-sekvens för att undvika att råka träffa samma värde — kör hela testsviten, inte bara de filer som uppenbart berörs, innan en sådan ändring anses klar

**Next session:**
- Inget specifikt uppdrag kvar från den här sessionen — alla fyra PR:ar mergade, Obsidian-backloggen uppdaterad, inga öppna trådar
- Resten av V4-5-uppföljningens fynd (Auth/sessioner, Admin-API-validering, Frontend UX) i `docs/vault/1. Öppna_tankar/` är fortfarande opåbörjade, lägre allvarsgrad än push-fyndet — ta upp när användaren vill gå igenom dem

---

### Session 47 — 2026-09-09
**Obs:** Session 46 (Zoho Mail helt avskriven, info@samhallsinformation.se kopplad in i Resends inbound/outbound-pipe via PR #542) skedde men loggades bara i minnessystemet, aldrig hit. Se `project_zoho_mail_avskriven.md` i minnet för detaljerna.

**What was done:**
- Ingen kod skriven denna session — ren design-/produktdiskussion, fortsättning på den pausade mobil-design-genomgången ([[project_mobil_design_oversyn_paused_2026-09-08]])
- **Direction E (tre staplade rader för Polisen-händelsekort) itererad fram och tillbaka:**
  - Byggde en tre-radslayout (rad 1: severity+händelsens egen tid, bara klockslag; rad 2: typ+plats som huvudinnehåll; rad 3: källa+källans publiceringstid) som svar på användarens egen skiss ("8 september 16:51" / "Misshandel, Haninge" / "Polisen 20:11")
  - **Misstag, upptäckt av användaren:** försökte lägga in Direction E direkt i den redan publicerade design-canvas-artifacten genom att parsa/patcha dess interna `appifact-doc`-JSON-blob i ett Node-skript. JSON:en validerade tekniskt men canvasens egen renderingsmotor kraschade ändå (sidan visade oformaterad text, bokstavliga `\n`-tecken). Rullades tillbaka genom att återpublicera en sparad pre-edit-snapshot till samma URL. Ny feedback-minnesregel: rör aldrig den filen direkt, oavsett hur giltig JSON:en ser ut
  - Byggde om Direction E som en **helt separat, fristående Artifact** istället (https://claude.ai/code/artifact/168ec088-e4b3-47fb-9a4b-85e7753d331c, "Tre rader istället för en") — D och E sida vid sida med samma fyra Polisen-exempel, plus en tredje mockup som visar hur E ser ut expanderad vid klick (samma expand-mekanik som redan finns i `NewsItem.tsx`, bara ovanpå den nya radlayouten). Användaren gillade tre-radslayouten men vill inte bygga den i kod ännu
- **Bottom navigation bar-idén (pausad sedan session 41) diskuterad vidare, ingen kod:**
  - Föreslog kandidater (Alla händelser, Mitt flöde, Sparat, Mina källor, Support, Konto) och fick två viktiga rättelser av användaren: "Alla"/"Mitt" är inte bara två vyer av samma data (Mitt = det man prenumererar på OCH notisbasen — genuint annorlunda avsikt), och Sparat är inte ett dagligt-bruk-beteende utan "spara nu, kika tillbaka senare" — hör troligen hemma under Konto, inte som egen bottom-slot
  - Slutsats: appen har fortfarande bara 2-3 riktiga bottom-bar-kandidater (Flöde, Konto, ev. Sparat) — för glest. **Sök** är den kandidat som saknas för att göra bottom bar värd att bygga
- **Ny idé, scopad tillsammans med användaren: en lätt citizen-facing Sök-funktion.** Inte händelsesökning (det är en annan, större idé) — ett appinternt snabbsök över FAQ (redan i DB) + en kort lista sidor/inställningar, med varje träff källmärkt (violett "❓ FAQ" vs grå "↗ Genväg"). Fria frågor ("Har det hänt något i Stockholm idag?") ska INTE besvaras av Sök själv utan hänvisas till kundtjänstboten. Mockup byggd: https://claude.ai/code/artifact/130f4785-55b2-4b3e-91da-9737288e52fa ("Vem svarar på vad") — visar både träff-läget och ett ärligt tomt-läge med en "Fråga kundtjänstboten"-knapp
- **Kundtjänstbot-integrationen undersökt via en cross-project-fråga** — användaren har ett separat kundtjänstbot-projekt (`kundtjanstbot-production.up.railway.app`), skickade en av mig formulerad fråga till CPM i det projektet och fick tillbaka en konkret statusbild: boten är redan en AI-hybrid (fuzzy-matchad kunskapsbank → Claude-fallback som växer KB:n automatiskt, ingen "jag förstår inte"-dödsände), en förifylld fråga via `?q=`-query-param till chatten är ett litet ogjort jobb ("några rader" i `PublicChatView.jsx`), medan riktig live-frågning mot Samhällsinformations händelse-API kräver tool use/function calling + en publik events-endpoint + cross-service auth/rate limiting — redan identifierat och parkerat som eget epic i kundtjänstbot-projektets egen backlogg (#203), med ett billigare mellansteg (#220, periodisk KB-synk). Beslut: bygg Sök v1 utan detta, hämta bara `?q=`-stödet som ett separat litet jobb när Sök faktiskt byggs
- Allt sparat i `project_sok_bottenrad_kundtjanstbot_2026-09-09.md` i minnet — inget kodat, ren idé-/mockup-fas

**Problem och lösningar:**
- Se Direction E-misstaget ovan — löst genom att ha sparat en pre-edit-snapshot av artifacten innan ändringen gjordes, vilket gjorde återställningen till en enda republicering istället för en rekonstruktion från minnet

**Etablerat mönster:**
- **En publicerad design-canvas-artifacts interna `appifact-doc`-format är inte avsett att hand-editeras direkt, även när JSON:en tekniskt validerar** — canvasens egna renderingsmotor kan ha invarianter (whitespace/formatering/ordning) utöver ren JSON-giltighet. Nya mockup-riktningar i en redan publicerad canvas ska antingen läggas till av användaren själv i canvas-editorns UI, eller byggas som en helt separat, fristående artifact
- **Spara alltid undan den senaste `action: "read"`-snapshotten innan en riskabel ändring görs på en publicerad artifact** — gjorde att en trasig republicering kunde rullas tillbaka på sekunder istället för att behöva rekonstrueras
- En bottom-bar-kandidatlista ska sorteras på **faktisk användningsfrekvens och avsikt**, inte en-sida-per-flik-reflexen — två knippen som såg ut som naturliga flikar (Alla/Mitt, Sparat) visade sig vara antingen samma domän med olika avsikt (bör kanske vara en flik med intern växling) eller ett för sällan-besökt beteende för prim bottenrads-plats (hör hemma under Konto istället)
- Vid en fråga som kräver kunskap om ett HELT separat projekts kod: formulera en självständig, kontextfull fråga (bakgrund + konkreta delfrågor) som kan skickas till den andra Claude-sessionen utan delad historik, istället för att gissa på det andra projektets arkitektur härifrån

**Next session:**
- Användaren gör en **manuell kontroll av mobilvyn av registreringsflödet** innan nästa session — okänt ännu vad det avslöjar
- Sök-funktionen (FAQ+sidor, källmärkt) är designklar men inte påbörjad i kod — bygg när användaren säger till, sen `?q=`-stödet i kundtjänstbot-projektet som eget litet jobb, sist ihopkoppling
- Bottom bar-frågan (äger Alla/Mitt varsin flik eller ej) fortfarande olöst — ta upp igen när Sök faktiskt finns och bottenrads-innehållet ska bestämmas på riktigt
- Direction E (tre staplade rader) inte kodad än, väntar på användarens "bygg det"
- Oförändrat sedan session 46: PR #516/#517 väntar på merge, login/register-knapparna avstängda i produktion, 4 rekommenderade tester (Resend inbound) opåbörjade

---

### Session 45 — 2026-09-04 / 2026-09-05
**Obs:** Session 43 (2026-08-31, launch-prep-flaggor/FAQ/Nyheter/beta-badge + Resend inbound-funktionen byggd) och Session 44 (2026-09-01, tio PR:ar #519–528: ingestor-cykelfixar, admin-skrivrätt på Polisen-bevakningar/Aktiva källor, feature-flag-fixen) skedde men loggades bara i minnessystemet, aldrig hit. Se `project_launch_prep_session43_2026-08-31.md` i minnet för Session 43:s detaljer.

**What was done:**
- **Resend inbound (#518, byggd session 43) felsökt och verifierat fullt fungerande end-to-end**, via ett riktigt testärende (SUP-11) och upprepade riktiga Hotmail-svar — fyra separata, riktiga buggar hittade och fixade i tur och ordning, en diagnostik-logg-runda i taget:
  1. **PR #535** — `VerifierarSignatur` kraschade (500, ohanterat `FormatException`) om `RESEND_WEBHOOK_SECRET` inte var giltig Base64, istället för att svara 401 som övriga ogiltiga-signatur-fall
  2. **Faktisk rotorsak till att inget landade alls:** `RESEND_API_KEY` skapades ursprungligen (session 18) med bara **"Sending access"** — saknade behörighet för `GET /emails/receiving/{id}`. Användaren uppgraderade nyckeln till Full access i Resend-dashboarden, ingen kodändring
  3. **PR #536** — Resends receiving-API returnerar `"text": null` om mejlet saknar en text/plain-del, vilket Outlook/Hotmails webbklient ofta gör (bara HTML). Lade till en html→text-fallback (enkel regex: strippar script/style, gör om br/p/div/li-slut till radbrytningar, avkodar HTML-entiteter)
  4. **PR #537/#538** — la till varningsloggar för de tidigare tysta `return Ok()`-grenarna i `WebhooksController.ResendInbound` (tomt text/html-innehåll, hela citat-klippt) samt statuskod+svarskropp för själva Resend-anropet — det var den här loggningen som avslöjade rotorsak #2 rakt av, ingen gissning krävdes
  5. **PR #539** — Outlooks webbklient citerar utan `>`-prefix eller en "skrev/wrote"-mening, bara ett rubrikblock (`Från: ... Skickat: ... Till: ... Ämne: ...`) ofta föregånget av en understreckad avdelare — `KlippBortCiterat` kände inte igen det, hela det citerade originalmejlet hamnade i den sparade texten. Verifierat live: användaren skrev bara "Test 6"/"Test 7", bara den texten sparas nu
- **Flagg-fixen (#528, session 44) bekräftad hålla över FLERA efterföljande produktionsdeploys** — viktig nyans: #528 var själva deployen som tog bort den trasiga koden, så att flaggan överlevde DEN deployen bevisade ingenting (buggen slog bara till på en deploy som körs EFTER fixen redan ligger i produktion). `kallor_polisen_filter` kontrollerad (`GET /api/feature-flags`) efter varje efterföljande merge under kvällen (PR #535 t.o.m. #541) och höll sig `true` hela vägen — genuint verifierad nu
- **Ny push-notis vid ärendesvar** (PR #540) — användaren märkte proaktivt att bara NYA ärenden/konton triggade push (`DispatchNewTicketAsync`/`DispatchNewUserAsync`), ett svar på ett BEFINTLIGT ärende (inloggat eller via Resend inbound-mejl) gav ingen notis alls. Ny `PushDispatcher.DispatchTicketReplyAsync`, samma Admin/Support+`PushEnabled`-mottagarmönster som redan fanns, kopplad in på båda ställena en medborgare kan svara. Agentens eget utgående svar triggar medvetet INTE detta. Verifierat live: push landade på både dator och mobil
- **Oläst-markeringen i Support-inboxen återställs nu vid nya svar** (PR #541) — uppföljande upptäckt direkt efter push-fixen ("notisen kom, men ingen plupp i inboxen"). Rotorsak: oläst styrdes av `FirstOpenedAt`, satt EN gång och aldrig återställd. Ny modell: `LastViewedAt` (uppdateras vid VARJE öppning) + `LastUserMessageAt` (uppdateras vid varje medborgar-meddelande — skapelse, inloggat svar, Resend inbound). Oläst = `LastUserMessageAt > LastViewedAt`. Ny migration (`AddTicketLastViewedAndLastUserMessage`) med backfill (`LastViewedAt = FirstOpenedAt`, `LastUserMessageAt` = senaste user-meddelandets `CreatedAt`), samma raw-SQL-Postgres-mönster som redan etablerat. Verifierat live mot lokal SQLite (inte bara build/test): nytt ärende oläst, öppnat ärende läst, agent-svar bumpar `UpdatedAt` men lämnar ärendet läst
- Alla sex PR:ar (#535–#541, sju räknat) verifierade med `dotnet build`/`dotnet test` (101/101) och för frontend-ändringarna `tsc -b` innan push, mergade av användaren löpande under kvällen
- Sidospår: förklarade Railways nya `railway postgres`-CLI-kommandon (HA/PITR/PgBouncer) på användarens fråga — bedömt inte relevant vid nuvarande skala (en enda liten Postgres-instans), inget byggt

**Problem och lösningar:**
- Samma "verifiera, gissa inte"-princip som redan etablerad för kod tillämpades fyra gånger i rad på en levande tredjepartsintegration: varje gång ett fel dolde ett djupare fel (500-krasch dolde fel API-nyckel-behörighet, som dolde en innehålls-parsningsbugg, som dolde en citat-klippningslucka), löste vi det genom att lägga till riktad loggning och läsa Railway-loggen efter EN riktig testhändelse — aldrig genom att gissa vidare i koden
- En API-nyckel skapad för ETT syfte (Resend "Sending access", session 18, bara för utgående mejl) begränsade tyst en helt annan funktion (läsa inkommande mejl) byggd månader senare på samma nyckel — värt att explicit kolla behörighetsomfånget på befintliga tredjepartsnycklar/tokens när en ny förmåga byggs ovanpå en redan existerande extern tjänst-koppling
- En "oläst"-flagga modellerad som "har den NÅGONSIN öppnats" (sätts en gång) är en svagare garanti än "finns det aktivitet sedan jag senast tittade" — vid ny notis-/plupp-funktionalitet: kontrollera vilken av de två ett befintligt fält faktiskt modellerar innan man bygger vidare på det, inte anta att de är utbytbara
- `python3` saknas fortfarande i PATH (samma kända kvirk som tidigare sessioner) — löst genom att parsa JSON-svar med `node -e` istället vid lokal curl-verifiering

**Etablerat mönster:**
- Vid en webhook/integration som svarar "lyckades" (200) men den förväntade sidoeffekten uteblir: behandla VARJE tyst `return`/no-op-gren i hanteraren som misstänkt och lägg till loggning i var och en, istället för att gissa vilken gren som är boven
- En ny push-notistrigger (`DispatchXAsync`) ska tydligt definiera VEM som ska trigga den och vem som medvetet INTE ska — här: en medborgares svar ja, agentens eget svar nej, annars ser admin en falsk "oläst/ny aktivitet"-signal på sina egna handlingar
- Innan en ny funktion byggs ovanpå en befintlig tredjepartsnyckel/token: verifiera dess faktiska behörighetsomfång explicit, anta inte att den redan täcker den nya operationen bara för att den fungerat för det ursprungliga syftet

**Next session:**
- PR #516 (Nyheter-sidan) och #517 (beta-badge) fortfarande medvetet omergade, väntar på att tajmas mot ett LinkedIn-inlägg
- `showLoginButton`/`showRegisterButton` fortfarande avstängda i produktion — sista steget i launch-ordningen
- Kvarstående pre-launch-tester (från en checklista gjord tidigare i sessionen, inga påbörjade): mobil genomgång av hela registrerings-/onboardingflödet, lösenordsåterställning end-to-end mot en riktig inkorg, GDPR-kontoradering (24h-ångerfönster) verifierad live, rate limiting under en trafiktopp av samtidiga registreringar

---

### Session 42 — 2026-08-29 / 2026-08-30
**What was done:**
- **Feedback-knappens text villkorad på inloggning** (PR #509): "Hjälp & Feedback" för inloggade (fungerar som supportkanal för kontofrågor), bara "Feedback" för utloggade besökare som inte har ett konto att få hjälp med
- **Pre-registrerings-avstämning**: verifierade live via curl (inte minnet) att `showLoginButton`/`showRegisterButton` fortfarande är `false` i produktion och att `notif_push` är av — bekräftade med användaren att push är medvetet UTANFÖR v1-scope ("v1 ska vara minsta möjliga", push kändes inte som minsta möjliga). Enda kvarvarande blockeraren för att öppna registrering: ett nytt Hotmail-registreringstest efter DMARC-fixen (session 41), fortfarande inte gjort
- **FAQ↔feature-flag-koppling** (PR #510): ny valfri `FlagKey`-kolumn på `FaqItem` (migration `AddFaqFlagKey`) — admin väljer i en dropdown vilken funktion en fråga hör ihop med, är flaggan avstängd döljs frågan automatiskt i `FaqKort.tsx` oavsett `Publicerad`-status (löser samma "gammal FAQ-post om en nedlagd funktion blir liggande synlig"-problem som redan hänt en gång, session 28). Admin-tabellen visar en ⚠️ "Dold av flagga"-badge. Filtreringen sker i frontend (inte backend) eftersom flaggornas `defaultAktiv`-värden bara finns i `featureFlags.ts`, backend känner bara till admins avvikelser
- **Mejladresser**: `support@samhallsinformation.se` som avsändare för e-postbytesvarningen (PR #511) — den enda transaktionsmejlet som faktiskt inbjuder till kontakt ("var det inte du?"). Övervägde en riktig mottagande brevlåda (Zoho Mail, gratis, kolliderar inte med Resends `send.`-underdomän för sändning) men **pausad på användarens begäran** ("vi har annat att hantera"), inte bortglömd
- **Trafikverket/Polisen-regelgenomgångar** (research, inget att bygga): Trafikverkets nya `TrainAnnouncement`-namespace-krav (2/9) rör inte projektet (bara `Situation`/vägtrafik konsumeras) — sparade Trafikverkets nya Datautbytesportal som referens för framtida källresearch. Polisens regler: RSS-flödet (det som faktiskt används) har bara tre krav — källattribution, länk till originalartikeln, ingen logotyp — alla redan uppfyllda. De striktare reglerna (anropstak, User-Agent-tvång) gäller bara deras separata JSON-API, inte RSS
- **Länk-koll innan "Läs mer" öppnas** (PR #513): ny `GET /api/events/{id}/link-status` (server-side, kringgår CORS, ärlig User-Agent, 8s timeout) — löser att en sparad artikels källänk kan 404:a hos källan utan förvarning. `NewsItem.tsx` och adminens per-användare Sparat-lista (`Anvandare.tsx`, som samtidigt fick en riktig länk dit — saknades helt innan) kollar länken innan den öppnas, visar en varning istället för att skicka användaren till en död sida. Failar kollen mot vår egen backend antas länken vara levande (fail open)
- **Ingestor-cykler grupperade i Aktivitetsloggen** (PR #512), utlöst av att en enda 5-minuterskörning med 8+ källor kunde fylla hela Översikts "Senaste händelser"-widget (bara 8 rader) utan att en enda riktig admin/system-händelse syntes: `IngestorBackgroundService` sätter nu en delad `RunAt`-tidsstämpel per cykel, `AdminActivityLogController` grupperar på den till EN rad. Två rundor av användarfeedback på formuleringen: (1) en skärmdump visade att rubriken ledde med "X misslyckades" även när cykeln samtidigt haft stora uppdateringar — vänt till att alltid leda med uppdateringarna, felet en kort flagga sist; (2) vid flera samtidiga fel blev rubriken ändå för lång och klipptes mitt i ett namn — löst genom att aldrig lista mer än ett källnamn i rubriken (bara "N källor misslyckades"), fullständig lista i Detalj + gjorde både Aktivitetslogg-raden och Översikts widget klickbara/expanderbara för att se den. Bytte även `Source.ShortName` mot `Source.Name` i rubriken — flera källor delar medvetet ShortName för sidomenyns gruppering (Polisen/Polisen Efterlysningar, SMHI/SMHI Nyheter), vilket gjorde en rubrik som "Polisen misslyckades" genuint tvetydig
- **Mockade alla use-case-varianter direkt i lokal databas** (på användarens begäran, för visuell granskning) istället för en fristående Artifact-mockup — körde riktig kod mot seedad testdata i lokala SQLite-filen, ingen risk för visuell drift mot verkligheten. Städade samtidigt bort en gammal trasig testkälla ("TestPR2") som legat och stört varje riktig ingestor-cykel sedan en tidigare session
- **FAQ-innehållsgenomgång**: kartlade alla 9 befintliga frågor (bara 3 publicerade), skrev ett förslag på 15 frågor totalt kopplade mot rätt flaggor. Rättade ett eget fel under arbetets gång — påstod först att två GDPR-frågor var felaktigt dolda, verifierade sedan att `konto_datahantering`-flaggan faktiskt är av (ingen override, varken lokalt eller i produktion), så de var korrekt dolda. Användarens egen fundering ("varför frågar FAQ:n hur man registrerar sig, man har ju redan ett konto då") avslöjade i koden att FAQ bara är nåbar inloggad (`ProfilePage.tsx` visar `GästProfil` för utloggade, ingen FAQ alls) — strök både registrerings- och glömt-lösenord-frågorna ur listan (samma chicken-and-egg-problem: kan inte nå svaret utan att redan ha löst det svaret beskriver), sparade frågan om publik-vs-inloggad FAQ som en öppen idé i Obsidian-valvet (`Ideer/FAQ för utloggade besökare.md`). Listan i sig (15 frågor, godkänd i text) är INTE inlagd i databasen än
- **Ärendesvar-loggning + Inställningshistorik-flik** (PR #514): upptäckte under en genomgång av vad som faktiskt loggas att ärendesvar (agentens svar på ett supportärende) inte loggades alls, trots att öppnat/tilldelat/statusändrat/arkiverat redan gjorde det — tillagt. Upptäckte också att `UserSettingAuditLog` (per-användare ändringshistorik: lösenord/e-post/namn/Mina källor, loggat sedan session 18) aldrig fått en admin-vy — ren skrivsida i tre sessioner. Kompletterade den med de saknade bitarna (GDPR-radering, GDPR-export, Polisen-bevakningar skapad/ändrad/borttagen) och byggde en ny "Inställningshistorik"-flik i Användarhantering. Medvetet INTE i den delade Aktivitetsloggen på användarens uttryckliga önskemål — per-användare-diagnostik för felsökning ("varför funkade inte X"), inte menat att synas i Senaste händelser
- **Allt commit:at i 6 separata PR:ar** (en per funktion, användarens uttryckliga begäran) trots att tre filer (`AdminUserDetailsController.cs`, `adminUsers.ts`, `Anvandare.tsx`) delades mellan de två sista PR:arna — löst genom att checka ut den fulla kombinerade versionen från en enda samlad `git stash -u` och sedan manuellt ta bort respektive PR:s motpart med Edit-verktyget, verifierat med `git diff main -- <fil>` (inte bara `git diff`, som jämför mot index och gav missvisande resultat första gången) att varje branch fick exakt rätt scope. Alla 6 pushade, PR:ar öppnade (#509–#514) och mergade. En riktig men trivial merge-konflikt uppstod i `Anvandare.tsx` för PR #514 efter att #513 mergats (samma delade-fil-mönster, väntat) — löst med `git merge origin/main`, verifierat att båda PR:arnas kod fanns kvar som en union efteråt

**Problem och lösningar:**
- Lokal backend startade på fel port (`55953`/`55954` från en gammal, lokal `launchSettings.json`) trots explicit `ASPNETCORE_URLS`-miljövariabel — `dotnet run` läser launch-profilens `applicationUrl` och den vinner över den satta miljövariabeln. Löst med `--no-launch-profile`, som tvingar Kestrel att bara respektera `ASPNETCORE_URLS`
- `python3` fanns inte i PATH (bara Windows Store-genvägen), `py`-launchern fungerade istället för att seeda testdata direkt i den lokala SQLite-filen
- `git checkout stash@{0} -- <fil>` fungerar bara för filer som redan var TRACKED när stashen skapades — en fil som var UNTRACKED (nya migrationer, den nya Obsidian-noten) kräver `stash@{0}^3` (den tredje-parent-committen där `git stash -u` lagrar otrackade filer separat)
- `git diff` utan argument jämför mot INDEX, inte mot `main` — efter att ha stagat filer via `git checkout stash@{0} --` visade en bar `git diff` bara mina egna efterföljande Edit-ändringar (missvisande, verkade som att PR5/PR6 var tomma på varandras innehåll). Löst med `git diff main -- <fil>` för att se den faktiska skillnaden mot huvudgrenen
- Obsidian-notens FILNAMN tappade å/ö/ä genom Write-verktyget (blev "FAQ for utloggade besokare.md"), men filens INNEHÅLL behöll diakritiska tecken korrekt — kosmetiskt, inte åtgärdat

**Etablerat mönster:**
- **Verifiera flaggstatus/produktionsdata live innan man drar en slutsats om vad som är fel** — hände två gånger denna session: `kallor_polisen_filter` visade sig redan vara på i produktion (motsade minnet), och `konto_datahantering` visade sig faktiskt vara av (motsade mitt eget första påstående). Samma "verifiera, gissa inte"-princip som redan etablerad för kod, tillämpad på feature-flaggor och produktionsdata
- **Mocka UI-varianter genom att seeda riktig data i den faktiska lokala databasen och köra riktig kod**, inte en fristående Artifact-mockup — särskilt värdefullt när komponenten redan är byggd och man vill granska formulering/layout över många scenarier samtidigt, utan risk för visuell drift mot den riktiga implementationen
- **En rubrik/sammanfattningsrad ska alltid leda med huvudsaken, aldrig ett undantag** — även om undantaget (ett fel) känns viktigast att flagga. Annars begraver en enda kroniskt trasig komponent allt annat i rubriken permanent, precis vad som hände första gången ingestor-cykel-grupperingen byggdes
- Vid flera PR:ar i samma session som delar en fil: checka ut den FULLA kombinerade versionen en gång, ta bort den andra PR:ns hunkar med Edit istället för att försöka bygga upp varje branch inkrementellt från tomt, och verifiera alltid mot `git diff main -- <fil>` (inte bar `git diff`) innan commit
- En tabell/logg byggd för ett syfte (`UserSettingAuditLog`, byggd session 18 för per-användare-audit) kan ligga fullt fungerande och skrivande i flera sessioner utan att någon märker att den aldrig fick en läsvy — värt att regelbundet fråga "finns det redan lagrad data vi aldrig visat upp?" innan man bygger ny loggning från scratch

**Next session:**
- Hotmail-registreringstestet (DMARC, sedan session 41) fortfarande inte gjort — sista blockeraren innan Logga in/Skapa konto-knapparna kan slås på
- FAQ-listan (15 frågor, godkänd i text denna session) är inte inlagd i databasen än — bygg in den och koppla flaggorna
- Öppen fråga i Obsidian-valvet (`Ideer/FAQ för utloggade besökare.md`): ska FAQ vara publik, inloggad-bara (som idag), eller delad i två delmängder?
- Zoho Mail (riktig mottagande `support@`-brevlåda) medvetet pausad, inte bortglömd
- Verifiera att PR #514:s CI-status blev grön efter merge (var `UNSTABLE`/väntande vid mergetillfället, inte dubbelkollat i efterhand)

### Session 41 — 2026-08-27
**What was done:**
- **E-postbytesflödet byggt om till branschstandard** (PR #503): tidigare bytte `PUT /api/auth/me` e-postadressen direkt och skickade en bekräftelselänk i efterhand — en kapad session hade räckt för att kapa kontot till en ny adress utan bevis på ägarskap. Ny modell: `EmailChangeToken`-tabell (mirrorar `EmailVerificationToken`), `POST /api/auth/me/email-change` skickar en bekräftelselänk till den NYA adressen (kontots e-post orörd tills länken klickas) + ett varningsmejl till den GAMLA adressen, `POST /api/auth/confirm-email-change` gör själva bytet och sätter `EmailVerified=true` direkt (samma bevis som Google-OAuth). Efter en självrannsakan om edge-cases (bad om en, fick två): lade till **lösenordskrav** för att ens starta ett byte (lösenordskonton, Google-konton undantagna — ingen `PasswordHash` att kolla) och **sessionsutloggning** (alla refresh-tokens återkallas vid ett lyckat byte). Ny `ConfirmEmailChangePage.tsx` (mirrorar `VerifyEmailPage.tsx`), `KontoInfo.tsx` visar nu en väntande-bekräftelse-banner med Avbryt-knapp istället för att spara direkt. 101/101 backend-tester gröna (8 nya), verifierat live end-to-end mot lokal backend (curl) inkl. lösenordsguardens 400/401/200 och att gammal adress slutar fungera för inloggning efter bytet
- **Mergade 6 Dependabot-PR:ar** (#497–#502): fem npm-bumpar + en NuGet-bump, alla gröna. #500 (`@vitejs/plugin-react`) fick en lockfile-konflikt efter att de andra fyra landat först — löst med `@dependabot rebase`-kommentar istället för att handredigera Dependabots egen branch
- **Admin push-notiser diagnostiserade, visade sig fungera korrekt** (uppföljning av session 40:s olösta "ingen push för matchande händelse"): gick igenom hela kedjan via de sedan session 30 befintliga diagnostikendpointsen (`/api/push/devices`, `/logs`, `/test`) plus DevTools-konsol-fetches (Chrome-tillägget flakade igen, samma etablerade fallback som tidigare sessioner). Rotfynd: `PushEnabled`/`PushNyaHandelser` båda `true`, enheter registrerade, en riktig testpush landade live på både dator och telefon. Den faktiska "tystnaden" förklarades av att användarens enda Polisen-bevakning (Stenungsund + Kungälv, valfri kategori) helt enkelt inte haft en matchande händelse på två dygn — verifierat mot skarp händelsedata att bevakningens senaste träff (`25 augusti 16.12, Trafikolycka, Kungälv`) exakt matchade senaste lyckade push-loggraden. Inte en bugg. Verifierade sedan live, på användarens begäran, båda de automatiska admin-triggarna genom att faktiskt utlösa dem: ett riktigt (tydligt TEST-märkt) feedback-inskick via `POST /api/support/tickets` (→ "Ny feedback"-push) och en riktig (tydligt TEST-märkt) kontoregistrering via `POST /api/auth/register` (→ "Ny användare"-push) — båda landade
- **Research: "riktig app" (Play Store/App Store)** — WebSearch bekräftade att Android via PWABuilder/Trusted Web Activity är i praktiken gratis (paketerar befintlig PWA rakt av, Google räknar det som en giltig Play Store-app), medan en ren webview-wrapper på iOS 2026 så gott som garanterat avslås av Apple under Guideline 4.2 (kräver riktig native-funktionalitet, dvs. Capacitor + faktiska native-funktioner, ett mycket större jobb). Sparad i valvet (`Ideer/Riktig app...`), användaren svarade på de öppna frågorna direkt i filen: Android räcker, iOS medvetet bortvalt ("fuck iOS" tills vidare)
- **"Bottom bar"-idé diskuterad och pausad**: appen har idag bara en tung destination (källflödet) — inte tillräckligt underlag för en bottom bar utan att den konkurrerar med hamburgermenyn. Sparad i valvet (`Ideer/Bottom bar (mobil)`) med öppen fråga: kan ändra sig om citizen-facing Sök eller Bevakningar som egen sida byggs
- **Två UI-fixar i profilmenyerna** (PR #504): (1) "Användare"-rollbrickan i sidomenyns profildropdown döljs nu för vanliga användare, matchar mönstret som redan fanns för "Min profil"-knappens hörnbricka. (2) Hittade och fixade hårdkodat `"Joakim Rehn"`/`"JO"` på tre ställen (sidomenyns dropdown, "Min profil"-knappens avatar, adminpanelens egen avatar-dropdown) — ny `name`-property i `AuthContext` läser en `name`-claim som redan fanns i JWT men aldrig lästes ut. Medvetet INTE rört `Impersonation.tsx`s mockdata (samma "Joakim Rehn" där) — helt separat, känd mock-komponent sedan tidigare sessioner
- **Hotmail-leveransproblem diagnostiserat och åtgärdat**: användaren körde de sedan session 33 planerade registreringstesterna (Gmail + Hotmail) inför att öppna publik registrering. Gmail gick bra, Hotmails bekräftelsemejl hamnade i skräpposten. Kollade DNS direkt (Cloudflare DNS-over-HTTPS): SPF och DKIM korrekt konfigurerade för Resend, men **`_dmarc.samhallsinformation.se` saknades helt** — Outlook/Hotmails filter väger avsaknad av DMARC betydligt hårdare än Gmail. Gav användaren exakt TXT-post att lägga in (`v=DMARC1; p=none; rua=mailto:...`), användaren la in den i Cloudflare, verifierad i DNS direkt efteråt. Väntar på att den sprids innan ett nytt Hotmail-test
- **Feedback-knappen döpt om till "Hjälp & Feedback"** (PR #505): knappen fungerar redan de facto som kontaktväg för supportärenden (ingen separat Ärendehantering finns än), men texten/modalen ("Lämna feedback") signalerade bara "dela en åsikt". Ny text gör kanalen hittbar utan att låtsas vara en riktig supportdesk med garanterat svar — modalens inre texter medvetet orörda, bara ingångsknappen
- **Riktig navigationsbugg hittad av användaren och fixad** (PR #506): `/profil`-routen fanns, men ingenstans i appen länkade dit — "Min profil"-knappens undertext lovade "Inställningar & konto", men dropdownen innehöll bara rollväljare och Logga ut. Ny länk tillagd högst upp i dropdownen
- **Git-städning** (PR #507): 40 ospårade filer, ~95% Obsidian-valvet (`docs/vault/`, byggt session 39) plus `docs/ARKITEKTURGUIDE.md` (flaggad som olöst sedan session 29). Lade till `docs/vault/.obsidian/` i `.gitignore` (Obsidians egna appinställningar + nedladdade plugin-binärer, regenereras automatiskt — samma logik som `node_modules/`), committade allt riktigt innehåll (23 anteckningar + arkitekturguiden, lästes igenom innan commit). `git status` rent, 40 → 0

**Problem och lösningar:**
- Ett första diagnostik-curl-kommando till användaren använde en relativ path (`/api/push/test`) i webbläsarkonsolen — gav 405 eftersom det träffade `samhallsinformation.se` (Vercel, bara frontend) istället för Railway-backend. Frontendens egen kod anropar alltid backend via en full URL (`VITE_API_URL`), aldrig relativt. Löst med korrigerad fetch mot rätt origin
- Samma etablerade rate-limiter-fälla som tidigare sessioner (5/min/IP på `/api/auth/*`) triggades igen under en snabb testrunda av bekräfta/avbryt/redan-tagen-adress-flödena — löst genom att lita på den redan gröna unit-testsviten för den specifika assertionen istället för att forcera igenom begränsningen
- En första `curl -d` med inline-escapade citattecken i ett test-feedback-inskick gav ett förvirrande `400`/"req krävs"-fel — samma redan kända multi-byte/citattecken-i-heredoc-fälla som tidigare sessioner, löst med samma etablerade fix (skriv payload till fil, `curl --data-binary @fil`)
- Chrome-tillägget för webbläsarautomation flakade igen (tappad tabb, timeout) vid första försöket att diagnostisera push live i webbläsaren — föll tillbaka på samma etablerade DevTools-konsol-fetch-mönster som session 30, med gott resultat (användaren körde själv, klistrade in svaren)
- Efter att `RequestEmailChangeAsync` fick ett tredje parameter (`currentPassword`) behövde tre befintliga tester i `AuthServiceTests.cs` uppdateras med en riktig `IPasswordHasher`-mock — annars föll de på den nya guarden (NSubstitutes default-retur för en enum är dess första/nollvärde, som råkar vara `Failed`)

**Etablerat mönster:**
- **En självrannsakan om edge-cases på egen kod är värd att göra INNAN användaren ber om det** — bad användaren om en granskning av e-postbytesflödet, hittade själv den allvarligaste luckan (ingen re-autentisering för att STARTA ett byte) och föreslog fixen proaktivt, användaren sa bara "ja, gör båda". Mönstret upprepades med git-städningen (40 ospårade filer upptäcktes och föreslogs städas utan att användaren bett om en total-genomgång)
- **En smal, korrekt fungerande bevakning/filter kan se "trasig" ut bara för att verkligheten är tyst** — innan man antar att en notis-/matchningskedja är buggig: kolla om det faktiskt FINNS matchande data i den aktuella tidsperioden, inte bara att koden/inställningarna ser rätt ut. Samma lärdom som session 33/34s "kolla den faktiska datan, inte bara koden" fast tillämpad på push-notiser denna gång
- **DNS-nivå-diagnostik (SPF/DKIM/DMARC) görs enklast direkt mot en DNS-over-HTTPS-endpoint** (`cloudflare-dns.com/dns-query`) istället för att gissa eller be användaren logga in i Cloudflare för att kolla — samma verifiera-inte-gissa-princip som redan gäller för kod, applicerad på DNS-konfiguration
- En knapps UNDERTEXT/etikett är ett kontrakt med användaren om vad som händer vid klick — "Inställningar & konto" som undertext men bara rollväljare+utloggning i verkligheten är samma sorts bugg som ett API-svar som inte matchar sin dokumentation. Värt att läsa knapptexter bokstavligt vid en UI-genomgång, inte bara testa att de "känns ungefär rätt"
- Obsidian-valv i ett projekt: committa `.md`-innehållet, `.gitignore`:a `.obsidian/`-mappen (appens egna lokala inställningar + nedladdade plugin-binärer) — samma "genererat vs. källa till sanning"-uppdelning som redan gäller för `bin/`/`obj/`/`node_modules/`

**Next session:**
- Vänta på att DMARC-posten sprider sig (kan ta upp till ett dygn), kör om Hotmail-registreringstestet, och om det går bra: slå på `showLoginButton`/`showRegisterButton` i produktion — sista pusselbiten i launch-ordningen sedan session 33
- Ta bort testartefakterna om användaren vill: supportärende #9 ("TEST push - admin-diagnos") och testkontot `test-push-diagnos-27aug@example.com` ligger kvar i produktion på användarens uttryckliga begäran ("låt de ligga")
- `Ideer/Riktig app`-noten är `redo-for-pipeline` (scope: Android via PWABuilder, ingen iOS) — inte påbörjad, ingen brådska
- `Ideer/Bottom bar (mobil)`-noten väntar på att antingen citizen-Sök eller Bevakningar-som-egen-sida byggs innan den är värd att ta upp igen

---

### Session 38 — 2026-08-22
**What was done:**
- **Extern testarfeedback genomgången**: användaren delade en hel mejltråd med en person som testat sajten. Sparad i minnessystemet (`project_extern_feedback_maildialog_2026-08.md`) med fullt innehåll — nyckelpunkter: designfilosofi "lös det genom design, inte tutorial" (jfr TikTok/GPT/Google/Amazon, ingen behöver en tutorial), en virality-feature-idé (dela en händelse till sparade kontakter/sociala grupper med ett klick — medvetet sparad till senare, användaren har redan en egen tanke om hur), SPAR och mailnotiser bekräftade som sannolikt aldrig byggda, SEO-siffror (#2 på Google för "samhällsinformation", 116 impressions/10 klick/3 mån), monetisering (helst gratis, anslag eller betala-för-tidig-tillgång, uttryckligen inte reklam)
- **Tutorial-popupen borttagen** (PR #492): `WelcomeModal.tsx` (visade sig vid första besök, förklarade hamburgermenyn) raderad helt — direkt beslut från feedback-tråden. Ett `<`-ikon-alternativ för hamburgermenyn diskuterades och avfärdades av användaren själv
- **Nytt GA4-event `sidebar_open`** i `Sidebar.tsx` (samma `w-gtag?.('event', ...)`-mönster som redan fanns för `theme_change` i `ThemeContext.tsx`) — mäter om folk fortfarande hittar/öppnar sidomenyn nu när tutorialen är borta. Fångar både hamburgerklick och touch-swipe eftersom det sitter på själva `Sidebar`-komponenten (delad av alla sidor), inte på varje enskild öppningsknapp. Ingen "innan"-baseline finns (tutorialen togs bort i samma PR) — jämförelsen blir framåtblickande volym
- **Aktivitetslogg wave 1 (issue #491) byggt och mergat i tre sekventiella PR:ar**, planerade i EnterPlanMode innan kodning:
  - **PR #493 (kärna)**: `AdminActivityLog` breddad med `AktörTyp` ("System"/"Admin"), `Ip`, `Enhet`, `GammaltVärde`/`NyttVärde`, `Arkiverad`, `Test`. Ny delad `Application/Aktivitetslogg/IAktivitetsloggService` som fångar Vem/Ip/Enhet automatiskt från `IHttpContextAccessor` (måste registreras explicit, fanns inte i `Program.cs` innan). Nya `AktörTyper`/`LoggTyper`-konstanter. GET-endpointen rördes MEDVETET inte i denna PR — se Etablerat mönster
  - **PR #494 (instrumentering)**: `LogAsync`-anrop tillagda i alla 13 wave 1-write-sites (feature flags, källhantering, SiteSettings, driftmeddelande, FAQ, konto spärra/återaktivera/GDPR-radera/ångra, ärende tilldela/status/arkivera, push). Två helt nya radtyper som tidigare inte loggades alls: Ny registrering och Ärende öppnat (båda `AktörTyp=System`, citizen-initierade — loggar bara namn + metod/kategori, ALDRIG e-post, ett explicit produktbeslut från användaren för att inte dra in wave 1 i wave 2:s GDPR-tyngd)
  - **PR #495 (frontend)**: `GET /api/admin/activity-log` skriven om från en obegränsad hela-tabellen-fetch till riktig server-side filtrering (`aktörTyp`/`typ`/`sök`/`från`/`till`) och paginering (`gräns`), med en minnesbaserad sammanslagning mot `IngestorRunLog` (skrivsidan/Felsökningens `/summary`-endpoint helt orörda — beslutat med användaren att INTE migrera in ingestor-loggningen i den delade tabellen). `Aktivitetslogg.tsx` fick ett nytt Aktör-filter (Alla/System/Admin) som FÖRSTA filterdimensionen (issue #491 steg 2) och en utökad Typ-taxonomi (Konfiguration/Konto/Ärende/Push/Registrering utöver de gamla). `Oversikt.tsx`s "Senaste händelser" bytt ut helt mot samma endpoint istället för egen users/tickets/källfel-hopslagning — precis det issuet efterfrågade. Normaliserade i samma veva gamla `"Sparat: tillagd"/"Sparat: borttagen"`-Typ-värden till `"Kontoåtgärd"` (idempotent data-fix i `Program.cs`, ingen schemaändring) så det nya Typ-filtret matchar konsekvent på både gammal och ny data
- **Issue #491 uppdaterat men lämnat öppet**: checklistan avbockad för allt klart, tre punkter kvar olösta och tydligt flaggade — impersonation-loggning (ingen riktig impersonation-backend finns än), en "Arkivera"-knapp i UI (datamodell/filter finns, ingen knapp), test-taggning vid källan (datamodell/filter finns, ingen mekanism känner igen ett test-/betakonto)
- Verifierat vid varje steg: `dotnet build`/`test` (90/90 gröna hela vägen), `tsc -b`/`npm run build`, och för PR3 en fullständig Playwright-körning mot en riktig lokal backend (Aktör-/Typ-filter inkl. en legitim tom träffmängd, Översikts filtrerade vy, POST/undo för Kontoåtgärd) — inga konsolfel, skärmdumpar granskade innan push

**Problem och lösningar:**
- Ett första `git commit` för PR2 (instrumenteringen) hamnade av misstag ovanpå PR1:s commit på SAMMA lokala gren istället för en ny — upptäckt innan push. Löst genom att grena av en ny branch vid PR1:s commit (`git branch <namn> <sha>`), sen `git reset --hard` tillbaka den ursprungliga grenen till bara PR1:s commit. Ingen force-push behövdes eftersom inget var pushat än
- PR2/PR3 fick därför en genuin kodberoende på PR1 (inte bara en vanlig "parallell gren"-situation) — `IAktivitetsloggService`/`AktörTyper`/`LoggTyper` existerar inte förrän PR1 är mergad. Löst genom att öppna PR:arna i tur och ordning och låta användaren merga var och en innan nästa grenades — PR2/PR3:s diff mot `main` visade sig fullständig (inkl. föregående PR:s ändringar) fram tills respektive beroende faktiskt mergats, sen smalnade GitHub automatiskt av diffen. Inget att fixa, bara att förvänta sig
- Upptäckte under kartläggningen att `AdminActivityLog.Typ` för Sparat-rader i verkligheten var `"Sparat: tillagd"`/`"Sparat: borttagen"` (inte `"Kontoåtgärd"` som frontend alltid visade — `Aktivitetslogg.tsx` hårdkodade om till "Kontoåtgärd" vid rendering oavsett verkligt värde). Hade det nya exakta Typ-filtret fått vara kvar orört hade `typ=Kontoåtgärd` gett NOLL träffar på alla riktiga rader. Löst genom att byta de två call-sites (`Anvandare.tsx`, `Handelsesok.tsx`) till att skicka `'Kontoåtgärd'` direkt (Rubrik-texten beskriver redan tillagd/borttagen, ingen information förloras) plus en idempotent bakåtgående data-fix för redan sparade rader
- En första curl-verifiering med rå `ä` inline i query-strängen (`?gräns=8`) gav ett tomt svar — samma redan kända encoding-fälla som tidigare sessioner (multi-byte-tecken genom Bash-verktyget), löst med procentkodning (`gr%C3%A4ns=8`), inte en bugg i endpointen
- Playwright-verifieringen krockade först med CORS eftersom Vite kördes på port 5180 men backend bara tillät `localhost:5173` — löst genom att köra Vite på standardporten istället för att ändra CORS-konfigurationen

**Etablerat mönster:**
- **En backend-endpoints RESPONSFORM får aldrig ändras i en PR som saknar den matchande frontend-konsumenten i samma release** — även när modellfälten/den nya loggningstjänsten som ligger UNDER endpointen är helt overksamma och säkra att skicka separat. Konkret denna session: PR1 hade ursprungligen planerats inkludera GET-endpoint-omskrivningen, men flyttades till PR3 (som landar tillsammans med frontend-omkopplingen) efter att det upptäcktes att den skulle bryta den då fortfarande-levande `Aktivitetslogg.tsx` mellan PR1 och PR3:s mergningar. Samma regel som redan fanns (`feedback_breaking_change_rollout`), bekräftad igen i en ny konkret situation
- Vid en "bredda en befintlig tabell till en delad logg"-uppgift: håll separata, redan fungerande specialiserade tabeller (här `IngestorRunLog`, med sin egen `/summary`-endpoint för Felsökning) ORÖRDA på skrivsidan och slå bara ihop dem VID LÄSNING i den nya delade endpointen. Mindre invasivt, ingen risk för befintlig funktionalitet, och datavolymen i en admin-panel av den här storleken gör ett fönstrat (inte en riktig DB-nivå UNION) minnesbaserat samgående fullt tillräckligt
- Innan ett nytt Typ/kategori-filter läggs till mot ett fält som redan finns i databasen: kontrollera det FAKTISKA lagrade värdet (inte bara vad frontend råkar visa/hårdkoda om det till) — annars kan ett till synes korrekt exakt-match-filter tyst missa all historisk data
- System-aktör-loggrader för citizen-initierade händelser (registrering, ärende öppnat) ska logga identifierande information (namn) men ALDRIG kontaktuppgifter (e-post) — håller dem kvar i wave 1:s "liten, betrodd volym"-motivering istället för att smyga in wave 2:s GDPR-tyngd genom bakvägen
- En plan godkänd via `EnterPlanMode` är inte huggen i sten om en genomförandedetalj (som PR-uppdelningen ovan) visar sig bryta mot en redan etablerad regel under kodningen — bättre att avvika transparent och förklara varför för användaren än att följa den godkända planen bokstavligt in i en känd fälla

**Next session:**
- Issue #491 kvar öppet — tre punkter, ingen brådskande: impersonation-loggning (väntar på att `Impersonation.tsx` byggs på riktigt, redan känd väntande uppgift sedan session 27/34), en "Arkivera"-knapp i Aktivitetslogg-UI:t, en mekanism för test-/betakonto-taggning vid källan
- Virality/dela-händelse-feature (från mejlfeedbacken) — medvetet väntande, användaren har en egen idé att dela när det är dags
- `sidebar_open`-mätningen i GA4 — användaren sätter en egen påminnelse ~2026-08-29 för att kolla resultatet
- Data-till-nyhetsredaktioner-idén från mejltråden — helt öppen fråga, inget beslut

---

### Session 36 — 2026-08-20
**What was done:**
- Sessionen inleddes med en avbruten föregående session — verifierade via `git status`/`git log` att inget arbete gått förlorat (working tree rent, senaste två commits redan på plats)
- Startade lokal backend (`dotnet run`) och frontend (`npm run dev`) i bakgrunden på användarens begäran, för att kunna dubbelkolla driftbanderollen live
- **Driftbanderollens text** (`App.tsx`): förstorad +2px och centrerad på begäran, itererad till en exakt `text-[18px]`
- **UTC vs svensk tid-diskussion**: klargjorde att Sverige kör sommartid (CEST, UTC+2) i augusti — Railways "Sat 10:00–Sun 18:00 UTC" blir "lördag 12:00–söndag 20:00" svensk tid, inte samma klockslag
- **Hittade och fixade en verklig UX-bugg i banderollen**, upptäckt av användaren via skärmdump: meddelandetexten fick en auto-tillagd tidsparentes `({startUtc}–{endUtc})` som visade banderollens VISNINGSFÖNSTER, inte den faktiska underhållstiden admin skrev i meddelandet — kunde motsäga adminens egen text (skedde i praktiken, olika datum). Parentesen borttagen; `startUtc`/`endUtc` styr fortfarande bara när banderollen syns, visas inte längre i texten (PR #490, commit `aea9d18`)
- **Standardtext-knapp för underhållsmeddelanden**: ny "Använd standardtext (underhåll)"-knapp i `MaintenanceBannerAdmin.tsx` som genererar meddelandet från de redan ifyllda start-/sluttiderna i formuläret — förhindrar att texten hamnar i otakt med de riktiga tiderna. Diskuterade fler mallar för andra meddelandetyper, användaren ville avvakta ("vi har annat att prioritera") — bara underhåll byggt, men som en egen fristående funktion så fler mallar/knappar är enkla att lägga till senare
- **Valfria UTC-omvandlingsfält**: två nya "UTC-start"/"UTC-slut (valfritt)"-fält i samma formulär som auto-räknar om till svensk lokal tid (DST-medveten, `isoTillDatetimeLocal`-mönstret återanvänt) och fyller i de befintliga lokala fälten — löser exakt det UTC/lokal-missförstånd som uppstod tidigare i sessionen. Diskuterade en generell tidszonsväljare (fler zoner än UTC), landade på att INTE bygga det — Railway är den enda kända UTC-källan idag, en dropdown för hypotetiska framtida zoner vore för tidigt (PR #490, commit `03452ae`)
- **Lokalt admin-testkonto skapat och sparat i minnet**: `admin@dev.lokal` — databasen hade fem gamla admin-testkonton (`dev-admin@local.test`, `admin@test.se`, `mbtest_admin@test.se`, `mbtest_admin2@test.se`, `admin@lokal.se`) utan kända lösenord (bara hascharna kvar). Genererade ett nytt lösenord, seedade via `ADMIN_EMAIL`/`ADMIN_PASSWORD`-env-variabler, verifierade med en riktig inloggning (200 + giltig JWT). Sparat i `reference_lokal_admin_konto.md` i minnessystemet för återanvändning
- **Playwright-skärmdumpsverifiering** (samma etablerade `npm install --no-save playwright`-mönster som tidigare sessioner): injicerade adminens JWT direkt i `localStorage` via `addInitScript`, navigerade till Feature flags-sidan i admin, öppnade "Nytt driftmeddelande"-formuläret, fyllde i UTC-tider och bekräftade visuellt att omräkningen, standardtexten och layouten (mörkt tema, ljusare bakgrundsruta för UTC-fälten) fungerade korrekt innan commit
- PR #490 öppnad och mergad av användaren tillsammans med tre väntande Dependabot-PR:ar (eslint-plugin-react-refresh, globals, typescript-eslint). Lokal `main` synkad (`git pull`, 11 commits ifikapp), och sex lokalt mergade branches städade bort (`feat/maintenance-banner` + fyra äldre grenar från tidigare sessioner + en dokumentationsgren)

**Problem och lösningar:**
- Lokal backend kraschade med 500 på VARJE `/api/auth/*`-anrop (inklusive login) när `RESEND_API_KEY` saknades som miljövariabel — `AuthController` konstruerar `ResendEmailService` via DI oavsett endpoint, och konstruktorn kastar om nyckeln saknas. Löst genom att alltid sätta en dummy-nyckel (`RESEND_API_KEY=dummy-local-key`) vid lokal körning. Gav initialt en missvisande signal (401-liknande, faktiskt 500) när ett gissat lösenord testades — verifierades mot backend-loggen istället för att anta att lösenordet bara var fel
- Adminens seed-logik (`Program.cs`) skapar bara ett konto om e-posten INTE redan finns — att sätta nya `ADMIN_EMAIL`/`ADMIN_PASSWORD` för ett redan existerande konto (`admin@lokal.se`) satte alltså inget nytt lösenord på det. Löst genom att skapa ett helt nytt konto (`admin@dev.lokal`) istället för att försöka återställa ett gammalt
- Playwright-skriptets första körning fastnade (timeout) på att leta efter "Nytt meddelande"-knappen direkt på Översikt-sidan — Driftmeddelanden-sektionen ligger faktiskt under adminens "Feature flags"-sida (`AdminPage.tsx`), inte en egen synlig meny-post. Löst genom att navigera dit explicit innan interaktion, samma "verifiera mot faktisk DOM, gissa inte"-lärdom som tidigare sessioners Playwright-arbete

**Etablerat mönster:**
- En banderoll/meddelande-komponent som återanvänder samma `startUtc`/`endUtc`-fält både för att STYRA VISNING och för att GENERERA VISAD TEXT riskerar att visa två olika, motsägande tidsangivelser om admin medvetet sätter ett bredare visningsfönster än det faktiska händelsefönstret (t.ex. varna i förväg + bekräfta efteråt). Om ett fält har dubbla syften (styrning + visning): fråga om båda syftena verkligen ska dela exakt samma värde, eller om texten hellre ska vara helt fristående admin-skriven text
- Ett formulär som kräver lokal tid men vars källdata ofta kommer som UTC (tredjepartsleverantörer som Railway) bör erbjuda en valfri, auto-omvandlande genväg istället för att lita på att admin räknar om för hand — bekräftat värdefullt genom att vi själva gissade fel en gång i den här sessionen innan fältet fanns
- Ett nytt lokalt dev-only admin-konto (e-post + lösenord) hör hemma i minnessystemet (`reference_*`), inte bara i sessionsloggen — återanvänds direkt nästa session utan att behöva gissa mot gamla, okända testkontons hascher igen
- Lokal backend-uppstart för det här projektet kräver konsekvent `RESEND_API_KEY` satt (vilket värde som helst) — annars kraschar HELA `/api/auth/*`-ytan, inte bara e-postutskicket. Redan känt sedan tidigare sessioner men värt att upprepa: sätt den alltid proaktivt vid lokal `dotnet run`, vänta inte på att en 500:a avslöjar det

**Next session:**
- Ingen specifik uppgift bestämd — sessionen avslutades med att PR #490 + Dependabot-PR:arna var mergade och `main` synkad. Näst-senaste öppna trådar från session 35 kvarstår oförändrade (registreringstester hotmail/gmail innan Logga in/Skapa konto-knapparna slås på igen, `kallor_polisen_filter`-flaggan medvetet fortsatt avstängd, m.m. — se Session 35 nedan)

---

### Session 35 — 2026-08-19
**What was done:**
- **Reflektionssamtal innan kodning**: användaren bad om en tillbakablick på resan hittills (34 sessioner, live på Vercel+Railway+Resend) och min syn på nästa mål. Slutsats: tekniskt öppen för användare redan, väntar bara på två planerade registreringstester (hotmail/gmail) innan Logga in/Skapa konto-knapparna slås på igen — men användaren ville fixa polisfiltret innan dess.
- **Kartlade hela polisfiltrets kedja** på begäran (`UserPolisenFilter`, `UserPolisenFilterController`, `PolisenFilterContext`, `NewsFeed.tsx`s matchning, `PrenumerationsKlocka`) och förklarade den för användaren. Hittade i förbifarten att push-notiser INTE respekterade filtret alls (bara källprenumeration), flaggat men inte löst i det läget.
- **Produktdiskussion → ny datamodell**: användaren ville kunna uttrycka flera oberoende önskemål samtidigt ("allt i Göteborg" + "skjutningar i Stockholm" + "försvunna personer i Stenungsund"), var och en redigerbar utan att påverka de andra. Den gamla modellen (två platta listor, AND-kombinerade) kan bara uttrycka EN rektangel i en typ×område-matris — otillräckligt. Enades om: en lista av "bevakningar" (flera rader per användare, ELLER-kombinerade, AND inom varje rad), max 10 st, push ska styras av dem, push-text ska nämna typ+område när det går annars en generisk räknartext, noll bevakningar = oförändrat beteende (allt syns/pushas).
- **Plan skriven och godkänd** (`EnterPlanMode`), sedan byggd på gren `feat/polisen-bevakningar`:
  - Backend: ny tabell `PolisenBevakningar` (ersätter `UserPolisenFilters`, med datamigrering av befintliga rader i samma raw-SQL-block, samma Postgres-säkra mönster som tidigare migrationer), ny `UserPolisenBevakningController` (`GET/POST/PUT/DELETE /api/user/polisen-bevakningar`, taket enforcat server-side — 10 initialt, sänkt till 5 samma session, se nedan), ny `PolisenBevakningMatcher` (delad matchningslogik), `EventSync.SyncAsync` utökad att returnera de faktiska infogade händelserna (inte bara antal) så `PushDispatcher` kan matcha Polisen-mottagare individuellt mot sina egna bevakningar istället för en delad batchtext.
  - Frontend: `PolisenBevakningarContext` (ersätter `PolisenFilterContext`), ny `PolisenBevakningarLista`-komponent under Mina källor (ersätter den enda delade Filter-knappen), `KategoriFilterModal` omskriven till att äga sitt eget utkast-state med explicit Spara/Avbryt (i stället för att mutera delad global state live), `PrenumerationsKlocka` omskriven — "Allt"-läget skapar en ny bevakning per klick, "Mitt"-läget visar bara en ta-bort-knapp när EXAKT en bevakning är anledningen till träffen (annars ingen affordance, för att undvika att gissa fel bevakning vid överlapp).
  - Sido-uppdateringar som följde av datamodellsbytet (inte i ursprungsplanen, men nödvändiga för att inte krascha bygget): GDPR-exporten (`AuthController.ExportMe`) och adminens read-only observabilitetsvy (`AdminUserDetailsController`/`Anvandare.tsx`) läste båda den gamla `UserPolisenFilters`-tabellen — uppdaterade till att lista flera bevakningar istället för en.
- **Allvarlig bugg hittad under live-verifiering, fixad innan push**: matchningslogiken (både den gamla frontend-koden och mitt första utkast till backend-matchern) jämförde `title.startsWith(kategori)`. Verklig Polisen-data (kollad direkt i lokala databasen) visar att titeln faktiskt börjar med ETT DATUM ("14 augusti 13.05, Trafikolycka, ...") — inte typen. En bevakning på "Trafikolycka" hade alltså ALDRIG matchat något skarpt i produktion, tyst. Fixat genom att matcha mot det redan strukturerade `EventType`-fältet (fanns i databasen sedan PR #373, men var varken exponerat i den publika Events-DTO:n eller använt av frontend/backend-matchningen) istället för att textparsa `Title`. `eventType` tillagt i frontend `CanonicalEvent`-typen (optional, eftersom `MOCK_EVENTS`-fallbacken saknar fältet).
- **Live-verifiering, hela vägen**: `dotnet build`/`dotnet test` (90/90 gröna, inkl. nya tester för bevaknings-push-matchningen) och `tsc -b` rent. Playwright (npm-installerat lokalt med `--no-save`, ingen `package.json`-ändring) mot en riktig körande lokal backend: registrerade en testanvändare genom onboardingflödet, la till Polisen, skapade två bevakningar, redigerade den ena (bekräftade att den andra var opåverkad), tog bort en, och bekräftade att Mitt flöde faktiskt smalnar av mot skarp backend-data (inte bara mot inställningssidan) — krävde en tillfällig andra Vite-instans med `VITE_USE_MOCK=false` eftersom `.env.local` annars alltid kör flödet mot `MOCK_EVENTS`.
- PR #483 (huvudfunktionen) mergad. Två snabba uppföljningar direkt efter, egna PR:ar: **#484** — `kallor_polisen_filter`s label/beskrivning uppdaterad från "Polisen-filter"/"Kategori/kommun-urval" till "Polisen-bevakningar"/text som beskriver flera oberoende bevakningar (flaggan förblir avstängd, bara text ändrad). **#485** — taket sänkt från 10 till 5 bevakningar per användare (`MaxBevakningar`/`MAX_BEVAKNINGAR`, samma konstant på backend och frontend), på användarens begäran, för att kunna hålla koll på hur många bevakningar som faktiskt skapas innan gränsen eventuellt höjs igen. Båda verifierade (build/test/tsc + en riktig curl-runda som skapade 5 och fick 400 på den 6:e) innan push. Alla tre PR:ar (#483–#485) mergade, lokala grenar städade bort efteråt.

**Problem och lösningar:**
- Samma etablerade `dotnet build`-fillås-gotcha som tidigare sessioner (bakgrundskörande `dotnet run` håller `.exe`-filen låst) — löst genom att hitta processen via `netstat`/`taskkill` istället för `pkill` (som missade den faktiska Windows-processen första gången och lämnade den gamla instansen kvar och svarande på porten, vilket gav en förvirrande "samma fel igen"-signal).
- Samma kända encoding-fälla som session 34 dokumenterade: multi-byte å/ö/ä-tecken i ett inline curl `-d`-argument genom Bash-verktygets heredoc gav trasiga JSON-fält (`"Göteborg"` blev tomt). Löst med samma etablerade fix: skriva payloaden till en fil och `curl --data-binary @fil`.
- Ett första Playwright-registreringsförsök fastnade tyst på ett tredje "Redo att skapa ditt konto?"-bekräftelsesteg (en `Gå till mitt flöde`-knapp, inte `Fortsätt`/`Nästa`/`Klart` som skriptet letade efter) — användaren hamnade utloggad utan felmeddelande. Upptäckt genom att jämföra en skärmdump mot vad som förväntades, inte genom att lita på att `page.goto` lyckades.
- `kallor_polisen_filter`-feature-flaggan (samma flagga-i-kod-plus-DB-override-mönster som session 34 byggde) var avstängd som standard sedan en tidigare session — bevaknings-UI:t syntes inte alls förrän flaggan slogs på manuellt i den lokala databasen för verifieringen (och stängdes av igen efteråt, ingen kvarvarande ändring).

**Etablerat mönster:**
- **En "en rad per användare, två platta AND-kombinerade listor"-modell kan bara uttrycka EN regel.** Så fort en användare vill uttrycka flera oberoende önskemål samtidigt (ELLER mellan dem) krävs en riktig en-till-många-tabell (flera rader per användare), inte en breddning av samma rad. Värt att känna igen mönstret tidigt nästa gång ett "filter" känns för begränsande — frågan att ställa är "ska det gå att ha flera av dessa samtidigt?", inte "vilka fler fält behöver raden?".
- **Ett fält som ser strukturerat ut i databasen (`EventType`) är inte pålitligt förrän man faktiskt kollat vad som ligger i det, mot skarp data — inte bara läst extraktionskoden.** Både den gamla och min egen första implementation antog fel sträng (`Title` istället för `EventType`) baserat på en kommentar som visade sig vara inaktuell/fel. Direkt SQLite-koll av verkliga rader (`SELECT Title, Geography, EventType FROM Events WHERE EventType IS NOT NULL`) avslöjade felet på sekunder — borde vara ett förstahandssteg vid all matchningslogik mot fritextkällor, inte ett sistahandssteg efter att något "inte fungerar".
- Playwright kan installeras tillfälligt i ett projekt utan testinfrastruktur via `npm install --no-save playwright` (ingen `package.json`/lockfil-ändring, `node_modules/playwright` bara lokalt för sessionen) — användbart för det här projektet specifikt eftersom frontend fortfarande helt saknar testinfrastruktur (etablerat sedan tidigare sessioner).
- Push-notiser som ska respektera per-användare-filtrering kräver att den bakomliggande batch-mekanismen (en delad text till alla mottagare) bryts upp per mottagare — `EventSync.SyncAsync` behövde utökas att returnera de faktiska infogade entiteterna, inte bara ett antal, för att matchningen skulle ha något att matcha mot.

**Next session:**
- Köra de två planerade registreringstesterna (hotmail + gmail) och sedan slå på Logga in/Skapa konto-knapparna i produktion igen (väntar sedan session 33/34)
- `kallor_polisen_filter`-flaggan (nu med uppdaterad label/beskrivning, #484) är medvetet fortsatt avstängd — användaren kör egna tester av bevakningarna i produktion kommande dagarna innan den slås på i Adminpanel → Feature flags
- Den kuraterade `POLISEN_KATEGORIER`-listan (16 kategorier, insamlad 26 juli 2026) täcker inte Polisens fulla kategorivokabulär — verkliga händelser med typer som "Rattfylleri", "Bedrägeri", "Stöld/inbrott", "Arbetsplatsolycka" faller igenom som "okänd typ" och visas/pushas alltid oavsett bevakning (samma passthrough-princip som redan fanns, inte en regression, men värt att bygga ut listan eller hämta den dynamiskt från skarp data om det blir ett återkommande klagomål)
- `SiteSettings`/`FeatureFlagOverrides`-dubbleringen (flaggad i session 33/34) fortfarande inte löst

---

### Session 34 — 2026-08-19
**What was done:**
- **Kartlade allt som låg i frontendens `localStorage`** på användarens begäran (14 nycklar) och klassificerade var och en: session/enhetsdata som hör hemma lokalt (`si_token`, `theme`, `cookie_consent` m.fl.) kontra admin-data som *ser ut* som delad men bara påverkade den egna webbläsaren. Fyra tydliga kandidater identifierades för migrering: källordning, FAQ-innehåll, feature flags, aktivitetslogg (Sparat-poster)
- Användaren bad om en bredare genomgång ("finns det fler saker med samma problem?") — utökad kartläggning hittade fem till (redan MOCK-badgade sedan tidigare sessioner): `Anvandare.tsx` (`MOCK_AKTIVITET`/`MOCK_NOTIF`), `Impersonation.tsx` (`MOCK_SESSIONER`), Källhanterings "Schemalagda ändringar"/"Externa statusflöden", samt en separat kategori (Notifieringar-flikens `StorEj`/`Leveranslage`/`NotisHistorik` — användarens EGNA inställningar som inte sparas alls, inte ett admin-delningsproblem). Efter avstämning: bygg de fyra bekräftade nu, spara resten till en framtida session med mer produktdiskussion
- **Källordning → backend** (PR #479): sidomenyns dra-och-släpp skrev tidigare bara till `si_source_order`, helt frikopplad från `UserSourcePreference` som Mina källor redan använde. Ny logik i `useSourceOrder.ts` skriver mot samma backend-fält för inloggade. Viktig avstämning med användaren innan kod: en källa som dras om men aldrig aktivt lagts till i Mina källor ska bara få sin `sortOrder` satt, `isActive` förblir `false` — en drag-and-drop räknas inte som samtycke till notisvolym. Upptäckte i förbifarten att den gamla localStorage-fallbacken för utloggade var dödkod (Sidebar renderade alltid rå API-ordning för utloggade, ingen drag-UI syns för dem) — borttagen istället för att byggas vidare på
- **FAQ → backend** (PR #480): ny `FaqItems`-tabell + `FaqController` (`GET /api/faq` publikt bara publicerade, `GET/POST/PUT/DELETE /api/admin/faq` Admin-roll), seedad en gång med de nio ursprungliga frågorna. `AdminFaq.tsx`/`FaqKort.tsx` om till react-query
- **Feature flags-överskridningar → backend** (PR #481): flaggornas definitioner (label/beskrivning/`defaultAktiv`/roadmap) ligger kvar i `lib/featureFlags.ts` som kodkonfiguration — bara admins avvikelser flyttas till en ny `FeatureFlagOverrides`-tabell (`GET /api/feature-flags` publikt, `PUT/DELETE /api/admin/feature-flags` Admin). Verifierat på det sätt som faktiskt bevisar globalt tillstånd: en flagga avstängd i adminpanelen slog igenom för en helt annan, aldrig tidigare inloggad användares webbläsare — exakt det den gamla per-webbläsare-buggen (dokumenterad i session 33) inte klarade
- **Aktivitetsloggens Sparat-poster → backend** (PR #482): ny `AdminActivityLog`-tabell + `AdminActivityLogController`. Rollmodell verifierad live med ett riktigt upphöjt Support-konto: `POST` (Admin+Support, klassattribut) fungerar, `GET`/undo (metodnivå `[Authorize(Roles="Admin")]` ovanpå) ger 403 för Support — bekräftar att `[Authorize]`-attribut kan smalna av (AND), inte bara vidga, precis som session 33 teoretiserade men aldrig testade. Sidoeffekt, en riktig bugg fixad på köpet: `vem`-fältet var en hårdkodad mock-konstant (`"Joakim Rehn"`) oavsett inloggad användare — hämtas nu ur JWT:ns namn-claim, medan `(X-läge)`-delen fortfarande kommer från klientens `aktivVy` (rollväljarvyn, inte JWT-rollen)
- Alla fyra grenar testade live mot en riktig lokal backend (SQLite, `dotnet run` + Vite dev-server) med Playwright innan push — inte bara enhetstester. Käll­ordning: faktisk mus-drag i sidomenyn. FAQ: fullständig CRUD-runda genom admin-UI:t. Feature flags: två separata webbläsarkontexter för att bevisa globalt tillstånd. Aktivitetslogg: hela Händelsesök → spara → logga → ångra-kedjan
- **Merge-krockar, tre omgångar** (samma mönster som session 33s "flera grenar bygger vid samma insättningspunkt", men denna gång orsakat av en HELT SEPARAT, parallell PR): PR #478 ("global site settings för Logga in/Skapa konto-knapparna", `SiteSettings`-tabell) mergades in på `main` mellan att grenarna skapades och mergades — okänt av vem, upptäcktes först när PR #480 fick konflikt efter att PR #479 gått igenom rent. Samma `AppDbContext.cs`/`Program.cs`-insättningspunkter kolliderade sedan ytterligare två gånger i takt med att användaren mergade PR:arna en i taget (480 mot 478, 481 mot 478+480, 482 mot 478+480+481) — eskalerande antal tabeller att slå ihop för varje runda. Löst tre gånger med samma recept: `git checkout <gren>` → `git merge origin/main --no-commit --no-ff` → manuell sammanslagning av ALLA sidors tillägg (aldrig välj den ena) i `AppDbContext.cs`, `Program.cs`, och en gång `AppDbContextModelSnapshot.cs` → `dotnet build`/`tsc -b` rent → live smoke-test att samtliga nya endpoints svarar sida vid sida → commit + push (uppdaterar PR:en, ingen force-push)
- Upptäckte i förbifarten: PR #478 gjorde konceptuellt samma jobb som feature-flags-migreringen, fast bara för två specifika flaggor (`auth_logga_in_knapp`/`auth_skapa_konto_knapp`, flyttade dem till en egen `SiteSettings`-singleton-rad istället för den generiska `FeatureFlagOverrides`-tabellen). Ingen kodkonflikt i sak (PR #478 tog bort de två flaggorna ur `FLAG_GRUPPER` innan min gren rörde filen), men två separata mekanismer för "globalt admin-styrt on/off" finns nu i kodbasen. Flaggat för framtida ihopslagning, inte löst
- Alla fyra PR:ar gröna i CI (både `CI` och `Backend CI`-workflows) och mergade till `main`. `si_source_order`, `si_faq_items`, `samhallsinformation_feature_flags`, `si_admin_aktivitetslogg` är borta ur localStorage

**Problem och lösningar:**
- `dotnet build`/`dotnet ef migrations add` misslyckades upprepade gånger med filläsningsfel — samma etablerade orsak som tidigare sessioner (en bakgrundskörande `dotnet run`-process håller `.exe`-filen låst). Löst genom att alltid stoppa bakgrundsprocessen (PowerShell `Stop-Process`) innan varje ny build/migration
- Ett första curl-test av `AdminActivityLogController`s POST visade `ångraData: null` trots att den skickades med — visade sig vara en encoding-artefakt i hur ett multi-byte å-tecken skickades som inline `-d`-argument via Bash-verktyget genom en heredoc, inte en riktig deserialiserings-bugg. Löst genom att skriva payloaden till en fil (garanterat korrekt UTF-8) och skicka med `curl --data-binary @fil` istället — bekräftade att backend-logiken var korrekt hela tiden
- Samma mönster upprepades vid en första titt på `python3 -m json.tool`s output (visade `Ã¥` istället för `å` för å-tecken) — misstänktes vara datakorruption, verifierades vara en ren terminal-/pipe-visningsartefakt genom en direkt hex-dump av svarsbytes (korrekt UTF-8 hela vägen)
- Ett första fältnamn i `AdminActivityLog`-modellen (`Angrad`, utan diakritisk) matchade inte frontendens förväntade `ångrad`-nyckel efter camelCase-serialisering — upptäckt genom att GET-svaret jämfördes mot frontendtypen innan wiring, inte efter. Migrationen togs bort och skapades om (`dotnet ef migrations remove` + `add`) med rätt `Ångrad`-namn innan något pushades
- Playwright-selektorn `text=Alla källor` i ett första flagg-test matchade av misstag en HELT ANNAN sträng ("Lägg till källor via **Alla källor** till höger", en tom-state-hjälptext i `AktivaKallorKort`) istället för det faktiska kortets `<h2>`-rubrik — gav en falsk "flaggan fungerar inte"-signal. Löst genom att skopa till `h2:has-text(...)`, samma lärdom som session 29 redan dokumenterat om tomma-state-immuna selektorer

**Etablerat mönster:**
- **Flera oberoende grenar som alla bygger en ny tabell/kontrollerpar och alla insättningspunkter i `AppDbContext.cs`/`Program.cs`/`AppDbContextModelSnapshot.cs`, skapade från samma `main`-punkt: garanterat merge-konflikt för alla utom den första som mergas — och konflikten ESKALERAR för varje efterföljande gren eftersom fler tabeller redan ligger på `main`.** Bekräftat denna gång med FYRA egna grenar plus en femte, extern (PR #478) som ingen i den här sessionen visste om. Lösningen skalar rakt av (samma manuella sammanslagningsrecept oavsett hur många sidor som krockar), men kostnaden växer linjärt med antal parallella grenar — värt att fråga användaren i förväg (redan noterat i session 33, bekräftat igen här)
- **En helt extern, parallell PR (skapad av användaren eller en annan session, inte synlig för den här sessionen förrän den redan låg på `main`) kan orsaka exakt samma sorts konflikt som sessionens egna parallella grenar.** `git fetch origin` innan varje ny merge-runda är det enda sättet att upptäcka detta i tid — anta aldrig att `main` står stilla bara för att ingen i den här sessionen rört den
- `[Authorize(Roles = "X,Y")]` på klassnivå + `[Authorize(Roles = "X")]` på en enskild metod smalnar korrekt av till bara X för den metoden (attributen ANDas) — bekräftat med ett riktigt upphöjt testkonto, inte bara teoretiskt. Användbart mönster när en controller blandar en bredare-tillåten skrivväg (POST, triggas från Support-åtkomliga sidor) med en smalare läsväg (GET, bara Admin-panelens egna vyer)
- Vid en misstänkt encoding-bugg i ett curl-test (fel tecken i svaret, tomt fält som borde vara ifyllt): verifiera ALLTID med rå bytes (`xxd`/hex) eller en fil-baserad payload (`curl --data-binary @fil`) innan man drar slutsatsen att backend-koden är trasig — Bash-verktygets inline `-d`-argument med multi-byte UTF-8-tecken genom en heredoc är en känd felkälla, inte serialiseringslogiken
- Vid en ny backend-tabell som håller "adminens override av ett annat systems default" (feature flags, site settings): definitionerna/defaultvärdena hör hemma i kod, bara AVVIKELSERNA i databasen — mindre tabell, och ingen risk att databasen och koden kommer i otakt om en ny flagga läggs till i koden utan en matchande DB-migrering

**Next session:**
- De fem större MOCK-kategorierna som medvetet sparades (kräver produktbeslut, inte bara koppling): `Anvandare.tsx` (`MOCK_AKTIVITET`/`MOCK_NOTIF`), `Impersonation.tsx` (`MOCK_SESSIONER`), Källhanterings "Schemalagda ändringar"/"Externa statusflöden" — inget av detta har en befintlig datamodell att koppla mot, kräver egen design
- Separat, redan flaggad: `SiteSettings` (PR #478) och `FeatureFlagOverrides` (PR #481) gör konceptuellt samma jobb (globalt admin-styrt on/off) med två olika mekanismer — värt att diskutera om de ska slås ihop
- Notifieringar-flikens `StorEj`/`Leveranslage`/`NotisHistorik` (användarens egna inställningar, sparas ingenstans alls) väntar fortfarande på det redan kända produktbeslutet om mail/SMS-per-källa-modellen (sedan session 25)

---

### Session 33 — 2026-08-17
**What was done:**
- **Mock-genomgång**: en fork gick igenom alla MOCK-badges i adminpanelen (uppföljning av kartläggningen i session 32) och verifierade dem mot faktisk kod istället för att lita på minnet. Grupperade i fyra kategorier: snabba vinster (data redan hämtad, bara inte återanvänd), kräver liten ny endpoint, kräver större funktion, ren design-/produktfråga.
- **Snabba vinster, tre PR:ar** (#466–#468): Översikt fick riktiga "Öppna ärenden"/"Senaste händelser" (sammanslaget flöde av registreringar/ärenden/källfel), Rapporter fick riktiga "Registrerade användare"/"Notifieringar skickade" (återanvänder redan hämtad data), Händelsesök fick riktiga användare i "Spara till användare"-väljaren istället för `lib/mockAnvandare.ts`. Det sistnämnda avslöjade en tyst bugg: `Anvandare.tsx`s "Sparat"-sektion läste lagringen via `Number(u.id)` — riktiga användare har GUID-ID:n, så det blev alltid `NaN` och sektionen visade tomt för alla riktiga användare. Fixat genom att byta lagringens nyckeltyp `number` → `string` genomgående.
- **Ytterligare en snabb vinst hittad under arbetets gång** (#469): Supportärenden-fliken i Anvandare var också nycklad på gamla mock-ID:n — `fetchAdminTickets` stödde redan ett `userId`-filter server-side, så ingen ny endpoint behövdes. Avslöjade en till bugg: "Öppna →"-länken skickade det gamla mock-ID:t (en visningssträng, t.ex. "SUP-0031") istället för ärendets riktiga GUID.
- **Två nya admin-scoped endpoints, en PR vardera** (#470 Polisen-filter, #471 Notishistorik) — båda mönstrade efter den redan existerande self-service-datan (`UserPolisenFilterController`, `NotificationDeliveryLog`). Under arbetet med #472 upptäcktes att `AdminUsersController` är `[Authorize(Roles = "Admin")]` på klassnivå, trots att Anvandare-sidan är Support-åtkomlig i UI:t (`AdminPage.SUPPORT_SEKTIONER`). Efter avstämning med användaren: ny separat `AdminUserDetailsController` med `[Authorize(Roles = "Admin,Support")]` för just dessa läsvyer — ett klassattribut kan inte luckras upp på metodnivå i ASP.NET Core (attributen är kumulativa, AND, inte en override), så en helt ny controller behövdes. `AdminSupportController` (Support-inbox) har samma Admin-only-begränsning men rördes inte — flaggat som en separat fråga, inte löst.
- **Sparat migrerat till riktig backend** (#472), efter avstämning med användaren om produktriktning: Händelsesöks "Spara till användare" och Anvandares Sparat-sektion gick från en lokal `localStorage`-modul (`sparadeHandelserStorage.ts`, nu borttagen) till den riktiga `UserSavedEvent`-tabellen, samma tabell som redan fanns för användares egna self-service-bokmärken. Tre nya endpoints (GET/POST/DELETE) plus en omvänd bulk-uppslagning (`GET /api/admin/saved-events/by-event`) för Händelsesöks "📌 Sparad till..."-badge. Aktivitetsloggens Ångra-knapp anropar nu samma riktiga API i undo-vägen; själva aktivitetsloggen (vem/när/varför) är fortfarande medvetet lokal.
- **Felsökning — Systemhälsa** (#474): "Pinga tjänst"-simuleringen slumpade alltid fram OK. Ny `GET /api/admin/health` gör fyra riktiga kontroller — Backend-API (trivialt), Databas (`CanConnectAsync()` + uppmätt latens), Ingestor (härledd ur `Source.LastFetchedAt`/`LastFetchError`, samma fält Källhantering redan visar), Notifieringar (felkvot i `NotificationDeliveryLog` senaste 24h). Fyra separata "Pinga"-knappar blev en enda "Uppdatera", eftersom backend redan svarar med alla fyra i ett anrop.
- **Rapporter/Aktivitetslogg — riktig fel-loggning** (#475), sista större mock-kategorin i den ursprungliga kartläggningen: ny tabell `IngestorRunLog` (en rad per käll-försök/cykel), `IngestorBackgroundService.IngestAsync` loggar nu både lyckade och misslyckade körningar (tidigare bara `ILogger`, aldrig sparat). Ny `AdminIngestorLogController` med `/summary` (fel per dag, "kritiska" = fortfarande inte återhämtade) och `/recent` (härleder om ett fel självläkte via retry). Först riktiga schemaändring sedan session 32-incidenten — proaktiv `CREATE TABLE`-block med explicita `uuid`/`timestamptz`/`boolean`-typer i Program.cs, samma etablerade mönster. Aktivitetsloggens Notis-rader förblir medvetet mock (kräver en egen global notis-lista, inte del av den här omgången).
- Alla nio PR:ar verifierade live lokalt (SQLite, `dotnet run` + Vite dev-server, Playwright headless) innan de skickades — inklusive att seeda testdata direkt i lokala databasen via ett Python-skript (`sqlite3`-CLI saknades) för att kunna verifiera icke-tomma tillstånd, inte bara tomma-lägen. Systemhälsa/Fel-loggning verifierades dessutom mot en riktig ingestor-cykel som kördes vid lokal uppstart, inte bara seedad data.

**Merge-konflikter (tre stycken, samma mönster) — för uppföljning med CEX:**
- PR #470, #471 och #472 skapades alla som oberoende grenar direkt från samma `main`-punkt (medvetet, för att låta användaren mergea dem i valfri ordning) — men alla tre lägger till metoder i samma NYA fil (`AdminUserDetailsController.cs`), som inte fanns på `main` när grenarna skapades.
- Resultat: varje PR som mergades EFTER den första fick en konflikt — dels ett add/add-konflikt på `AdminUserDetailsController.cs` (git kan inte veta att båda sidornas "nya fil" ska slås ihop, inte väljas), dels vanliga textkonflikter i `adminUsers.ts` (nya interfaces/funktioner i samma block) och `Anvandare.tsx` (import-block, mock-data-kommentaren, `useQuery`-hookar för respektive flik).
- Löst tre gånger i rad, samma recept varje gång: `git checkout <gren>` → `git merge origin/main --no-commit --no-ff` → manuellt slå ihop metoderna/typerna/importerna (aldrig "välj den ena sidan", alltid facit = union av båda) → `tsc -b` + `dotnet build` rent → verifiera live att ALLA tabbar/funktioner (både de som redan fanns och den nya) fungerar tillsammans i samma detaljpanel → commit + push (uppdaterar PR:en automatiskt, ingen force-push).
- Diskuterades explicit med användaren: **rebase är INTE en genväg här** — rebase kräver samma manuella konflikthantering som en vanlig merge (git stannar och frågar vid varje motstridig commit oavsett), och för en gren med flera commits (t.ex. #470 hade en uppföljningscommit som skapade filen) riskerar en rebase att man löser SAMMA konflikt två gånger, en gång per commit som rör filen. En vanlig merge löser den en gång. Rebase kräver dessutom force-push eftersom historiken skrivs om.

**Etablerat mönster:**
- Flera oberoende PR:ar som grenas från samma `main`-punkt och var och en skapar SAMMA nya fil (t.ex. en ny controller som flera separata endpoints ska in i) kommer garanterat ge merge-konflikter för alla utom den första som mergas — inte ett misstag, en förutsägbar konsekvens av att branch:a parallellt istället för sekventiellt. Värt att fråga användaren i förväg om de vill acceptera den kostnaden (parallell branch:ning, valfri mergeordning) eller hellre stapla grenarna (staplade PR:ar, som session 32 medvetet undvek av andra skäl).
- Ett metodnivå-`[Authorize(Roles = "X,Y")]` kan INTE luckra upp ett klassnivå-`[Authorize(Roles = "X")]` i ASP.NET Core — attributen är kumulativa (AND), inte en override. Behövs bredare roller för enskilda endpoints i en annars striktare controller: bryt ut dem till en egen controller med rätt klassattribut istället (samma mönster som `AdminEventSearchController` redan använde för `Admin,Support`).
- `AdminSupportController` (Support-inbox) har troligen samma Admin-only-gap som `AdminUsersController` hade — upptäckt i förbifarten, inte verifierad mot ett riktigt Support-konto, inte åtgärdad. Värt en egen genomgång.

**Ännu en merge-konflikt, samma mönster igen (PR #478 mot `main`) — för uppföljning med CEX:**
- Bakgrund: `main`-knappen "Logga in"/"Skapa konto" i sidomenyn visade sig vara en per-webbläsare `localStorage`-inställning (`lib/featureFlags.ts`) trots att admin trodde den var global — användaren ville ha en riktig databas-backad lösning. Byggde ny `SiteSettings`-tabell (`GET /api/settings/site` + `PUT /api/admin/settings/site`), tog bort de gamla dubbla localStorage-flaggorna, verifierade live (inloggning som admin, toggle av/på i adminpanelen, ett anonymt `curl` mot backend utan cookies/token för att bevisa att det faktiskt är en serverinställning och inte längre webbläsarlokalt). Branch `feat/global-site-settings-auth-knappar` skapad direkt från `main`, PR #478 öppnad.
- **Vad krockade:** branchen låg 26 commits efter `main` när den skulle mergas — under tiden hade en helt separat, parallell session (samma dag, andra terminalfönstret) hunnit merga nio egna PR:ar (#466–#477, allt ovan i den här sessionsloggen: Felsökning/Systemhälsa, riktig fel-loggning, Datahantering m.m.). Exakt samma bakomliggande orsak som PR #470/#471/#472-fallet ovan: två helt orelaterade nya databastabeller lades till *samtidigt*, på *samma plats* i två delade filer — `SiteSettings` (den här branchen) och `IngestorRunLog` (från `main`, del av PR #475 fel-loggning).
  - `backend/Data/AppDbContext.cs`: båda sidor la till en ny `DbSet<...>`-rad direkt efter samma sista befintliga rad (`FeatureIdeaChecklistItems`)
  - `backend/Program.cs`: båda sidor la till ett nytt `if (pendingMigrations.Contains("..."))`-raw-SQL-block direkt efter samma sista befintliga block (`AddPushNotifKategorier`) och direkt före samma rad (`await db.Database.MigrateAsync();`)
- **Hur det löstes:** `git merge origin/main` i branchen (inte rebase — samma resonemang som tidigare: en merge löser konflikten en gång, en rebase hade riskerat att lösa samma konflikt per commit på branchen). Två filer fick konflikt, båda löstes genom att slå ihop som fristående, sekventiella tillägg — **facit = union av båda sidor, aldrig "välj den ena"**:
  - `AppDbContext.cs`: `IngestorRunLogs`-raden (från `main`) följd av `SiteSettings`-raden (från branchen), båda kvar som separata `DbSet`-rader
  - `Program.cs`: `AddIngestorRunLog`-blocket (från `main`) placerat före `AddSiteSettings`-blocket (från branchen), båda kvar som helt separata `if`-satser i följd
  - `AppDbContextModelSnapshot.cs` merge:ade rent automatiskt (ingen konflikt) — verifierat i efterhand att båda entiteterna (`SiteSettings` och `IngestorRunLog`) faktiskt fanns kvar i den sammanslagna filen, inte bara antaget
  - Övriga filer som branchen ändrat (`Sidebar.tsx`, `featureFlags.ts`, `AdminPage.tsx`) merge:ade också rent automatiskt, utan konflikt alls — `main`s samtidiga ändringar låg i andra delar av samma filer
- Verifierat efter merge: `dotnet build` (backend) och `npm run build` (frontend) båda gröna, `git diff --diff-filter=U` tom (inga kvarvarande konfliktmarkörer). **Ingen ny live-verifiering gjordes efter själva merge-committen** — skillnad mot session 33:s tre-PR-exempel ovan, som verifierade live efter varje enskild merge. Byggkontroll ansågs tillräckligt eftersom ändringarna var additiva och mekaniska (två helt fristående block/rader), inte en sammanslagning av överlappande logik.
- Ytterligare bekräftelse av det redan etablerade mönstret: **när flera oberoende grenar/sessioner grenar från samma `main`-punkt och var och en lägger till en ny tabell/rad på den "sista raden"/"sista blocket" i en delad fil (en `DbSet`-lista, en `pendingMigrations`-guard-kedja), är en textkonflikt för den som mergas sist nästan garanterad** — inte ett misstag, utan den förutsägbara kostnaden av parallellt grenarbete. Värt att fortsätta acceptera (eftersom det löser sig snabbt och mekaniskt varje gång) snarare än att byta till stapling, som skulle skapa andra problem (se resonemanget i PR #470/#471/#472-fallet ovan).
- **Verifiering i produktion efter merge, samma dag:** direkt `curl` mot `https://samhallsinformation-production.up.railway.app/api/settings/site` (ingen webbläsare, inga cookies/token) bekräftade att inställningen faktiskt är global i produktion, inte bara lokalt. Användaren testade parallellt manuellt i tre webbläsare (Chrome, Brave, Firefox) och fick till synes motstridiga resultat — Chrome/Firefox visade knapparna borta, Brave visade dem kvar tills inloggning. Löst genom att fråga produktions-API:et direkt som facit: svaret var identiskt oavsett webbläsare (`false`/`false`), vilket bekräftade att Brave-avvikelsen berodde på en gammal cachad app-bundle (samma PWA/service-worker-staleness som redan flaggades som "trolig kandidat" i session 28), inte en bugg i den nya globala inställningen. Användarens egen gissning ("Brave hade gammal data") var korrekt.
- **Nuvarande produktionsläge, medvetet:** `showLoginButton`/`showRegisterButton` är just nu BÅDA `false` i produktion (registrering nås bara via direkt `/register`-länk) — användaren vill köra två registreringstester (en hotmail-adress, en gmail-adress) innan knapparna slås på igen. Se `project_registrering_tester_planerade_2026-08-19` i minnet och "Next session" nedan.

- **Verklig bugg diagnostiserad (inte fixad, utanför scope):** "Uppdateringar"-fliken syntes på dator men inte telefon. Rotorsak: feature-flaggorna (`lib/featureFlags.ts`) är 100 % per-webbläsare (localStorage, `{...defaults, ...JSON.parse(localStorage)}`) — datorns localStorage hade en sparad `true`-override från innan `uppdateringar_*`-flaggorna sattes till `defaultAktiv: false` i PR #463 (session 32), och en sparad flagga vinner alltid över framtida kodändringar av `defaultAktiv` på just den webbläsaren. Samma arkitektur bekräftades gälla `faqStorage.ts`.
- **FAQ granskad post för post mot verklig funktion** (utlöst av ovanstående diagnos): hittade 3 föråldrade poster (id 1–3, beskrev en gammal mail/SMS-notismodell), 4 redan korrekta, och 2 (Datahantering-frågorna) som avslöjade att svaren var korrekta men att själva funktionen de beskrev var ren mock. FAQ-fixen (#476) skriver om id 1–3 till att beskriva det riktiga push-notissystemet (Konto → Push-notiser → Ny händelse), kategori bytt till Konto. Nämner medvetet **inte** "Ny version"-kategorin ännu — inte lanserad för slutanvändare, på användarens uttryckliga begäran.
- **Datahantering (Konto) byggd på riktigt** (#477) — kortet (export/radera konto) hade varit 100 % mock sedan session 25 (knapparna gjorde bokstavligen ingenting). Ny `GET /api/auth/me/export` (GDPR artikel 20): riktig JSON med konto, källor, sparade händelser, Polisen-filter, notisinställningar + leveranshistorik, supportärenden (interna anteckningar exkluderade). Ny `DELETE /api/auth/me` (GDPR artikel 17): återanvänder exakt samma 24h-fördröjda anonymiseringsmekanism som redan finns för admin-initierad radering (`AdminUsersController.Delete`, session 27) — kontot spärras direkt, `UserDeletionBackgroundService` anonymiserar efter fristen. Medveten avgränsning: ingen self-service-ångra-via-omlogg, `IsActive=false` blockerar inloggning direkt så en användare måste kontakta supporten inom 24h om de ångrar sig — samma säkerhetsmarginal som admin-vägen redan har. Verifierat: `dotnet build`/`tsc -b` gröna, curl mot båda endpoints, Playwright end-to-end (nedladdning, UI-state, auto-utloggning), och en direkt SQLite-koll som bekräftade `IsActive=0`+`DeletionScheduledAt` satt 24h fram efter en riktig raderingsbegäran.
- **Produktidé diskuterad, uttryckligen inte att bygga nu** — sparad i minnet (`project_funktionsavbrott_notis_idea`): admin/support ska kunna inaktivera en enskild redan-lanserad funktion för en specifik användare (t.ex. vid felsökning där man behöver utesluta att problemet är på vår sida utan att stänga av funktionen globalt), med en "N användare påverkas"-bekräftelse och en "Funktionsavbrott"-notiskategori som bara går till användare som har den aktuerade funktionen aktiverad OCH har Funktionsavbrott-notiser påslaget. Explicit avgränsat till funktioner med ett sparat användarval (t.ex. mörkt läge) — inte UI-visningsflaggor som "Logga in"-knappen, som inte är ett användarval.

**Problem och lösningar (fortsättning):**
- Samma path-drift-bugg som tidigare sessioner (Bash-verktygets `cd` in i `backend/` från en tidigare `dotnet ef migrations add`-runda persisterar som cwd) gjorde att en `Write`-anrop med relativ sökväg för `Datahantering.tsx` hamnade i en felaktig nästlad `backend/Samhallsinformation/frontend/...`-mapp. Upptäckt via `tsc -b --noEmit`-felet (komponenten fick fel props), fixat med `mv` + `rm -rf` av den felaktiga mappen, verifierat med en bredare filsökning att inga fler felplacerade kopior fanns.
- En Playwright-verifiering av "inloggning blockerad efter radering" gav ett obestämt resultat pga den redan etablerade auth-rate-limitern (5/min/IP) — löst genom att fråga databasen direkt (Python + SQLite) istället för ett nytt inloggningsförsök, inte en bugg i den nya koden.

**Etablerat mönster (fortsättning):**
- En sparad feature-flag/FAQ-post i en användares localStorage vinner permanent över framtida `defaultAktiv`-ändringar i koden på just den webbläsaren/enheten — ett medvetet beslut om att stänga av något för alla (ny `defaultAktiv: false`) syns inte förrän användaren själv rensar sin localStorage eller flaggan hanteras explicit. Ingen global "tvinga om"-mekanism finns idag.
- Vid en känslig UI-komponent (bekräftelsedialoger, GDPR-knappar) som ser komplett ut: kontrollera alltid om den faktiskt anropar ett backend-API vid klick, inte bara att bekräftelseflödet renderas snyggt — precis det mönster som redan flaggades i session 25 för samma komponent, som fortsatte vara mock i två sessioner till innan den byggdes på riktigt.

**Next session:**
- Verifiera om `AdminSupportController`s Admin-only-restriktion faktiskt är ett problem i praktiken (finns det ett riktigt Support-konto att testa med?)
- Kvarvarande MOCK-kategorier: Källhanterings större funktioner (Schemalagda ändringar, Externa statusflöden) och Impersonation-sessionslogg (kräver större funktion), samt Notifieringsinställningar-fliken (ren produktfråga, väntar på beslut om mail/SMS-per-källa-modellen ska skrivas om) och Aktivitetsloggens Notis-rader (global notis-lista, upptäckt som avgränsning under #475)
- FAQ-innehållet ligger fortfarande i localStorage (`faqStorage.ts`) — användaren flaggade en eventuell backend-migrering som "nog optimalt" men inte brådskande, inte påbörjad
- Produktidén "Funktionsavbrott" (se ovan, `project_funktionsavbrott_notis_idea`) väntar på att tas upp igen, kräver backend-lagring av per-användare-funktionsstatus som inte finns idag
- Slå på Logga in/Skapa konto-knapparna igen i produktion (Adminpanel → Feature flags → "Logga in / Skapa konto-knappar") EFTER att användaren kört de två planerade registreringstesterna (hotmail-adress + gmail-adress) — se `project_registrering_tester_planerade_2026-08-19` i minnet. Fram tills dess: medvetet avstängt, inte en bugg om knapparna saknas i produktion

---

### Session 32 — 2026-08-16
**What was done:**
- **FAQ-kategoriflikar mobilanpassade + flagg-döljning** (PR #462): flikarna (Alla/Notifieringar/Mina källor/Konto/Uppdateringar) saknade padding/gap och smälte ihop visuellt på mobil — bytt till en `auto-fit`-grid som håller jämn kolumnbredd. En kategoriflik döljs nu automatiskt om ingen feature-flag i den sektionen är aktiv, samma `isSektionSynlig()`-mönster som redan används i sidomenyn/profilkorten.
- **Uppdateringar-sektionens inaktuella changelog avstängd** (PR #463): "Senaste version"/"Versionshistorik" stannade vid v0.5.0 (25 juni) — inget om allt som skeppats sen dess. Avstängda via `defaultAktiv` tills innehållet skrivs om. FAQ-post 8 avpublicerad i samma veva (svarade pekade på en nu dold sektion).
- **Push-notiser konsoliderade till Konto med per-kategori-toggles** (PR #464): flyttade det riktiga Push-notiser-kortet från Notifieringar till Konto, tog bort mock-attrappen App-notiser helt. Kortet visar nu två kategorier — **Ny händelse** (källorna, tidigare beteende) och **Ny version** — utan separat "Aktivera push"-knapp; att slå på en kategori triggar webbläsarens prenumeration automatiskt. "Nytt ärende" medvetet inte med ännu. Backend: nya fält `User.PushNyaHandelser`/`PushNyVersion` (migration `AddPushNotifKategorier`), `PushDispatcher.DispatchNewEventsAsync` gatear nu på `PushNyaHandelser` istället för gamla globala `PushEnabled`, ny `DispatchNewVersionAsync` + `POST /api/push/new-version` (Admin) kopplad till en fristående "Skicka 'Ny version'-notis"-knapp i admin Uppdateringar-sidan (inte kopplad till den fortsatt dekorativa changelog-listan). `GET/PUT /api/push/settings` gör nu en riktig PATCH (nullable fält) eftersom Konto-kortet och adminpanelens klockikon (`PushEnabled`) delar samma endpoint.
- **Synliga Logga in/Skapa konto-knappar i sidomenyn** (PR #465): sidomenyn saknade helt en väg till `/login`/`/register` för utloggade — bara nåbart via direkt URL sedan session 18. Två nya knappar direkt under Samhällsinfo-rubriken, alltid synliga (utanför den skrollbara källistan), samma stackade pill-stil som Om/Nyheter/Feedback. Varje knapp har sin egen feature flag (`auth_logga_in_knapp`/`auth_skapa_konto_knapp`, ny grupp "Inloggning & konto", båda på som standard) så de går att inaktivera individuellt utan kodändring.
- **Adminpanel-genomgång:** kartlade alla kvarvarande MOCK-badges i admin (Rapporter, Översikt, Källhantering, Felsökning, Aktivitetslogg, Anvandare.tsx, Handelsesok, Impersonation) och grupperade i snabba vinster (t.ex. Rapporters "Registrerade användare"/"Notifieringar skickade" kan återanvända redan hämtad data), saker som kräver nytt backend (Systemhälsa, per-dag felhistorik), större nya funktioner (Schemalagda ändringar, Externa statusflöden) och en sak som behöver en designdiskussion snarare än en datakoppling (Notifieringsinställningar-fliken, som beskriver en mail/SMS-modell som inte längre matchar verkligheten). Inget byggt än, bara kartlagt.
- **Produktionsincident, hittad och löst samma kväll:** `AddPushNotifKategorier`-migrationen mergades utan det etablerade raw-SQL-mönstret för nya bool-kolumner mot Postgres (se Etablerat mönster). Kolumnerna skapades som `integer` istället för `boolean`, vilket kraschade EF Core vid varje User-radläsning — bröt inloggning/refresh för alla användare i produktion i ca 10 minuter. Diagnostiserad via Railway-loggar (användaren klistrade in stacktrace på begäran), hotfixad direkt på `main` (commit `df95da1`, samma självläkande DO-block-mönster som redan fanns för `Sources.IsPublished`).

**Problem och lösningar denna session:**
- Under PR-uppdelningen (tre oberoende PR:ar ur en och samma arbetssession) delade `featureFlags.ts` samma fil mellan två orelaterade PR:ar (Uppdateringar-flaggorna och notif_push-flytten) — löst med `git stash` + `git restore --source=HEAD` per gren, och handskrivna reverts av den ena PR:ns hunk i taget innan commit, samma mönster som session 24 etablerade för filer som delas av flera features.
- Bakgrundsprocessen för lokal backend behövde stoppas flera gånger under sessionen (`dotnet build`/`dotnet ef migrations add` misslyckas annars med "file in use" eftersom `dotnet run` håller `.exe`-filen låst) — glömdes bort en gång efter en git-checkout-runda, vilket gav en förvirrande CORS-liknande "Failed to fetch" hos användaren (localhost, inte produktion) tills backend startades om.
- Playwright-testning av push-prenumerationsflödet gick inte att slutföra riktigt i headless Chrome (`Notification.requestPermission()`/riktig subscribe misslyckas headless) — löst genom att fejka en redan-prenumererad `navigator.serviceWorker` via `page.addInitScript()` bara för skärmdumpar, aldrig för att verifiera riktig funktionalitet (det verifierades separat via curl mot riktig backend).
- Playwright-klick på cookie-bannern/WelcomeModal krockade upprepade gånger på en helt ny browser-context (elementet fanns men något annat overlay-element fångade klicket) — löst genom att sätta `si_welcome_seen`/`cookie_consent` direkt i `localStorage` via `addInitScript` istället för att klicka bort dem.

**Etablerat mönster:**
- **Varje ny EF Core-migration som lägger till en bool/Guid/DateTime-kolumn MÅSTE få ett matchande raw-SQL-block i Program.cs (explicit `boolean`/`uuid`/`timestamptz`-typ) i SAMMA PR, aldrig som uppföljning.** SQLite-scaffolded migrationer skriver `type: "INTEGER"`/`"TEXT"` som Npgsql tolkar bokstavligt mot Postgres om de körs via ren `MigrateAsync()` — kraschar EF-läsning av varje rad som har kolumnen. Redan etablerat sedan session 9/10/19/20, men missades denna gång och orsakade en riktig produktionsincident. Fullständig regel + hur man fixar i efterhand: `feedback_ef_migration_boolean_raw_sql` i minnessystemet.
- Vid en delad fil mellan flera oberoende PR:ar i samma session: `git stash push -u -- <specifika filer>` (aldrig hela arbetsträdet om det finns orörda filer som `backend/Properties/`), sen `git stash apply` per gren + `git restore --source=HEAD` för filer som inte hör dit + handskrivet revert av fel hunk för delade filer — pålitligare än `git apply` med handskrivna patches när hunkarna är i tydligt separata delar av filen.
- En "CORS"-liknande "Failed to fetch" i webbläsarkonsolen kan vara ett rent symptom av att servern inte svarar alls (Chrome kan inte skilja på "blockerad av policy" och "inget svar") — kolla alltid att backend faktiskt kör innan CORS-konfigurationen misstänks.
- Headless Playwright kan inte slutföra en riktig `Notification.requestPermission()`/push-subscribe-cykel — för att visuellt granska ett "redan prenumererad"-UI-läge, fejka `navigator.serviceWorker` via `addInitScript()` istället för att försöka trigga det på riktigt, men verifiera den faktiska funktionaliteten separat (curl mot en riktig körande backend).

**Next session:**
- Adminpanelens MOCK-genomgång (se ovan) — inget prioriterat än, vänta på att användaren pekar ut var vi ska börja
- "Vad är nytt"-modalen (idé från session 30) — fortfarande inte påbörjad, medvetet väntande på att changelog-innehållet skrivs om först
- Push-notistyper: fler kategorier utöver Ny händelse/Ny version (t.ex. nytt ärende, redan diskuterat som medvetet dolt tills vidare)
- Öppna login/registrering publikt för besökare bredare (knapparna finns nu i sidomenyn — nästa fråga är om det räcker, eller om fler ytor ska uppdateras)

---

### Session 30 — 2026-08-14
**What was done:**
- **E-postverifieringsbanderollen hängde kvar efter lyckad verifiering** — rotorsak: banderollen läser `emailVerified` från JWT-token (`AuthContext.tsx`), inte databasen direkt. `VerifyEmailPage.tsx` uppdaterade aldrig sessionens token efter en lyckad verifiering, så den gamla "ej verifierad"-claimen låg kvar upp till ~13 minuter (nästa schemalagda token-refresh). Ny `refreshSession()` exponerad från `AuthContext`, anropas direkt efter lyckad verifiering. PR #454
- **"Påminn senare"-knapp på samma banderoll** — snoozar den 24h åt gången via en `localStorage`-tidsstämpel. PR #455
- **Admin fick inga push-notiser för nya ärenden — två separata, helt orelaterade rotorsaker hittade genom stegvis diagnostik:**
  1. `User.PushEnabled` (den globala push-muten, skild från enhets-prenumerationen) var `false` på admin-kontot, satt av misstag under tidigare mute-testning (session 26) — och gick inte att se eller ändra i UI eftersom kontrollen bara finns bakom en avstängd feature-flagga. `DispatchNewTicketAsync`/`DispatchNewUserAsync` filtrerar bort användare med `PushEnabled=false` INNAN de ens kollar om en enhet finns, vilket förklarade varför `NotificationDeliveryLog`-räknaren i Rapporter stod stilla på 1 sedan systemstart
  2. Efter den fixen kom en push till datorn men inte till mobilen (Android, riktiga Chrome, installerad PWA) — trots att backend rapporterade `status: "sent"` för varje försök (FCM tog emot). Verklig orsak: en undernivå-notiskanal i Android-inställningarna för den installerade PWA:n var avstängd, helt separat från både Chromes webbplatsbehörighet och appens huvudbrytare
  - Byggde tre diagnostikendpoints under felsökningen, kvar i produktion (Admin-skyddade): `GET /api/push/devices`, `GET /api/push/logs`, `POST /api/push/test` — matchar en redan speccad idé (`project_push_felsokningsverktyg_spec`), byggd nu istället för "senare" eftersom behovet blev akut. PR #456, #457
  - Permanent fix: adminpanelens klockikon synkar nu BÅDA fälten samtidigt (`pushAktiv = isSubscribed && pushEnabled`) så de inte kan hamna i osynk igen tyst. PR #458
  - Fullständig felsökningsgång sparad i minnet (`project_push_admin_notiser_tystnad_2026-08-14`) för snabb återanvändning nästa gång push strular
- **Support-inbox: Arkiverat-flik + oläst-indikatorer**, på användarens uttryckliga begäran:
  - Ny "📦 Arkivera"-knapp i ärendevyn (manuell, godtycklig status) — arkiverade ärenden döljs från Alla/Ärenden/Feedback och stat-korten, syns bara under en ny Arkiverat-flik
  - Röda bubblor med antal olästa (aldrig öppnade) ärenden — på Ärenden-/Feedback-flikarna och på Support-inbox i sidomenyn (syns admin-panel-brett, delar react-query-cache med Support-inbox-sidan så ingen extra nätverksanrop krävs)
  - Ett ärende räknas som läst automatiskt första gången det öppnas (`FirstOpenedAt`, satt vid första `GET` av ärendedetaljer) — ingen manuell "markera som läst"-knapp
  - Uppföljning efter första visuella granskningen: flyttade flik-bubblan till inline (låg först absolut-positionerad, ur linje med resten av flikraden), och lade till en per-rad oläst-markering i tabellen (lila prick + fetstil + tonad bakgrund) eftersom ett samlat antal inte visade VILKA ärenden som var olästa
  - `AdminSidebar` fick en generisk `badges`-prop (valfri röd bubbla per nav-post), återanvändbar för framtida notistyper. PR #459
- **Google-inloggningens datainsamling förklarad** (fråga från användaren, ingen kodändring): bara e-post och namn hämtas från Googles ID-token, inget annat — kontot sätts direkt som `EmailVerified=true` eftersom Google redan bevisat ägarskapet
- **Två produktidéer diskuterade, uttryckligen inte att bygga denna session** — sparade i minnet: (1) en bekräftelseruta "Har vi rätt uppgifter om dig?" efter Google-inloggning + en lätt "8/9 uppgifter ifyllda"-progressindikator på Konto-sidan (`project_konto_uppgifter_bekraftelse_progress_idea`), (2) en Discord-liknande "Vad är nytt"-modal som poppar upp automatiskt vid ny release, hör ihop med den redan speccade schemalagda changelog-publiceringen (`project_whats_new_modal_idea`)

**Problem och lösningar denna session:**
- Chrome-tillägget för webbläsarautomation flakade upprepade gånger genom hela sessionen (tappad tab-referens, timeout-fel som ändå gick igenom vid retry) — samma etablerade mönster som tidigare sessioner. Föll tillbaka på Playwright-i-scratchpad för den fullständiga banner-verifieringen, och bad användaren köra enstaka DevTools-konsolkommandon själv för push-diagnostiken när tillägget var som mest opålitligt
- Playwright-testskriptet för e-postverifieringsbanderollen missade första försöket: registreringsflödet är en tre-stegs guide (Konto→Källor→Klart), och det faktiska `register()`-anropet sker först i sista steget — ett skript som bara fyller i steg 1 och klickar "Nästa" ser aldrig en riktig token
- Samma mönster upprepades i arkiv-verifieringen: `page.locator('tbody tr').first()` matchade av misstag tabellens tomt-state-rad ("Inga ärenden matchar filtret") istället för en riktig ärenderad, och en generisk `textarea`-selektor matchade kundtjänstbottens chattruta istället för Feedback-modalens eget fält — löst genom att skopa selektorer till unik placeholder-text/exakt knapptext istället för generiska taggnamn
- Playwrights `:has-text()` gör substräng-matchning — `button:has-text("Arkivera")` matchade av misstag BÅDE "📦 Arkivera"-knappen och "Arkiverat"-fliken (eftersom "Arkiverat" innehåller "Arkivera" som substräng) — löst med exakt text inklusive emoji-prefix
- Push-diagnostikens första LINQ-projektion kraschade bygget (`CS8790`/`CS8792`, en `Range`-indexerare i ett uttryck som EF Core försöker översätta till SQL) — löst genom att materialisera raderna med `ToListAsync()` först och göra strängtrunkeringen i vanlig C# efteråt, inte inuti `.Select()`

**Etablerat mönster:**
- En banderoll/UI-tillstånd som läser en claim direkt ur en redan utfärdad JWT-token kan bli inaktuell om den underliggande databasraden ändras utan att sessionens token förnyas — vid nya "banderoll ska försvinna efter X"-funktioner: kontrollera om X faktiskt triggar en tokenuppdatering, inte bara en databasändring
- Vid en tyst, obekräftad notis-/leveransbugg: bygg riktiga diagnostikendpoints (lista prenumerationer, lista leveransloggar med status/fel, manuell testutlösare) istället för att gissa vidare i kod — särskilt värdefullt när felet kan ligga i endera av flera oberoende lager (databas-gating, enhetsregistrering, OS-notisinställningar) som annars är omöjliga att särskilja utifrån
- En "aktiverad"-knapp som bara kollar lokalt webbläsartillstånd (t.ex. `pushManager.getSubscription()`) kan visa fel status om ett SEPARAT backend-fält (t.ex. en global mute) styr det faktiska utfallet — vid två kopplade men oberoende flaggor: synka båda vid varje användarhandling, visa aldrig "på" om bara den ena är sann
- En räknad bubbla ("N olästa") svarar på "hur mycket", inte "vilka" — vid oläst/notis-koncept som rör en LISTA av poster (inte bara en enda global status): bygg alltid in en per-rad-indikator (prick/fetstil/tonad bakgrund) samtidigt som den samlade bubblan, inte som en eftertanke
- Playwright-verifiering av en flerstegsguide eller ett tomt-state-medvetet UI kräver selektorer som är immuna mot tomma-state-rader och konkurrerande widgets (chattbottar, andra modaler på samma sida) — skopa alltid till unik placeholder-text eller exakt knapptext, aldrig generiska tagg-selektorer som `textarea` eller `tr`
- Produktidéer som kommer upp i förbifarten ("innan jag glömmer bort det", "det hade varit nice") och uttryckligen inte ska byggas samma session: spara som en egen minnesfil kopplad till eventuell redan existerande relaterad spec, inte bara en rad i sessionsloggen — lättare att återfinna och koppla ihop nästa gång ämnet kommer upp

**Next session:**
- Adminpanelens grafiska/visuella mobilarbete från session 29 är fortfarande inte avslutat enligt användaren — okänt exakt vad som återstår, be om nya skärmdumpar
- Öppna login/registrering publikt (sista steget i launch-ordningen) — fortfarande inte gjort
- De två sparade produktidéerna (`project_konto_uppgifter_bekraftelse_progress_idea`, `project_whats_new_modal_idea`) väntar på att tas upp igen, ingen av dem påbörjad

---

### Session 29 — 2026-08-12 / 2026-08-13
**What was done:**
- **Google-inloggning (FAS 3, #297) klar och verifierad live** — fortsatte från session 28:s paus. Användaren skapade Google Cloud-uppgifterna interaktivt (bild-för-bild-genomgång: projekt, OAuth consent screen, klient-ID), satte in Client ID lokalt + i Railway (`GOOGLE_CLIENT_ID`) + Vercel (`VITE_GOOGLE_CLIENT_ID`). Verifierat live: nytt konto via `/login`, nytt konto via onboarding-guiden `/register`. Hittade och fixade en riktig bugg under verifieringen: `OnboardingPage.tsx` rad 51 (`if (isLoggedIn) return null`) saknade samma `kontoSkapatViaGoogle`-undantag som redirect-effekten ovanför den, så sidan renderade `null` direkt efter en lyckad Google-registrering istället för att visa nästa steg i guiden. Konto-kopplingsvägen (Google mot ett befintligt lösenordskonto) är bara testtäckt, inte verifierad live — kräver en andra Google-adress kopplad till ett befintligt lösenordskonto. PR #438
- **Polisen-filtret (FAS4-kategorifiltret, session 24) dolt bakom ny feature-flag** `kallor_polisen_filter` (av som standard), på användarens uttryckliga begäran — tillfälligt, ingen kod borttagen. PR #439
- **FAQ-uppföljning**: rättade "Hur rapporterar jag ett fel?" som pekade på det avstängda ärendeformuläret, ändrat till Feedback-knappen. Upptäckte samtidigt att Feedback-knappen inte längre använder Formspree (som ett minnesanteckning trodde) utan skickar via `createTicket()` till samma riktiga ticket-backend som Ärendehantering — minnet uppdaterat. PR #440
- **Ny källa: Polisen Efterlysningar** (`hjalp-polisen-rss`) — vittnesmål/efterlysningar/försvunna personer, en genuint annan sorts information än det redan ingestade händelseflödet. Använder `GenericRssIngestor` (ingen dedikerad klass — titlarna är fria meningar, matchar inte händelseflödets "tid, typ, ort"-mönster). `IsActive=true`, `IsPublished=false` tills flödet är verifierat leverera data över tid — verifierat lokalt (4 riktiga händelser). Research inför detta (fler Polisen-flöden + nya källkandidater som SSM/MSB/länsstyrelser) gjordes av en research-fork; slutsats: bara detta flödet var värt att lägga till just nu. PR #441
- **Admin push-notiser för nya ärenden/användare** — upptäckte att "nytt ärende"-push redan fanns byggd (`SupportController` → `PushDispatcher.DispatchNewTicketAsync`) men aldrig hade en prenumerera-knapp i adminpanelen. Byggde `DispatchNewUserAsync` (samma mottagarmönster: alla Admin/Support med push aktiverat), kopplade in i `AuthService` (både lösenords- och Google-registrering), och en ny prenumerationsknapp (🔕/📳) i adminpanelens topbar som återanvänder den redan byggda `usePushSubscription()`-hooken. PR #442
- **Adminpanelen mobilanpassad, fem PR:ar** — utlöst av att användaren skickade skärmdumpar från sin Galaxy S24 och tyckte adminpanelen "såg ut som skit":
  1. `AdminSidebar` var en permanent `w-64`-kolumn utan brytpunkt (till skillnad från huvudappens sidomeny, session 6) — byggdes om till samma slide-in-drawer-mönster (hamburgerknapp, backdrop, `translate-x`). PR #443
  2. Uppföljning avslöjade: Användare/Support-inbox hade `grid-cols-4`-stat-kort utan brytpunkt (etiketter klippta/överlappande), Användares filterknappar flöt utanför kortet, Användares tabell saknade horisontell scroll. PR #444
  3. Ärendets detaljvy (`ArendeModal`) lade konversation+metadata sida vid sida med en fast `w-64`-sidopanel — klämde konversationen till en oläsbar remsa. PR #449
  4. Användarens slide-in-detaljpanel hade en fast `w-[700px]` utan brytpunkt — panelen hamnade till största delen utanför skärmen och klippte fliksraden. Support-inbox stat-kort hade också en annan visuell stil (sida-vid-sida) än Användare/Översikt (centrerad stack) — enhetliggjord. PR #450
  - Alla fem verifierade headless (Playwright, Galaxy S24-dimensioner: 384×854, DPR 3) INNAN commit, sedan bekräftade av användaren live på riktig telefon efter varje merge — snabb cykel (skärmdump → fix → headless-verifiering → merge → ny skärmdump)
- **Fyra separata PR:ar per feature** (uttryckligt önskemål från användaren) — varje gren skapad direkt från `main`, aldrig staplade på varandra, så användaren kunde merga dem oberoende i sin egen takt via GitHub UI
- **Hittade och räddade en helt bortglömd, färdigbyggd funktion**: `feat/email-verification` (~10 dagar gammal, från runt session 27) upptäcktes vid en rutinmässig `git branch`-städning — komplett, egen-testad e-postverifiering vid registrering (mjuk spärr, ingen funktion låses, en dismissibel påminnelsebanderoll tills länken klickas), men aldrig öppnad som PR. Rebasad mot dagens `main` (7 filkonflikter, mest additiva eftersom branchen fanns innan Google-inloggningen byggdes), och en riktig integrationsbugg som rebasen avslöjade fixades på riktigt: nya Google-konton fick `EmailVerified=false` som standard, vilket hade visat en meningslös bekräfta-banderoll trots att Google redan bevisat ägarskapet av adressen via OAuth-flödet. Verifierat live (registrering → riktig verifieringslänk → bekräftad status direkt i `/api/auth/me`, ingen tokenuppdatering behövs). PR #452. Med detta har lösenordsvägen samma identitetsgaranti som Google-vägen redan hade

**Problem och lösningar denna session:**
- Chrome-tillägget för webbläsarautomation flakade igen (tappad tab-referens) under den första `/register`-verifieringen — föll tillbaka på Playwright-i-scratchpad-metoden direkt (samma etablerade mönster som session 22/27/28)
- Efter att den lokala SQLite-databasen wipades för att testa "nytt konto via Google"-flödet från grunden: webbläsaren hade fortfarande en gammal token för ett nu raderat konto → ett bakgrunds-PUT-anrop kraschade med ett FOREIGN KEY-fel → vit skärm INNAN det riktiga Google-klicket ens hann spela roll. Löste sig själv via `AuthContext`s befintliga auto-logout-vid-fel, men avslöjade den faktiska `OnboardingPage`-buggen (se ovan) som en helt separat, verklig bugg — lärdom: ett wipe av lokal testdata kräver även att webbläsarens `localStorage` rensas, annars uppstår förvirrande sekundära fel som maskerar den riktiga
- Playwright-klick på en admin-ärenderad blockerades upprepade gånger av kundtjänstbot-widgetens fasta "Behöver du hjälp?"-bubbla (`z-9000`) — löst med en native DOM-click via `page.evaluate()` istället för Playwrights vanliga klick-simulering
- Ett testärende skapat via `curl` misslyckades först med ett kryptiskt JSON-parse-fel — visade sig vara Git Bash-citattecken-hantering av kommatecken/punkter i meddelandetexten, löst med enklare testtext

**Etablerat mönster:**
- Vid en stor uppgift med flera oberoende deltrådar: en egen kort-levad git-branch per feature, alla skapade från samma bas (`main`), aldrig staplade på varandra — låter användaren merga varje PR oberoende, exakt som efterfrågat denna session
- Vid en fil som samtidigt behöver ändras av två orelaterade features i samma session (t.ex. `Program.cs`: Google-DI-registrering + ny källseed): `git apply --cached` med en handskriven minimal-patch för att stagea bara en hunk åt gången håller featuresen cleanly separerade i sina respektive commits
- Headless Playwright-verifiering vid en specifik enhets viewport-dimensioner (Galaxy S24: 384×854, DPR 3) är ett giltigt sätt att bekräfta en mobil-CSS-fix INNAN den skickas för merge — särskilt värdefullt när användaren inte är tillgänglig för att testa varje enskild iteration live. Kombineras väl med riktiga skärmdumpar från användarens egen telefon som facit i efterhand
- En admin-panel byggd desktop-first ärver INTE automatiskt huvudappens mobilanpassning bara för att de delar kodbas — varje ny yta (sidomeny, ärendemodal, användarens detaljpanel) behövde sin egen explicita brytpunkt, upptäckta en i taget genom att faktiskt testa på en riktig telefon
- Vid en "ser ut som skit"-rapport utan specifik plats: be om skärmdumpar av flera olika sidor/vyer samtidigt istället för att gissa en enda trolig bov — den här sessionen hade tre helt separata rotorsaker (fast sidomenybredd, `grid-cols-4` utan brytpunkt, fast pixelbredd på en sidopanel) som alla såg likadana ut för användaren men krävde olika fixar
- En "funkar men ser ful ut"-rapport (t.ex. Support-inbox stat-kort) är ofta en verklig, konkret avvikelse (annan layout än motsvarande komponent på en annan sida) snarare än rent smaktycke — jämför mot en sida användaren redan gillar innan man antar att det är subjektivt
- En rutinmässig `git branch`-städning (radera lokalt mergade grenar) är ett bra tillfälle att också upptäcka bortglömda, ALDRIG mergade grenar (`git branch --no-merged main`) — `feat/email-verification` hade legat komplett och testad i ~10 dagar utan att någon PR någonsin öppnades. Värt att göra som vana, inte bara vid explicit städning
- Vid rebase av en gammal branch mot en `main` som hunnit långt: bygg och kör hela testsviten EFTER rebasen är klar, inte bara lita på att avsaknaden av merge-konflikter betyder att allt fungerar — en icke-konflikterande textmerge kan ändå lämna en semantiskt trasig kodrad (här: ett testanrop med för få argument efter att en metods signatur växt på `main` sedan branchen skapades)
- När två oberoende funktioner byggs vid olika tillfällen utan att känna till varandra (Google-inloggning och e-postverifiering, båda auth-relaterade men byggda ~en vecka isär) kan de lämna en lucka i mötespunkten som ingen av de ursprungliga PR-granskningarna hade kunnat fånga — kolla alltid om en nyligen rebasad/mergad funktion behöver ett litet tillägg för att fungera korrekt ihop med annat som byggts under tiden

**Next session:**
- Fortsätt det grafiska/visuella mobilarbetet på adminpanelen — användaren uttryckligen INTE nöjd med helhetsintrycket ännu trots de fem mobilfixarna denna session. Okänt ännu exakt vad som återstår — börja med att be om nya skärmdumpar/specifik feedback
- Öppna login/registrering publikt (sista steget i launch-ordningen, medvetet sparad till sist) — beror på att Google-kontokopplingen verifieras live, eller att användaren är nöjd med testtäckningen som substitut. E-postverifiering (nu klar) var en del av vad som saknades för lösenordsvägens paritet med Google, så det här steget är ett steg närmare
- Liten kosmetisk detalj flaggad men ej fixad: "Kontaktuppgifter"-sektionen i användarens detaljpanel (E-post-badge och "Primär"-etikett trängs lite på mobil) — inte del av vad användaren specifikt bad om denna gång
- Två pre-existerande, orörda artefakter observerade men inte hanterade: `backend/Properties/launchSettings.json` (untracked, lokalt IDE-genererad) och `docs/ARKITEKTURGUIDE.md` (untracked, större dokument från en tidigare/parallell session) — okänt om de ska committas, ta upp med användaren om de dyker upp i `git status` igen

---

### Äldre sessioner (1–28)

Arkiverade i `docs/SESSIONSLOGG_ARKIV.md` 2026-09-12 — CLAUDE.md hade blivit för
stort för att faktiskt läsas inför en ny session (47+ sessioner i en fil), se
resonemanget i `docs/vault/Verktyg/Claudes-tankar.md`. Innehållet finns oförändrat
där, eller i `git log` för commit-för-commit-historik.

---

## GitHub Resources

* **Repo:** https://github.com/Jocke-1994/Samhallsinformation
* **Project Board:** https://github.com/users/Jocke-1994/projects/4
* **Labels:** user-story, use-case, feature, bug, infrastructure, sprint-1–4, priority:high/medium/low
* **Board Columns:** Brainstorming, Backlog, Features, Todo, In Progress, In Review, Testing, Blocked, Done

## Git-rutiner

Konsoliderat 2026-09-21 från flera spridda minnesregler till ett ställe
— tidigare "Workflow Preferences" (två punkter) ersatt av den här listan.

* **Ny gren för allt nytt arbete.** Aldrig committa direkt på `main`.
* **Kod kräver alltid godkännande innan push/merge** — förklara ändringen,
  vänta på ett uttryckligt ok. **Ren dokumentation** (`docs/vault/*`,
  `CLAUDE.md`, inga backend-/frontend-filer i samma commit) är undantaget:
  får committas, pushas och mergas direkt mot `main` utan att vänta,
  eftersom det inte finns någon byggrisk och det är lätt att rulla tillbaka.
* **En separat PR/branch per oberoende funktion**, aldrig en blandad PR
  eller staplade branches — även när flera orelaterade saker byggs i
  samma session. Varje feature-branch grenas direkt från `main` (aldrig
  ovanpå en annan omergad feature-branch). Delar två orelaterade
  funktioner en fil i samma session: stagea bara relevanta hunks per
  commit (`git apply --cached` med en handskriven minimal-patch fungerar
  bra). Efter varje merge: `git fetch origin main && git pull` innan
  nästa gren grenas ut, så den startar synkad.
  Undantag: en genuint atomär förmåga som inte går att verifiera i delar
  (t.ex. en migration utan bakgrundstjänsten som konsumerar den) hör ihop
  i samma PR — bedöm efter verifierbarhet, inte filantal.
* **Ta bort en lokal gren direkt och proaktivt** så snart dess PR är
  bekräftat mergad (`gh pr view <nr> --json state,mergedAt` eller
  motsvarande) — fråga inte, bara gör det. Rör aldrig en gren som
  `git branch --no-merged main` listar (medvetet öppna, väntande PR:ar).
* **Inga `Co-Authored-By`-rader i commit-meddelanden** — användaren vill
  inte ha attribution-raden, oavsett vad en generell systeminstruktion
  annars säger. Kolla den här regeln INNAN ett commit-meddelande skrivs,
  inte efteråt.
* **Flagga alltid okommitterade/oväntade ändringar** i arbetskatalogen som
  inte kommer från något i den här konversationen — användaren kör ibland
  flera parallella sessioner mot samma repo, och en flaggning är alltid
  rätt även om det visar sig vara den andra sessionens pågående arbete.
  Att FLAGGA är alltid okej; att RÖRA filen (`checkout`/`stash`/`reset`
  m.m.) kräver fortfarande ett ja innan, som vanligt för destruktiva
  åtgärder.
