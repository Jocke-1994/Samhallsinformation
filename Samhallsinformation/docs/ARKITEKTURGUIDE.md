# Arkitekturguide — den röda tråden

> Syfte med det här dokumentet: inte "vad gör rad 47", utan **varför finns
> den här mappen/filen överhuvudtaget, och vad är dess enda jobb.** Skriv i
> stil med en senior utvecklares råd: förstå logiken och arkitekturen innan
> syntaxen. Byggs på över tid, en genomgång per "vertikal" (en funktion som
> rör sig genom alla lager).

Varje avsnitt följer EN verklig händelse hela vägen genom systemet, lager
för lager, och förklarar vilket problem varje lager löser — inte bara vad
koden råkar göra.

---

## Genomgång 1: "Lägg till en källa" (Mina källor)

**Händelsen:** en inloggad användare klickar "+ Lägg till" på Trafikverket i
profilsidans "Mina källor". Vi följer den bokstavligen från knapptryck till
databas och tillbaka.

### Steg 0 — varför finns en front-/backend-uppdelning alls?

Innan vi ens går in i koden: appen är två helt separata program som pratar
med varandra bara via HTTP.

- **Frontend** (`frontend/`) körs i användarens webbläsare. Den vet ingenting
  den inte fått serverat eller hämtat via ett API-anrop. Den kan inte prata
  direkt med databasen — det vore en säkerhetskatastrof (vem som helst skulle
  kunna öppna DevTools och skriva rakt i databasen).
- **Backend** (`backend/`) är den enda parten som får prata med databasen.
  Den är en "grindvakt": allt som frontend vill läsa eller skriva måste gå
  via ett API-anrop som backend väljer att tillåta eller neka.

Det är hela anledningen till att en och samma funktion ("lägg till källa")
existerar som kod på **två ställen** — en frontend-del (vad användaren ser
och klickar på) och en backend-del (vad som faktiskt får hända med datan).

### Steg 1 — komponenten: `frontend/src/components/Profile/MinaKallor/index.tsx`

```tsx
function handleAdd(ids: number[]) {
  const uppdateringar: SourcePrefUpdate[] = ids.map(sourceId => ({
    sourceId, isActive: true, sortOrder: ...
  }))
  mutation.mutate(uppdateringar)
}
```

`index.tsx` är **orkestreraren** för hela "Mina källor"-sidan. Dess enda jobb
är: hålla reda på vilken data som behövs (`sources`, `prefs`), och koppla
ihop knapptryck (`handleAdd`, `handleRemove`) med en åtgärd. Den vet
**ingenting** om HTTP, tokens eller URL:er — det är medvetet. Om vi en dag
byter hur vi pratar med backend (REST → GraphQL, till exempel) ska den här
filen inte behöva ändras alls.

`mutation` kommer från **React Query** (`useMutation`) — ett bibliotek vars
enda jobb är att hantera "skicka data, vänta, visa laddningsläge, hantera
fel, uppdatera cache vid lyckat resultat". Det är därför ingen egen
`isLoading`/`try-catch`-kod syns i komponenten.

### Steg 2 — API-lagret: `frontend/src/api/userSources.ts`

```ts
export async function saveUserSources(updates: SourcePrefUpdate[]) {
  const res = await adminFetch('/api/user/sources', {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
  ...
}
```

Det här är **översättningslagret** mellan React och nätverket. Varje
backend-resurs (`sources.ts`, `userSources.ts`, `savedEvents.ts`, …) har sin
egen fil i `frontend/src/api/`. Poängen med att ha en egen fil per resurs:
om `/api/user/sources` byter form eller URL en dag, är det **exakt en fil**
som behöver ändras — ingen komponent känner till att den ändringen ens
skedde.

`adminFetch` (`frontend/src/api/adminFetch.ts`) är i sin tur den delen som
bifogar JWT-token (`Authorization: Bearer ...`) från `localStorage` på
**varje** anrop. Det är enda stället i frontend som vet att autentisering
existerar — komponenterna och de andra api-filerna bryr sig inte.

### Steg 3 — gränsen korsas: HTTP

Vid det här laget lämnar begäran webbläsaren som en vanlig HTTP PUT-request
mot `/api/user/sources`, med JSON-kroppen `[{sourceId: 5, isActive: true,
sortOrder: 2}, ...]` och headern `Authorization: Bearer <token>`.

**Viktigt att internalisera:** från och med här litar backend på **ingenting**
i request-kroppen om vem användaren är. Det enda backend litar på är vad som
står i den redan verifierade token. Det är kärnan i varför nästa steg ser ut
som det gör.

### Steg 4 — routing + grindvakt: `backend/Controllers/UserSourcesController.cs`

