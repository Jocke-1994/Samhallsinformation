# Code review — Enhet 8: Testlucka-kartläggning

- **Granskad commit-SHA:** `3bd097c` (main, 2026-09-25). Arbetsträdet rent före och efter. Sedan enhet 1:s SHA `2c278d3` har bara filer under `docs/` ändrats (`git diff 2c278d3 3bd097c` utanför docs: tomt), så enhet 1–6:s kodreferenser gäller fortfarande.
- **Omfång:** `Samhallsinformation/backend.Tests/` (17 filer, 3 355 rader) mot all handskriven backendkod (Controllers, Services, Ingestors, Application, Infrastructure, Helpers, Data, `Program.cs`), plus frontend som helhet (ingen testinfrastruktur). Ingen kod eller inga tester ändrades, inga nya tester skrevs, ingen commit/push. Endast `enhet-8.md` är skriven.
- **Metod:** (1) läste enhet-1…6 och PLAN.md; (2) läste alla testfilers testnamn och uppsättning (helpers, provider, mockar) samt ett urval i sin helhet; (3) körde `dotnet test` två gånger (andra gången med coverlet, `--collect:"XPlat Code Coverage"`, resultat lagt i scratchpad, inget i repot) och tolkade cobertura-XML per fil; (4) läste de källrader som varje föreslaget regressionstest ska pröva för att bekräfta att felet fortfarande finns i koden och att testet är genomförbart (t.ex. `EventSync`, `WebhooksController.HanteraSvar…`, `DeleteMe`, `SetStatus`, `GetUppdateringar`, `PushDispatcher` mottagarfrågor och claim-ordning, `IngestorBackgroundService.IngestAsync`, `AdminActivityLogController.GetLog`, `UserSourcesController.SaveSources`, `SupportScheduledActionService`, `UtcDateTimeConverter`); (5) skannade migrationsfilerna mot `Program.cs` med ett skalskript för guard-testet; (6) kontrollerade vilka paket/versioner frontend-uppsättningen kräver via `npm view`.
- **Inte gjort / inte verifierat (markerat även i texten):** inget av de föreslagna testerna har skrivits eller körts, så "testet blir rött idag" är härlett ur koden, inte bevisat. Docker och PostgreSQL finns inte på den här maskinen (`docker` saknas), så inget PG-test kunde prövas. Vitest/RTL är inte installerade och inget frontend-test kördes. Timmesuppskattningar är grova. Railways PostgreSQL-version är okänd.

## Sammanfattning

