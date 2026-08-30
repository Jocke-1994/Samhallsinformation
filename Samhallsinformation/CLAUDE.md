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

### Session 28 — 2026-08-08
**What was done:**
- **FAQ-innehållet granskat post för post mot vad som faktiskt är byggt** (steg 3/7 i den gamla pre-registrerings-ordningen, se session 24/25-loggarna) och rättat i `faqStorage.ts` (PR #436):
  - id 1–3 avpublicerade — beskriver mail/SMS-notiskanaler ("Standardinställningar under Notifieringar") som inte existerar i dagens UI. Hela Notifieringar-sidan är tom just nu (alla `notif_*`-flaggor, inkl. `notif_push`, är av)
  - id 4 ("Hur lägger jag till fler källor?") — SPAR-adressförslags-referensen borttagen (togs bort ur Mina källor i PR #386, session 25)
  - id 5 ("Kan jag följa flera myndigheter samtidigt?") — påståendet om separat notis-urval borttaget, matchar nu "Mitt flöde = notisbasis"-modellen
  - id 8 ("Vad är nytt i senaste versionen?") — det överdrivna löftet om deep-links till berörda funktioner borttaget (mekaniken finns i typen men används bara på en gammal changelog-post, inte senaste versionen)
  - id 9 ("Hur rapporterar jag ett fel?") — "Tekniskt fel på sidan" → "Tekniskt fel", matchar den faktiska ämnes-dropdownen i `ArendehanteringKort.tsx`
  - id 6–7 (radera konto/dataexport) lämnade orörda — redan korrekt avpublicerade sedan tidigare
- **Vitskärms-incident direkt efter merge, felsökt och avfärdad som transient:** användaren mergade PR #436 och fick en vit sida. `curl` mot produktion (HTML/JS/CSS/backend) gav 200 överallt, uteslöt deploy-/infrafel. Byggde och körde `main` lokalt (`npm install` + `build` + `preview`), verifierade sedan headless med Playwright (samma metod som session 22) mot **både** produktions-URL:en och den lokala buildet: `#root` fick 55 018 respektive 39 832 tecken, inga JS-fel — bara en blockerad GA-analytics-request (`net::ERR_ABORTED`, irrelevant för rendering). Slutsats: koden var aldrig trasig, troligen en övergående cache-krock kring deploy-tillfället (PWA-service workern sedan session 23 är en trolig kandidat) — löste sig med en hård omladdning, bekräftat av användaren

**Problem och lösningar denna session:**
- Webbläsarautomatisering (Chrome-tillägget) tappade tab-referensen upprepade gånger mitt i vitskärms-felsökningen — samma återkommande instabilitet som session 27. Föll tillbaka på den etablerade Playwright-i-scratchpad-metoden (session 22) istället för att fortsätta försöka med Chrome-verktyget

**Etablerat mönster:**
- Vid en misstänkt trasig produktionssida efter en merge: `curl` utesluter bara infra/deploy-fel (ger alltid 200 vid en klientkrasch, se session 22). Nästa steg är headless-rendering (Playwright, scratchpad, rör inte projektets egna beroenden) mot både produktion och en lokal build av samma commit, och jämför `#root`s faktiska teckenlängd — inte bara att sidan svarar
- Chrome-tillägget för webbläsarautomation är fortsatt opålitligt vid tab-hantering session efter session — planera med Playwright-fallbacket som förstahandsval vid den här typen av verifiering, inte som sista utväg

**Next session:**
- Funktionsidéer/feature-flaggor-diskussionen (pausade funktioner som pipeline-poster) — fortfarande väntande sedan session 27
- `Impersonation.tsx`-ombyggnad — fortfarande väntande sedan session 27
- Resten av launch-ordningen: FAS 3 (Google OAuth, #297), sen öppna login/registrering publikt

---

### Session 27 — 2026-08-04 / 2026-08-05
**What was done:**
- **Alla fyra pre-launch-luckor från förra sessionens plan färdiga och mergade till main:** `AuthProvider`/`IsActive`/`SuspendedAt`/`TermsAcceptedAt`-fält på `User` (PR #414), kontospärrning + riktig `GET/PUT /api/admin/users` (PR #415, senare återöppnad som #421 — se nedan), villkorsgodkännande vid registrering + utkastad `/villkor`-sida (PR #416), rate limiting 5/min/IP på `/api/auth/*` (PR #417)
- **Fem uppföljnings-PR:ar ovanpå det:** `Anvandare.tsx` kopplad mot riktig användarlista istället för 10 påhittade mockkonton (PR #418), påminnelse vid kontospärrning via adminpanelens befintliga klock-ikon istället för schemalagd återaktivering (PR #419), GDPR-radering av konton via anonymisering **med ett 24h ångerfönster** — kontot spärras direkt, en ny `UserDeletionBackgroundService` gör den faktiska anonymiseringen när fönstret gått ut, en `cancel-deletion`-endpoint ångrar det innan dess (PR #420)
- **Merge-krock mitt i sessionen:** PR #413 (wizard, från tidigare session) mergades till main medan PR #414–420 fortfarande var öppna, vilket bröt hela stapeln. Löste `docs/UTVECKLINGSLOGG.md`-konflikter (samma append-only-fil, flera grenar la till poster överst) i varje enskild gren. Allvarligare: när `feat/account-control-fields`s branch togs bort efter att PR #414 mergats, **stängde GitHub PR #415 automatiskt istället för att omdirigera dess bas** (till skillnad från PR #416, som GitHub korrekt omdirigerade till `main`) — återöppnades som ny PR #421 med identiskt innehåll. Lärdom: retargeta nedströms-PR:ars bas till `main` proaktivt INNAN en uppströms-gren tas bort, inte efteråt
- **Admin-polish, allt kopplat mot data som redan var riktig men aldrig visad:** Översikts "Användare"-kort visar nu riktigt antal + riktig 7-dagarstrend istället för `1284`/`+12` (PR #422); läsbara `Nr 1, 2, 3...`-nummer (registreringsordning) i Användarhantering istället för råa GUID:n, med GUID:et kvar som hover-tooltip (PR #423, #424); `"Okänt"` istället för den bokstavliga `0001-01-01`-defaulten för konton (i praktiken bara admin-kontot) som fanns innan `CreatedAt`-kolumnen lades till (PR #425); Rapporters "Notifieringar per kanal" kopplad mot redan existerande men aldrig uppvisad `NotificationDeliveryLog`-data (del av PR #423)
- **Ny funktion: visningsnamn för supportsvar** (`User.DisplayName`) — upptäckte under research att den citizen-facing ärendevyn redan bara visade en hårdkodad `"Support"`-etikett (aldrig det riktiga namnet), så det här är en personaliseringsmöjlighet, inte en integritetsfix. Nytt kort i Konto, bakom både en feature-flagga och en rollkontroll (Admin/Support), plus samma spärr på `PUT /api/auth/me` i backend (PR #426, #427)
- **Diskuterat men medvetet inte byggt:** om avstängda feature-flaggor (t.ex. tvåfaktor, fortfarande 100% fejk) borde bli poster i funktionsidé-pipelinen — pipelinen har redan ett `FlagKey`-fält men ingen stage som betyder "pausad, kan återupptas" (bara "lanserad" eller "avfärdad", båda fel). Sparat till nästa session enligt uttrycklig begäran. `Impersonation.tsx` bekräftades kräva samma omfattning arbete som hela `Anvandare.tsx`-ombyggnaden (egen separat mock-användarlista, ett `telefon`-fält och `BankID`/`Betatestare` som inte finns i det riktiga schemat) — sparad som egen framtida uppgift, inte en snabb fix

**Problem och lösningar denna session:**
- Se merge-krocken ovan — PR #415s automatiska stängning (inte omdirigering) när dess basgren togs bort var den allvarligaste överraskningen. Löst genom att öppna en ny PR (#421) med identiskt innehåll, och genom att proaktivt retargeta alla ännu opåverkade nedströms-PR:ar till `main` innan fler grenar togs bort
- Under end-to-end-verifiering av visningsnamn-funktionen: flera snabba `register`/`login`-curl-anrop i rad gav tomma access-tokens — visade sig vara PR #417s egen rate limiter (5/min/IP) som triggade på de egna testanropen, inte en bugg. Löst genom att starta om backend-processen (nollar den in-memory-räknaren) och göra färre auth-anrop per testomgång
- Webbläsarautomatisering instabil igen vid ett tillfälle (samma återkommande problem som tidigare sessioner) — föll tillbaka på statisk kodgranskning + `curl`-verifiering enligt etablerad praxis

**Etablerat mönster:**
- **Retargeta nedströms-PR:ars bas till `main` INNAN en uppströms-gren i en PR-stapel tas bort**, inte efteråt — GitHub omdirigerar ibland automatiskt (som med PR #416), men stänger ibland PR:en istället (som med PR #415) utan tydlig regel för vilket som händer
- Vid en UI-siffra som ser konstig ut (t.ex. `1-01-01`): kolla om det är en bugg i det aktuella flödet eller ett historiskt artefakt från en tidigare migrering (`grep` efter fältnamnet i `Program.cs`s raw-SQL-block) innan man antar det ena eller andra
- Aldrig hitta på ett rimligt-seende värde för att dölja en databas-artefakt (t.ex. ett påhittat registreringsdatum) — visa "Okänt"/motsvarande istället. Samma princip som redan etablerad för MOCK-badges
- Ett fält som bara är meningsfullt för en viss roll (t.ex. `DisplayName` för Admin/Support) bör spärras på fältnivå i backend, inte bara döljas i UI:t — annars är säkerheten beroende av att alla framtida kodvägar råkar komma ihåg samma implicita antagande

**Next session:**
- Funktionsidéer/feature-flaggor-diskussionen (pausade funktioner som pipeline-poster) — användaren vill prata igenom det mer innan beslut
- `Impersonation.tsx`-ombyggnad (egen mock-användarlista, `telefon`/`BankID`/`Betatestare` som inte finns i schemat) — samma omfattning som `Anvandare.tsx` var
- Obs: Session 26 (grundpushen, PR #392–395) saknas i den här loggen — finns bara sammanfattad i minnessystemet (`project_push_grundpush_byggd.md`), aldrig skriven hit. Fyll i vid tillfälle om det behövs för framtida kontext

---

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