```csharp
[ApiController]
[Route("api/user/sources")]
[Authorize]
public class UserSourcesController : ControllerBase
{
    [HttpPut]
    public async Task<IActionResult> SaveSources([FromBody] List<SourcePrefRequest> items)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        ...
```

Tre saker händer innan en enda rad av vår egen logik körs:

1. **Routing** (`[Route("api/user/sources")]`) — ASP.NET Core läser URL:en
   och avgör att just den här klassen ska hantera begäran.
2. **`[Authorize]`** — en inbyggd "vakt" (middleware) som kontrollerar JWT-
   token *innan* `SaveSources`-metoden ens anropas. Ogiltig/saknad token →
   401, koden i metoden körs aldrig. Det är därför ingen manuell
   "är användaren inloggad"-kontroll syns i metoden.
3. **`[FromBody]`-bindning** — ASP.NET Core parsar JSON-kroppen till en lista
   av `SourcePrefRequest` automatiskt. Om JSON:en inte matchar formen
   (fel typer, saknade fält) avvisas requesten innan metoden nås.

Sedan: `User.FindFirstValue(ClaimTypes.NameIdentifier)` läser användarens id
**ur token**, inte ur något användaren skickat i JSON-kroppen. Det är den
säkerhetsprincip vi nämnde i steg 3 — annars skulle användare A kunna skicka
"spara detta som användare B:s inställningar".

### Steg 5 — datamodellen: `backend/Models/UserSourcePreference.cs`

```csharp
public class UserSourcePreference
{
    public Guid   Id        { get; set; } = Guid.NewGuid();
    public Guid   UserId    { get; set; }
    public int    SourceId  { get; set; }
    public bool   IsActive  { get; set; } = true;
    public int    SortOrder { get; set; }

    public User   User   { get; set; } = null!;
    public Source Source { get; set; } = null!;
}
```

Det här är precis det du frågade efter: filen som säger **"jag får inte ta
emot vilken data som helst"**. Den definierar formen en rad i databasen
*måste* ha: ett `UserId` (vems inställning är det), ett `SourceId` (vilken
källa), en `bool` för aktiv/inaktiv, en sorteringsordning. Om något
försökte spara en rad utan `UserId`, eller med text istället för ett tal i
`SourceId`, skulle C#-kompilatorn/EF Core stoppa det långt innan det når
databasen.

`User`- och `Source`-egenskaperna längst ner är **relationer** — de säger
"varje rad hör ihop med exakt en användare och exakt en källa", vilket är
samma sak som en foreign key i SQL-termer.

### Steg 6 — controllern gör sitt jobb (affärslogik)

Tillbaka i `UserSourcesController.SaveSources`:

1. Hämtar användarens **befintliga** rader ur databasen (`existing`).
2. Går igenom varje inskickad uppdatering: finns raden redan → uppdatera
   den; finns den inte → skapa en ny (`_db.UserSourcePreferences.Add(...)`).
3. Jämför gammalt vs nytt värde och skriver en rad i `UserSettingAuditLog`
   för varje faktisk ändring — **detta är ett medvetet arkitekturbeslut**
   (etablerat session 18): varje inställningsändring en användare gör ska
   gå att spåra i efterhand (när, vad, från–till), inte bara "senaste
   värdet vinner" utan historik.
4. `await _db.SaveChangesAsync()` — först här skrivs något faktiskt till
   databasen.

### Steg 7 — EF Core: `AppDbContext` (i `backend/Data/`)

`_db` i controllern är av typen `AppDbContext`. Det är **Entity Framework
Core** — ett bibliotek vars enda jobb är att översätta C#-objekt
(`UserSourcePreference`-instanser) till SQL och tillbaka. Controllern
skriver aldrig SQL för hand; den skriver `.Where(...)`, `.Add(...)`, EF Core
bygger SQL-satserna. Det är samma DbContext oavsett om databasen bakom är
SQLite (lokal utveckling) eller PostgreSQL (produktion, Railway) — det är
poängen med att ha ett ORM-lager: samma C#-kod fungerar mot båda, bara
konfigurationen i `Program.cs` skiljer.

### Steg 8 — svaret vandrar tillbaka

`return Ok()` → HTTP 200 → tillbaka genom `adminFetch` → `saveUserSources`
returnerar utan fel → React Querys `onSuccess`:

```tsx
const mutation = useMutation({
  mutationFn: saveUserSources,
  onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['user-sources'] }),
})
```

Notera vad som **inte** händer: komponenten uppdaterar inte UI:t optimistiskt
utifrån vad den *tror* hände. Den säger till React Query "den här datan är
nu ogiltig, hämta den på riktigt igen" (`invalidateQueries`), vilket
triggar en ny `GET /api/user/sources` och renderar UI:t utifrån vad som
**faktiskt** ligger i databasen. Det är samma "DB är enda sanningen"-princip
som återkommer i hela projektet.

### Hela kedjan, i en rad

