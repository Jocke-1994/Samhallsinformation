---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ej-bedomd
beroenden: "Ingen — rotorsaken är bekräftad (Polisen byter URL vid kategoriuppdatering, ingestorn dedupar fel). Redo att scopas som en riktig bugg."
prioritet: ej-bedomd
pipelineNr: ""
kalla: "Beslut - Lansering av Sparat.md, fråga 2026-09-12"
---

# Sparat — lever länkarna kvar tillräckligt länge?

Fråga från dig: Sparat länkar bara till Polisens artikel, lagrar ingen
egen kopia av texten. Om Polisen tar bort artiklar efter ett tag blir en
sparad händelse värdelös — man kan spara nu, komma tillbaka senare, och
mötas av en död länk. Tre alternativ du föreslog: skrota Sparat, lagra
hela artikeltexten vid sparningstillfället, eller hantera det på annat
sätt.

## Verifiering 2026-09-12, runda 1 (stickprov, för tidig slutsats)
Testade premissen med två slumpmässiga Polisen-artiklar från juni 2026
(~3 månader gamla) — båda svarade 200, text intakt. Drog då slutsatsen
att artiklar inte försvinner generellt. **Den slutsatsen höll inte** — se
runda 2, som hittade den faktiska mekanismen tack vare ett konkret
exempel från dig.

## Verifiering 2026-09-12, runda 2 — rotorsaken hittad
Du sparade "21 augusti 14.06, Övrigt, Fagersta" på ditt konto och fick en
död länk. Grävde i skarp produktionsdata (`GET /api/events`) och hittade
den verkliga mekanismen:

**Polisen byter URL på en händelse när de uppdaterar dess kategori** —
URL:en innehåller kategorinamnet (`.../21-augusti-14.06-ovrigt-fagersta/`
→ `.../21-augusti-14.06-morddrap-fagersta/` när "Övrigt" uppgraderades
till "Mord/dråp" efter vidare utredning, synligt i titeln som "Uppdaterad
2026-08-26 11:38:26 ..."). Bekräftat live:
- Gamla URL:en (`ovrigt-fagersta`) → **HTTP 404**
- Nya URL:en (`morddrap-fagersta`) → **HTTP 200**, artikeln lever, bara på
  en annan adress

**Sidoeffekt, en till bugg:** eftersom ingestorn dedupar på URL
(`ExternalId`), räknas den nya URL:en som en HELT NY händelse — samma
verkliga händelse ligger nu som TVÅ separata rader i databasen (samma
`publishedAt`, samma `content` "Larm från skola.", olika `id`/`title`).
Den som sparade den gamla raden (du) sitter kvar med den döda länken för
alltid — det finns ingen koppling i datamodellen mellan de två raderna.

**Det här är alltså INTE "artiklar försvinner efter ett tag"** — det är
"Polisen döper om en artikel när kategorin uppdateras, och vår ingestor
känner inte igen den nya URL:en som samma händelse."

## Redan existerande delvis skydd
`GET /api/events/{id}/link-status` (PR #513, session 42) kollar redan om
en sparad händelses länk är död INNAN den öppnas, och visar en varning
istället för att skicka användaren till en trasig sida. Om en länk
faktiskt dör någon gång är användaren alltså redan skyddad från en tyst,
förvirrande 404 — de får bara inte tillbaka den förlorade texten.

## Rekommendation (uppdaterad efter runda 2)
Det här är en riktig, avgränsad bugg — inte ett argument för att skrota
Sparat eller bygga full-textlagring i förväg. Två separata saker att fixa,
när det är läge (inte i natt):

1. **Duplicerings-buggen (rotorsaken):** `PolisenRssIngestor`/
   `EventSync.SyncAsync` behöver känna igen att en ny URL med samma
   `publishedAt`+`content`+geografi är EN UPPDATERING av en befintlig
   händelse, inte en ny händelse — annars fortsätter samma sak hända för
   varje händelse Polisen omkategoriserar
2. **Redan-sparade händelser med en nu-död länk** — `link-status`-
   kollen (PR #513) varnar redan innan man öppnar en död länk, vilket
   fungerade som tänkt i din skärmdump ("Sidan finns inte längre... öppna
   ändå"). Frågan är om vi ska försöka HITTA den nya URL:en automatiskt
   (matcha på publishedAt+content mot andra Polisen-rader) istället för
   att bara varna, eller om varningen räcker

Ingen brådska ikväll — bra att ha nedskrivet till nästa gång du är vid
datorn.

## Öppna frågor
- Vill du att den döda länk-varningen ska försöka HITTA rätt nya URL
  automatiskt (matcha på tid+innehåll), eller räcker det att bara varna
  som idag?
- Ska duplicerings-fixet (ingestor-sidan) prioriteras för sig, oberoende
  av vad som händer med redan sparade händelser?

## Kopplat
- [[../Beslut/Beslut - Lansering av Sparat]]
- [[../Funktioner/GDPR-verktyg]] (samma "länk kan dö"-mekanism används inte
  här, men `link-status`-endpointen är delad kod)
