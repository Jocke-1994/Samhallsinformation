---
typ: beslut
status: stängd
datum: 2026-09-12
---

# Beslut - SPAR avfärdat

SPAR-integrationen (#46, #55) byggs inte. Adress/ort-baserad källsökning
via SPAR revs aktivt bort ur onboardingen redan session 24/25 — de här två
issuen låg kvar öppna som ett spöke från den idén utan en formell stängning.

## Varför
SPAR kostar pengar per uppslag, och det finns idag ingen bestämd
intäktsmodell för appen (se [[Beslut - Monetisering]]). Utan en modell går
den löpande kostnaden inte att motivera — inte en teknisk begränsning,
ett ekonomiskt beslut.

## Påverkar
- #46 (SPAR-integration — hämta adress/ort via personnummer) — stängd
- #55 (Samtycke vid SPAR-datahämtning) — stängd, beror på #46
- Ingen kod att riva — SPAR fanns bara som mockdata i onboardingen, redan
  borttagen (se `docs/MINA_KALLOR_BORTTAGNA_FUNKTIONER.md`)

## Om det tas upp igen
Skulle en intäktsmodell faktiskt finnas på plats någon gång är SPAR inte
avfärdat av tekniska skäl — bara av kostnadsskäl kopplat till avsaknaden av
intäkter idag.
