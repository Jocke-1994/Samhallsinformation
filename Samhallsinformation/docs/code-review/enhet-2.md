# Code review — Enhet 2: Program.cs (schema/seed), Data, Models

- **Granskad commit-SHA:** `7e8f05b` (main, 2026-09-25; koden är identisk med HEAD `d6cabc7`, som bara ändrar enhet-1.md)
- **Nivå:** medium (precision-inriktad, ingen `--fix`)
- **Granskade filer** (under `Samhallsinformation/backend/`): `Program.cs` (rad 215-1518: migrations-/raw-SQL-block, självläkande DO-block, seed; DI-registreringar rad 1-214 lästa för dubbletter), `Data/AppDbContext.cs`, `Data/UtcDateTimeConverter.cs`, alla filer i `Models/`. `Helpers/MetadataFallbacks.cs` berör inte schema/seed, `Infrastructure/Auth` är redan granskad i enhet 1. Auth/CORS/rate limit hoppades över enligt uppdraget.
- **Migrationer:** endast filnamn och `Up()` för de 7 migrationer som saknar raw-SQL-block lästes; genererad kod granskades inte.
- **Metod:** genomläsning rad för rad, modell-för-modell-jämförelse mot blocken, spårning av anropare (Ingestors, `EventSync`, controllers). Varje fynd verifierat mot citerad kod. PLAUSIBLE = mekanismen finns i koden men utlösaren beror på drift/data som inte kunnat verifieras härifrån.
- **Status:** ej fixade. Fixar = en PR per funktion (se PLAN.md).

## Sammanfattning

Huvudfrågan (fel 42804, modell↔block) är **ren för nuvarande produktionsväg**: varje modell/kolumn av typ bool/Guid/DateTime som tillkommit via migration har antingen ett `pendingMigrations`-block med korrekta Postgres-typer eller ett självläkande DO-block (se tabellen längst ner). Inga saknade block hittades. De verkliga fynden ligger i seed-logiken (FAQ skriver över adminens ändringar vid varje omstart) och i skörheten kring start-/bootstrap-logiken (`catch` som kan trigga DROP TABLE, tom Postgres-databas går inte att starta). Inga kritiska fel.

## Fynd (rangordnade, mest allvarligt först)

### 1. FAQ-seeden skriver över adminens ändringar och återuppväcker raderade frågor vid VARJE start — CONFIRMED, medel
- `Program.cs:1331-1336` (loopen `nyaFaqFragor`), `Program.cs:1346-1360` (`raderaKontoFaq`/`exporteraDataFaq`).
- Seed-guarden är *frågetexten*, inte "tomt bord". Två konsekvenser vid varje uppstart (dvs varje deploy/omstart på Railway):
  1. `raderaKontoFaq` och `exporteraDataFaq` sätter ovillkorligen `Publicerad = true`, `FlagKey = "konto_datahantering"` (och för den förra `Svar`) så länge frågetexten är oförändrad. Admin som avpublicerar frågan eller skriver om svaret i admin-FAQ får det återställt vid nästa omstart, utan varning.
  2. De 7 frågorna i `nyaFaqFragor` (och de två "session 49"-frågorna) läggs till igen om admin raderat dem eller ändrat frågetexten (den ändrade raden finns kvar, den nya seed-raden läggs bredvid -> dubbletter).
- Scenario: admin skriver om "Hur tar jag bort mitt konto?"-svaret eller avpublicerar det (t.ex. om raderingsflödet buggar) -> nästa deploy sätter tillbaka den hårdkodade texten och publicerar den. Admin raderar en seedad fråga -> den är tillbaka efter omstart. Kommentaren "admin äger innehållet därefter" stämmer inte.
- Förslag: gör engångsdatafixarna versionerade (t.ex. en seed-version i SiteSettings) eller flytta dem till en EF-migration med `UPDATE ... WHERE`; en seedad fråga ska bara läggas till en gång, inte "om texten saknas".

### 2. `catch { alreadyMigrated = false; }` kan trigga `DROP TABLE Events/Sources/UserPreferences/__EFMigrationsHistory` — PLAUSIBLE, hög påverkan / låg sannolikhet
- `Program.cs:222-234`.
- Alla exceptions (inte bara "tabellen saknas", som redan ger tom lista utan exception) tolkas som "ingen migrationshistorik" och leder till att `Events`, `Sources`, `UserPreferences` och historiktabellen droppas. Om `GetAppliedMigrationsAsync` kastar av ett övergående skäl (timeout/anslutningsreset vid Railway-omstart, Postgres som startar om) men nästa `ExecuteSqlRawAsync` sedan lyckas, raderas alla händelser och källor, och att historiktabellen försvinner får `MigrateAsync` att försöka köra om alla migrationer mot befintliga tabeller.
- Föreslagen fix: fånga bara det specifika fallet (SQLSTATE 42P01), låt annars appen krascha vid start; eller ta bort DROP-grenen helt (den är ett SQLite-till-Postgres-engångsförfarande från tidig fas).

