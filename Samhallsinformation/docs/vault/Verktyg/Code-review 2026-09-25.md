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

## Läge (uppdaterad 2026-09-28)
- Granskning: **klar** (enhet 1–8)
- Åtgärder: **57 av 60 utfärdade PR:ar mergade** (#598–#657, verifierat med `git log --merges`). Alla fyra vågor genomförda eller uttryckligen parkerade.
- **Kvar:** två PR:ar väntar på ditt beslut (#605 migreringsskydd, #643 avsändarautentisering — se `FIXPLAN.md`). V3-23 (start mot tom PostgreSQL) är medvetet inte påbörjad men har nu ett facit-test som bevisar buggen — ingen akut risk, produktionen är inte tom.
- Sök-funktionen kan byggas nu — vågorna den väntade på är klara.

## Beslut (2026-09-25, alla genomförda utom två)
- Support-rollen får Support-inbox (Användarlistan skrivskyddad) — ✅ byggt (V3-10)
- Mitt flöde filtreras på servern — ✅ byggt och verifierat live (V3-11)
- Mock-UI: märk MOCK i admin, ta bort/dölj medborgarmock — ✅ byggt (V3-20), ingen mock-flagga var på som default
- E-post normaliseras till gemener; migreringen avbryter och loggar vid dubbletter — ✅ byggt (V2-11)
- Token-lagring: alt A nu, alt B senare, **alt C parkerat** → [[Beslut - Alt C refresh-token i cookie]] — ✅ alt B byggt (V3-22), villkor 2 bevakas nu automatiskt

## Kopplat
- [[Beslut - Alt C refresh-token i cookie]]
- [[Checklista-innan-lansering]]