- **Testkörning:** 157 tester, 157 gröna, 0 röda, 0 hoppade över (körd två gånger, ca 1 s). Två kompilatorvarningar (CS8602, nullable) i `AuthServiceTests.cs:88` och `:220`. Inga `Skip`/`Theory`/`InlineData` finns i sviten (allt är `[Fact]`).
- **Täckning i stort (mätt med coverlet, körbara rader):** handskriven logik (Controllers, Services, Ingestors, Application, Infrastructure, Helpers) 32 % (1 366 av 4 245). Controllers 27 %, Services 47 %, Application 79 %, **Ingestors 0 %**. Inklusive `Program.cs` (1 251 körbara rader, 0 %) och `Data/`: 28 %. Hela assemblyn visar 3,8 % eftersom ca 42 000 genererade migrationsrader räknas; siffran säger inget. 15 av 25 controllers har 0 % eller bara attributtest, inklusive `WebhooksController`, `AdminSupportController`, `SourcesController` och `PreferencesController`.
- **Alla 157 tester är blinda för produktionsfelklassen.** De använder uteslutande EF Core InMemory och anropar controllers direkt med C#-värden. Ingen Npgsql-typmappning, ingen `timestamptz`, ingen FK/unik-index-kontroll, ingen modellbindning, ingen middleware/auktorisering, ingen rate limiter och ingen raw-SQL körs i någon test. De fyra incidentklasser som kodkommentarerna dokumenterar (42804 integer/boolean, `Kind=Unspecified` mot `timestamptz`, saknat raw-SQL-block, ett publikt endpoint som bara filtrerar i klienten) hade alla passerat sviten.
- **Två befintliga tester låser fast buggar** och måste ändras avsiktligt av respektive fix-PR: `SupportControllerTests.AdminSupportController_RequiresAdminRole` (E4 #7: Support-rollen ska ha åtkomst) och `PushControllerTests.Claim_UnknownClaimId_FailsOpenAsClaimed` (E3 #4: fail-open-designen).
- **Topp 5 saknade tester** (detaljer i avsnitt 3):
  1. Push-mottagarfilter: `IsActive`/`DeletedAt`/`IsPublished` i alla fyra dispatch-vägar (E3 #5, E4 #3/#4).
  2. Spärr/radering: `DeleteMe` som avstängd, `CancelDeletion` som inte får radera en spärr, `SetStatus` mot schemalagd/raderad/egen/sista admin (E1 #3/#7, E6 #1).
  3. `WebhooksController`: signaturverifiering, `int.Parse`-overflow, idempotens, trasig JSON (E1 #5/#10). Noll test på hela den anonyma, signaturskyddade ytan.
  4. Ingest-robusthet: dubblett i `EventSync`, en trasig källa får inte fälla resten av cykeln, dedikerade ingestorer ska respektera `IsActive` (E3 #1/#3/#6).
  5. UTC-Kind vid skrivning och i frågeparametrar (E2 #4, E4 #2), fångat utan Docker med en `DbCommandInterceptor` på SQLite, plus ett enda PostgreSQL-rökprov.
- **Guard-test för modell↔raw-SQL** är genomförbart utan DB (ca 60–110 rader), se avsnitt 4. Skanningen visar att bara 4 av 41 migrationer har bool/Guid/DateTime-kolumner utan block (alla täckta av självläkning) och att övriga 37 har block eller inga riskkolumner.
- **Frontend:** Vitest 5.0.1 stödjer Vite ^8 (verifierat med `npm view`). Förslag på 8 första tester (ca 14 h inkl. uppsättning), avsnitt 5.

## 1. Inventering av backend.Tests

### 1.1 Teknik (gäller alla filer om inte annat anges)

- **Provider:** `UseInMemoryDatabase(Guid.NewGuid().ToString())` i varje testklass (en `NewDb()`-hjälpare kopierad per fil). Paketen i `Samhallsinformation.Tests.csproj`: xunit 2.9.3, NSubstitute 6, `Microsoft.EntityFrameworkCore.InMemory` 10.0.0-rc.2, coverlet.collector. Inte använt: SQLite (fast backend refererar `Microsoft.EntityFrameworkCore.Sqlite`, så det är tillgängligt utan nytt paket), `WebApplicationFactory` (paketet `Microsoft.AspNetCore.Mvc.Testing` saknas och `Program.cs` saknar `public partial class Program`), Testcontainers.
- **Mönster:** controllers instansieras direkt med NSubstitute-mockar (`IAktivitetsloggService`, `IEmailService`, `IAuthService`, `IPushNotificationService`) och `ControllerContext` med en `ClaimsPrincipal`. Statiska tjänstemetoder (`PushDispatcher.DispatchNewEventsAsync`, `ScheduledReleaseBackgroundService.ExecuteDueAsync`, `SupportScheduledActionService.ExecuteDueActionsAsync`, `UserDeletionBackgroundService.ExecuteDueDeletionsAsync`) anropas direkt med en `db`. Det är ett bra mönster: bakgrundstjänsternas loopkropp är redan testbar.
- **Konsekvens av att controller-metoder anropas direkt:** parametrar skickas som färdiga C#-värden, så `[FromQuery] DateTime?`-bindning (som ger `Kind=Unspecified` av "2026-09-18", E4 #2), `[Authorize]`-utvärdering, rate limiting och JSON-serialisering testas aldrig. Auktorisering prövas bara som reflektion på klassattributet (`*_RequiresAdminRole`).
- **Vad InMemory inte kan:** tvinga FK eller unika index, köra `ExecuteSqlRawAsync` (alla raw-SQL-block och seed-kod i `Program.cs`), `ExecuteUpdate/ExecuteDelete`, riktiga transaktioner, Npgsql-typmappning eller Kind-regeln. Kända EF Core-begränsningar, inte omprövade här.

### 1.2 Per testfil

| Testfil | Antal | Vad den testar | Hur |
|---|---|---|---|
| `AdminFeatureIdeaControllerTests` | 15 | Idé-CRUD, löpnummer, triage, stadiebyte (checklista seedas en gång, `RedoAttLanseras` sätts/nollas), testare (ok/okänd/dubblett), checklistpunkter, `RequiresAdminRole` | controller + InMemory + reflektion |
| `AdminUserDetailsControllerTests` | 6 | Bara `Get/SetPushSettings` (okänd användare, bara angivet fält ändras, audit-logg skrivs bara vid verklig ändring). Resten av controllern (sparade händelser, källpreferenser, Polisen-bevakning, notislogg) är otestat | controller + InMemory |
| `AdminUsersControllerTests` | 20 | Lista, `SetStatus` (spärra/återaktivera/påminnelse), `Delete` (schemalägger, blockerar inloggning, dubbel, egen, okänd), `CancelDeletion`, lösenordsåterställning, återsänd verifiering, notiser för förfallna påminnelser, `RequiresAdminRole` | controller + InMemory + `IAuthService`-mock |
| `AuthControllerTests` | 6 | `Me`, `UpdateMe` (visningsnamn: sätta/tömma/utelämna, bara Support/Admin får), `ExportMe`. Inget om `DeleteMe`, `ChangePassword`, `Login/Register/Refresh` (controller-lagret), `CancelDeletion` | controller + InMemory, allt i `IAuthService` mockat |
| `AuthServiceTests` | 37 | Registrering, verifiering (giltig/utgången/använd/okänd), återsändning, e-postbyte (token, fel lösenord, upptagen, ersätter äldre, återkallar refresh-tokens), login (rätt/fel/spärrad/Google-konto), Google-login, refresh (rotation/spärrad/utgången/återkallad/okänd), `CancelDeletionAsync`. **Otestat:** `RequestPasswordResetAsync`, `ResetPasswordAsync`, `LogoutAsync`, e-postnormalisering, lösenordspolicy | tjänst + InMemory, `ITokenService`/`IPasswordHasher`/`IEmailService`/`IGoogleTokenValidator` mockade |
| `DateTimeQueryHelpersTests` | 3 | `EnsureUtcKind` (Unspecified, Local, Utc) | ren logik |
| `EventsControllerTests` | 9 | `LogShare` (anonym/inloggad), `SearchPublic` (opublicerade källor uteslutna, geografi-fuzzy, sökord, källfilter, okänt shortName, svarsform för kundtjänstboten, standardsida 10). **Otestat:** `GetEvents`, `GetEvent`, `GetLinkStatus`, sidstorleks-kantfall | controller + InMemory |
| `FaqControllerTests` | 6 | Publik synlighet (opublicerad, flagga av/på, override), `UpdatedAt` | controller + InMemory |
| `FeatureFlagsControllerTests` | 2 | `SetOverride` rensar/rör inte `RedoAttLanseras` | controller + InMemory |
| `PolisenBevakningMatcherTests` | 6 | Bara `Explain` (admin-förklaring: kommun, län, typ). `Matches` (används av push) testas bara indirekt via `PushDispatcherTests` | ren logik (statisk) |
| `PushControllerTests` | 3 | Bara `Claim` (första enheten, redan claimad, okänd id = `true`). `Subscribe`/`Unsubscribe`/inställningar/`ListLogs` otestade | controller + InMemory |
| `PushDispatcherTests` | 19 | Nya händelser (skickar och loggar, tystad, källa av för användaren, inga nya, utgången prenumeration tas bort, övrigt fel behåller enheten, Polisen med/utan bevakning, sammanfattningar pushas aldrig), ny version (2), nytt ärende (admin/tystad/vanlig användare/delad claim över två enheter/feedback-rubrik). **Otestat:** `DispatchNewUserAsync`, `IsActive`/`DeletedAt`/`IsPublished`, claim-rad sparad före utskick | statiska metoder + InMemory + `IPushNotificationService`-mock |
| `ScheduledReleaseBackgroundServiceTests` | 5 | `ExecuteDueAsync`: förfallen release aktiverar flaggor, publiceras bara med punkter, schema rensas, ej förfallen hoppas över. Ingen poison-pill/ogiltig JSON | statisk metod + InMemory |
| `SupportControllerTests` | 8 | Skapa ärende (anonymt/inloggat/utan text/löpnummer), `GetMyTickets`, `GetMyTicket`, `AdminSupportController_RequiresAdminRole` (låser fast E4 #7). Inget om rate limit/validering (E1 #8) | controller + InMemory |
| `SupportScheduledActionServiceTests` | 5 | `svar`/`intern`/`tilldela`, ej förfallen, redan utförd. Inget test bevisar att svaret mejlas (det gör det inte, E3 #2) | statisk metod + InMemory |
| `UppdateringarControllerTests` | 3 | Endast schemaläggningslogiken vid `UpdateUppdatering`. Publik `GET` (synlighet) och validering otestade | controller + InMemory |
| `UserDeletionBackgroundServiceTests` | 4 | Anonymisering när fönstret gått ut/inte/redan raderad/inga. Inget test på att andra tabeller rensas (E3 #9) | statisk metod + InMemory |

Summa 157 (verifierat mot körningens totalsiffra).

### 1.3 Hur blind är sviten för PostgreSQL-felklassen?

Bedömning: **100 % av de 157 testerna**, av konstruktion, men det är inte deras uppgift att fånga den. Det som saknas är ett andra lager, inte att de befintliga skulle vara fel. Vad som faktiskt fångas respektive inte:

| Felklass | Fångas av nuvarande sviten? | Vad som skulle fånga den |
|---|---|---|
| Affärslogik (rätt statuskod, rätt rad ändrad, filter) | Ja, bra (InMemory räcker) | Befintligt mönster |
| 42804 / bool-uuid-timestamptz-typer, saknat raw-SQL-block | Nej. 0 körda rader av 1 251 körbara i `Program.cs` | Guard-test (text, avsnitt 4) + ett PG-test som kör start/`MigrateAsync` |
| `DateTime.Kind=Unspecified` vid skrivning/frågeparameter | Nej (InMemory och SQLite bryr sig inte) | Kind-interceptor på SQLite (proxy) + ett PG-rökprov (bevis) |
| FK-brott, unika index, dubblett-race (E2 #7, E4 #3, E1 #5) | Nej (InMemory tvingar inget) | SQLite (tvingar FK/unik) räcker för det mesta |
| Modellbindning, `[Authorize]`, rate limit, JSON-form | Nej | Reflektionsguard eller `WebApplicationFactory` (kräver `public partial class Program` + `Mvc.Testing`) |
| `ExecuteUpdate/Delete`, transaktioner, samtidighet (claim-atomicitet) | Nej | SQLite/PG |
| Seed-logik i `Program.cs` (E2 #1, #8) | Nej | Extrahera till en testbar klass, SQLite |
| Skiftlägeskänslig `LIKE`/`Contains` | Delvis (InMemory är skiftlägeskänsligt som PG, SQLite är det inte för ASCII) | PG |

Praktisk slutsats: **SQLite gör mest nytta per timme** (tvingar FK, unika index, NOT NULL, stöder `ExecuteUpdate`, kräver inget nytt paket, kör lokalt utan Docker) och ska vara standard för de nya integrationstesten. **PostgreSQL via Testcontainers** behövs för en handfull bevis (Kind, bool-kolumner efter start, tom-DB-start) och bör vara få (3–5) och separat märkta. Docker finns inte på utvecklarmaskinen (verifierat), men CI (`ci-backend.yml`, `ubuntu-latest`) kör `dotnet test` och har normalt Docker (antagande, inte verifierat här); alternativ är `services: postgres` i workflowen. PG-testerna bör hoppas över tyst när Docker saknas så att lokal `dotnet test` förblir grön.

## 2. Täckningskarta

Rader = ungefärliga filrader. "Täckning" = mätt andel körbara rader (coverlet) från de 157 testerna. "Testfil" = vilken/vilka som träffar den. Rader med hög täckning kan ändå sakna de scenarier fynden gäller (markerat).

### 2.1 Controllers (`backend/Controllers/`)

| Komponent | Rader | Testad? (täckning) | Testfil | Risk |
|---|---|---|---|---|
| `WebhooksController` | 317 | Nej (0 %) | – | **Hög** (anonym, signaturskyddad; E1 #5/#10) |
| `PreferencesController` | 65 | Nej (0 %) | – | **Hög** (helt utan auth, E1 #4; oanvänd av frontend, kandidat att raderas) |
| `AuthController` | 369 | Delvis (61 %) | `AuthControllerTests` | **Hög** (`DeleteMe`, `ChangePassword`, rate limit-policy på hela klassen: alla otestade) |
| `AdminUsersController` | 213 | Ja (93 %) | `AdminUsersControllerTests` | **Hög** (oåterkalleligt; men `SetStatus` mot schemalagd/raderad/egen saknas, E1 #7, E6 #1) |
| `PushController` | 250 | Delvis (13 %) | `PushControllerTests` | Medel-hög (`Subscribe` SSRF, E1 #6) |
| `AdminSupportController` | 324 | Nej (0 %), bara attributtest | `SupportControllerTests` | Medel-hög (Support-inboxens kärna, E4 #7/#8) |
| `AdminUserDetailsController` | 389 | Delvis (16 %) | `AdminUserDetailsControllerTests` | Medel |
| `EventsController` | 223 | Delvis (41 %) | `EventsControllerTests` | Medel (publik, `pageSize`, `GetLinkStatus`, E1) |
| `SupportController` | 194 | Ja/delvis (78 %) | `SupportControllerTests` | Medel (anonym skrivning utan validering/rate limit, E1 #8) |
| `SourcesController` | 187 | Nej (0 %) | – | Medel (publik läcka av `LastFetchError`, `IsActive`-effekt, `DeleteSource`; E4 #4/#5/#12) |
| `UppdateringarController` | 209 | Delvis (81 %, bara schemalogiken) | `UppdateringarControllerTests` | Medel (publik synlighetsläcka, okänd `Typ` vitskärmar, E4 #1/#9) |
| `UserSourcesController` | 97 | Nej (0 %) | – | Medel (E4 #3) |
| `AdminActivityLogController` | 276 | Nej (0 %) | – | Medel (500 mot PG, E4 #2/#11) |
| `UserPolisenBevakningController` | 110 | Nej (0 %) | – | Medel-låg (E4 #6) |
| `FeatureFlagsController` | 106 | Delvis (41 %) | `FeatureFlagsControllerTests` | Låg-medel |
| `MaintenanceBannersController` | 115 | Nej (0 %) | – | Låg-medel (publik läcka, E4 #10) |
| `SiteSettingsController` | 71 | Nej (0 %) | – | Låg-medel (globala växlar) |
| `AdminEventSearchController` | 124 | Nej (0 %) | – | Låg-medel |
| `AdminHealthController` | 75 | Nej (0 %) | – | Låg-medel (500 när DB nere) |
| `FaqController` | 114 | Ja (52 %, publik filtrering täckt) | `FaqControllerTests` | Låg |
| `AdminFeatureIdeaController` | 286 | Ja (60 %) | `AdminFeatureIdeaControllerTests` | Låg |
| `UserSavedEventsController` | 61 | Nej (0 %) | – | Låg |
| `AdminIngestorLogController` | 83 | Nej (0 %) | – | Låg |
| `StatsController` | 81 | Nej (0 %) | – | Låg |
| `TestingController` | 84 | Nej (0 %) | – | Låg (Admin-only) |

15 av 25 controllers ligger på 0 % (eller bara attributtest). Sammanlagt ca 2 070 av 4 420 controllerrader ligger i helt otestade controllers.

### 2.2 Services, Ingestors, Application, Infrastructure, Helpers, Data

| Komponent | Rader | Testad? (täckning) | Testfil | Risk |
|---|---|---|---|---|
| `EventSync` | 56 | Nej (0 %) | – | **Hög** (en dubblett dödar källan permanent, E3 #1) |
| `IngestorBackgroundService` | 126 | Nej (0 %) | – | **Hög** (delad DbContext, `IsActive`, E3 #3/#6). `IngestAsync` är `private`, se seam i avsnitt 3 |
| `PushDispatcher` | 275 | Ja (86 %), men filtren saknas | `PushDispatcherTests` | **Hög** (E3 #4/#5, E4 #3) |
| `UserDeletionBackgroundService` | 68 | Delvis (45 %) | `UserDeletionBackgroundServiceTests` | **Hög** (oåterkallelig GDPR, ofullständig, E3 #9; E1 #7) |
| `ResendEmailService` | 204 | Nej (0 %) | – | Medel (HTML-injektion E3 #8; `HttpClient` skapas i konstruktorn, kräver seam) |
| `SupportScheduledActionService` | 102 | Delvis (65 %) | `SupportScheduledActionServiceTests` | Medel (mejlas aldrig, E3 #2) |
| `ScheduledReleaseBackgroundService` | 87 | Delvis (50 %) | `ScheduledReleaseBackgroundServiceTests` | Medel-låg (poison-pill) |
| `PolisenBevakningMatcher` | 106 | Ja (100 %) | `PolisenBevakningMatcherTests` + Push | Medel (`Matches` vs frontend `matchar()` kan glida isär) |
| `GoogleTokenValidator` | 34 | Nej (0 %; alltid mockad) | – | Medel |
| `WebPushNotificationService` | 41 | Nej (0 %) | – | Medel-låg |
| `SvenskaLan` | 94 | Ja (100 %, via matchertester) | indirekt | Låg (statisk data, kontrollerad i E3) |
| `KrisinformationApiIngestor` | 128 | Nej (0 %) | – | **Hög** (enda källan med VMA; `DateTimeOffset.Parse` fäller hela källan, E3 #7) |
| `PolisenRssIngestor` | 96 | Nej (0 %) | – | Medel-hög (huvudkällan) |
| `TrafikverketApiIngestor` | 187 | Nej (0 %) | – | Medel (E3 #13) |
| `SmhiApiIngestor` | 176 | Nej (0 %) | – | Medel-låg (opublicerad, men ExternalId-bygget E3 #1) |
| `GenericRssIngestor` | 68 | Nej (0 %) | – | Medel (HTML-detektering är en uttalad BE-regel, otestad) |
| `AuthService` | 394 | Ja (81 %) | `AuthServiceTests` | **Hög** (saknar återställning, logout, normalisering, policy, Google-pre-hijack; E1 #9) |
| `JwtTokenService` | 60 | Nej (0 %) | – | **Hög**/liten (säkerhetskritisk, trivial att testa; E1 #2) |
| `AktivitetsloggService` | 55 | Nej (0 %; alltid mockad) | – | Låg-medel (`SaveChanges` committar anroparens ändringar, E3) |
| `FeatureFlagActivation` | 56 | Ja (100 %) | via Uppdateringar/ScheduledRelease | Medel |
| `FeatureFlagDefaults` | 58 | Ja (97 %) | via `FaqControllerTests` | Låg (men frontend-paritet otestad, se G3) |
| `DateTimeQueryHelpers` | 17 | Ja (100 %) | `DateTimeQueryHelpersTests` | Låg |
| `MetadataFallbacks` | 31 | Nej (0 %) | – | Låg |
| `Data/UtcDateTimeConverter` | 27 | "100 %" men bara läsriktningen prövas | indirekt | Medel (`convertToProvider` är `v => v`, E2 #4) |
| `Data/AppDbContext` | 267 | 97 % (bara modellbygget körs) | indirekt | Medel (index/FK-luckor, E2 #7) |
| `Program.cs` (seed, raw SQL, start) | 1 518 | Nej (0 % av 1 251 körbara rader) | – | **Hög** (E2 #1–#3/#5/#8) |

Ingestors: 0 % av 417 körbara rader. Alla fem tar en `HttpClient` i konstruktorn (`GenericRssIngestor(HttpClient, Source)`, `KrisinformationApiIngestor(HttpClient)`, `PolisenRssIngestor(HttpClient)`, `SmhiApiIngestor(HttpClient, ILogger)`, `TrafikverketApiIngestor(HttpClient, ILogger)`), så de går att testa med en fejkad `HttpMessageHandler` utan att ändra produktionskod.

## 3. Rangordnade tester med mest värde

Rangordning = (allvar × sannolikhet enligt E1–E6) / kostnad, med bonus för säkerhetsgränser som har noll test idag. Regel: **testet skrivs i samma PR som fixen** (en PR per funktion); för de översta bör testet först skrivas och köras rött mot dagens kod för att bevisa att det fångar felet, sedan fixen.

Teckenförklaring: "Enhet" = ren logik eller InMemory; "Integr." = kräver relationell provider eller hela pipelinen. **DB-kolumnen:** `InMem` = går med InMemory (befintligt mönster), `SQLite` = SQLite in-memory (`Data Source=:memory:`, öppen anslutning; inget nytt paket), `PG` = kräver riktig PostgreSQL (Testcontainers/CI), `–` = ingen DB.

| # | Test (namnförslag) | Bevisar | Fynd | Nivå | DB |
|---|---|---|---|---|---|
| 1 | `DispatchNew*_InactiveOrDeletedRecipient_SendsNothing` (Theory över de 4 vägarna: nya händelser, ny version, nytt ärende, ny användare), `DispatchNewEventsAsync_UnpublishedSource_SendsNothing` | Avstängda (`IsActive=false`) och raderade (`DeletedAt!=null`) konton, samt avstängd Admin/Support, får ingen push; opublicerad källa pushar inte. Bygger på befintlig `SeedSubscriber`-hjälpare. Kod bekräftad: mottagarfrågorna (`PushDispatcher.cs:31-34`, `:120-123`) saknar `IsActive`/`DeletedAt`. ~8 tester | E3 #5, E4 #3/#4 | Enhet | InMem |
| 2 | `DeleteMe_SuspendedUser_IsRejected`, `CancelDeletion_AdminSuspendedUser_DoesNotClearSuspension` (`AuthService`), `SetStatus_Reactivate_DeletionScheduledOrDeleted_IsRejected`, `SetStatus_SuspendSelf_IsRejected`, `SetStatus_SuspendLastActiveAdmin_IsRejected` | En avstängd användare kan inte häva sin spärr via GDPR-radering; admin kan inte "återuppliva" ett konto som ska anonymiseras (annars sker anonymiseringen senare) eller låsa ut sig/alla admins. Kod bekräftad: `DeleteMe` kontrollerar bara `DeletionScheduledAt`, `SetStatus` kontrollerar inget (`AdminUsersController.cs:77-96`). `NewController(db, callerId)` finns redan. ~8 tester | E1 #3/#7, E6 #1 | Enhet | InMem |
| 3 | Webhook-svit: `ResendInbound_MissingOrBadSignature_Returns401`, `..._OldTimestamp_Returns401`, `..._NoSecretConfigured_FailsClosed`, `..._TicketNumberOverflow_Returns200NotThrow`, `..._MalformedJson_Returns200Or400NotThrow`, `..._SameEmailIdTwice_CreatesOneMessage`, `..._SenderMismatch_IgnoredAndNoMessage`, `..._InfoAddress_CreatesTicket` | Hela den anonyma yttre ytan har 0 test. Signatur (Svix HMAC, ±5 min, fail-closed), `int.Parse` på `svar+99999999999999999999@…` (kod bekräftad `:104`), retry-idempotens, from-spoofing-skydd. Testet räknar ut riktig HMAC med en test-secret i en in-memory-`IConfiguration`, sätter `DefaultHttpContext` med body/headers och mockar `IEmailService.GetReceivedEmailTextAsync`. ~9 tester | E1 #5/#10 | Enhet | InMem |
| 4 | Ingest-robusthet: `SyncAsync_DuplicateExternalIdInSameFetch_InsertsOnce`, `SyncAsync_ExistingDuplicatesInDb_DoesNotThrow`, `SyncAsync_EmptyExternalId_Skipped`; `IngestCycle_SaveChangesFailsForOneSource_LaterSourcesStillSaved_AndRunLogWritten`; `IngestCycle_DedicatedIngestorWithSourceInactive_IsSkipped`; unikt index `(SourceId, ExternalId)` avvisar dubblett | En dubblett får inte döda en källa permanent (`ToDictionaryAsync`, `EventSync.cs:21-23`, bekräftat), ett misslyckat `SaveChanges` får inte förgifta resten av cykeln (delad `db`, bekräftat `IngestorBackgroundService.cs:53-54,107-122`), `IsActive` gäller även dedikerade ingestorer (bekräftat `:75-77`). Fejkad `IIngestor`. **Seam behövs:** `IngestAsync` är `private` (ta fram en `public static` cykelmetod som de andra tjänsterna, i fix-PR:en). ~8 tester | E3 #1/#3/#6, E2 #7 | Enhet + Integr. | InMem för logiken, **SQLite** för felande `SaveChanges` (NOT NULL) och unikt index |
| 5 | Auth-yta: `AllControllers_WithoutAuthorize_AreInApprovedPublicList` (reflektionsinventering över alla actions med effektiv anonym åtkomst, jämförs mot en godkänd lista `METHOD route`) och `AuthController_RateLimitedPoliciesAreOnAnonymousEndpoints` | Ingen ny/befintlig controller blir oskyddad utan att listan ändras avsiktligt (fångar `PreferencesController` idag, även om fixen är att radera controllern). ~2 tester, ca 70 rader | E1 #4 (+ policyomfång E1 obs.) | Enhet | – |
| 6 | Kind-vakt: `EveryDateTimeProperty_NormalizesToUtcOnWrite` (converter-enhetstest över `db.Model`), `AdminActivityLog_GetLog_WithUnspecifiedFrån_SendsUtcParameter` och en generell `DbCommandInterceptor` som kastar om någon `DateTime`-parameter har `Kind != Utc`; ett PG-rökprov `PostgresRoundTrip_UnspecifiedDateTime_Persists` | Skriv- och frågesidan av `timestamptz`-regeln. Interceptor på SQLite härmar Npgsqls regel (proxy: kontrollerar det värde som skulle skickas, bevisar inte Npgsql-beteendet, det gör PG-testet). Kod bekräftad: `convertToProvider` är `v => v`, `GetLog` använder `från/till` orörda. ~5 tester | E2 #4, E4 #2 | Enhet + Integr. | **SQLite** (interceptor), **PG** (1 rökprov) |
| 7 | Publika läckor: `GetUppdateringar_Anonymous_ExcludesInloggadePunkter`, `..._Authenticated_IncludesAll`, `CreateUppdatering_UnknownTypOrSynlighet_ReturnsBadRequest`, `GetBanners_PublicCaller_OnlyActiveAndAudienceFiltered`, `GetSources_Public_DoesNotExposeLastFetchError` (serialisera `Value` och kontrollera fältnamn) | Server-sidig filtrering (inte bara klient, samma klass som PR #581), validering som hindrar vitskärms-`Typ`, DTO utan interna fält. Kod bekräftad: `GetUppdateringar` filtrerar bara på `Publicerad` (`:34-37`). ~8 tester. Backend + minimal frontend i samma release (breaking-change-regeln) | E4 #1/#5/#9/#10 | Enhet | InMem |
| 8 | Push-claim: `SendToDevices_ClaimRowIsPersistedBeforeFirstSend` (NSubstitute `When(...).Do` läser claim via en andra kontext mot samma InMemory-databas), `Claim_IsAtomic_OnlyOneOfTwoConcurrentCallsWins` | Claim-raden ska finnas när första enheten hinner anropa `/claim` (nu sparas den efter alla utskick, bekräftat `PushDispatcher.cs:236-273`). Obs: `Claim_UnknownClaimId_FailsOpenAsClaimed` låser fast fail-open och ska skrivas om om designen ändras. Atomicitetstestet kräver `ExecuteUpdate` | E3 #4 | Enhet + Integr. | InMem (ordning), **SQLite** (atomicitet) |
| 9 | Seed/start (efter att seed-koden extraherats till en klass): `Seed_RunTwice_DoesNotOverwriteAdminEditedFaq`, `Seed_DeletedFaq_NotResurrected`, `Seed_Uppdateringar_AllTypAndSynlighetAreValid`, `Startup_EmptySqlite_AppliesMigrationsAndSeeds`, `AdminSeed_ExistingEmailWithOtherRole_LogsWarning` | Seed skriver inte över adminens innehåll (E2 #1, bekräftat i enhet 2), seed-data kan inte vitskärma Nyheter (PR #583-klassen), start på tom SQLite fungerar. Kräver antingen extraktion eller `public partial class Program` + `Mvc.Testing`. ~5 tester | E2 #1/#8, E4 #9 | Integr. | **SQLite** |
| 10 | `SupportScheduledAction_Svar_SendsEmailToContact`, `..._Svar_LogsActivity`, `AddScheduledAction_InvalidTypeOrEmptyText_ReturnsBadRequest` | Det schemalagda svaret mejlas (idag bara en DB-rad, bekräftat `SupportScheduledActionService.cs:59-68`). Signaturen ändras (tar `IEmailService`), så testet skrivs med fixen. ~3 tester | E3 #2, E4 #8 | Enhet | InMem |
| 11 | Krisinformation/SMHI/Trafikverket/Polisen/Generic med fejkad `HttpMessageHandler`: `Krisinformation_EmptyOrBadPublished_SkipsItemOnly`, `..._MissingIdentifier_SkipsItem`, `Smhi_MissingAreaId_NoCollidingExternalId`, `Generic_HtmlResponse_ThrowsDescriptiveErrorWithContentTypeAndUrl` (BE-regel), `Trafikverket_MissingApiKey_Reports…` | Ingestors 0 %. Fångar parse-krasch som tystar hela källan (bekräftat `KrisinformationApiIngestor.cs:51`) och backend-rollens egen HTML-regel. Fixtures från riktiga svar. ~10 tester | E3 #1/#7 + rollens regler | Enhet | – |
| 12 | `AdminSupportController_AllowsAdminAndSupport` (skriv om det befintliga attributtestet), `AdminUsersController`-rollens gränser | Support-rollens enda sida ger inte 403 (klassattributet är endast `Admin`, enligt E4 #7 och enligt det befintliga testet som kräver just det; själva controllerfilen läste jag inte om). 1 test, trivialt | E4 #7 | Enhet | – |
| 13 | `UserDeletion_Anonymize_RemovesDevicesTokensPrefsSavedEvents`, `..._ClearsTicketContactAndAuditLogValues` | GDPR-anonymiseringen rör alla tabeller som E3 #9 listar (idag bara `User`-raden). SQLite för att kaskader/FK ska vara verkliga. ~3 tester | E3 #9 | Integr. | SQLite |
| 14 | `SaveSources_UnknownOrUnpublishedSource_Returns400`, `..._DuplicateSourceIds_Deduped`, `CreateBevakning_OversizedLists_Rejected` | Prenumerationsvalidering (E4 #3/#6). Valideringen sker i kod, så InMemory räcker för 400-fallen; dubbletter/unikt index kräver SQLite. ~6 tester | E4 #3/#6 | Enhet | InMem/SQLite |
| 15 | `ResendEmail_UserControlledValues_AreHtmlEncoded` (Theory över 6 metoder) | `toName`/`newEmail`/`subject` HTML-kodas (E3 #8). **Seam:** `HttpClient` skapas i konstruktorn, låt den injiceras eller extrahera HTML-byggarna. ~3 tester | E3 #8 | Enhet | – |
| 16 | `RateLimitKey_*` (ren funktion efter extraktion: IPv6 till /64, högraste betrodda hopp) + ett `WebApplicationFactory`-rökprov (5 anrop, sedan 429) | Partitionsnyckeln kan inte förfalskas med `X-Forwarded-For`. **Begränsning:** hur Railway faktiskt skriver headern går inte att testa lokalt (E1 #1 är PLAUSIBLE); testet bevisar bara koden. ~4 tester | E1 #1 | Enhet + Integr. | – / SQLite |
| 17 | `JwtTokenService_GeneratesExpectedClaimsAndExpiry`, `Startup_MissingJwtSecretOutsideDevelopment_Throws` | Roll-claim, 15 min livstid; fail-fast för hemligheter efter härdningen (E1 #2, kvarstår som hygien). ~3 tester | E1 #2 | Enhet | – |
| 18 | `AuthService`: e-postnormalisering (`Kalle@x.se` = `kalle@x.se`), lösenordspolicy i Register/Change, Google mot befintligt `local`-konto utan verifierad e-post, `ResetPassword`/`Logout`/`RequestPasswordReset` (finns inte alls idag), refresh-token återkallas vid lösenordsbyte | E1 #9 + obs. ~10 tester | E1 #9 | Enhet | InMem |
| 19 | Aktivitetslogg: `GetLog_IngestorWindow_IsTimeBasedNotRowCount`, `GetSummary_NegativeDays_Returns400` | E4 #11 och Admin-kantfall. ~3 tester | E4 #11 | Enhet | InMem |
| 20 | `EventsController_PageSizeZeroOrHuge_DoesNotThrow` | `pageSize <= 0`/overflow ger negativt `Skip/Take` (E1 obs.) | E1 obs. | Enhet | InMem (validering) |

Övriga bekräftade fynd är rena frontend-fynd (E5, E6) eller design-/driftfynd som inte går att testa automatiskt (t.ex. E1 #1:s Railway-beteende, E3 #11 push-timeout, E3 #13 Trafikverkets gräns) och tas i avsnitt 5 respektive lämnas.

**Tester som redan finns och som en fix kommer att göra röda (avsiktligt):** `AdminSupportController_RequiresAdminRole` (E4 #7), `Claim_UnknownClaimId_FailsOpenAsClaimed` (om designen ändras, E3 #4), `SupportScheduledActionServiceTests` (om signaturen ändras, E3 #2). Uppdatera dem i respektive PR och skriv varför.

**Seam-lista (små refaktoreringar som fix-PR:arna ändå behöver):** (a) `IngestorBackgroundService.IngestAsync` till en `public static`-cykelmetod; (b) seed/start i `Program.cs` till en testbar klass (`DatabaseBootstrapper`); (c) `ResendEmailService` tar `HttpClient`/`HttpMessageHandler`; (d) `public partial class Program` (+ `Microsoft.AspNetCore.Mvc.Testing`) bara om ni vill ha HTTP-nivåtester (rate limit, auth-pipeline).

## 4. Guard-tester som saknas

### G1. Modell↔raw-SQL-block (E2:s öppna punkt)

**Bakgrund (verifierat):** migrationerna är genererade mot SQLite (`type: "INTEGER"`/`"TEXT"` hårdkodat, t.ex. `AddSchemalagdLansering` som lägger `RedoAttLanseras` som `INTEGER`). Körs de orört mot PG blir bool en integerkolumn (42804). Därför finns ett `pendingMigrations.Contains("<id>")`-block per migration i `Program.cs` (32 st) med korrekta PG-typer. Inget test eller start-kontroll fångar att ett block glöms.

**Skanning jag gjorde (skalskript, ej ett test):** av 41 migrationer har 4 bool/DateTime/Guid-kolumner i `Up()` men inget block: `InitialCreate`, `AddUsers`, `AddIsTestOnlyToSource`, `AddFetchStatusToSource`. Alla fyra täcks enligt E2:s tabell av självläkningen (Users.Id före migrering, Events/Sources/UserPreferences i `else`-grenen, `Sources.IsPublished`/`LastFetchedAt` efter `MigrateAsync`). Fem migrationer (`AddSourceUrlCategory`, `AddEventTypeToCanonicalEvent`, `AddFaqFlagKey`, `AddSupportTicketInboundAddress`, `AddDeletionCancelToken`) har inga riskkolumner. De övriga 32 har varsitt block (41 = 32 + 4 + 5). (Notering till E2: dess uppräkning av "7 migrationer utan block" stämmer, men tre av dem, `AddUsers`, `AddIsTestOnlyToSource`, `AddFetchStatusToSource`, har faktiskt riskkolumner och förlitar sig på läkningen, inte på "endast TEXT".)

**Föreslagen konstruktion (nivå 1, ca 60–80 rader, ingen DB):**
1. Reflektera över `typeof(AppDbContext).Assembly` efter typer med `[Migration("id")]` och `[DbContext(typeof(AppDbContext))]`.
2. För varje: `((Migration)Activator.CreateInstance(t)!).UpOperations` (publik egenskap, kör `Up()` utan DB). Samla `AddColumnOperation` och `CreateTableOperation.Columns` där `ClrType` (efter nullable-avpackning) är `bool`, `DateTime`, `DateTimeOffset`, `Guid` eller `TimeSpan`.
3. Om en migration har minst en sådan kolumn: kräv att `Program.cs`-texten innehåller `"<id>"` (hitta filen genom att gå uppåt från `AppContext.BaseDirectory` till mappen med `backend/Program.cs`), annars att id:t finns i en `Undantag`-ordbok `{ id → motivering }` (de fyra ovan, med pekare till läkningen).
4. Testet är en `[Theory]` med `MemberData` över migrationslistan så felet pekar ut vilken migration som saknar block.

**Nivå 2 (+40 rader):** klipp ut blocktexten mellan `Contains("<id>")` och nästa `pendingMigrations.Contains(` och kräv att varje riskkolumns namn (`"RedoAttLanseras"`) förekommer citerat i blocket tillsammans med en PG-typ (`boolean|uuid|timestamptz|timestamp with time zone|time`) och inte `INTEGER`. Fångar "block finns men en kolumn glömdes".

**Begränsningar:** kontrollerar text, inte att SQL:en är korrekt (det gör bara PG-testet); känslig för att blocken flyttas ur `Program.cs` (då byts filsökvägen mot en klass/ordbok, vilket är en bättre design: `Dictionary<string,string>` migrations-id → SQL som testet läser direkt). En ny `Undantag`-rad kräver motivering, så disciplinen blir synlig i diffen. Värde: hög, det är exakt incidentklassen bakom feedback-regeln om raw-SQL i samma PR.

### G2. "Modell ändrad utan migration" (spike, osäkert)

`Program.cs:51` ignorerar `PendingModelChangesWarning`, så en modelländring utan migration fångas inte vid start. Ett test som anropar `db.Database.HasPendingModelChanges()` (finns i nyare EF Core; exakt API i EF 10 inte verifierat) skulle stänga första länken i kedjan. **Risk:** snapshotten är SQLite-genererad, så differ kan ge falska träffar mot ett Npgsql-konfigurerat context; behöver en timmes spike innan det litas på. Uppskattning: 1 h spike + 20 rader om det fungerar.

### G3. Frontend↔backend-flaggparitet (ca 40 rader)

E3 jämförde `frontend/src/lib/featureFlags.ts` med `FeatureFlagDefaults` för hand (31/31). Ett backend-test kan läsa `../frontend/src/lib/featureFlags.ts` (regex på `key:` och `defaultAktiv:`) och jämföra nyckel för nyckel och default mot `FeatureFlagDefaults`. Fångar driftandet som ger FAQ-filtrering/flaggaktivering ur synk. Beroende på repolayout (fungerar i CI-checkout).

### G4. Publik yta som snapshot

Se test 5 i avsnitt 3 (godkänd lista över anonyma endpoints). Ca 60–70 rader plus ca 30 rader lista.

### G5. Kind-vakt som gemensam testbas

`SaveChangesInterceptor` (InMemory, kontrollerar `DateTime`-egenskaper vid skrivning) och `DbCommandInterceptor` (SQLite, kontrollerar parametrar). Lägg dem i en delad `TestDb.Create()` som ersätter de 15 kopierade `NewDb()`-hjälparna: då får även alla befintliga tester Kind-skyddet gratis, och det som bryter avslöjar var koden förlitar sig på Unspecified. Ca 40–60 rader plus mekanisk ersättning av hjälparna. Kan bli röd på befintliga tester (vilket är poängen).

### G6. Det slutgiltiga guardet (kräver PG + extraktion)

`Startup_EmptyPostgres_BootstrapsAndAllDbSetsAreReadable`: kör start/migrering mot en färsk PG-container och läs varje `DbSet`. Fångar 42804-klassen på riktigt. **Idag skulle det bli rött** eftersom en tom PG inte kan startas (E2 #3), så det hör ihop med den fixen (baseline-migration) och kräver att start-koden extraherats (seam b). 1 dag inklusive fixturen, Testcontainers-fixtur för PG delas med övriga PG-tester.

## 5. Frontend: minimal testuppsättning (bygg inget)

**Läge (verifierat):** ingen testinfrastruktur, inga `*.test.*`-filer, `package.json` har bara `dev/build/lint/preview`, CI (`ci.yml`) kör `npm run build` + `npm audit` men inga tester. Ingen `ErrorBoundary` finns någonstans i `src/`. Mycket logik ligger inbyggd i stora komponenter (t.ex. `Anvandare.tsx`, `NewsFeed.tsx`), så vissa tester kräver att en liten ren funktion först plockas ut i fix-PR:en.

**Installation:** dev-beroenden `vitest` (senaste 5.0.1, peer `vite ^6.4 || ^7 || ^8`, alltså kompatibel med projektets Vite 8.2), `jsdom` (30.1.1), `@testing-library/react` (16.3.3, peer `react ^18 || ^19`), **`@testing-library/dom`** (krävs som peer), `@testing-library/user-event`, `@testing-library/jest-dom`. Valfritt senare: `@vitest/coverage-v8`, `msw`. Konfiguration: ett `test`-block i `vite.config.ts` (`environment: 'jsdom'`, `setupFiles: './src/test/setup.ts'` med jest-dom och `localStorage.clear()`/`vi.useRealTimers()` i `afterEach`, `globals: true`), skript `"test": "vitest run"`, `types` för vitest/jest-dom i `tsconfig.app.json` (så `tsc -b` klarar testfiler), ett `npm test`-steg i `ci.yml`. `import.meta.env.VITE_API_URL` är odefinierad i test (blir `''`), vilket räcker. Uppskattning: 2 h.

**De första 8 testerna, i ordning:**

| # | Test | Bevisar | Fynd | Storlek |
|---|---|---|---|---|
| F1 | `AuthContext`: refresh med 401/403 loggar ut, med 429/5xx/nätverksfel behåller sessionen och planerar om (`renderHook` med `AuthProvider`, `vi.useFakeTimers`, `vi.stubGlobal('fetch')`, hjälpare `makeJwt({exp, role})`) | `doRefresh` (`AuthContext.tsx:118-132`) rensar idag sessionen vid alla fel. 401-fallet är grönt idag (baslinje), de övriga blir röda tills fixen | E5 #2 | ~70 rader, 4 tester |
| F2 | `AuthContext`: `byttVy('Support')` överlever nästa refresh; refresh med ny roll som inte längre tillåter vyn faller tillbaka | `applyTokens` skriver `si_aktiv_vy` vid varje refresh (`:112-114`) | E5 #6 | ~40 rader, 2 tester |
| F3 | `AuthContext`: refresh-fördröjningen har golv och två flikar synkas (`storage`-händelse ändrar token/refresh-token utan att tömma lagringen) | Tät refresh-loop vid klockskillnad (`:135-143`) och flik-kollision | E5 #3/#8 | ~50 rader, 3 tester |
| F4 | `PolisenBevakningarContext`: `matchar` före laddning = false, efter lyckad tom hämtning = true, **efter misslyckad hämtning får det inte bli "visa allt"**; AND/ELLER-semantiken för `kategorier`/`omraden`; `matcharLän` | `.catch(() => setLaddat(true))` återinför "visa allt"-buggen (`:61`); paritet med backendens `PolisenBevakningMatcher.Matches` (delad tabell av fall kan ligga i en JSON-fixtur som även backendtestet läser) | E5 #5, E3 (paritet) | ~70 rader, 6 tester |
| F5 | `kallorUtils`: `extraheraPolisenTyp/Omrade`, `länFörGeografi`, `kommunerILän` mot riktiga Polisen-titlar/geografier (`it.each`) | Rena, redan exporterade funktioner: enklaste första testet, bra för att verifiera att uppsättningen fungerar. Kommunstavning (bindestreck) är en känd osäkerhet (E3) | E3/E5 | ~50 rader, ~12 fall |
| F6 | `ErrorBoundary`-komponent + `Uppdateringar`-listan: barn som kastar visar fallback och resten av sidan lever; punkt med okänd `typ` renderar med reserv i stället för att kasta | Vitskärm vid okänd `Typ` (`TYP_CONFIG[typ].label`), ingen boundary finns. Skrivs i samma PR som komponenten. `TYP_CONFIG` är modulprivat; exportera eller testa via renderad lista | E6 #9, E4 #9 | ~50 rader, 3 tester |
| F7 | `adminFetch`: 401 ger en delad (single-flight) refresh och ett enda omförsök; parallella 401 ger en refresh | `adminFetch` (`api/adminFetch.ts`) har ingen 401-hantering | E5 #4 | ~50 rader, 3 tester |
| F8 | Massmarkering i Användare (efter att `toggleAllaMarkerade`-logiken plockats ut till en ren funktion): markerar aldrig egen rad, andra Admin eller redan raderade | Massavstängning kan låsa ut alla admins (frontend-halvan av E6 #1; backend-halvan är test 2) | E6 #1/#2 | ~40 rader, 3 tester + liten extraktion |

Ungefärlig storlek: uppsättning 2 h + F1–F8 ca 12 h (24 tester, ca 400 rader) = **ca 14 h**. Utanför de första 8: `lib/tid` (tidszonsstabila tester, kräver `TZ` i konfigurationen), `services/readState`, `useSourceOrder` och kösemantiken efter utloggning (E5 #7, kräver `QueryClientProvider`-wrapper).

## 6. Rekommenderad ordning och uppskattning

Principen ("skriv testet i samma PR som fixen", en PR per funktion, breaking changes tillsammans med minimal frontendfix) betyder att det mesta arbetet följer fix-ordningen i enhet 1–4. Tre förberedande PR:ar behövs dock först, eftersom de inte är kopplade till någon enskild fix.

**Fas 0: förberedelser (egna PR:ar, snabbt gröna, ingen ändring av produktionskod utom där angivet)**
1. Guard-tester G1 (nivå 1, sedan nivå 2), G3 och G4/test 5. Alla passerar idag (med de fyra undantagen). ~5–6 h.
2. Gemensam `TestDb` (InMemory + SQLite-fabrik) med Kind-vakt (G5), ersätter de kopierade `NewDb()`. ~3 h. Eventuella röda befintliga tester utreds här.
3. Frontend-uppsättning + F5 (enklaste, bevisar att uppsättningen fungerar) + `npm test` i CI. ~4 h.
4. PostgreSQL-fixtur (Testcontainers, hoppas över utan Docker, körs i CI) + två rökprov: Kind-round-trip och en bool-kolumn efter `MigrateAsync`+block. ~6 h. Kan skjutas efter fas 1 om Docker i CI ska utredas först.

**Fas 1: tester som hör till de allvarligaste fixarna (följer E1–E4:s egen fix-ordning)**

| Ordning | Fix-PR (funktion) | Tester som skrivs i den | Antal | Tim. |
|---|---|---|---|---|
| 1 | Spärr/radering (E1 #3, #7, E6 #1 backend) | Test 2 | ~8 | 3 |
| 2 | Push-mottagare (E3 #5, E4 #3/#4) | Test 1 | ~8 | 2 |
| 3 | Webhook-härdning (E1 #5, #10) | Test 3 | ~9 | 4 |
| 4 | Ingest-robusthet (E3 #1, #3, #6, E2 #7 index) | Test 4 och 11 | ~18 | 10 (inkl. seam) |
| 5 | Push-claim (E3 #4) | Test 8 | ~3 | 2 |
| 6 | Publika läckor + validering (E4 #1, #5, #9, #10) | Test 7 (+ F6:s frontenddel) | ~8 | 3 |
| 7 | UTC-Kind (E2 #4, E4 #2) | Test 6 | ~5 | 4 |
| 8 | `PreferencesController` bort (E1 #4) | Test 5 (redan i fas 0) | 0 nya | 0 |
| 9 | Rate limiting (E1 #1) | Test 16 | ~4 | 5 |
| 10 | Support-roll + schemalagda svar (E4 #7/#8, E3 #2) | Test 10 och 12 | ~4 | 2 |
| 11 | Seed (E2 #1) + GDPR (E3 #9) + mejl-escape (E3 #8) | Test 9, 13, 15 | ~11 | 10 (inkl. seam) |
| 12 | Auth-policy och normalisering (E1 #9), hemligheter (E1 #2) | Test 17, 18 | ~13 | 5 |
| 13 | Övrigt (test 14, 19, 20) | | ~12 | 4 |

**Fas 2: frontend, parallellt med motsvarande fix-PR:ar (E5/E6)**

| Fix | Tester | Tim. |
|---|---|---|
| Refresh/session (E5 #2, #3, #6, #8, sannolikt 1–2 PR:ar) | F1, F2, F3 | 5 |
| Polisen/Sparat-laddning (E5 #5) | F4 | 2 |
| ErrorBoundary (E6 #9) | F6 | 1,5 |
| `adminFetch` 401 (E5 #4) | F7 | 1,5 |
| Admin-massåtgärder (E6 #1/#2) | F8 | 1,5 |

**Total (grov):** backend ca 110–120 nya tester och 60–70 h (inklusive seams, guardtester och PG-infrastruktur), frontend ca 24 tester och ca 14 h. Sammanlagt **ca 135–145 tester, 75–85 h**. Det är inkrementell tid ovanpå fixarna (testet skrivs medan felet är färskt, vilket brukar vara billigare än att skriva det i efterhand). Mätbart mål efter fas 0–1: handskriven backendlogik från 32 % till uppskattningsvis 55–60 % körbara rader (Ingestors från 0, Webhooks från 0), men viktigare än siffran: varje bekräftat fynd i E1–E4 som går att testa automatiskt har ett regressionstest.

## 7. Verifierat / ej verifierat

**Verifierat (kört eller läst i koden):**
- 157/157 gröna vid `3bd097c`, inga hoppade; täckningssiffrorna (coverlet, körbara rader per fil) är mätta, inte uppskattade.
- Alla 157 testerna använder InMemory; inga SQLite/Testcontainers/`WebApplicationFactory`; `Program` saknar `public partial class`.
- Docker och `psql` saknas lokalt; `ci-backend.yml` kör `dotnet test` på `ubuntu-latest`.
- Koden bakom testerna 1, 2, 3, 4, 6, 7, 8, 10 ovan är läst och felen finns kvar (se citerade rader).
- Migrationsskanningen (4 migrationer med riskkolumner utan block) gjordes med ett skalskript över `Up()`-avsnitten, inte med den föreslagna reflektionslogiken.
- Vitest 5.0.1 accepterar Vite 8 och RTL 16.3.3 kräver `@testing-library/dom` som peer (`npm view`).

**Inte verifierat:**
- Att något föreslaget test blir rött idag eller grönt efter fix (inget skrivet/körd).
- Att Kind-interceptorn på SQLite verkligen efterliknar Npgsql-regeln fullt ut (därför ett PG-rökprov som bevis).
- `HasPendingModelChanges` på det SQLite-genererade snapshotet (G2, spike).
- Att GitHub-runnern har Docker tillgängligt för Testcontainers (standardantagande om `ubuntu-latest`).
- Railways PostgreSQL-version (ska matcha container-imagen).
- Alla tidsuppskattningar; frontend-testen mot faktiska komponenters testbarhet (några kräver små extraktioner, angivet).