### 3. Startlogiken fungerar bara mot en databas som redan har schemat — tom Postgres startar inte — PLAUSIBLE, medel (drift-/återställningsrisk)
- `Program.cs:238-259` (typläkningen ligger bara i `else`-grenen), `Program.cs:296+` (blocken körs före `MigrateAsync` på rad 1128).
- På en tom Postgres-databas (ny miljö, staging, återställning): `alreadyMigrated == false` -> droppar bara tre tabeller. Sedan körs `pendingMigrations`-blocken FÖRE `MigrateAsync`, men `AddUserSystem`-blocket gör `ALTER TABLE "Users"` och refererar `Sources`/`Users` som ännu inte finns (skapas av InitialCreate/AddUsers, som körs först på rad 1128) -> exception vid start. Dessutom körs bool/uuid/timestamp-läkningen för `Sources.IsActive`, `Events.IsNational`, `UserPreferences.IsActive`, `Events.Id`-PK m.fl. bara i `else`-grenen, så även om blocken passerade skapar den SQLite-typade InitialCreate kolumner som aldrig läks (bara `Sources.IsPublished` och `LastFetchedAt` läks efter `MigrateAsync`).
- Scenario: katastrofåterställning eller ny testmiljö mot en tom Postgres -> appen kraschar vid start (eller startar och kraschar sedan på EF-läsning av `Sources.IsActive`, samma symptom som 42804-incidenten). Det finns ingen väg att bygga en ny miljö från noll.
- Förslag: baseline en Postgres-specifik migration (eller `EnsureCreated` för tom DB) och ta bort SQLite-läkningen i takt med att den blir överflödig; minst, dokumentera att "tom Postgres stöds inte".

### 4. `UtcDateTimeConverter` normaliserar bara vid läsning, inte vid skrivning — PLAUSIBLE, medel
- `Data/UtcDateTimeConverter.cs:14-18` och `:22-26`: `convertToProvider` är `v => v`.
- Npgsql vägrar skriva `DateTime` med `Kind != Utc` till `timestamptz`. Konvertern läker läsriktningen men inte skrivriktningen. Ingenstans i `Controllers/`, `Ingestors/` eller `Services/` anropas `ToUniversalTime`/`SpecifyKind` (grep: 0 träffar).
- DTO:er som tar emot `DateTime` direkt från klienten: `AdminSupportController.cs:323-324` (`ReminderAt`, `ScheduledAt`), `AdminUsersController.cs:213` (`ReminderAt`), `MaintenanceBannersController.cs:115` (`StartUtc`/`EndUtc`), `UppdateringarController.cs:203-209` (`Datum`, `SchemalagdPubliceringUtc`). Skickar klienten en sträng utan `Z`/offset deserialiseras den som Unspecified och `SaveChanges` ger 500 i Postgres men fungerar i SQLite lokalt.
- Scenario: admin schemalägger en lansering eller ett driftmeddelande med "2026-10-01T12:00" (utan Z) -> 500 i produktion, grönt lokalt. Beror på om frontenden alltid skickar `toISOString()` (ej verifierat, enhet 6).
- Förslag: skrivsidan i konvertern: `v => v.Kind == Utc ? v : v.Kind == Local ? v.ToUniversalTime() : DateTime.SpecifyKind(v, Utc)` (och motsvarande för nullable). Löser alla platser på en gång.

