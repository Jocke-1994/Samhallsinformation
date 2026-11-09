# AUDIT — Samhällsinformation, granskat som en ny kollega

Datum: 2026-11-09. Skolövning (LIA 2, "Hur repot fungerar för ett team"):
granska det egna projektet utifrån, poängsätt ärligt, gör de fem
viktigaste fynden till GitHub Issues med label `quality`.

Allt nedan är verifierat genom att faktiskt köra kommandona i ett rent
kloningsläge, inte gissat utifrån hur koden "borde" fungera.

## Checklista: hur koden är byggd

| Punkt | Poäng | Underlag |
|---|---|---|
| Är controllers tunna, ligger logiken i services? | **1** | Ett riktigt Application/Services-lager finns (51 filer i `Application/`, 22 i `Services/`) med riktiga interfaces (`IAuthService`, `IAktivitetsloggService` m.fl.) — men **27 av 30 controllers** injicerar `AppDbContext` direkt ändå. `AuthController` blandar `IAuthService` för inloggningslogik med egna `_db.Users.FindAsync(...)` + `_db.SaveChangesAsync()` för profiluppdatering och auditloggning. Mönstret finns, men följs inte konsekvent. |
| Används DTOs, eller skickas databasobjekten rakt ut? | **1** | Bara **1 klass i hela repot** har suffix Dto/Response/ViewModel. Skyddet görs istället ad hoc med `.Select(s => new {...})` per endpoint (fungerar, t.ex. `SourcesController.GetSources` filtrerar medvetet bort `IsPublished`/`Url` m.fl. med en kommentar om varför) — men `EventsController.GetEvent(id)` bredvid gör `return Ok(evt)` och skickar hela EF-entiteten `CanonicalEvent` rakt ut, inkonsekvent med listendpointen ovanför. |
| Är frontend uppdelad på ett sätt som går att hitta i? | **2** | Tydlig, konventionell struktur: `api/ components/ context/ hooks/ lib/ pages/ services/ test/ types/`. 77 komponenter, lätt att navigera. |
| Finns tester, och går de att köra med ett enda kommando? | **2**\* | `dotnet test` → **1281 passerade, 0 fel**. `npm test` → går att köra med ett kommando, **men se reproducerbarhetsfyndet nedan** — en fräsch `npm install` gör att 5/616 tester failar. |
| Kollar servern själv att datan är rimlig, eller litar den blint på formuläret? | **0** | **0** förekomster av `[Required]` i modellerna, **0** `ModelState.IsValid`-kollar i hela `Controllers/`, ingen FluentValidation. Bara 2 controllers gör manuell null/tomsträng-koll. Validering är undantaget, inte regeln. |
| Får användaren ett vettigt besked när något går fel? | **0** | Ingen global felhantering i `Program.cs` — inget `UseExceptionHandler`/`IExceptionHandler` finns alls. En oväntad exception faller igenom till ASP.NET Cores standardbeteende istället för ett genomtänkt JSON-svar. |
| Visar React att något laddar, och vad händer när listan är tom? | **1–2** | Tomt-state hanteras brett (113 träffar på "ingen/inga hittade"-mönster). Explicit laddningsstate finns i 27 av 99 icke-test-komponenter — inte överallt, men rimligt för en app där många komponenter är rent presentationella. |

\* Se reproducerbarhetsfyndet — poängen gäller "går att köra", inte
"är grön från scratch".

## Checklista: hur repot fungerar för ett team

