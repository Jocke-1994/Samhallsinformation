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
