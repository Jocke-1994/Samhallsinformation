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

### Session 22 — 2026-07-25
**What was done:**
- Akut produktionsincident: användaren rapporterade vit skärm på `samhallsinformation.se`
- Felsökte utifrån (curl mot frontend/backend/assets — allt gav 200, uteslöt infra/deploy-fel), gick sedan igenom `AuthContext.tsx`/`ThemeContext.tsx` för riskabla `JSON.parse`/`localStorage`-lässtigar (inga hittades — redan skyddade med try/catch)
- Upptäckte att lokal branch låg 58 commits efter `origin/main` — bl.a. Fas 1/2-auth-refresh (session 20) och en react-router v7→v8-migrering (PR #355) hade redan gått live utan att synas i den lokala historiken
- Användaren delade webbläsarkonsolens faktiska fel (skärmdump): `Minified React error #527, args[19.2.8, 19.2.7]` — löste frågan direkt
- Rotorsak: Dependabot-PR #342 bumpade `react` till `19.2.8` men missade `react-dom`, som blev kvar på `19.2.7`. React 19 kräver exakt matchande versioner mellan paketen — mismatchen kraschar hela render-trädet vid uppstart. Appen har ingen ErrorBoundary, så kraschen syntes bara som en tom `#root` i webbläsaren, inget synligt felmeddelande
- Verifierade rotorsaken headless (Playwright/Chromium, `npx playwright install chromium`, körd mot en scratch-katalog för att inte påverka projektets `package-lock.json`): produktions-URL gav `#root` med 0 tecken + exakt samma `pageerror`; lokalt bygge med matchande versioner gav `#root` med ~37 000 tecken och inga fel
- PR #358 (`fix/react-dom-version-mismatch`): `react-dom` → `^19.2.8` i `package.json` + `package-lock.json`, byggt och testat lokalt (`npm run build` + `npm run preview` + headless-verifiering) innan push. Mergad av användaren, verifierad live direkt efter (headless-koll mot produktion gav 48 772 tecken i `#root`, 0 fel)

**Problem och lösningar denna session:**
- En Dependabot-PR som bumpar `react` utan att samtidigt bumpa `react-dom` (eller tvärtom) ger inget CI-fel — `tsc -b && vite build` bryr sig inte om att versionerna matchar vid körning, bara vid rendering i webbläsaren. Lärdom: `react`/`react-dom`-par bör alltid bumpas ihop; överväg att slå ihop dem till en enda Dependabot-grupp
- Ingen ErrorBoundary i appen gjorde diagnosen svårare rent externt (curl visar alltid 200 och giltig HTML/JS oavsett klientkrasch) — webbläsarkonsolen var enda källan till den faktiska felsignaturen
- Lokal branch hade tappat kontakt med `main` i 58 commits (senast synkad vid session 19) — gjorde första felsökningsrundan onödigt lång innan avvikelsen upptäcktes

**Etablerat mönster:**
Vid "vit skärm"-rapporter: servern/CDN:n kan vara helt frisk (200 överallt) medan felet ändå är en klientkrasch under rendering. Fråga alltid efter webbläsarkonsolens faktiska felmeddelande tidigt — det är snabbaste vägen till rotorsaken, särskilt utan ErrorBoundary. Headless-verifiering (Playwright i en scratch-katalog, `--no-save`) är ett bra sätt att bekräfta både att felet reproduceras i produktion och att fixen faktiskt löser det, utan att röra projektets egna beroenden.

**Next session (Session 23):**
- Överväg en ErrorBoundary runt `<App />` i `main.tsx` så framtida renderingskrascher ger ett användarvänligt felmeddelande istället för vit skärm
- Överväg att gruppera `react`/`react-dom` i samma Dependabot-uppdatering (`.github/dependabot.yml`) för att förhindra framtida versions-mismatch
- Synka lokal arbetsbranch mot `main` oftare — 58 commits efter innebar att flera redan lösta saker (Fas 1/2-auth, react-router v8) undersöktes på nytt i onödan
- Övrigt från session 21 kvarstår: SMHI-varningar publicera i sandlådan, FAS 3–5 (#297–#299), stashad lokal drift sedan session 20

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