### 5. Källa-ID-kollision mellan hårdkodade ingestor-ID:n och sekvensgenererade ID:n kan tyst skriva över en källa — PLAUSIBLE, låg
- `Program.cs:1208-1221` (`Find(source.Id)` -> skriver över `Name/ShortName/BaseUrl/Type/Url`), `Program.cs:261-274` (`Sources_Id_seq` skapas en gång och avancerar aldrig efter explicita insättningar).
- Ingestorerna har fasta ID:n (1, 4, 5, 10). Alla andra källor (admin-skapade via `SourcesController.CreateSource`, seedade SMHI Nyheter/Polisen Efterlysningar) får ID från sekvensen. Om en ny ingestor får ett fast ID som redan är taget av en sekvensgenererad rad hittar `Find` den raden och skriver över dess namn/URL/typ vid varje start; motsatt riktning ger unique-violation när sekvensen når ett explicit insatt ID.
- Scenario: en framtida ingestor med `Id = 7` medan en admin-skapad RSS-källa redan har id 7 -> RSS-källan blir ingestorns källa vid nästa start och dess händelser hamnar under fel källa.
- Förslag: reservera ett ID-intervall (t.ex. ingestorer < 100, sekvens från 1000), eller identifiera ingestor-källor på `Url`/en stabil nyckel.

### 6. Obegränsad tillväxt i loggtabeller utan städning — PLAUSIBLE, låg
- `Models/IngestorRunLog.cs`, `Models/PushDispatchClaim.cs`, `Models/EventShareLog.cs`; skrivs i `IngestorBackgroundService.cs:93,118`, `PushDispatcher.cs:237`.
- `IngestorRunLogs` får en rad per källa var 5:e minut (6+ källor -> ~1 700 rader/dygn, ~600 000/år). `PushDispatchClaims` en rad per push-batch, `EventShareLogs` en per delning. Ingen retention/städning hittades (inga `Remove`/`ExecuteDelete` mot dessa tabeller). Endast `IngestorRunLogs` har index (`RunAt`, `SourceId`); `PushDispatchClaims`/`EventShareLogs` saknar index och FK helt (`UserId`, `EventId`, `ClaimedByDeviceId` är råa Guid), vilket lämnar föräldralösa rader efter GDPR-anonymisering/händelseradering.
- Förslag: bakgrundsstädning av rader äldre än 30/90 dagar; index på `PushDispatchClaims.CreatedAt`.

### 7. `Events` saknar unique (SourceId, ExternalId), SourceId-index och FK mot Sources — PLAUSIBLE, låg
- `Data/AppDbContext.cs:52-56`, `Services/EventSync.cs:19-23`.
- Dedupen sker enbart i applikationskod (uppslag på `SourceId` + `ExternalId`). Bakgrundsingesten (var 5:e min) och adminens manuella omkörning (`SourcesController.cs:113`) kan köra samtidigt -> dubbletter, och inget hindrar det på databasnivå. `TrafikverketApiIngestor` faller dessutom tillbaka på `Guid.NewGuid().ToString()` som ExternalId (`TrafikverketApiIngestor.cs:93`), vilket aldrig dedupas. Frågor filtrerar på `SourceId` (`EventsController.cs:138`) men bara `ExternalId`/`Geography`/`PublishedAt` är indexerade. `SourceId` saknar FK, så en borttagen källa lämnar föräldralösa händelser.
- Förslag: unikt index `(SourceId, ExternalId)` (rensa eventuella dubbletter först), ev. index `(SourceId, PublishedAt)`.

### 8. Admin-seeden hoppar tyst över om kontot redan finns med annan roll — PLAUSIBLE, låg
- `Program.cs:1498-1514`.
- Villkoret är `!db.Users.Any(u => u.Email == adminEmail)`. Om någon redan registrerat kontot med den e-postadressen (t.ex. via öppen registrering före första start i en ny miljö, eller Google-inloggning) skapas ingen admin och rollen uppgraderas inte, utan logg. Det nyskapade admin-kontot får dessutom `EmailVerified = false` (modellens default) och `TermsAcceptedAt = null`.
- Scenario: ny miljö, admin registrerar sig först på vanligt sätt -> inloggning fungerar men kontot är "Användare", ingen varning i loggen.
- Förslag: logga en varning när e-postadressen finns med annan roll, sätt `EmailVerified = true` i seeden.

## Modell↔block-kontroll (huvudfrågan)

