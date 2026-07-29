# Mina källor — borttagna funktioner (session 25)

Detta dokument finns för att fullständigt bevara hur tre funktioner i "Mina källor" var tänkta att fungera, innan de togs bort i samband med att käll-listan kopplades mot den riktiga backend-datan (`GET/PUT /api/user/sources`). Alla tre byggde på fält eller data som inte finns i den riktiga `Source`-modellen — de togs bort istället för att döljas bakom en flagga, eftersom det inte finns någon verklig data att koppla dem mot idag.

**Om någon av de här ska byggas tillbaka:** koden nedan (och den fulla historiken) finns kvar i git — sök på filnamnen som anges under respektive rubrik i commit-historiken före denna borttagning. Det här dokumentet är en snabb funktionsbeskrivning, inte källkoden i sig.

---

## 1. SPAR-adressförslag ("Automatisk hämtning")

**Vad det gjorde:** Automatiskt föreslå vilka källor en användare borde följa, baserat på deras folkbokföringsadress hämtad från SPAR (Statens personadressregister).

**Var i UI:t:** Övre delen av "Lägg till källa"-kortet, ovanför den manuella sökningen, separerade med en "eller"-avdelare.

**Filer som berördes:**
- `components/Profile/MinaKallor/LaggTillKort.tsx` — själva knapparna/logiken
- `components/Profile/MinaKallor/SparModal.tsx` — bekräftelsemodalen
- `components/Profile/MinaKallor/kallorUtils.ts` — `SPAR_FORSLAG`-konstanten (mockdata)
- `types.ts` — `SparFilter`-typen (`'Allt' | 'Regionalt' | 'Nationellt'`)
- (Utanför MinaKallor-mappen) `SparSamtycke.tsx` i Konto-sektionen — samtyckes-toggeln, helt mockad redan innan denna borttagning, hårdkodad adress "Storgatan 1, Stockholm (mock)"

**Hur det fungerade (mockat):**
1. Ett samtyckesflagga i `localStorage` (`spar_samtycke`, satt av `SparSamtycke.tsx` i Konto) styrde om SPAR-knapparna alls visades.
2. **Om inte aktiverat:** ett meddelande "Aktivera SPAR-hämtning under Konto för att automatiskt hämta källor baserat på din folkbokföringsadress" + knapp "Gå till Konto →" (navigerade till `?section=konto`).
3. **Om aktiverat:** tre knappar — "Allt", "Nationellt", "Regionalt". Klick på en:
   - Visade en spinner + "Hämtar..." i 1200 ms (simulerad nätverksfördröjning).
   - Slog upp ett hårdkodat facit (`SPAR_FORSLAG[filter]`, en lista med källID:n per filter) och filtrerade bort redan aktiva källor.
   - Om inga träffar: visade ett filterspecifikt felmeddelande ("Inga nya regionala källor hittades." osv).
   - Om träffar: öppnade `SparModal` — en modal med kryssrutor per föreslagen källa, grupperade Nationella/Regionala, alla förbockade från start. Knapp "Lägg till (N)" (disabled om inget markerat) lade till de valda källorna; "Avbryt" stängde modalen utan att göra något.

**Varför det inte kan kopplas mot riktig data:** Kräver en riktig integration mot SPAR (statens adressregister), vilket i sin tur kräver personnummer + BankID-verifiering av användaren — ingen av delarna finns i appen (redan konstaterat i session 24). Det är alltså inte bara en fråga om att byta ut mockdata mot en riktig endpoint, utan en helt egen, större integration.

---

## 2. "Nya"-fliken i "Alla källor"

**Vad det gjorde:** En flik i "Alla källor"-kortet som bara visade källor som lagts till i systemet de senaste 30 dagarna.

**Var i UI:t:** En av flikarna i `AllaKallorKort.tsx` (`Alla | Nya | Nationell | Regional | Kommunal`), med antal-badge under fliknamnet precis som de andra flikarna.

**Filer som berördes:**
- `components/Profile/MinaKallor/AllaKallorKort.tsx` — flikvalet och filtreringen
- `components/Profile/MinaKallor/kallorUtils.ts` — `arNy()`-hjälpfunktionen och `NY_GRANS_DAGAR = 30`
- `types.ts` — `AllaFlik`-typen (`RekFlik | 'Nya'`)

