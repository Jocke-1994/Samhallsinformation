---
typ: beslut
status: öppen
datum: 2026-08-03
---

# Beslut - Lansering av Push-notiser

Push-notiser är verifierade end-to-end i produktion (grundpushen PR
#392-395, konsoliderad PR #464) — inget tekniskt kvar. Väntar enbart på ett
produktbeslut om lansering.

## Påverkar
- [[Push-notiser]]

## Öppna frågor — besvarade
- **Beroende till [[Beslut - Lansering av Sparat]]?** Nej, lanseras inte
  samtidigt. Push bör lanseras snarast efter kontoskapande — eller redan
  innan, dvs. testa i mer skarpt läge.
- **Vilka kategorier PÅ som standard?** Ny händelse. Inte Ny version.
- **Oro kring notisvolym?** Nej — Polisen-bevakningar bedöms tillräcklig
  gating, klart mest aktiva källan idag.

## Kvarstående
Bara launch-mekaniken/timingen kvar (direkt efter registrering, eller testa
skarpt först) — inget produktbeslut blockerar längre i sak. Värt att
notera: [[Beslut - Polisen-bevakningar egna tester]] avslöjade att push för
just Polisen-bevakningar inte levererades under test — bör klaras upp
innan Push-notiser lanseras brett, eftersom Polisen är tänkt att bära mycket
av notisvolymen.

## Timing — besvarat 2026-09-12
Skickas ut en tid efter att appen fått en del riktiga användare, inte i
samband med själva lanseringen av login/register. Inget exakt datum eller
användarantal satt.
