---
typ: beslut
status: öppen
datum: 2026-08-04
---

# Beslut - Lansering av Sparat

Sparat är fullt byggd (PR #380/384/385, migrerad till riktig backend PR
#472) men vilar medvetet "för en framtida funktionslansering" — inget
uttalat datum eller villkor satt än.

## Påverkar
- [[Sparat]]

## Öppna frågor — besvarade
- **Beroende till [[Beslut - Lansering av Push-notiser]]?** Nej, lanseras
  var för sig.
- **Är UI:t fortfarande godkänt?** I grunden ja, men vill se över det en
  gång till innan lansering ("måste se bra ut").
- **Finns ett datum/villkor?** Obestämt just nu, men kommer behöva
  bestämmas vid något tillfälle.

## Kvarstående
Bara timing — inget uttalat datum, ingen blockering kvar utöver en
UI-översyn.

## Ny fråga 2026-09-12 — riktig bugg hittad, inte "artiklar försvinner"
Du misstänkte att Polisens artiklar försvinner efter ett tag. Ett första
stickprov (två slumpade artiklar) motsade det — men du hittade sedan ett
konkret eget exempel (en sparad händelse från 21 augusti, död länk), och
det ledde till den faktiska rotorsaken: **Polisen byter URL på en
händelse när kategorin uppdateras** (t.ex. "Övrigt" → "Mord/dråp" efter
vidare utredning), och vår ingestor känner inte igen den nya URL:en som
samma händelse — skapar en duplicerad rad istället för att uppdatera den
befintliga. Den gamla länken dör då på riktigt, permanent, för den som
sparat den.

Full analys + rekommendation: [[../Ideer/Sparat-lankarnas-livslangd]].
Ingen brådska att fixa i natt, men en riktig, avgränsad bugg att ta med
nästa gång ni jobbar med Polisen-ingestorn — inte ett argument för att
skrota Sparat.