```
Knapptryck (index.tsx)
  → mutation.mutate (React Query)
  → saveUserSources (api/userSources.ts)     ← översätter till HTTP
  → adminFetch                                ← bifogar JWT-token
  ──────────── nätverk ────────────
  → routing + [Authorize]                     ← ASP.NET Core-middleware
  → UserSourcesController.SaveSources         ← affärslogik, läser userId ur token
  → UserSourcePreference / AppDbContext       ← EF Core, C# ↔ SQL
  → databasen (SQLite lokalt / PostgreSQL i produktion)
  ──────────── nätverk tillbaka ────────────
  → 200 OK → invalidateQueries → ny GET → UI ritas om från riktig data
```

---

## Mappkarta (kort, hela poängen är att veta VARFÖR mappen finns)

### Frontend (`frontend/src/`)

| Mapp | Varför den finns |
|---|---|
| `pages/` | En fil per sida/route (`/login`, `/om`, `/profil` …). Bestämmer *vilken* sida, inte hur en enskild funktion fungerar. |
| `components/` | Återanvändbara byggklossar, grupperade per funktionsområde (`Profile/MinaKallor/`, `Admin/`, `Sidebar/`). Om en mapp har många filer beror det på att funktionen har flera delansvar (t.ex. `MinaKallor/` har separata filer för sökrad, filtermodal, varje korttyp). |
| `api/` | Se steg 2 ovan — en fil per backend-resurs, enda platsen som vet om HTTP existerar. |
| `context/` | Delat tillstånd som många olika komponenter behöver (t.ex. `AuthContext` — är man inloggad, som vilken roll) utan att skicka det som props genom tio nivåer. |
| `hooks/` | Återanvändbar *logik* (inte UI) som flera komponenter delar. |
| `lib/` | Fristående hjälpfunktioner utan React-beroende (t.ex. `featureFlags.ts`, `version.ts`). |
| `types/` | Delade TypeScript-typer, så frontend och backend är överens om datans form. |
| `services/` | Tunnare hjälpmoduler kring externa integrationer (t.ex. analytics). |

### Backend (`backend/`)

| Mapp | Varför den finns |
|---|---|
| `Controllers/` | Grindvakterna (steg 4 ovan) — en klass per URL-grupp (`/api/user/sources`, `/api/events`, …). Bestämmer *om* en begäran ens får nå affärslogiken. |
| `Models/` | Kontrakten (steg 5 ovan) — vad en rad i databasen *måste* se ut som. |
| `Data/` | `AppDbContext` — EF Core-kopplingen mellan C#-modellerna och den faktiska databasen (steg 7). |
| `Application/<domän>/` | "CA-light"-mönster (etablerat session 20, hittills bara för `Auth/`): ren affärslogik, frikopplad från HTTP *och* frikopplad från databas-detaljer — testbar utan varken webbserver eller riktig databas. |
| `Infrastructure/<domän>/` | Den konkreta implementationen `Application`-lagret bara beskriver abstrakt (t.ex. `JwtTokenService` — *hur* en JWT faktiskt signeras). |
| `Ingestors/` | En klass per myndighetskälla (Polisen, SMHI, Trafikverket …) vars enda jobb är "hämta rådata från en extern källa, omvandla till vårt gemensamma `CanonicalEvent`-format". |
| `Services/` | Bakgrundsjobb och tvärgående tjänster (`IngestorBackgroundService` kör alla ingestors periodiskt, `EventSync` gör själva spara/uppdatera-logiken, `ResendEmailService` skickar mejl). |
| `Migrations/` | EF Core:s historik över varje databasändring — hur man tar en tom databas till dagens skick, steg för steg, i ordning. |
| `Helpers/` | Små, fristående hjälpfunktioner utan naturlig hemmamapp (t.ex. metadata-fallbacks). |

**Observera:** de flesta backend-funktioner (t.ex. hela "Mina källor" ovan)
går rakt från `Controllers/` till `Data/` utan att passera
`Application/`/`Infrastructure/` — det mönstret finns hittills bara i
Auth-delen. Det är inte en bugg eller inkonsekvens, det är ett medvetet
"lägg bara till lager där komplexiteten faktiskt motiverar det"-beslut
(se `CLAUDE.md`, session 20: "CA-light", inte fullskalig Clean Architecture).

---

## Hur den här filen växer

Nästa genomgång bör ta en händelse som *inte* rör sig via `Controllers` →
`Data` rakt av, t.ex. en inloggning (`Application/Auth/` → `Infrastructure/Auth/`
→ JWT utfärdas → sparas i `localStorage` → `AuthContext` läser den vid varje
sidladdning), eller ett ingestor-flöde (`IngestorBackgroundService` → en
specifik `Ingestor` → `EventSync` → databasen, helt utan någon inloggad
användare inblandad).