| Punkt | Poäng | Underlag |
|---|---|---|
| Räcker README för att någon annan ska kunna starta projektet? | **1** | README (precis omskriven, PR #724) ger korrekta kommandon för backend (`dotnet restore && dotnet run`) och frontend (`npm install && npm run dev`). **Men** en fräsch `npm install` på main ändrar `package-lock.json` (19 tillägg/39 borttagningar jämfört med den committade filen) och ger därefter **5 failande tester** (`flode-api.test.ts`, `api-timeout-och-felkropp.test.ts`) som inte syns om man bara återanvänder en gammal `node_modules`. CI (`ci.yml`) kör `npm install`, inte `npm ci` — samma otydlighet gömmer sig alltså även där. Node-versionen i README (22+) är också något lägre än vad några transitiva testberoenden (jsdom 30, `@asamuzakjp/*`) faktiskt kräver (`npm warn EBADENGINE`). |
| Är bin, obj och node_modules utanför git? | **2** | Bekräftat: `git ls-files` hittar inga trackade filer under `bin/`, `obj/` eller `node_modules/`. |
| Finns det lösenord eller nycklar i koden eller i historiken? | **2** | Sökt igenom alla trackade filer och hela git-historiken: inga committade `.env`- eller `.db`-filer någonsin, ingen `appsettings.json` i repot alls (konfiguration går helt via miljövariabler, med `StartupSecretsGuard` som validerar dem vid start). De enda träffarna på "password"/"secret" i koden är testdata eller en tydligt märkt `DevFallbackSecret` ("change-in-production"). Bättre secrets-hygien än genomsnittet för ett skolprojekt. |
| Ser commit-historiken ut som en berättelse, eller som "fix", "fix2", "nu funkar det"? | **2** | Genomgående Conventional Commits (`feat:`, `fix:`, `docs:`, `build(deps):`) med beskrivande meddelanden och PR-nummer. Inga "fix2"-commits i den granskade historiken. |
| Är koden formaterad på samma sätt överallt? | **0** | `dotnet format --verify-no-changes` → **1758 fel i 100 filer**. `npx prettier --check .` → **254 filer** med avvikelser. Ingen `.editorconfig` och ingen `.prettierrc` finns i repot, så verktygens standardregler krockar med den faktiska (medvetna, läsbara) kolumn-justerade stilen i koden. Ingen av CI-filerna (`ci.yml`, `ci-backend.yml`) kör en formatteringskontroll — bara lint, test och build. |

## De fem viktigaste förbättringarna

Rangordnade efter hur troligt det är att de faktiskt stoppar/förvirrar
nästa person (inte efter hur allvarligt fyndet ser ut på pappret):

1. **Ingen reproducerbar frontend-installation** — en fräsch `npm install`
   ändrar den committade lockfilen och ger 5 failande tester av 616. CI
   kör `npm install` istället för `npm ci`, så problemet är dolt tills
   någon rensar sin `node_modules`.
2. **Ingen formatteringskontroll i CI, och inget delat formatteringskontrakt**
   — 1758 `dotnet format`-fel i 100 filer, 254 filer med Prettier-avvikelser,
   ingen `.editorconfig`/`.prettierrc`. "Samma formattering överallt" går
   inte att verifiera idag.
3. **Ingen global felhantering i backend** — inget
   `UseExceptionHandler`/`IExceptionHandler`, nästan ingen
   inputvalidering (0 `[Required]`, 0 `ModelState.IsValid`-kollar).
4. **Inkonsekvent dataretur från API:t** — `GET /api/events/{id}` skickar
   hela EF-entiteten rakt ut medan grannendpointen `GET /api/events`
   medvetet filtrerar bort interna fält. Ingen DTO-klass finns i hela
   repot (1 träff totalt) som skulle göra skyddet konsekvent.
5. **27 av 30 controllers pratar direkt med `AppDbContext`** trots att
   ett riktigt Application/Services-lager redan finns — "tunna
   controllers" är ett etablerat mönster men följs inte överallt.

GitHub Issues för punkterna ovan: se länkar i sessionens inlämning på
Learnpoint (label `quality`).

## Vad jag INTE flaggade som en topp-5-punkt, men som är värt att veta

- `StartupSchemaGuard.CountIfTableExistsAsync` ger en EF1002-varning
  ("SQL injection") för `SqlQueryRaw` med interpolerad sträng — men
  tabellnamnen är hårdkodade konstanter, aldrig indata, så det är en
  falsk positiv. Värt att suppressa explicit i koden istället för att
  låta varningen stå kvar och se ut som ett olöst problem.
- Flera `CS8602`-varningar (nullable-dereferens) i testfilerna. Inte i
  produktionskod, låg prioritet.
