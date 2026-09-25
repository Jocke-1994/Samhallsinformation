---
typ: granskning
status: pagaende  # giltiga värden: att-gora | pagaende | klart
---

# Code review 2026-09-25

Full granskning av hela kodbasen i 8 enheter (backend, frontend, admin, testlucka),
gjord på användarens begäran innan Sök-funktionen byggs. **90 rangordnade fynd**,
fördelade på **57 PR:ar i fyra vågor**. Facit och all detalj ligger i repot, inte här
— den här noten är bara ingången.

## Var allt finns
- `Samhallsinformation/docs/code-review/PLAN.md` — planen och status per enhet (med granskad commit-SHA)
- `docs/code-review/enhet-1.md … enhet-8.md` — fynden per enhet
- `docs/code-review/FIXPLAN.md` — åtgärdsplanen: vågor, PR:ar, beslut D1–D6, beroenden, övervakningsdesign

## Läge
- Granskning: **klar** (enhet 1–8)
- Åtgärder: **våg 1 pågår** (testfundament först: V1-0a backend, V1-0b frontend)
- Sök-funktionen väntar tills våg 1 (gärna våg 2) är klar

## Beslut (2026-09-25)
- Support-rollen får Support-inbox (Användarlistan skrivskyddad)
- Mitt flöde filtreras på servern
- Mock-UI: märk MOCK i admin, ta bort/dölj medborgarmock
- E-post normaliseras till gemener; migreringen avbryter och loggar vid dubbletter
- Token-lagring: alt A nu, alt B senare, **alt C parkerat** → [[Beslut - Alt C refresh-token i cookie]]

## Kopplat
- [[Beslut - Alt C refresh-token i cookie]]
- [[Checklista-innan-lansering]]
