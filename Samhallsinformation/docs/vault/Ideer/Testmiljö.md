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

## Öppna frågor
- **"Spegel av senaste versionen" — vad är det tekniskt?** En helt
  separat deploy av samma kod (egen URL, t.ex. en Railway-miljö eller en
  Vercel preview-deploy pekad mot samma/en annan backend), eller en vy
  INUTI den befintliga sajten som bara syns för dig (roll-styrd, ingen
  separat installation)? Olika kostnad, olika grad av isolering.
- **Samma databas som produktion, eller en separat?** Skarp data direkt
  är enklast att bygga men innebär att en bugg i testkod kan röra riktiga
  rader. En separat/synkad databas är säkrare men är i sig ett eget
  byggprojekt (klon/synk-mekanism) och data blir inte lika "levande".
- **Vad är en "vy" rent konkret?** Byter den bara vilken ROLL UI:t
  RENDERAR som (en admin-only växlare ovanpå din riktiga inloggning —
  tekniskt releaterat till Impersonation, fast tvärtom: du spelar en roll
  nedåt, inte in i ett specifikt konto), eller en riktig separat
  inloggning/session per vy?
- **Hur hålls den i synk med "senaste versionen"?** Automatiskt vid
  varje deploy (kräver en pipeline-koppling), eller en manuell
  uppdatering?
- **Vem är beta-testare i framtiden, och hur bjuds de in?** En ny roll
  (`Beta`, utöver dagens `Admin`/`Support`/`User`), eller ett
  konto-attribut som ger extra flagg-synlighet utan en helt ny roll?
- **Hur skiljer det sig från att bara bygga en synlighetsnivå i det
  befintliga flagg-systemet** (`FeatureFlagOverrides` får t.ex. "endast
  Admin"/"endast Beta"/"alla" istället för bara på/av), helt utan någon
  separat miljö? Kan vara hela svaret — eller otillräckligt om poängen
  är att se sajten som en riktig utloggad besökare ser den, vilket en
  inloggad admin-session inte kan simulera rakt av.

## Kopplat
- [[Geografiskt-platsfilter-besokare]] — den konkreta anledningen till
  att frågan kom upp: väntar på ett lanseringsbeslut bakom en helt
  avstängd flagga, ingen väg att testa den mot skarp data utan att
  antingen köra lokalt eller slå på den för alla.
