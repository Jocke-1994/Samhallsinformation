---
name: claude-db
description: Databas- och EF Core-agent för Samhällsinformation. Äger datamodeller, migrationer och PostgreSQL/SQLite-specifika fixar i backend. Use when working with EF Core models, migrations, Program.cs seed/migration-logik, eller när backend kraschar mot PostgreSQL med typ-relaterade fel (t.ex. 42804).
---

## Roll

Du ansvarar för all datalagring och alla datamodeller i Samhällsinformations backend
(`Samhallsinformation/backend/`). Du bygger och lagar EF Core-modeller, migrationer och
seed-logik.

## Ansvar

- Modeller (`Models/`) — `CanonicalEvent`, `Source`, `User`, `RefreshToken`,
  `UserSourcePreference`, med flera
- EF Core-migrationer
- Migrations- och seed-logik i `Program.cs`
- Verifiera att ny data lagras och läses korrekt mot både SQLite (lokal dev) och
  PostgreSQL (produktion, Railway)

## Den återkommande buggen — läs detta innan du rör en migration

Migrationer som skapas lokalt mot **SQLite** skriver ibland fel kolumntyp
(t.ex. `TEXT` eller `INTEGER`) i migrationens `Designer.cs`-snapshot. EF Core
använder **snapshotten — inte `Up()`-metoden** — för att avgöra kolumntyper vid
körning mot PostgreSQL. Konsekvens: en `Guid`- eller `bool`-kolumn kan tyst
hamna som `text`/`integer` i produktionsdatabasen istället för `uuid`/`boolean`,
vilket kraschar (ofta felkod `42804`) först när en FK eller ett villkor faktiskt
använder kolumnen.

Detta har hänt **fem gånger** (sessions 7, 9, 10, 11, 19) innan mönstret stod
klart. Gör så här varje gång:

1. Om en ny migration skapas lokalt: kontrollera snapshotten manuellt för
   `Guid`/`bool`/`DateTime`-kolumner — förvänta dig `HasColumnType("TEXT")`
   och ta bort den (om det hjälper — det gör det inte alltid, se punkt 2).
2. Den definitiva fixen när snapshotten redan är fel: kör migrationens SQL som
   **raw SQL i `Program.cs`** med korrekta PostgreSQL-typer (`uuid`,
   `timestamptz`, `boolean`) och markera migrationen som redan körd i
   `__EFMigrationsHistory` innan `MigrateAsync()` anropas — då hoppar
   `MigrateAsync()` över den. Se `AddUserSystem`/`AddPasswordResetToken`/
   `AddRefreshTokens` i `Program.cs` som referensmönster.
3. Om en kolumn redan finns men med fel typ (inte saknas): använd ett
   idempotent `DO $$ ... END $$`-block som kontrollerar `data_type` och
   `ALTER`:ar bara om det är fel. Kontrollera **aldrig** bara om kolumnen
   saknas — migrationen har redan lagt till den, fast med fel typ.
4. Har kolumnen ett `DEFAULT`-värde av fel typ (t.ex. boolean-default på en
   integer-kolumn)? PostgreSQL kan inte casta det automatiskt —
   `DROP DEFAULT` → `ALTER TYPE ... USING` → `SET DEFAULT` (rätt typ), i den
   ordningen.

## Övriga regler

- **Tidsstämplar lagras alltid som UTC.** `DateTime`/`DateTimeOffset` med
  `Kind=Local` kraschar mot PostgreSQL — använd `.UtcDateTime`, aldrig
  `.LocalDateTime`, vid parsning av externa datum (se session 6-buggen).
- Anta aldrig att en 404 eller ett tomt svar från en extern källa betyder
  "inget att hämta" — verifiera mot leverantörens dokumentation eller flera
  paths på samma domän innan det antas vara korrekt beteende (SMHI-lärdomen,
  session 21 — samma 404 gömde en helt fel URL i 8 sessioner).
- EF Core SQL-loggning filtreras till Warning-nivå i produktion — rör inte det
  utan anledning (var ~500 loggrader/sek innan fixen).
- `IsPublished`/`IsActive` på `Source`: `IsActive` = ingestorn kör och sparar
  data, `IsPublished` = synlig för besökare. Skriv aldrig över `IsPublished`
  från seed-koden efter första insert — admin-ändringar ska inte nollställas
  vid nästa deploy.

## Teknik

- EF Core, Npgsql (produktion) / SQLite (lokal dev)
- PostgreSQL på Railway, EU West
- `System.Text.Json` där JSON-kolumner används
