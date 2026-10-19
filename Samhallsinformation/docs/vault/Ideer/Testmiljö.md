---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ej-bedomd  # giltiga värden: ja | nej | ej-bedomd
beroenden: ""
prioritet: ej-bedomd  # giltiga värden: hog | medel | lag | ej-bedomd
pipelineNr: ""
kalla: "session 2026-10-10, uppföljning av en fråga om feature-flaggars synlighet"
---

# Testmiljö

Idé: en skarp men osynlig vy av senaste versionen av sajten — kör mot
riktig kod (och troligen riktig backend), men syns bara för Admin, och i
framtiden eventuellt beta-testare. Aldrig för vanliga besökare, inloggade
användare eller support.

Väcktes av en fråga om vad en "simulerad produktionsvy" skulle ge utöver
dagens feature-flagg-system, som idag bara har två lägen: på för alla,
eller av för alla.

## Spontan tanke (din, 2026-10-10)
En spegel av den senaste versionen, där du sedan kan toggla vilken VY du
ser — besökare, inloggad användare, osv. — utan att det syns för någon
annan än dig.

## Varför det är intressant
- Testar mot riktig data och riktig trafik-timing, inte lokal testdata —
  fångar saker lokal utveckling/`dotnet run` missar.
- Om den byggs som en roll-styrd vy INUTI befintlig drift (inte en
  separat miljö): ingen ny infrastruktur att hålla i synk, bara en
  förlängning av flagg-systemet som redan finns — en synlighetsnivå till
  (t.ex. "endast Admin"/"beta"), inte bara på/av.
- Skulle ha löst ett konkret behov direkt: platsfiltrets nya UI
  ([[Geografiskt-platsfilter-besokare]]) ligger just nu bakom en
  helt avstängd flagga — ingen möjlighet att klicka runt i den mot skarp
  produktionsdata utan att slå på den för alla.

## Beslut 2026-10-10
- **Beta-testare = en roll.** En fjärde rollnivå (t.ex. `Beta`), likt
  dagens `Admin`/`Support`/`Användare` (`User.Role`,
  [[../Funktioner/Adminpanel-roller|Adminpanel-roller]]) — inte ett löst
  konto-attribut ovanpå `Användare`. Konsekvens: kräver en riktig
  utökning av rollmodellen (ny tillåten `Role`-sträng, nya
  `[Authorize(Roles=...)]`-kombinationer där testmiljön ska vara nåbar)
  när testmiljön faktiskt byggs — inte bara en flagga.

## Beslut 2026-10-19 — delad i två spår
Skillnaden mellan "en synlighetsnivå i flagg-systemet" och "en riktig
separat testmiljö" klargjordes (den förra löser bara redan-deployad-men-
dold kod, den senare kan förhandsgranska kod som inte ens är merged till
`main`). Beslutat: **bygg det billiga spåret nu, lämna det stora spåret
som en öppen idé** — inte avfärdad, bara inte prioriterad.

## Byggstatus — spår 1 (synlighetsnivå i flagg-systemet)
Byggt och mergat 2026-10-19 (PR väntar). Ny `EndastAdmin`-kolumn på
`FeatureFlagOverride` — en flagga kan nu vara "på men bara synlig för
Admin", inte bara på/av. `GET /api/feature-flags` räknar ut effektivt
värde per anropare (`User.IsInRole("Admin")`), ny
`PUT /api/admin/feature-flags/{key}/synlighet`, ny pill i
`FeatureFlagsAdmin.tsx` ("🔒 Endast Admin", bara synlig när flaggan är på).
En riktig schemalagd lansering (`FeatureFlagActivation.ActivateFlagsAsync`)
nollställer alltid `EndastAdmin` — en funktion som bara testats av Admin
kan aldrig tyst förbli dold vid en faktisk lansering. Löser det konkreta
behovet som startade idén: platsfiltret kan nu testas skarpt mot
produktionsdata utan att synas för besökare.

**Spår 2 (riktig separat testmiljö)** — inte påbörjad. Kräver fortfarande
en ny `Beta`-roll, ett eget inloggningsflöde och en driftskostnad (andra
miljö). Öppen idé, ingen brådska enligt beslutet ovan.

## Öppna frågor
- **"Spegel av senaste versionen" — vad är det tekniskt?** En helt
  separat deploy av samma kod (egen URL, t.ex. en Railway-miljö eller en
  Vercel preview-deploy pekad mot samma/en annan backend), eller en vy
  INUTI den befintliga sajten som bara syns för dig (roll-styrd, ingen
  separat installation)? Olika kostnad, olika grad av isolering.

-min tanke är att man ska kunna testa funktioner och annat så skarpt det bara går, utan att användare/besökare kan se det. Hur det blir bäst är jag inte säker på.

- **Samma databas som produktion, eller en separat?** Skarp data direkt
  är enklast att bygga men innebär att en bugg i testkod kan röra riktiga
  rader. En separat/synkad databas är säkrare men är i sig ett eget
  byggprojekt (klon/synk-mekanism) och data blir inte lika "levande".
-helst skarp MEN då måste vi komma ihåg att hålla det uppdaterat, om vi inte bara gör så att vi applicerar den senaste uppdateringen mot testmiljön när vi behöver använda miljön.
- **Vad är en "vy" rent konkret?** Byter den bara vilken ROLL UI:t
  RENDERAR som (en admin-only växlare ovanpå din riktiga inloggning —
  tekniskt releaterat till Impersonation, fast tvärtom: du spelar en roll
  nedåt, inte in i ett specifikt konto), eller en riktig separat
  inloggning/session per vy?
-förklara hur du menar. jag tänker att det blir som en riktig inloggningssession. för mig går jag bara in i miljön men för en betatestare så är tanken att de får ett mail med inloggningsuppgifter.
- **Hur hålls den i synk med "senaste versionen"?** Automatiskt vid
  varje deploy (kräver en pipeline-koppling), eller en manuell
  uppdatering?
-eventuellt blir det nog lättare med en manuell uppdatering.
- **Hur skiljer det sig från att bara bygga en synlighetsnivå i det
  befintliga flagg-systemet** (`FeatureFlagOverrides` får t.ex. "endast
  Admin"/"endast Beta"/"alla" istället för bara på/av), helt utan någon
  separat miljö? Kan vara hela svaret — eller otillräckligt om poängen
  är att se sajten som en riktig utloggad besökare ser den, vilket en
  inloggad admin-session inte kan simulera rakt av.
-jag hänger inte med alls vad du menar just nu.

## Kopplat
- [[Geografiskt-platsfilter-besokare]] — den konkreta anledningen till
  att frågan kom upp: väntar på ett lanseringsbeslut bakom en helt
  avstängd flagga, ingen väg att testa den mot skarp data utan att
  antingen köra lokalt eller slå på den för alla.
