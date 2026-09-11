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

## Ny fråga 2026-09-12 — verifierad, inte ett hinder
Du misstänkte att Polisens artiklar försvinner efter ett tag, vilket skulle
göra en sparad händelses länk värdelös. **Testade det direkt (2026-09-12):**
hämtade två Polisen-artiklar från juni 2026 (tre månader gamla) live —
båda svarade 200 och innehöll fortfarande sin riktiga text. Bekräftar
alltså INTE att artiklar försvinner, åtminstone inte inom tre månader.

Full analys: [[../Ideer/Sparat-lankarnas-livslangd]]. Ingen anledning att
skrota eller bygga om Sparat baserat på det här — men flaggar det som en
öppen fråga där, ifall du har ett konkret exempel på en död länk du redan
stött på (då blir det värt att undersöka den specifika artikeltypen).
