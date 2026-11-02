---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ej-bedomd  # giltiga värden: ja | nej | ej-bedomd
beroenden: "Vad är nytt-rutan (PR #706) bör vara mergad först, annars finns en av de fyra flikarna inte."
prioritet: ej-bedomd  # giltiga värden: hog | medel | lag | ej-bedomd
pipelineNr: ""
kalla: "din idé 2026-11-02, efter att Vad är nytt byggts"
---

# Live-förhandsvisning i Uppdateringar

När du fyller i en ny uppdatering i adminpanelen visas en ruta bredvid
formuläret som **direkt** visar hur det kommer att se ut för besökarna,
uppdaterad för varje bokstav du skriver. Som förhandsvisningen när man
skriver ett LinkedIn-inlägg.

## Varför
En enda uppdatering kan i dag synas på upp till fyra ställen, och inget
av dem syns medan man fyller i:

| Flik | Visas när | Styrs av |
|---|---|---|
| **Nyheter-sidan** | Alltid | Titel, datum, punkterna |
| **Vad är nytt** | "Visa som Vad är nytt" ikryssad | Samma innehåll, i rutans format |
| **Banderoll** | "Visa banderoll på sajten" ikryssad | Titel + målgrupp (härleds från punkternas "Syns för") |
| **Push** | "Skicka push till inloggade" ikryssad | Version + meddelande |

Dessutom ser olika personer olika saker: en besökare ser bara punkter
märkta "Alla", en inloggad ser även "Endast inloggade". Och under
annonsering i förväg visas först "Kommer snart" och sedan det riktiga
innehållet. Allt det får man i dag hålla i huvudet.

## Förslag (skissat 2026-11-02)
- Flikar ovanför förhandsvisningen. En flik syns bara om dess kryssruta är ikryssad
  (Nyheter-sidan syns alltid).
- Reglaget **Visa som: Besökare / Inloggad**.
- Är annonsering i förväg vald: reglaget **Fas: Annonsering / Lansering**.
- Formulärpanelen blir bredare på dator för att få plats med förhandsvisningen.
- Skiss med mockdata: https://claude.ai/artifact/HsiBRTQ65NDnMvVhqepDES

## Öppna frågor
- Ska förhandsvisningen alltid synas, eller bara när man klickar "Förhandsgranska"?
- På mobil: en knapp "Förhandsgranska" som byter vy, eller inte alls på mobil?
- Räcker de fyra flikarna, eller saknas något ställe där en uppdatering syns?

## Kopplat
- [[Vad ar nytt-modal]]
- [[Uppdateringar-schemalagd-publicering]]
- [[Uppdateringar-kalendervy]]
