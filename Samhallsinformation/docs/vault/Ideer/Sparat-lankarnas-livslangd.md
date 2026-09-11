---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ej-bedomd
beroenden: "Beror på om Polisen faktiskt tar bort artiklar över tid — inte bekräftat än, se verifiering nedan"
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

## Verifiering 2026-09-12 (innan något beslutas)
Testade premissen direkt istället för att anta den. Hämtade två riktiga
Polisen-artiklar från juni 2026 (då ~3 månader gamla) direkt från
`polisen.se`:
- `2026/juni/9/09-juni-10.15-stoldinbrott-ockelbo/` — HTTP 200, texten
  ("Fyrhjuling stulen... Ockelbo") fanns kvar
- `2026/juni/9/10-juni-07.30-information-orebro-lan/` — HTTP 200, samma sak

**Bekräftar INTE att artiklar försvinner** — åtminstone inte inom tre
månader, för dessa två stickprov. Det utesluter inte att NÅGRA artiklar
tas bort (t.ex. en känslig utredning, eller ett rättelsekrav), bara att
det inte är ett generellt, garanterat mönster som drabbar alla sparade
händelser inom en rimlig tidshorisont.

## Redan existerande delvis skydd
`GET /api/events/{id}/link-status` (PR #513, session 42) kollar redan om
en sparad händelses länk är död INNAN den öppnas, och visar en varning
istället för att skicka användaren till en trasig sida. Om en länk
faktiskt dör någon gång är användaren alltså redan skyddad från en tyst,
förvirrande 404 — de får bara inte tillbaka den förlorade texten.

## Rekommendation
Bygg inget nytt just nu — varken skrota Sparat eller lagra full artikeltext
i förväg, baserat på en overifierad premiss. Om du stöter på en KONKRET
död länk i praktiken (en riktig sparad händelse vars artikel faktiskt är
borta): spara URL:en och ta upp det då — då går det att undersöka om det
är en specifik artikeltyp (t.ex. färska efterlysningar som löses och tas
bort) snarare än en generell regel, och avgöra om full-textlagring
verkligen behövs eller om länk-status-varningen redan räcker.

## Öppna frågor
- Har du ett konkret exempel på en sparad händelse vars länk faktiskt gått
  död? Skulle vara det snabbaste sättet att gå vidare med det här.

## Kopplat
- [[../Beslut/Beslut - Lansering av Sparat]]
- [[../Funktioner/GDPR-verktyg]] (samma "länk kan dö"-mekanism används inte
  här, men `link-status`-endpointen är delad kod)
