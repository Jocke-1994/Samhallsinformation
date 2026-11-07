# Projektöversikt – Samhällsinformation & Notifieringar

Detta projekt är ett fristående verktyg utvecklat i .NET som samlar samhällsinformation från svenska myndigheter på en gemensam plats. Syftet är att göra offentlig information mer tillgänglig via webb och kontrollerade notifieringar utan att tolka eller ändra källmaterialet.

## Grundprinciper (Låsta beslut)

Dessa principer utgör systemets kärna och bryts aldrig:

* **Ingen opinionsbildning:** Systemet skapar inget eget innehåll.
* **Ingen tolkning:** Information omformuleras aldrig; systemet fungerar som ett förmedlande lager.
* **Källkrav:** Ingen information visas utan en verifierad primär källa.
* **Transparens:** Systemet är tydligt med varför en notifiering skickas eller uteblir.

## Vid sessionsstart (sedan 2026-11-07)

Körs varje gång en ny session startar, innan första uppgiften — som en
konstruktor. Rapportera kort vad som hittades (en rad per punkt räcker,
hoppa över punkter där inget finns).

1. **`git status` + `git fetch`** — flagga okommitterat (kan vara den andra
   parallella sessionen) och om `main` ligger efter `origin/main`.
2. **Öppna PR:ar och Dependabot-larm** (`gh pr list`, säkerhetslarm) — väntar
   något på merge eller beslut?
3. **Senaste posten i `docs/SESSIONSLOGG.md`** ("Next session"-punkterna) +
   `docs/vault/1. Öppna_tankar/Öppna frågor.md`.
4. **Var ~5:e session — Claude Code-nyheter:** kolla changelogen för Claude
   Code sedan förra kollen och föreslå **en** konkret sak vi borde börja
   använda (eller säg att inget var relevant). Notera datum för kollen i
   sessionsloggen.
5. **Var ~5:e session — kort retro av arbetssättet:** vad var klumpigt,
   upprepades eller gick fel sedan sist (titta i de senaste sessionsloggarna)?
   Föreslå **en** förbättring. Ersätter den gamla Papercuts-listan, som aldrig
   fylldes på.
6. **Var 5–10:e session — liveverifiering** mot produktion, se "Periodisk
   liveverifiering" nedan.

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
1. Läs det här dokumentet + relevant not i Obsidian-valvet (`docs/vault/`).
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
- Ingen separat spec- eller datamodell-fil — idénoten i Obsidian-valvet
  (`docs/vault/Ideer/`, `docs/vault/Funktioner/`) är spec, koden i
  `Models/` är sanningen för datamodeller. Två parallella dokument som kan
  glida isär från koden är värre än inga alls.
- **Periodisk liveverifiering** (sedan 2026-09-12): ungefär var 5-10:e session,
  kör ett par snabba liveverifieringar mot produktion av sånt som är svårt att
  enhetstesta men lätt att tro fungerar (rate limiting, CORS, riktiga
  DNS/mejlleveranser). Grundorsaken: rate limiting-buggen (session 45) låg
  odetekterad i produktion i över ett halvår trots grönt enhetstest — testet
  bevisade att LOGIKEN var rätt, inte att den faktiskt kördes mot rätt data i
  produktionens nätverkstopologi.
- **CLAUDE.md innehåller bara regler, aldrig historik** (sedan 2026-11-07):
  filen läses in i varje session, så allt som står här kostar utrymme varje
  gång. Sessionsloggen flyttades därför ut helt till `docs/SESSIONSLOGG.md`
  (CLAUDE.md gick från 843 → ~200 rader). Projektstatus hör hemma i
  Obsidian-valvet, sessionshistorik i `docs/SESSIONSLOGG.md`. Ser du en regel
  här som inte längre stämmer med hur vi faktiskt jobbar — föreslå att den
  stryks eller skrivs om.
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

## Flagga det som saktar ner (sedan 2026-09-21)

Så fort något märkbart saktar ner arbetet under en session (ett upprepat
verktygsfel, en klumpig workaround som körs flera gånger, en process som tar
orimligt lång tid) — säg till direkt i chatten: "Jag har identifierat att [X]
saktar ner arbetet, hur vill du att vi hanterar det?" Skriv in det i
sessionsloggen så att retron (se "Vid sessionsstart", punkt 5) hittar det.
(Ersätter den gamla Papercuts-listan, som stod tom från 2026-09-21 till
2026-11-07.)

---

## Teknisk Arkitektur

* **Backend:** ASP.NET Core Web API med bakgrundstjänst för datainsamling.
* **Datamodell:** En gemensam intern struktur (`CanonicalEvent`) för att standardisera metadata från olika källor.
* **Databas:** SQLite lokalt, PostgreSQL i produktion, via Entity Framework Core.
* **UI/UX:** Modern, "clean" design med stöd för mörkt/ljust tema.

## Informationsomfång & Metadata

Systemet hanterar information baserat på tillgänglig metadata:

* **Obligatorisk metadata:** Källa, publiceringsdatum, titel, innehåll och länk.
* **Valfri metadata:** Geografisk klassning, allvarlighetsgrad och kategori.
* **Fallback:** Om allvarlighetsgrad saknas används "Bra att veta". Om geografi saknas betraktas informationen som nationell.

## Sessionslogg

Ligger i `docs/SESSIONSLOGG.md` (nyast först) sedan 2026-11-07 — inte här.
Läs den senaste posten vid sessionsstart, skriv ny post högst upp i den filen
när användaren signalerar att sessionen är klar.

## Git-rutiner

Konsoliderat 2026-09-21 från flera spridda minnesregler till ett ställe
— tidigare "Workflow Preferences" (två punkter) ersatt av den här listan.
Repo: https://github.com/Jocke-1994/Samhallsinformation (Project Board och
labels används inte längre sedan issues ersattes av Obsidian-valvet).

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