| Kolumn/tabell | Typ | Täckning |
|---|---|---|
| Users.Id | uuid | typläkning före migrering (rad 277-291) |
| Users: CreatedAt, PushEnabled, EmailVerified, IsActive, SuspendedAt, SuspensionReminderAt, TermsAcceptedAt, DeletedAt, DeletionScheduledAt | timestamptz/boolean | `pendingMigrations`-block (AddUserSystem, AddPushSupport, AddEmailVerification, AddAccountControlFields, AddSuspensionReminder, AddUserDeletedAt, AddDeletionScheduledAt) |
| Users.PushNyaHandelser/PushNyVersion | boolean | block + självläkande DO-block (rad 1137-1156) |
| Users.DisplayName, DeletionCancelToken | text | ingen läkning behövs (TEXT nullable) |
| Sources.IsActive | boolean | typläkning i `else`-grenen (bara befintlig DB, se fynd 3) |
| Sources.IsPublished, LastFetchedAt | boolean/timestamptz | självläkande DO-block efter MigrateAsync |
| Events.IsNational, PublishedAt, IngestedAt, Id | boolean/timestamptz/uuid | typläkning i `else`-grenen |
| SupportTickets: IsArchived, FirstOpenedAt, LastViewedAt, LastUserMessageAt, ReminderAt | boolean/timestamptz | block AddSupportTickets + AddTicketArchiveAndReadTracking + AddTicketLastViewedAndLastUserMessage |
| SupportTicketMessages.IsInternal, ScheduledActions.Executed/ExecutedAt | boolean/timestamptz | block AddSupportTickets |
| FeatureIdeas (TriageKanGoras/BorGoras bool?, CreatedAt), ChecklistItems.Done/DoneAt | boolean/timestamptz | block AddFeatureIdeas |
| FaqItems: Publicerad, CreatedAt, UpdatedAt | boolean/timestamptz | block AddFaqItems + AddFaqItemUpdatedAt; FlagKey (text) via ren migration |
| FeatureFlagOverrides.Value, RedoAttLanseras | boolean | block AddFeatureFlagOverrides + AddSchemalagdLansering |
| SiteSettings, MaintenanceBanners, PushDispatchClaims, EventShareLogs, IngestorRunLogs, AdminActivityLogs, PolisenBevakningar, EmailChangeTokens, UserSavedEvents, RefreshTokens, PasswordResetTokens, EmailVerificationTokens, UserDevices, UserDoNotDisturbSchedules (bool + TIME), UserNotificationSettings, UserSettingAuditLogs, UserSourcePreferences, NotificationDeliveryLogs, Uppdateringar/UppdateringsPunkter | bool/Guid/timestamptz | block med explicita Postgres-typer |

Resultat: ingen modell med bool/Guid/DateTime-kolumn saknar block. De 7 migrationer utan block (AddUsers, AddIsTestOnlyToSource, AddFetchStatusToSource, AddEventTypeToCanonicalEvent, AddFaqFlagKey, AddSupportTicketInboundAddress, AddDeletionCancelToken) tillför endast TEXT-kolumner eller täcks av läkningen ovan. Invarianten upprätthålls dock enbart av utvecklardisciplin (kommentaren vid rad 1131-1136 beskriver incidenten där ett block glömdes); inget test eller startkontroll fångar ett framtida glapp. Förslag: ett enhetstest som för varje migration med bool/Guid/DateTime-kolumn kontrollerar att ett block finns i `Program.cs`.

## Övriga observationer (ej rangordnade fynd)
- **Dubbla/motstridiga registreringar:** inga dubbletter bland DI-registreringarna (`AddHttpClient<X>` + `AddScoped<IIngestor, X>` är ett avsiktligt par, varje ingestor och hosted service registreras en gång). `ConfigureWarnings(... PendingModelChangesWarning ignore)` (rad 51) gör att en modelländring utan migration/block inte fångas vid start; det är orsaken till att bool-regeln kräver disciplin.
- **Kaskader:** alla `Cascade`/`SetNull`/`Restrict` är rimliga för dagens flöden. `Restrict` på `FeatureIdea.CreatedByUserId` och `SupportTicketScheduledAction.CreatedByUserId` blockerar hård radering av ett admin-konto, men ingen kod raderar användare fysiskt (GDPR anonymiserar), så det är inget aktivt problem.
- **information_schema-kontroller** filtrerar inte på `table_schema` (rad 245, 1143, 1170, 1186). Ofarligt på Railway med enbart `public`.
- **Uppdateringar-seed:** `if (!db.Uppdateringar.Any())` (rad 1407) återseedar allt om admin raderar samtliga poster. Samma mönster som fynd 1, mindre sannolikt.
- **Källrättningar** (Livsmedelsverket/Läkemedelsverket/KEMI, rad ~1249-1275) körs vid varje start och matchar på gammalt värde; idempotenta, men skriver över en avsiktlig admin-ändring av ShortName. Kandidater att flytta till migration.
- **UserPreference.UserId** är `string` medan alla andra `UserId` är `Guid`, utan FK. Ser ut som ett rudiment; verifiera användning och ta bort.