**Hur det fungerade (mockat):**
```ts
export const NY_GRANS_DAGAR = 30

export function arNy(k: Kalla): boolean {
  return (Date.now() - new Date(k.tillagdISystem).getTime()) / 86_400_000 < NY_GRANS_DAGAR
}
```
Varje mock-källa hade ett `tillagdISystem`-datum (t.ex. `'2025-06-01'` eller `'2026-03-15'`). Fliken filtrerade helt enkelt på detta datum.

**Varför det inte kan kopplas mot riktig data:** Den riktiga `Source`-modellen (backend) har inget datumfält för "när källan lades till i systemet" — bara `LastFetchedAt` (senaste ingestor-körning, inte skapelsedatum) och `LastFetchError`. Om funktionen ska byggas på riktigt krävs ett nytt `CreatedAt`-fält på `Source`-modellen (enkel migration, men inte gjord).

---

## 3. "Planerat underhåll"-varning på källor (deprecated-fältet)

**Vad det gjorde:** Visade en varningslänk direkt på en aktiv källa i "Aktiva källor"-kortet om källan var markerad som "deprecated" (t.ex. inför en förestående ersättning eller nedstängning), som länkade vidare till och highlightade motsvarande rad i Systemstatus-vyn.

**Var i UI:t:** Under källans namn i `AktivaKallorKort.tsx`, en liten gul länk "⚠️ Planerat underhåll — se systemstatus".

**Filer som berördes:**
- `components/Profile/MinaKallor/AktivaKallorKort.tsx` — `KallaRad`-komponenten, `gaTillSystemstatus()`-funktionen
- `components/Profile/Support/SystemstatusKort.tsx` — mottagarsidan (denna påverkas INTE av borttagningen, highlight-mekanismen `location.state?.highlightNamn` finns kvar och används fortfarande av Systemstatus-sidan för andra highlight-syften — bara MinaKallor-sidan av länken togs bort)
- `types.ts` — `Kalla.deprecated`/`Kalla.deprecatedAnledning`-fälten

**Hur det fungerade (mockat):**
```ts
function gaTillSystemstatus() {
  navigate('?section=support', { state: { highlightNamn: k.deprecatedAnledning } })
}
// ...
{k.deprecated && (
  <button onClick={gaTillSystemstatus} className="...">
    ⚠️ Planerat underhåll — se systemstatus
  </button>
)}
```
Två mock-källor hade `deprecated: true` + en `deprecatedAnledning`-sträng (t.ex. `'Länsstyrelsen Västra Götaland'`, `'MSB'`) som matchade namnet på en rad i `SystemstatusKort.tsx`. Klick navigerade dit och `SystemstatusKort` scrollade till och highlightade (samma `card-highlight`-mönster som används på flera andra ställen i appen, t.ex. `MinaKallor/index.tsx`s egen `highlightId`) den matchande raden i 4,2 sekunder.

**Varför det inte kan kopplas mot riktig data:** Den riktiga `Source`-modellen har `IsActive`/`IsPublished`/`LastFetchError`, men inget fält för "planerat, framtida underhåll med en orsak/länk till en specifik systemstatusrad". `LastFetchError` betyder att något redan gått sönder — inte samma semantik som ett planerat, kommande avbrott man vill förvarna om. Skulle kräva ett nytt fält (t.ex. `PlannedMaintenanceNote`) på `Source`-modellen, eller en helt egen liten tabell för schemalagda avbrott, kopplad till Systemstatus-sidans (delvis redan mockade, se `Tjanst`/`Subkalla`/`PlaneratUnderhall`-typerna i `types.ts`) datamodell.

---

## Sammanfattning — vad krävs för att bygga tillbaka

| Funktion | Krävs för att bli verklig |
|---|---|
| SPAR-adressförslag | Riktig SPAR-integration + BankID/personnummer-verifiering |
| "Nya"-fliken | Nytt `CreatedAt`-fält på `Source` (enkel migration) |
| Planerat underhåll-varning | Nytt fält/tabell för schemalagda avbrott, kopplat till Systemstatus |

Alla tre är kandidater för egna, separata uppgifter — ingen av dem hänger ihop med varandra eller med resten av Mina källor-omkopplingen.
