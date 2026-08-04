# Utvecklingslogg — mål, process, buggar och val

Den här filen är inte samma sak som `CLAUDE.md`s sessionslogg (som listar VAD
som gjordes, PR-nummer, filer) eller `FORKLARINGAR.md` (som förklarar
funktioner utan teknisk jargong). Den här filen är till för resonemanget
bakom arbetet — särskilt när något gick fel på vägen. Varje post ska gå att
läsa och förstå: vad var målet, vad hände faktiskt (inte bara "det fungerar
nu"), vilka buggar dök upp, hur hittades grundorsaken (uteslutningsmetod), hur
löstes det, och vilka andra vägar hade kunnat fungera istället.

Tänkt att användas av `claude-ex`-skillen (se `.claude/skills/claude-ex/SKILL.md`)
som källmaterial för djupa tekniska förklaringar till utvecklaren.

---

## feat: rate limiting på /api/auth/* (PR 4/5) (2026-08-04)

**Mål:** Sista kvarstående punkten på issue `#295`s egen checklista — inget
skydd mot upprepade snabba anrop mot inloggning/registrering/refresh, alltså
öppet för brute force mot lösenord eller för att spamma nya konton. Del av
den fyra-PR-plan som beslutades efter en genomgång av `User`-modellens
attribut (se `[[project_...]]`-minnena för PR 1–3).

**Genomförande:** Inbyggd `Microsoft.AspNetCore.RateLimiting` (finns sedan
.NET 7, inget nytt paket). En namngiven policy `"auth"` i `Program.cs`,
partitionerad per IP (`RateLimitPartition.GetFixedWindowLimiter` nyckad på
`RemoteIpAddress`) — **viktigt val:** `AddFixedWindowLimiter` utan
partitionering delar en enda räknare mellan ALLA anropare oavsett IP, vilket
hade gjort hela tjänsten otillgänglig för alla efter fem inloggningar totalt
från vem som helst. Gräns satt till 5 försök/minut, matchar exakt vad
`#295`s checklista själv föreslog. `[EnableRateLimiting("auth")]` på hela
`AuthController` (alla dess endpoints, inte bara login) — `OnRejected`
skriver ett eget 429-svar med samma `{ error: "..." }`-format som resten av
auth-felen använder, så frontend inte behöver ett specialfall.

Byggd oberoende av PR 1–3 (ren `Program.cs`/`AuthController.cs`-ändring,
rör ingen datamodell) — grenad direkt av `main`, inte av
`feat/wizard-deferred-registration`.

**Verifiering:** `dotnet build`/`dotnet test` gröna (43/43, main saknar
ännu PR 1–3:s nya testfall). Lokal end-to-end: sex snabba
`POST /api/auth/login`-anrop med fel lösenord → fem `401` följt av `429`
med rätt felmeddelande. Bekräftade samtidigt att en obesläktad route
(`GET /api/sources`) fortsatt gav `200` — begränsningen är faktiskt
scopad till auth-rutterna, inte global.

---

## feat: onboarding-wizard på riktigt (Konto → Källor → Klart) (2026-08-04)

**Mål:** Punkt 2 i den bestämda ordningen innan registrering kan öppnas
publikt (9→1→6→7→8→**2**→3→4→5, se `[[project_fore_registrering_checklista]]`).
En 3-stegs wizard skissades som klickbar mockup i session 24 men byggdes
aldrig på riktigt — `RegisterPage.tsx` skapade bara kontot och kastade
användaren rakt in på startsidan.

**Utforskning innan kod (två parallella Explore-agenter):** bekräftade att
`POST /api/auth/register` redan loggar in användaren direkt (token sätts
innan navigering), så alla tre steg kan anropa autentiserade endpoints utan
extra inloggning. Bekräftade också att `Source` fortfarande är helt
flack/nationell (inget geografifält) — det ursprungliga mockup-designens
adress/ort-fält för att "föreslå lokala källor" skulle alltså inte göra
något just nu. Efter avstämning med användaren (som inte kom ihåg den
gamla mockup-detaljen — helt rimligt, den är från en session sedan länge)
föll valet på att hoppa över fältet helt istället för att bygga in ett
overksamt UI-element.

**Genomförande:** Ny route `/onboarding` (`OnboardingPage.tsx`), inte
låst till en "precis registrerad"-flagga — vilken inloggad användare som
helst kan besöka den (samma enkla guard-mönster som `AdminPage.tsx`).
`RegisterPage.tsx` navigerar dit istället för direkt till `redirect`-målet,
med `name`/`email` skickat via router-state (bara för välkomstskärmens
personalisering, ingen ny AuthContext-yta behövdes).

Steg 2 (Källor) återanvänder `AllaKallorKort.tsx` **rakt av**, oförändrad
— den var redan en ren, presentationell komponent (`sources`/`activeIds`/
`onAdd` som props). `onAdd` gör exakt samma sak som `MinaKallor/index.tsx`s
redan befintliga `handleAdd`: ett `saveUserSources`-anrop direkt vid klick
(inte en lokal wizard-batch), så resultatet blir identiskt med hur riktiga
Mina källor redan fungerar — och ett besök på `/onboarding` en andra gång
visar korrekt redan valda källor. Steg 3 (Klart) visar en riktig
sammanfattning (namn, e-post, valda källor) och en global "Hoppa över
introduktionen"-länk finns på alla steg (tvingar aldrig, matchar projektets
hållning på FAQ/samtycke).

**Bugg hittad under verifiering, INTE i den nya koden:** vid manuell
webbläsartest (registrera → gå igenom steg 2 → klicka "+ Lägg till" på
flera källor) gav ett klick på SMHI `500 Internal Server Error`
(`SQLite Error 19: 'FOREIGN KEY constraint failed'` i backend-loggen, från
`UserSourcesController.SaveSources`).
- **Uteslutningsmetod:** samma sida/lista, en annan källa (Polisen) sparades
  precis innan utan problem — uteslöt direkt att felet satt i wizardens
  egen kod eller i `AllaKallorKort`/`saveUserSources`-anropet i sig (samma
  kod, samma request-form, bara olika `sourceId`). `curl GET /api/sources`
  direkt mot backend visade bara 3 riktiga källor (Polisen/Trafikverket/
  Krisinformation) — webbläsarens synliga lista på 8 källor var en kvarleva
  i react-querys cache från en tidigare sidladdning, innan jag startat om
  den lokala backend-processen ett flertal gånger under dagens
  testningspass (varje omstart kör om `Program.cs`s seed-logik mot samma
  ihållande lokala SQLite-fil, vilket kan ge en annan uppsättning
  publicerade käll-ID:n än det webbläsarfliken råkade cacha tidigare).
- **Slutsats:** ett testmiljö-artefakt orsakat av min egen upprepade
  backend-omstart under sessionen, inte en bugg i den nya wizarden eller i
  den redan skarpa Mina källor-koden — en riktig, kontinuerligt körande
  backend (produktion, eller en enda sammanhängande dev-session) startas
  inte om upprepade gånger på det här sättet.

**Verifiering:** `npm run build` grönt. Manuellt end-to-end: registrerade
ett riktigt testkonto i webbläsaren → landade korrekt på `/onboarding`
istället för startsidan → steg 1 visade rätt namn/e-post → steg 2 (Polisen)
sparades och visade "Tillagd" → bekräftat via `curl GET /api/user/sources`
med kontots riktiga JWT att valet faktiskt persisterats i backend (inte
bara UI-tillstånd). Kunde inte klicka igenom hela steg 3 pga upprepad
webbläsarverktygs-instabilitet (samma kända problem som tidigare denna
session), men kärnmekaniken (registrering→redirect, äkta backend-sparning,
återbesök visar befintliga val) är bevisat fungerande.

**Andra vägar som hade kunnat fungera:** batcha alla källval lokalt i
wizard-state och göra ETT sparanrop på "Nästa" istället för per-klick —
avfärdat till förmån för att återanvända `handleAdd`s redan beprövade
mönster rakt av, vilket också gör beteendet identiskt med hur Mina källor
redan fungerar (mindre att hålla synkat, en enda sanning för "hur en källa
läggs till").

---

## feat: flagg-roadmap-status flyttad in i idé-pipelinen, "Kommande funktioner" skrotad (2026-08-04)

**Mål:** Direkt efter att idé-pipelinens tre PR:ar mergats påpekade
användaren en genuin överlappning: den fristående "Kommande funktioner"-
sidan (byggd tidigare samma session på `feat/admin-kommande-funktioner`,
men ALDRIG mergad/PR:ad) visar i praktiken samma sak som en idés
"Lanseringsklar"-läge i den nya pipelinen — bara på ett annat ställe,
härlett från en annan datakälla (`featureFlags.ts` direkt, inte
`FeatureIdea`-tabellen).

**Varför det var ett genuint problem, inte bara kosmetiskt:** projektet har
redan blivit bränt av precis den här typen av duplicering en gång (de
divergerande `Arende`-typerna, sessionslogg 25). Att ha två separata
adminsidor som båda svarar på "vad är byggt men inte lanserat?" hade
riskerat samma sak — de kan tystna glida isär.

**Lösning:** Ingen sammanslagning av datamodeller (det är fortfarande två
olika, legitima begrepp — se nedan) utan en **visuell** sammanslagning:
`IdeDetaljModal.tsx` slår nu upp `idea.flagKey` mot `FLAG_DEFINITIONER`
(från `featureFlags.ts`) och visar flaggans `roadmap`/`roadmapSedan`/
`roadmapPrNummer`-info (samma PR-länkar och "väntat X dagar"-badge som den
skrotade sidan hade) direkt i idéns egen beskrivningssektion, om en
matchande flagga med roadmap-data finns. `FlagDefinition`-typen i
`featureFlags.ts` fick tillbaka de tre fälten (`roadmap`/`roadmapSedan`/
`roadmapPrNummer`) och datan för `flode_sparat`/`notif_push`/
`support_arenden` — själva `KommandeFunktioner.tsx`-komponenten och dess
`Oversikt.tsx`-dashboardkort byggdes INTE om, eftersom de aldrig mergades
och den fristående sidan nu är överflödig. Grenen `feat/admin-kommande-
funktioner` raderades helt (lokalt och på GitHub).

**Varför inte en fullständig sammanslagning av datamodellerna:** `Kommande
funktioner` var en *härledd* vy — den kan aldrig ljuga om vad som faktiskt
är kodat, eftersom den läser `featureFlags.ts` direkt. Idé-pipelinen är en
*process*-vy — den spårar sådant som inte ens har en flagga än (brainstorm,
triage). De svarar på olika frågor och har olika käll-sanningar; att slå
ihop dem till EN datamodell hade tvingat antingen pipelinen att känna till
frontend-kodens flaggor (omöjligt för backend) eller flaggsystemet att bli
databasdrivet (en mycket större omställning, inte motiverad av det här).
Den lätta lösningen — visa flaggans data INUTI idévyn när en länk finns,
annars bara den enkla textraden `Flagga: {key}` — täcker samma behov utan
att blanda ihop källorna.

**Verifiering:** `npm run build` grönt.

---

## feat: Funktionsidé-pipeline-UI i admin (2026-08-04, PR 3/3)

**Mål:** Del 3 av 3, den sista biten i idé-pipelinen (se PR 1–2 för
datamodell/API). Bygger själva adminsidan: en flikfiltrerad lista
(Brainstorm/Triage/Bygger/Testar/Lanseringsklar/Avslutade) plus en
detaljmodal per idé (stadie-växlare, triage, testare, lanseringschecklista).

**Genomförande, allt återanvänt mönster, inget nytt uppfunnet:**
- `api/featureIdeas.ts` — exakt samma form som `api/support.ts`
- `FunktionsIdePipeline.tsx` — flikfilter (samma mönster som
  `SupportInbox.tsx`s Alla/Ärenden/Feedback), tabell + "Ny idé"-inline-formulär
- `IdeDetaljModal.tsx` — `createPortal`-modal (samma mönster som
  `FeedbackButton.tsx`, valt istället för `SupportInbox`s inline-variant
  eftersom idékorten ligger i en tabellrad som annars kan klippas av)
- Stadie-växlaren är en fri knapprad (alla sju stadier alltid klickbara),
  INTE en låst linjär "nästa steg"-knapp — riktigt arbete går fram och
  tillbaka (t.ex. testas → byggs igen vid en upptäckt bugg under test)
- Ny "💡 Skapa idé av det här ärendet"-knapp i `SupportInbox.tsx`s
  ärendemodal — kopplar ihop Feedback-inkorgen med idé-pipelinen: skapar en
  idé med `källaTyp: 'feedback'` och `sourceTicketId` satt till ärendet,
  förifylld med ärendets ämne och första meddelande
  - Idé-detaljen visar i sin tur en länk tillbaka till käll-ärendet
    (`onÖppnaÄrende`-prop, samma callback-mönster som redan finns för
    `Anvandare.tsx`/`Handelsesok.tsx` i `AdminPage.tsx`) — full cirkel utan
    att duplicera data mellan de två systemen
- Ny adminsektion `funktionsideer` i `AdminSidebar.tsx`/`AdminPage.tsx`,
  samma wiring-mönster som `kommande-funktioner` (egen branch, ej mergad än)

**Verifiering:** `npm run build` grönt. Backend-API:t redan fullt
curl-verifierat i PR 2/3 (skapa/lista/triage/stadiebyte/checklista-seedning/
testare/behörighet). **Kunde INTE verifieras visuellt i webbläsaren** —
`mcp__claude-in-chrome`-verktygen var instabila hela försöket (samma kända
transienta problem som återkommit flera gånger denna session: tabbar
byter ID/tabGroupId mellan anrop, verktyg svarar inte i tid). Efter ~5
försök med olika verktyg (navigate/screenshot/get_page_text) gavs
webbläsarverifieringen upp och lokala servrar (backend :5000, frontend
:5175) lämnades igång åt användaren att testa manuellt istället för att
låtsas att det verifierats.

**Andra vägar som hade kunnat fungera:** en riktig drag-and-drop-kanban
istället för flikfiltrerad lista — avfärdat i planeringsfasen, se
plan-dokumentet: mer kod, nytt beroende, och löser inget som flikarna inte
redan löser för en ensam admin-användare.

---

## feat: AdminFeatureIdeaController — API för idé-pipelinen (2026-08-04, PR 2/3)

**Mål:** Del 2 av 3 (se PR 1/3 ovan för datamodellen och det fulla
designresonemanget). Bygger det faktiska API:et ovanpå `FeatureIdea`-
modellerna: lista/skapa/detalj/uppdatera/stage/triage/testare/checklista.

**Genomförande:** `AdminFeatureIdeaController` (`api/admin/feature-ideas`,
`[Authorize(Roles = "Admin")]`), samma struktur som `AdminSupportController`
rakt av — inga nya mönster uppfanns. Enda logiken utöver ren CRUD: när
`PUT .../stage` sätter `Stage` till `"lanseringsklar"` för första gången
seedas fyra standardchecklista-poster ("FAQ uppdaterad", "Kundtjänstbotens
kunskapsbas uppdaterad", "Push-notis förberedd", "Flagga aktiverad i kod")
— men bara om idén saknar checklista sedan innan, så att flytta fram och
tillbaka mellan stadier (t.ex. tillbaka till "byggs" och sedan fram igen)
inte duplicerar posterna eller nollställer redan avbockade items.

13 nya xUnit-tester i `AdminFeatureIdeaControllerTests.cs`, samma
InMemory-DB-mönster som `SupportControllerTests`: `IdeaNumber` ökar
korrekt via MAX+1, triage sätter alla tre fält, lanseringsklar-seedning
sker exakt en gång även vid upprepade stadiebyten, testare läggs till via
e-postuppslagning (okänd e-post → 404, redan tillagd → 409), checklista-
items kan bockas av (sätter `DoneAt`/`DoneByUserId`) och tas bort,
Admin-only bekräftat via samma reflektions-test som `AdminSupportController`
redan använder.

**Verifiering:** `dotnet build` grönt, `dotnet test` grönt — 43/43 (30
tidigare + 13 nya), inga regressioner.

**Andra vägar som hade kunnat fungera:** validera `Stage`-värdet mot en
fast lista server-side istället för att acceptera vilken sträng som helst
— avfärdat för konsekvens med `SupportTicket.Status`, som redan accepterar
fri text utan whitelist. Om ogiltiga stadienamn blir ett verkligt problem
i praktiken är det enkelt att lägga till senare utan att bryta något.

---

## feat: FeatureIdea-datamodell för idé-pipelinen (2026-08-04, PR 1/3)

**Mål:** Efter "Kommande funktioner" föreslog användaren en betydligt större
idé: ett enda ställe i admin som täcker en funktions HELA livscykel —
brainstorm → triage (kan/bör-bedömning) → bygg → test (med utvalda testare)
→ lanseringsklar (checklista: FAQ, kundtjänstbot, push, flagga) → lanserad.
Planerades i ett eget plan-läge-pass (två parallella Explore-agenter mot
backend-auth/SupportTicket-mönster respektive frontend-admin-mönster) innan
någon kod skrevs, eftersom det är ett helt nytt backend-domän. Detta är del
1 av 3 planerade PR:ar — bara datamodellen.

**Designbeslut som drevs av kodsökning, inte gissning:**
- **Ingen global "Tester"-roll.** `User.Role` är bara en fri sträng
  (`"Admin"/"Support"/"Användare"`), och sökning bekräftade att ingen
  per-record multi-user-koppling finns någonstans i kodbasen sedan
  tidigare (`SupportTicket.AssignedToUserId` är en enda FK, inte en lista).
  En global testroll hade blandat ihop "kan testa vissa funktioner" med en
  systemomfattande behörighetsnivå. Löst med en egen kopplingstabell
  (`FeatureIdeaTester`) istället — matchar hur varje annan relation i
  schemat redan är byggd (riktiga FK-tabeller, aldrig JSON-listor av ID:n).
- **`IdeaNumber` tilldelas i applikationskod (MAX+1), inte en DB-sekvens** —
  exakt samma medvetna val som `SupportTicket.TicketNumber` gjorde (portabelt
  mellan SQLite lokalt och Postgres i produktion utan en till
  sekvens-specialfix i `Program.cs`).
- **Triage är två nullable booleans + en motivering-textsträng**
  (`TriageKanGoras`/`TriageBorGoras`/`TriageMotivering`), inte en egen enum
  eller fyra separata statusvärden — täcker användarens fyra kombinationer
  (kan+bör=godkänd, alla andra=inte godkänd) utan att uppfinna en ny
  statustyp när kodbasen redan konsekvent använder fria strängar för den
  typen av fält (`Status`/`Channel`/`SenderType` på `SupportTicket`).
- **Ingen `GET /api/admin/users`-lista finns** (bekräftat: `Anvandare.tsx`
  är fortfarande 100% mock) — att bygga hela användarlistnings-API:et hör
  inte hemma i den här funktionen. Löst med en minimal
  `GET /api/admin/users/lookup?email=` i en ny `AdminUsersController.cs`,
  räcker för att lägga till en specifik testare via e-post utan att bygga
  ett helt nytt, större API i förbigående.

**Genomförande:** `FeatureIdea`/`FeatureIdeaTester`/`FeatureIdeaChecklistItem`
i `backend/Models/`, konfigurerade i `AppDbContext.OnModelCreating` med
samma FK/index-mönster som `SupportTicket`-familjen. Migration genererad med
`dotnet ef migrations add AddFeatureIdeas` (id
`20260804145629_AddFeatureIdeas`), följt av det etablerade
raw-SQL-Postgres-blocket i `Program.cs` (uuid/timestamptz/boolean/TEXT-typer,
`ON CONFLICT DO NOTHING`-insert i `__EFMigrationsHistory`) — exakt samma
mönster som `AddSupportTickets`.

**Verifiering:** `dotnet build` grönt, alla 30 befintliga backend-tester
gröna (inga regressioner), `dotnet ef migrations has-pending-model-changes`
bekräftar att modellen och migrationen stämmer exakt överens, och
`dotnet ef database update` applicerade migrationen mot den lokala
SQLite-databasen utan fel (verifierar den faktiska SQL:en, inte bara att
koden kompilerar). Postgres-grenen av migrationen kan inte testas lokalt
(ingen lokal Postgres-instans), men följer syntaxen från `AddSupportTickets`
som redan är bevisat fungerande i produktion.

**Andra vägar som hade kunnat fungera:** en riktig `[Authorize(Roles =
"Tester")]`-roll hade varit enklare kod men fel modell — skulle krävt att
varje testare fick en global rollhöjning bara för att testa EN funktion,
och skulle inte gått att ge olika testare till olika idéer samtidigt.

---

## fix: NewsItem-radlayout (titelklämning) + tyst fel vid Spara-klick (2026-08-04)

**Mål:** Två buggar hittade av användaren under manuell verifiering av
Sparat-funktionen i Chrome DevTools innan PR #404 (som stänger av Sparat
bakom en flagga) mergades. Behövde fixas innan Sparat kunde bedömas som
"snyggt nog att stänga av tills vidare" — dvs. innan funktionen läggs på is
ska den inte lämnas i ett trasigt skick.

**Bugg 1: händelsetiteln klämdes till ett ord per rad.** En skärmdump visade
"Ökad spridning av kikhosta i Sverige" (Folkhälsomyndigheten) radbruten
till nästan ett ord per rad i den hopfällda radvyn.

- **Grundorsak:** `NewsItem.tsx`s hopfällda rad var EN flex-rad där titeln
  (`flex-1`) fick konkurrera om bredd med severity-badge, checkbox,
  källnamn, geografi, klockslag, prenumerationsklocka, bokmärkesikon och
  chevron — samtliga `shrink-0`. Med en lång källa (lång ShortName) och en
  lång titel samtidigt blev titelns tillgängliga bredd så smal att varje ord
  fick sin egen rad.
- **Uteslutningsmetod:** bekräftat genom att läsa layoutens JSX rad för rad
  (rad 90–149) — inget CSS-fel, bara för många `shrink-0`-syskon som
  strukturellt konkurrerade om samma rad som titeln.
- **Lösning:** raden delades i två — rad 1: checkbox + severity-badge +
  titel (`flex-1 min-w-0`, nu ensam om utrymmet) + chevron. Rad 2 (mindre
  text, `flex-wrap`, `mt-1`): källnamn, geografi, klockslag,
  prenumerationsklocka, bokmärkesikon. Följer användarens egen instinkt
  ("källnamnet ovanför händelsenamnet") snarare än att bara krympa
  textstorleken, vilket bara hade skjutit samma problem till en mindre
  brytpunkt.
- **Andra vägar som hade kunnat fungera:** (a) trunkera långa titlar med
  ellipsis (`truncate`) — avfärdat, döljer information användaren
  uttryckligen vill se i en nyhetslista; (b) krympa textstorleken på lång
  källa/titel — användarens egen alternativa förslag, men löser bara
  symptomet vid en specifik brytpunkt snarare än att ta bort den strukturella
  konkurrensen om bredd.

**Bugg 2: 400 Bad Request vid klick på Spara-ikonen, ingen rollback i UI.**

- **Vad hände:** Användaren fick ett 400-fel i nätverksfliken vid klick på
  bokmärkesikonen, men ikonen visade ändå "sparad" i gränssnittet.
- **Uteslutningsmetod:** reproducerade `POST /api/user/saved-events` via
  curl med ett riktigt GUID-event-ID — gav 200 OK, alltså inget fel i
  backend-endpointen i sig. Kontrollerade sedan `.env.local`:
  `VITE_USE_MOCK=true` gör att lokal dev visar `MOCK_EVENTS` (hårdkodade
  icke-GUID-ID:n som `'fhm-002'`) — ett sådant ID skickat till en `Guid`-
  bindad `[FromBody]`-DTO ger automatiskt 400 från ASP.NET Cores
  modellbindning, innan koden ens når controllerns egen logik. Detta är en
  ren lokal-dev-artefakt (produktion kör `VITE_USE_MOCK=false`), inte en
  riktig backend-bugg.
- **Den riktiga buggen som 400:an avslöjade:** `SavedEventsContext.tsx`s
  `toggleSparad` uppdaterade UI-state optimistiskt (innan svar från
  backend) men fångade upp ett misslyckat API-anrop med en tom
  `.catch(() => {})` — ingen rollback. Ikonen kunde alltså visa "sparad"
  permanent även när backend faktiskt avvisat anropet, med data som tyst
  hamnat i ett osynkat tillstånd mellan klient och server.
- **Lösning:** `.catch()` rullar nu tillbaka exakt den optimistiska
  ändringen (lägger tillbaka eller tar bort samma ID igen) om anropet
  misslyckas, så ikonen alltid speglar vad som faktiskt sparats i backend.
- **Andra vägar som hade kunnat fungera:** en fullständig refetch av
  `fetchSavedEventIds()` vid fel istället för en riktad rollback — avfärdat
  som onödigt tungt (en extra nätverksrunda) för att korrigera en enda
  boolean-toggle vars före/efter-tillstånd redan är kända lokalt.

**Verifiering:** `npm run build` grönt. Bytte branch innan commit — arbetet
hade av misstag skett direkt på `docs/kundtjanstbot-kunskapsbas-och-integration`
(PR #405s branch), overrelaterat till dessa två UI/UX-fixar. Flyttat till en
egen branch (`git stash push` på bara de två filerna, `checkout main`,
`checkout -b`, `stash pop`) innan commit, för att hålla PR:arna atomära.

---

## fix: mobilanpassning av Ärendehantering + profilens Uppdateringar (2026-08-04)

**Mål:** Ett kodbaserat mobilaudit av alla sidor besökare+medlemmar kan nå
(webbläsarverktyget var otillgängligt hela sessionen — samma transienta
instabilitet som setts tidigare, gav upp efter flera förnyade försök och gick
kodgranskningsvägen istället). Frågan som drev det: är vi säkra på att allt är
mobilanpassat?

**Vad hände på vägen:** Delade upp granskningen i två lager — (1) navigations-
skalet (svep + hamburgermeny för att öppna sidomenyn) och (2) innehållslagret
(gridlayouter inuti varje sida). `grep -rl useSwipeable` visade att skalet
redan är EN återanvänd, konsekvent implementerad lösning — `App.tsx`, `OmPage`,
`UppdateringarPage` och `ProfilePage` (som täcker ALLA medlemssektioner: Mina
källor, Notifieringar, Konto, Uppdateringar, Support) har den redan, sedan
session 6/23. Inget att fixa där.

Innehållslagret var mer blandat. `grep -n "grid-cols"` över samtliga
profilsektioner visade att Konto, Notifieringar, Support-wrappern, FAQ-kortet
och Mina källor (som redan hade fått en egen, specifik mobilfix i session 23:
`h-auto sm:h-[523px]`) alla redan använder ett responsivt mönster
(`grid-cols-1 lg:grid-cols-2` eller motsvarande `flex`-variant). Två filer
gjorde INTE det:

- `ArendehanteringKort.tsx` — `grid-cols-4` helt utan brytpunkt, både för
  statistikraden och för layouten "skicka ärende (1 kol) + ärendetabell
  (3 kol)". Skulle tvinga fyra hopklämda kolumner på en 390px-skärm.
- `Uppdateringar.tsx` (profilsektionen, inte den publika `/uppdateringar`-sidan
  — den har redan svep/hamburger men dess INNEHÅLL hade aldrig granskats
  separat) — `grid-cols-2` utan brytpunkt, samma problem i mindre skala.

**Lösning — användarens egen idé:** användaren bekräftade att Mina källor
faktiskt ser bra ut på sin riktiga telefon (bättre bevis än en emulerad
webbläsarbredd) och frågade om det mönstret kunde återanvändas. Kopierade
`MinaKallor/index.tsx`s exakta struktur rakt av:
`flex flex-col lg:flex-row gap-6 items-stretch lg:items-start` för den
asymmetriska formulär+tabell-layouten i Ärendehantering (samma
`w-full lg:w-80 lg:shrink-0` / `flex-1 min-w-0`-uppdelning som `LaggTillKort`/
`AktivaKallorKort` redan använder), och det enklare `grid-cols-1 lg:grid-cols-2`
(samma som Konto/Notifieringar) för statistikraden och för profilens
Uppdateringar-sektion.

**Andra möjliga lösningar, inte valda:**
- Kunnat uppfinna en helt ny mobillayout för just Ärendehantering (t.ex.
  kort-baserad vy istället för tabell på små skärmar) — avfärdat för nu,
  betydligt mer jobb än att återanvända ett redan beprövat mönster, och
  tabellen har redan `overflow-auto` så den går i alla fall att använda,
  bara inte optimalt.
- SupportInbox.tsx (adminsidan) har samma tabellform men rördes INTE —
  ligger utanför den här gångens scope (besökare+medlemmar, inte admin), och
  admin är en annan roll med andra avvägningar om mobilstöd överhuvudtaget
  är önskvärt där.

**Verifiering:** `npm run build` grönt. Inget riktigt klicktest gjordes den här
gången (samma webbläsarverktygsproblem som hindrade hela auditen) — rekommenderar
att användaren kollar båda sidorna på sin telefon efter merge, samma sätt som
redan bekräftades för Mina källor.

---

## fix: DateTime tappade UTC-markering vid läsning från SQLite (2026-08-03)

**Mål:** Ingen ny funktion — ett bugfix upptäckt av användaren direkt efter att
ha testat den nya SupportInbox: ett svar visades med tiden 15:55 fast klockan
faktiskt var 17:58.

**Vad hände på vägen:** Kollade rådata direkt (`curl` mot admin-API:t) istället
för att gissa i frontend-koden. Svaret innehöll
`"createdAt":"2026-08-03T15:45:33.6432707"` — **ingen `Z` i slutet, ingen
tidszon alls**. UTC-klockan var samtidigt faktiskt 15:58, så det lagrade värdet
var korrekt (15:45 UTC = 17:45 svensk sommartid) — problemet satt i hur det
serialiserades, inte i vad som lagrats.

- **Uteslutningsmetod:** Två möjliga förklaringar — antingen sparas fel
  klockslag i databasen, eller så är klockslaget rätt men taggen som säger
  "det här är UTC" försvinner på vägen ut. `curl`-svaret avgjorde det direkt:
  15:45 UTC stämmer exakt med den faktiska tiden minus två timmar (svensk
  sommartid, UTC+2) — värdet var alltså korrekt hela vägen, bara
  UTC-markeringen (`Z`) saknades i JSON-strängen.
- **Grundorsak:** Ett känt beteende i EF Core mot SQLite — `DateTime.UtcNow`
  sparas korrekt taggad som UTC (`DateTimeKind.Utc`), men SQLite har ingen
  egen datatyp för det, så vid **läsning** tillbaka från databasen returnerar
  EF Core:s SQLite-provider datumet som `DateTimeKind.Unspecified` (taggen
  tappas, värdet i sig är oförändrat). `System.Text.Json` skriver då ut
  strängen UTAN `Z`, och webbläsarens `new Date(...)` tolkar en sträng utan
  tidszon som redan-lokal-tid istället för att konvertera från UTC — fel
  klockslag visas.
- **Omfattning:** Inte bara Ärendehanteringen — det här gäller VARJE
  `DateTime`-fält i hela appen som lästs från en lokal SQLite-databas.
  Upptäcktes bara nu för att Ärendehanteringen är första gången exakta
  klockslag ner på minuten visas så tydligt i gränssnittet.
- **Lösning:** En global EF Core-konverterare (`ConfigureConventions` i
  `AppDbContext`, ny fil `Data/UtcDateTimeConverter.cs`) som tvingar
  `DateTimeKind.Utc` på varje `DateTime`/`DateTime?`-fält vid läsning, oavsett
  vilken databas som används. Ingen ny migration behövdes — bekräftat med
  `dotnet ef migrations has-pending-model-changes` ("No changes have been
  made to the model") eftersom det bara är en CLR-sidans tolkning, inte en
  ändring av den faktiska kolumntypen.
- **Andra möjliga lösningar, inte valda:**
  - Kunnat fixa det bara i frontend (t.ex. lägga till `Z` manuellt på varje
    datumsträng innan `new Date(...)`) — avfärdat, hade krävt att komma ihåg
    det på varje enskilt ställe datum formateras, och löser inte grundorsaken
    för framtida kod.
  - Kunnat fixa det fält för fält i varje entitet — avfärdat, en global
    konverterare via `ConfigureConventions` täcker alla nuvarande OCH
    framtida `DateTime`-fält automatiskt, en enda plats att underhålla.
  - Övervägde att detta kanske bara är ett lokalt SQLite-problem (Postgres
    `timestamptz`-kolumner brukar bevara UTC-taggen korrekt) och att
    produktion redan kunde vara opåverkad — men fixen är ofarlig och
    korrekt oavsett databas (att tvinga UTC på ett värde som redan är UTC är
    en no-op), så samma fix gäller båda utan att behöva bevisa vilken databas
    som faktiskt hade problemet.
- **Verifiering:** `dotnet build`/`dotnet test` (29/29 gröna, ingen ny
  migration), sedan `curl` igen mot samma endpoint efter omstart — samma
  ärende visar nu `"createdAt":"2026-08-03T15:45:33.6432707Z"`, med `Z`.

---

## Del 4 — Ärendehantering/SupportInbox omkopplade mot riktig data (2026-08-03)

**Mål:** Sista delen av fyra — koppla `ArendehanteringKort.tsx` (användarsidan) och
`SupportInbox.tsx` (adminsidan, ~900 rader, den mest utbyggda mock-UI:n i hela
projektet) mot det riktiga API:t från PR #398. Plus två tillägg som beslutades
efter att användaren testat Feedback-knappen och undrade vart informationen
faktiskt tog vägen: (1) push-notis till admin vid nytt ärende, (2) ett
kanalfilter (Alla/Ärenden/Feedback) i SupportInbox eftersom användaren inte
ville blanda anonym feedback med medlemmars riktiga ärenden i samma vy.

**Vad hände på vägen:** Läste båda stora filerna i sin helhet innan någon
ändring gjordes (891 respektive 435 rader) för att förstå exakt vilka fält
mock-datan hade, sedan skrevs de om rad för rad — samma JSX/Tailwind-struktur
bevarad, bara datalagret bytt från lokalt `useState` till `useQuery`/
`useMutation` (samma mönster som redan används i `Kallhantering.tsx`).
Mockens `executeOverdueActions` (klient-side `setInterval` var 60:e sekund)
togs bort helt — nu kör `SupportScheduledActionService` (byggd i PR #398)
det på riktigt server-side, frontend behöver bara polla (`refetchInterval`)
för att se resultatet.

### Bugg: `"paminnelse"` vs `"påminnelse"` — stavning matchade inte mellan backend och frontend

- **Vad hände:** `tsc -b` (typkontrollen i `npm run build`) vägrade bygga:
  `Type '"paminnelse"' is not assignable to type '"tilldelad" | "påminnelse"'`.
- **Uteslutningsmetod:** Inget gissande behövdes — TypeScripts egen
  typkontroll pekade exakt på var strängarna skilde sig åt (asciifierat
  `"paminnelse"` i backend-koden jag skrivit i PR #398, mot `"påminnelse"` med
  å i den ursprungliga mockens `PendingNotis`-typ som `AdminPage.tsx` redan
  konsumerar).
- **Grundorsak:** Ren stavningsinkonsekvens när jag skrev C#-strängen — troligen
  undvek jag å av gammal vana (den tidigare, ogrundade oron för
  UTF-8-problem, se PR #398:s "bugg 2" som visade sig vara ett Bash/curl-fel,
  inte ett riktigt encoding-problem i .NET).
- **Lösning:** Rättade backend-strängen till `"påminnelse"` (med å) istället för
  att degradera frontend-typen till ascii — å/ä/ö fungerar felfritt end-to-end
  i den här stacken, det finns ingen anledning att undvika dem.
- **Andra möjliga lösningar:** Kunnat byta frontend-typen till `"paminnelse"`
  istället — avfärdat, hade brutit konsekvent svensk stavning som redan
  används överallt annars (`"Öppet"`, `"Under behandling"` har redan å/ä/ö
  utan problem).

### Upptäckt scope-gräns: `Anvandare.tsx`s hela användarlista är fortfarande mock

Planen sa att `Anvandare.tsx`s supportärende-flik skulle kopplas mot ett
riktigt filtrerat anrop (`?userId=`). Vid närmare koll visade det sig att HELA
`Anvandare.tsx`-panelen bygger på en hårdkodad `INITIAL_ANVÄNDARE`-array med
fejkade numeriska ID:n (`vald: number`) — inget `GET /api/admin/users` finns
någonstans (redan noterat i session 24/25). Att koppla bara supportärende-
fliken mot riktiga biljetter hade varit meningslöst: en fejkad användares
ID matchar aldrig något riktigt ärendes `CreatedByUserId`, så fliken hade
bara tyst visat "inga ärenden" för alla användare, alltid — sämre än att
vara ärligt mockad. **Beslut: lämnade den fliken orörd.** Att koppla hela
Anvandare-panelen mot riktiga användare är en egen, mycket större uppgift
(kräver att `GET /api/admin/users` byggs först) — inte del av den här planen.

### Designval: "Redigera" en schemalagd åtgärd = avbryt + skapa ny

Mockens redigeringsflöde för en väntande schemalagd åtgärd (byta datum/text/
agent på en redan schemalagd åtgärd) hade ingen motsvarande PUT-endpoint i
backend (PR #398 byggde bara skapa + avbryt, inte uppdatera — ett sällan
använt redigeringsflöde ansågs inte motivera en till endpoint). Löste det i
frontend istället: "Spara" på en redigering anropar avbryt-mutationen och
skapa-mutationen i följd, med de nya värdena. Samma slutresultat för
användaren, ingen ny backend-kod behövdes. Enda skillnaden mot en riktig
uppdatering: åtgärden får ett nytt ID och `CreatedByUserId` blir den som
redigerade (rimligt — reflekterar faktiskt vem som senast ändrade den).

### Verifiering — ärligt om vad som gjordes och inte

- **Gjort:** full läsning av båda originalfilerna innan omskrivning, `dotnet
  build`/`dotnet test` (29/29 gröna, 4 nya tester för
  `PushDispatcher.DispatchNewTicketAsync`), `npm run build` grönt (typkontrollen
  fångade stavningsbuggen ovan), och en fullständig curl-verifiering av hela
  backend-kedjan: skapade ett anonymt feedback-ärende OCH ett inloggat
  medlemsärende, bekräftade att admin-listan visar båda med rätt `channel`-
  fält och rätt `contactName`/`contactEmail`.
- **Inte gjort den här gången:** ett riktigt klicktest i webbläsaren av hela
  UI-flödet (öppna ärende, svara, tilldela, sätt påminnelse, schemalägg en
  åtgärd). Webbläsarverktygets anslutning till fliken föll upprepade gånger
  (samma kända transienta CDP-instabilitet som i PR #400), oberoende av
  flikbyten. Efter flera förnyade försök (praxis: ge inte upp direkt men
  fortsätt inte i all oändlighet) föll jag tillbaka på en noggrann manuell
  kodgenomläsning av båda de omskrivna filerna istället för att låtsas att ett
  klicktest gjordes. **Rekommenderar starkt en manuell klickgenomgång innan
  eller strax efter merge**, eftersom det här är den enskilt största UI-
  omskrivningen i hela planen.

---

## PR #400 — Feedback-knappen bort från Formspree (2026-08-03)

**Mål:** Del 3 av 4 — koppla om Feedback-knappen till det nya, riktiga
support-API:t (#398) istället för Formspree, som har ett hårt inskickstak
(50/månad, delat med andra projekt) som var hela anledningen till att bygga
det här. Den mest akuta biten av de fyra delarna.

**Vad hände på vägen:** Rak omkoppling — `FeedbackModal` anropade tidigare
`fetch` direkt mot `https://formspree.io/f/xpqeyzjj`. Bytte till en ny
`createTicket()`-wrapper i en ny `src/api/support.ts` (samma mönster som alla
andra `api/*.ts`-filer redan använder). Ingen bugg den här gången, men ett
medvetet beteendeval behövde göras: Formspree accepterade feedback helt utan
e-post, men backend kräver `ContactEmail` för anonyma ärenden — annars finns
inget sätt att veta vem som skickade det eller svara. Löste det genom att
göra e-postfältet obligatoriskt (`required`) bara när man INTE är inloggad
(`useAuth().isLoggedIn`) — inloggade slipper ange e-post eftersom kontots
e-post redan finns i biljetten.

**Verifiering — ärligt om vad som inte gjordes:** Kunde inte klicka igenom
flödet live den här gången — webbläsarverktygets anslutning till fliken
tappades upprepade gånger (samma kända, transienta CDP-flakighet som noterats
i tidigare sessioner, t.ex. session 24s skärmdumpsproblem), oberoende av om
någon bytte flik eller inte. Efter några förnyade försök (enligt praxis: ge
inte upp direkt, men fortsätt inte heller i all oändlighet på något som
upprepat felar) föll jag tillbaka på kodgranskning istället: läste igenom hela
den ändrade filen, och jämförde det exakta anropsformatet
(`message`/`channel`/`contactEmail`) mot samma kontrakt som redan
livetestades framgångsrikt i PR #398 (anonym ärendeskapelse med e-post gav då
en riktig biljett). Inte samma sak som ett riktigt klicktest, och det
kommunicerades tydligt i PR-beskrivningen istället för att låtsas att det
gjordes.

**Andra möjliga vägar, inte valda:**
- Kunnat behålla Formspree som reserv/fallback om det nya API:t skulle
  misslyckas — avfärdat direkt, hela poängen var att komma bort från
  inskickstaket, en fallback hade bara återinfört samma beroende i tysthet.
- Kunnat kräva e-post av ALLA (även inloggade) för enkelhetens skull — avfärdat
  eftersom kontots e-post redan är känd data för inloggade användare; att
  fråga igen hade varit onödig friktion.

---

## PR #398 — Support-API, admin-inkorg och riktig bakgrundstjänst (2026-08-03)

**Mål:** Bygga backend-delen (kontrollers + en riktig bakgrundstjänst) för det
nya supportärendesystemet — del 2 av 4 i att ersätta Formspree (som har ett
hårt inskickstak) och göra den befintliga, helt mockade Ärendehanteringen till
en riktig inkorg. Se `.claude/plans/staged-weaving-sparrow.md` för hela planen.

**Vad hände på vägen:** Byggde `SupportController` (publikt/användarsidan),
`AdminSupportController` (inkorgen, kräver Admin-roll) och
`SupportScheduledActionService` (kör schemalagda ärende-åtgärder — svar,
intern notering, ombokning — på riktigt server-side var 60:e sekund, istället
för mockens `setInterval` i webbläsaren som bara körde medan admin-fliken
råkade vara öppen). Skrev 11 nya tester, byggde och körde dem gröna, startade
sedan en riktig lokal backend och testade varje endpoint manuellt med curl
innan PR:en räknades klar — det är i det steget båda buggarna nedan hittades.

### Bugg 1: `TicketNumber` kom tillbaka som `0`

- **Vad hände:** Första riktiga anropet (`POST /api/support/tickets`) skapade
  ett ärende, men svaret visade `"ticketNumber":0` istället för `1`.
- **Uteslutningsmetod:** Två möjliga förklaringar — antingen var schemat/
  migrationen fel, eller så triggade aldrig själva mekanismen som skulle sätta
  värdet. Läste om min egen migration och Postgres-SQL-blocket i `Program.cs`
  och insåg att jag hade kopierat samma auto-increment-fix som `Sources.Id`
  fick i session 9 — men den fixen körs bara mot Postgres, aldrig mot lokal
  SQLite. Det uteslöt "schemat är fel": kolumnen fanns rätt, den blev bara
  aldrig ifylld lokalt.
- **Grundorsak:** `Sources.Id` auto-inkrementerar lokalt också, men bara för
  att den är tabellens FAKTISKA primärnyckel — SQLite ger riktiga
  `INTEGER PRIMARY KEY`-kolumner auto-increment på köpet. `TicketNumber` är
  inte primärnyckeln (`Guid Id` är det), så det gratis-beteendet gällde aldrig
  den kolumnen.
- **Lösning:** Flyttade tilldelningen till applikationskoden
  (`MAX(TicketNumber) + 1` i `SupportController.Create`) och tog bort den nu
  onödiga Postgres-sekvensen helt — en enda mekanism, fungerar identiskt på
  SQLite och Postgres.
- **Andra möjliga lösningar, inte valda:**
  - Kunnat lägga till en riktig SQLite-sida av samma sequence-mekanism (t.ex.
    egen triggers-baserad lösning) — mer kod, två databasspecifika vägar att
    underhålla istället för en.
  - Kunnat göra `TicketNumber` till den faktiska primärnyckeln istället för
    `Guid Id` — hade gett gratis auto-increment på båda databaserna, men bryter
    mot hela kodbasens etablerade konvention (alla andra tabeller har `Guid Id`
    som PK, sekventiella heltal som synliga, separata visningsfält) och gör
    ID:t förutsägbart/räknebart utåt, vilket inte är önskvärt för en publik
    resurs.
  - Valde applikationskod-varianten eftersom den är enklast, kräver noll
    databasspecifik kunskap för nästa person som läser koden, och har en känd,
    accepterad svaghet (en teoretisk race condition vid exakt samtidiga
    ärenden) som är helt ofarlig i praktiken för den här trafikvolymen.

### Bugg 2 (som visade sig inte vara en bugg): JSON med å/ä/ö gav fel

- **Vad hände:** Flera curl-anrop med svenska specialtecken i texten (t.ex.
  "Kom ihåg detta") gav ett JSON-deserialiseringsfel som pekade exakt på det
  fält som innehöll specialtecknet.
- **Uteslutningsmetod:** Istället för att anta att C#-koden hanterar UTF-8
  fel, isolerade jag variabeln — skrev exakt samma JSON till en fil med
  `printf`, verifierade med `xxd` att å faktiskt kodats rätt som UTF-8-bytes
  (`C3 A5`), och skickade filen med `curl --data-binary @fil` istället för
  text direkt i kommandoraden.
- **Resultat:** Fungerade perfekt. Bevisade att felet aldrig satt i servern —
  det är Git Bash på den här Windows-maskinen som hanterar icke-ASCII-tecken
  fel när de skickas som direkta kommandoradsargument till `curl.exe`. Bra att
  känna till för framtida manuell testning här, men inget att fixa i appen.

### En egen miss i testmetoden (inte appen)

Första försöket att bekräfta att bakgrundstjänsten faktiskt körde en
schemalagd åtgärd använde `grep` för att leta efter svarstexten var som helst
i ärende-detaljen. Problemet: den texten finns ALLTID i den schemalagda
åtgärdens eget `Text`-fält, oavsett om den körts än eller inte — så testet gav
en falsk positiv. Rättat genom att istället kontrollera det faktiska
`"executed":true`-fältet och att ett NYTT meddelande faktiskt postats i
konversationen. Efter rättelsen bekräftades att bakgrundstjänsten verkligen
körde åtgärden helt på egen hand, utan att någon flik var öppen — vilket var
hela poängen med att bygga det på riktigt.

---

## Session 25 — Feature-flaggornas faktiska räckvidd missförstods (2026-07-29/30)

**Mål:** Stänga av `kallor_lagg_till` och `konto_datahantering` för riktiga
besökare som en del av V1-scope-genomgången.

**Vad hände:** Admin trodde att en toggle i admin-panelens
feature-flag-sektion styrde vad *alla* besökare ser. Vid försöket att stänga
av `kallor_lagg_till` på riktigt visade det sig att flaggan redan "var av" i
panelen — men kortet syntes ändå live för andra besökare.

- **Grundorsak:** `lib/featureFlags.ts` lagrar varje flaggas värde i
  `localStorage`, per webbläsare. Admin-panelens toggle skriver bara till
  *admins egen* `localStorage` — den har aldrig pratat med backend eller
  påverkat någon annan användares webbläsare. Den enda inställningen som
  faktiskt avgör vad en ny besökare ser är `defaultAktiv`-värdet hårdkodat i
  själva `featureFlags.ts`-filen.
- **Lösning:** Rättade `defaultAktiv` för de två flaggorna direkt i koden
  (PR #389) — den enda platsen som faktiskt styr verkliga besökares
  upplevelse.
- **Andra möjliga lösningar, inte valda:** En riktig backend-driven
  feature-flag-tjänst (flaggvärden i databasen, admin-panelen skriver dit)
  hade gjort admin-panelens toggle sann på riktigt. Inte byggd — bedömdes som
  överdimensionerat för ett projekt med en admin och en handfull flaggor;
  konventionen "en kodändring av `defaultAktiv` = produktionsbeslut" är
  billigare att hålla reda på just nu.
- **Etablerat mönster:** Ett beslut om att stänga av något för riktiga
  användare måste alltid landas som en kodändring (`defaultAktiv`), aldrig
  bara en admin-panelstoggle.

---

## Session 23 — Mobil-, tillgänglighets- och synkbuggar (2026-07-26)

Fyra separata buggar hittade under samma sessions mobil-/surfplatteiteration
av "Mina källor" och FAS 4-filterprototypen.

### Bugg 1: `AdminPage` bröt Reacts Rules of Hooks

- **Vad hände:** Ett villkorligt `return null` (utloggad → redirect) låg
  mitt i komponentkroppen, mellan de första hooksen och `useFeatureFlagsAdmin`
  /sju `useState`/ett andra `useEffect`/`useCallback`.
- **Grundorsak:** React räknar hur många hooks som körs per rendering och
  förväntar sig exakt samma antal och ordning varje gång. Ett tidigt
  `return` gör att antalet hooks som faktiskt körs skiljer sig mellan en
  rendering där villkoret är sant och en där det är falskt *(uppskattat
  utifrån sessionsloggen — sättet felet visade sig på, t.ex. Reacts egen
  körtidsvarning kontra ett annat symptom, är inte ordagrant dokumenterat)*.
- **Lösning:** Flyttade samtliga hooks till att alltid köras ovillkorligt,
  det tidiga returnet placerat efter dem istället (PR #367).

### Bugg 2: Osynliga men klickbara raderingsknappar på touch

- **Vad hände:** "Ta bort"-knappar i Aktiva källor/Notifieringar använde
  `opacity-0 group-hover:opacity-100`. Användaren bekräftade att ett tryck
  bredvid källnamnet på mobil raderade tyst, utan varning eller synlig knapp.
- **Grundorsak:** Mönstret förutsätter hover, som inte existerar på
  touch-skärmar — knappen var alltid fullt klickbar, bara osynlig.
- **Lösning:** Ny `.hover-reveal`-CSS-klass med `@media (hover: hover)` —
  knappen är alltid synlig där hover *inte* finns (touch), och hover-gömd
  bara där hover faktiskt finns (PR #375).
- **Etablerat mönster:** `opacity-0 group-hover`-mönster för destruktiva
  knappar är osäkert på touch-enheter — kräver en `@media (hover: hover)`
  -variant.

### Bugg 3: Två `sm`-brytpunkter krockade — en "ingen har plats"-zon

- **Vad hände:** "Lägg till källa" fick `flex-col`-stapling under `sm` för
  att lösa en mobilklämning (PR #374). Vid efterföljande test i iPad-emulering
  (DevTools) visade det sig att den brytpunkten och Aktiva källors interna
  3-kolumnsgrid råkade dela exakt samma tröskelvärde — vid just den bredden
  fanns plats för ingetdera layoutet ordentligt, text och knappar överlappade.
- **Uteslutningsmetod:** Buggen syntes inte i vanlig mobil- eller
  desktoptestning, bara vid uttrycklig surfplatte-emulering — dvs. den
  upptäcktes genom att testa en bredd *mellan* de två vanliga testpunkterna,
  inte genom att anta att "mobil funkar, desktop funkar" räcker.
- **Lösning:** Höjde båda brytpunkterna till `lg` (PR #376).
- **Etablerat mönster:** Testa nya modaler/UI-mönster på fler brytpunkter än
  bara mobil/desktop — surfplatta (`md`-intervallet) avslöjar klasser av
  buggar som annars förblir osedda i produktion.

### Bugg 4: Resync rapporterade "updated" utan att faktiskt uppdatera fältet

- **Vad hände:** Polisens nya `EventType`-fält extraherades (PR #373), men
  `EventSync.SyncAsync`s uppdateringsgren missade fältet helt — en resync
  svarade `updated` men satte aldrig det nya värdet.
- **Uteslutningsmetod:** Upptäcktes bara för att resultatet verifierades mot
  den faktiska datan i databasen efteråt, inte genom att lita på att
  endpointen svarade utan fel.
- **Grundorsak:** Uppdateringsgrenen är en handskriven fält-för-fält-kopiering
  utan automatik — ett nytt fält på modellen måste läggas till där manuellt,
  annars ignoreras det tyst vid uppdatering (även om det fungerar vid ny
  insättning).
- **Lösning:** Lade till kopieringen av `EventType` i uppdateringsgrenen.
- **Etablerat mönster:** Verifiera alltid den faktiska datan efter en resync
  eller migrering, aldrig bara att endpointen svarade "OK".

**Sidonotiser (inte fullständigt egna buggar):** react/react-dom-mismatchen
(se Session 22 nedan) var tillbaka vid sessionsstart — grundorsaken var redan
känd men aldrig faktiskt åtgärdad (bara flaggad som idé), löst permanent
genom att gruppera paketen i Dependabot (PR #370). Chrome desktop vägrade
installera admin-PWA:t separat från huvudappen — visade sig vara en
plattformsbegränsning i Chromes "en app per scope"-heuristik, inte ett fel i
manifesten.

---

## Session 22 — Vit skärm i produktion: react/react-dom-mismatch (2026-07-25)

**Mål:** Diagnostisera en akut produktionsincident — användaren rapporterade
att `samhallsinformation.se` visade en helt vit sida.

**Uteslutningsmetod (i den ordning den beskrivs i sessionsloggen):**
1. `curl` mot frontend/backend/assets — allt gav 200. Uteslöt
   infrastruktur-/deployfel.
2. Genomgång av `AuthContext.tsx`/`ThemeContext.tsx` för riskabla
   `JSON.parse`/`localStorage`-lässtigar. Inga hittades — redan skyddade med
   try/catch. Uteslöt en trasig lokal-lagring-parsning.
3. Upptäckte att lokal branch låg 58 commits efter `origin/main` — flera
   redan livegångna ändringar (Fas 1/2-auth, en react-router-migrering)
   undersöktes därför i onödan innan avvikelsen märktes.
4. Användaren delade webbläsarkonsolens faktiska felmeddelande (skärmdump):
   `Minified React error #527, args[19.2.8, 19.2.7]` — löste frågan direkt.
   Det här steget var den faktiska genvägen; utan konsolfelet hade
   diagnosen fortsatt vara gissningar utifrån (appen har ingen
   ErrorBoundary, så en klientkrasch syns utåt bara som en tom `#root`).

**Grundorsak:** Dependabot-PR #342 bumpade `react` till `19.2.8` men missade
`react-dom`, som blev kvar på `19.2.7`. React 19 kräver exakt matchande
versioner mellan de två paketen — mismatchen kraschar hela render-trädet vid
uppstart.

**Verifiering:** Playwright/Chromium headless mot en fristående
scratch-katalog (för att inte påverka projektets `package-lock.json`):
produktions-URL:en gav `#root` med 0 tecken plus exakt samma `pageerror`;
ett lokalt bygge med matchande versioner gav `#root` med ~37 000 tecken och
inga fel — bekräftade både felet och att fixen löste det.

**Lösning:** PR #358 — `react-dom` → `^19.2.8`. Verifierad live direkt efter
merge (headless-koll gav 48 772 tecken i `#root`, 0 fel).

**Etablerat mönster:** `react`/`react-dom` bör alltid bumpas ihop — en
Dependabot-PR som bumpar bara det ena ger inget CI-fel eftersom `tsc -b &&
vite build` inte bryr sig om att versionerna matchar, bara webbläsarens
körtid gör det. Vid "vit skärm"-rapporter: be alltid om webbläsarkonsolens
faktiska felmeddelande tidigt, det är snabbaste vägen till grundorsaken,
särskilt utan en ErrorBoundary.

### Beslut i samma session: hur får en redan ingestad händelse en fixad ingestor-logik?

**Vad hände:** Efter en separat SMHI-textformateringsfix
(PR #360) frågade användaren om redan hämtad SMHI-data kunde få det nya
formatet utan att vänta på nya varningar.

- **Bakgrund:** `IngestorBackgroundService` dedupar på `ExternalId` och
  uppdaterar aldrig befintliga rader — en ingestor-fix syns annars bara på
  nyinkommen data.
- **Lösning (vald):** PR #361 — ny `POST /api/admin/sources/{id}/resync`
  (JWT Admin) som kör om en källas ingestor och skriver över befintliga
  rader. Upsert-logiken extraherades till en delad
  `EventSync.SyncAsync(db, ingestor, overwriteExisting, ct)`-helper, och
  bakgrundstjänsten bytte till samma helper med `overwriteExisting: false`
  — dess eget beteende förblev oförändrat.
- **Varför den lösningen:** återanvändbar för alla källor och alla framtida
  ingestor-ändringar, istället för en engångslösning bara för SMHI.
- **Begränsning som blev tydlig i samma veva:** bara live/aktuell data i
  källans eget flöde kan rättas retroaktivt via resync — historik som redan
  lämnat käll-RSS:en/API:et förblir orörd för alltid. Inte en bugg, en
  permanent egenskap hos mekanismen.

**Sidonotis:** Samma session upptäcktes att `ci.yml` bara triggar på
`Samhallsinformation/frontend/**`, så en ren backend-PR (#361) mergades utan
någon automatisk byggkontroll. Löst med en egen `ci-backend.yml` med eget
path-filter (PR #362).

---

## Session 21 — SMHI: fel URL, inte tomt resultat (2026-07-24)

**Mål:** Användaren bad om en översyn av SMHI-källan.

**Vad hände:** `SmhiApiIngestor` (vädervarningar) hade aldrig levererat data
sedan den byggdes i session 12–13.

- **Ursprunglig, felaktig slutsats (session 15):** ett 404 från
  varnings-API:et tolkades som "inga aktiva varningar, sommar i Sverige" —
  ett rimligt men aldrig verifierat antagande.
- **Uteslutningsmetod (session 21):** testade om *andra* paths på samma
  subdomän också gav 404. De gjorde det — vilket uteslöt "tomt men giltigt
  svar" och avslöjade att hela subdomänen/URL:en var fel, inte att resultatet
  var tomt. Rätt endpoint hittades genom att pröva URL-varianter live tills
  en gav 200 OK.
- **Grundorsak:** Fel/utgången API-URL (`api/version/2/warnings.json`, hård
  404 på hela subdomänen). Antagandet från session 15 låg okontrollerat kvar
  i **åtta sessioner** (12→21) innan det ifrågasattes.
- **Lösning:** PR #344 — rättade URL:en till
  `https://opendata-download-warnings.smhi.se/ibww/api/version/1/warning.json`,
  verifierad live mot skarp data.
- **Etablerat mönster:** Ett 404 som tolkas som "korrekt tomt svar" bör
  verifieras mot leverantörens dokumentation eller alternativa paths på
  samma domän innan det accepteras som avsiktligt beteende — annars kan en
  trasig URL gömma sig bakom antagandet i flera sessioner.

### Bugg: `JsonException` på varje ingest-tick (PR #346, akut hotfix)

- **Vad hände:** Railway-loggarna visade en `JsonException` varje gång
  ingestorn kördes, efter att URL-fixen (PR #344) släppt igenom riktig JSON.
- **Grundorsak:** `SmhiWarningArea.Id` var deklarerad som `string?`, men
  SMHI:s JSON skickar fältet som ett tal (`"id": 9873`). Felet fanns redan
  innan PR #344 men triggades aldrig förrän JSON-parsningen faktiskt nåddes.
- **Varför missades det i det ursprungliga testet:** Ett fristående
  testprogram (byggt för PR #344) använde en *förenklad* egen kopia av
  DTO-klasserna, och `id`-fältet uteslöts av misstag ur den kopian.
- **Lösning:** Körde hela den fullständiga, verbatim-kopierade
  DTO-uppsättningen mot skarp data (alla 16 aktuella varningar) istället för
  en förenklad variant — avslöjade typfelet direkt.
- **Etablerat mönster:** Ett testprogram som verifierar parsningslogik mot
  skarp extern data bör alltid använda de faktiska produktions-DTO-klasserna
  (kopia eller referens), aldrig en egen förenklad variant — annars testar
  man inte det man tror man testar.

---

## Session 20 — Breaking change utan matchande frontend-fix (2026-07-18)

**Mål:** FAS 1 (backend-auth med refresh-tokens) och FAS 2
(`AuthContext`-uppdatering) byggdes som två separata PR:ar.

**Vad hände:** FAS 1:s svarsfältbyte (`token` → `accessToken`/`refreshToken`)
mergades separat från FAS 2 → admin-inloggningen bröts live i produktion
mellan de två merge-tillfällena.

- **Grundorsak:** `AuthContext` läste fortfarande `data.token`, som nu blev
  `undefined`. Det gjorde `isLoggedIn` sant (`undefined !== null` utvärderas
  som sant) trots en trasig token, medan `parseRole` tyst föll tillbaka till
  `'Användare'` — inloggningen såg ut att fungera men gav fel roll och ingen
  giltig token.
- **Lösning:** Akut-PR #337 uppdaterade `AuthContext` till de nya fältnamnen.
- **Etablerat mönster:** Släpp aldrig en backend-kontraktsändring utan den
  matchande minimala frontend-fixen samtidigt — samma lärdom som senare
  formaliserades som ett fast arbetssätt i CLAUDE.md
  ("`feedback_breaking_change_rollout`").

**Sidonotis:** Samma sessions `AddRefreshTokens`-migration råkade ut för
samma `HasColumnType("TEXT")`-problem som Session 19 (se nedan) redan hade
löst en gång — löst direkt med samma etablerade raw-SQL-mönster i
`Program.cs`, utan ny felsökning.

---

## Session 19 — PostgreSQL 42804: fyra PR:ar till grundorsaken (2026-06-30)

**Mål:** Åtgärda en produktionskrasch vid backend-start efter PR #321
(användarsystemet).

**Vad hände:** Fyra PR:ar krävdes i följd innan grundorsaken faktiskt
åtgärdades — ett bra exempel på hur EF Core/Npgsql kan bete sig annorlunda
än väntat med SQLite-genererade migrationer körda mot PostgreSQL.

1. **PR #323 (första försöket):** Ett `DO`-block i migrationen som
   konverterar `Users.Id` från text till `uuid`. Löste inte hela problemet.
2. **PR #324 (andra försöket):** Tog bort de explicita `type: "TEXT"`
   -strängarna från Guid-kolumnerna i migrationens `Up()`-metod. Hjälpte
   inte.
3. **PR #325 (tredje försöket):** Flyttade `Users.Id`-konverteringen till
   att köras före `MigrateAsync()` i `Program.cs`. Hjälpte fortfarande inte
   — de nya tabellerna skapades ändå med `TEXT`.
4. **PR #326 (grundorsaken hittad, definitiv fix):** Insikten som löste det:
   EF Core använder migrations-**snapshotten** (`*Designer.cs`) — inte vad
   som faktiskt står i migrationens egen `Up()`-metod — för att avgöra
   kolumntyper vid körning. En SQLite-genererad migration skriver
   `HasColumnType("TEXT")` i just den snapshotten, och det värdet "vinner"
   oavsett vad `Up()` säger. Det förklarar varför PR #324 och #325 (som båda
   redigerade `Up()`/körordning) inte hade någon effekt.
   `Users.Id` var `text`, och nya `UserId`-kolumner ärvde samma typ —
   FK-relationen kraschade (`text` → `uuid`) så fort `Users.Id` väl
   konverterades. Lösningen: kör `AddUserSystem` och `AddPasswordResetToken`
   som **raw SQL** direkt i `Program.cs`, med korrekta PostgreSQL-typer
   (`uuid`, `timestamptz`, `boolean`) från början, och markera dem som redan
   körda i `__EFMigrationsHistory` — `MigrateAsync()` hoppar då över dem helt
   istället för att försöka tolka snapshotten.

**Etablerat mönster:** Vid nya EF Core-migrationer skapade lokalt mot
SQLite: förvänta `HasColumnType("TEXT")` för Guid/DateTime-kolumner i
snapshotten, och lägg alltid till ett matchande raw-SQL-block i `Program.cs`
innan migrationen når produktion — istället för att försöka fixa det via
`Up()`-metoden, som visat sig inte spela någon roll.

---

## Session 15 — IsPublished nollställdes vid varje omstart + deployskev (2026-06-29)

### Bugg 1: Admin-ändringar av `IsPublished` försvann

- **Vad hände:** En källa som en admin publicerat via panelen blev
  opublicerad igen efter nästa Railway-omstart.
- **Grundorsak:** Seed-loopen i `Program.cs` skrev `existing.IsPublished =
  source.IsPublished` (värdet från koden) vid *varje* uppstart — inte bara
  vid första insättning, vilket nollställde alla admin-gjorda ändringar.
- **Lösning:** Tog bort den raden ur update-grenen — `IsPublished` sätts nu
  bara vid initial insert, aldrig vid en efterföljande seed-körning.
- **Etablerat mönster:** Ett fält som en admin ska kunna ändra i produktion
  får aldrig skrivas över av en seed-loop som körs vid varje uppstart —
  seedning ska bara sätta ett *förstahandsvärde*, aldrig återställa.

### Bugg 2: Två "SMHI"-knappar i sidebaren

- **Vad hände:** Efter en multi-feed-omläggning (gruppering per
  `shortName`, PR #305) dök källan upp dubbelt i sidebaren för vissa
  besökare.
- **Grundorsak:** Railway (backend) hade deployat den nya
  `?shortName=`-filtreringen, men Vercel (frontend) hade inte hunnit deploya
  motsvarande frontend-ändring — gammal frontend skickade fortfarande den
  gamla `?source=<id>`-parametern, som den nya backend-koden ignorerade helt.
- **Lösning:** Backend gjordes tillfälligt bakåtkompatibel — stödjer både
  `?shortName=` och det gamla `?source=`-parametret tills båda plattformarna
  var i fas (PR #306).
- **Etablerat mönster:** Vid en fram- och bakåtkopplad ändring (frontend +
  backend) på två separata deploy-plattformar (Vercel/Railway) som inte
  deployar synkront: backend bör tåla den gamla frontend-kontraktsformen
  under en övergångsperiod, inte anta att båda sidor alltid är i takt.

---

## Session 16 — `npm ci` kraschade i CI (2026-06-29)

**Vad hände:** `npm ci` i GitHub Actions kraschade med `Missing:
@emnapi/core@1.11.1` efter att drag-and-drop-paketen (`@dnd-kit/*`)
installerats lokalt på Windows.

- **Grundorsak:** Windows `npm install` skriver inte in Linux-specifika
  valfria (`optional`) beroenden i `package-lock.json`. `npm ci` på en
  Linux-baserad CI-runner kräver att lock-filen är fullständig för den
  plattformen den körs på, och vägrar installera om något valfritt beroende
  saknas i den.
- **Lösning:** Bytte CI-steget från `npm ci` till `npm install`.
- **Etablerat mönster:** Cross-platform-utveckling (Windows lokalt, Linux i
  CI) med paket som har plattformsspecifika optional dependencies kan kräva
  `npm install` istället för `npm ci` i CI, eftersom lock-filen genererad på
  en plattform inte nödvändigtvis är komplett för en annan.

---

## Session 14 — Tailwind `dark:`-prefix utan effekt (2026-06-24)

**Vad hände:** `dark:bg-slate-600` på Om-/Nyheter-knapparna i sidebaren hade
ingen synlig effekt i mörkt läge.

- **Grundorsak:** `index.css` hade en manuell regel,
  `html.dark .bg-slate-100 { ... }`, med högre CSS-specificitet än Tailwinds
  genererade `dark:`-prefix-klass. Den manuella regeln vann alltid.
- **Lösning:** Lade till en explicit regel i `index.css` för de nya
  dark-klasserna, på samma mönster som den befintliga overriden.
- **Etablerat mönster:** I det här projektet har `index.css` manuella
  dark-mode-overrides med högre specificitet än Tailwinds `dark:`-prefix.
  Vid nya dark-mode-klasser: lägg alltid till en explicit regel i
  `index.css` på formen `html.dark .dark\:bg-[klass] { ... }` — att bara
  lägga till en `dark:`-klass i JSX räcker inte i den här kodbasen.

---

## Session 10–12 — Trafikverket: "ObjectType does not exist" (2026-06-15/17)

**Mål:** Få Trafikverkets Situation-API att leverera data — en
flersessioners felsökningsarc.

**Uteslutningsmetod (session 10):** API:et gav ett 400-fel utan tydlig
förklaring. Lade först till loggning av hela response-bodyn vid fel
(PR #252/#253) för att sluta gissa blint. Testade sedan tre olika
`objecttype`-värden i tur och ordning: `Situation` (v2) → `TrafficSituation`
(v2) → `Situation` (v1) — samtliga avvisades med samma "does not exist"-fel
(PR #254/#257). Vid det laget var slutsatsen att API-nyckelns behörighet
kunde vara begränsad — en rimlig men, som det visade sig, felaktig
hypotes.

**Grundorsak (session 12):** Frågeelementet saknade
`namespace="road.trafficinfo"` — ett krav som Trafikverket infört sedan mars
2026 enligt deras egen portal. Utan namespace avvisas objecttypen oavsett
vilket namn eller vilken API-version som anges, vilket förklarar varför alla
tre varianterna i session 10 gav exakt samma fel.

**Lösning (session 12, PR #267–#270):** Lade till namespace, uppgraderade
till schemaversion 1.6 (rätt version enligt dokumentationen) och API v2.
Samtidigt hittades och fixades två närliggande buggar i samma
datamodell-genomgång:
- `StartTime` låg på fel nivå (`TvSituation` istället för `TvDeviation`) och
  kunde dessutom ligga i framtiden (planerade arbeten) — bytte till
  `PublicationTime` som `PublishedAt`.
- Titel-fallback använde `MessageCodeValue` (engelska) före `MessageCode`
  (svenska) — fallback-ordningen byttes.

**Etablerat mönster:** Trafikverkets Situation-API (v2) kräver
`namespace="road.trafficinfo"` och `schemaversion="1.6"` i QUERY-elementet —
utan namespace ger API:et samma generiska "ObjectType does not exist"
oavsett objecttype eller version, vilket gör felet vilseledande att
felsöka utan att känna till just det kravet.

---

## Session 10–11 — `IsPublished`: boolean-kolumnen i PostgreSQL (2026-06-15)

**Mål:** Ersätta det otydliga `IsTestOnly`-konceptet med `IsPublished`
(Aktiv = ingestorn kör, Publicerad = synlig för besökare).

**Vad hände (session 10):** `IsPublished` skapades av en SQLite-genererad
migration som `INTEGER`. Ett första ALTER-block i `Program.cs` skulle
konvertera kolumnen till `boolean`, men kraschade — `MigrateAsync()` kör
migrationen (som lägger till kolumnen som `INTEGER`) *innan* ALTER-blocken
hinner köras, så ett block som bara kontrollerade "saknas kolumnen?" cachade
fel tillstånd.

- **Lösning (session 10):** Skrev om DO-blocket till att kontrollera det
  faktiska `data_type='integer'`-läget och ALTER:a till boolean därifrån —
  inte kontrollera om kolumnen saknas (den finns redan, bara med fel typ).

**Vad hände (session 11, uppföljningskrasch):** Servern kraschade ändå, nu
med `42804: default for column "IsPublished" cannot be cast automatically to
type boolean`.

- **Grundorsak:** PostgreSQL kan inte automatiskt casta ett `INTEGER
  DEFAULT (1)`-värde till boolean — ett `DEFAULT` av fel typ måste droppas
  explicit innan `ALTER COLUMN TYPE` körs, annars vägrar Postgres.
- **Lösning (PR #260):** DROP DEFAULT → ALTER TYPE USING → SET DEFAULT
  (med rätt boolean-värde).
- **Etablerat mönster:** Vid `ALTER COLUMN TYPE` i PostgreSQL på en kolumn
  som har ett `DEFAULT`: droppa alltid defaulten explicit före `ALTER TYPE`,
  sätt sedan en ny default av rätt typ efteråt. Gäller alla framtida
  boolean-/typkonverteringar av det här slaget — och är samma
  familj-av-problem som Session 19:s större snapshot-upptäckt byggde vidare
  på.

---

## Session 9 — `Sources.Id` saknade sequence i PostgreSQL (2026-06-15)

**Vad hände:** `POST /api/admin/sources` (för att lägga till en ny källa)
gav 500 med en `NOT NULL violation` på `Sources.Id`.

- **Grundorsak:** `InitialCreate`-migrationen använde SQLite:s
  `Sqlite:Autoincrement`-annotation för att ge `Sources.Id` auto-increment.
  PostgreSQL ignorerar den annotationen helt — kolumnen fick ingen sequence
  alls, så ett INSERT utan explicit `Id` gav `NULL` istället för nästa
  lediga tal.
- **Lösning:** Ett idempotent `DO`-block i `Program.cs` som skapar
  sequencen vid första uppstart om den saknas.
- **Not:** Samma familj av problem (SQLite-specifika mekanismer som tyst
  ignoreras av PostgreSQL) dök upp igen långt senare för `TicketNumber` i
  PR #398 (se den posten högst upp i den här filen) — där löstes det dock
  annorlunda, genom att flytta tilldelningen till applikationskoden istället
  för att bygga ännu en databasspecifik sequence-lösning.

---

## Session 7 — Migrationshistorik-krasch + instängd modal (2026-06-12)

### Bugg 1: `__EFMigrationsHistory` gömde en pågående krasch

- **Vad hände:** En "smart" migreringskontroll skulle bara droppa tabeller
  om `__EFMigrationsHistory` saknades (för att undvika dataförlust vid
  omdeploy) — men `__EFMigrationsHistory` hade redan `InitialCreate`
  registrerad, med SQLite-typer. Kontrollen såg det som "redan migrerat" och
  hoppade över drop-steget, varpå ett INSERT kraschade mot den gamla,
  felaktigt typade tabellen.
- **Lösning:** Ett `DO $$`-block som en gång fixar bool/uuid/datetime-kolumner
  om de har fel typ från den gamla migrationen, utan att tabellen droppas
  och utan dataförlust (PR #228).

### Bugg 2: `FeedbackModal` gick inte att se fullt ut

- **Vad hände:** Modalen skulle täcka hela skärmen (`fixed`-positionerad)
  men syntes bara begränsad till sidebarens yta.
- **Grundorsak:** Sidebarens `<nav>`-element hade en CSS `transform`
  (translate, för slide-in-animationen) — ett CSS-transform på ett
  förfader-element skapar en ny *stacking context* som `fixed`-positionerade
  barn inte kan bryta ut ur, oavsett `z-index`.
- **Lösning:** Renderade modalen via `createPortal` direkt till
  `document.body`, utanför sidebarens DOM-träd helt (PR #230). Samma mönster
  återanvändes senare för `KategoriFilterModal`s stacking-bugg (session 24).

---
