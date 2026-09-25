# Code review av hela kodbasen — plan och status

Startad 2026-09-25 på `main` @ `1da5cf1`. Syfte: granska hela kodbasen i riskordning, dokumentera varje enhet så att samma del inte behöver granskas om senare (om inte koden ändrats sedan den angivna commit-SHA:n).

> **Granskningen är klar (enhet 1–8, 2026-09-25).** Åtgärdsplanen med alla 90 rangordnade fynd fördelade på 57 PR:ar i fyra vågor: [FIXPLAN.md](FIXPLAN.md).

## Principer
- Varje enhet körs som `/code-review <sökväg> <nivå>`. Ingen `--fix` under granskningen — fynd samlas först.
- Fynd sparas per enhet i `docs/code-review/enhet-N.md` med **granskad commit-SHA**. Ren dokumentation pushas direkt mot main.
- Bara bekräftade fynd går vidare. Fixar = en PR per funktion, aldrig staplat. EF-migrationer följer bool-raw-SQL-regeln.
- Efter granskningen: bekräftade fynd ingår i FIXPLAN.md (PR:ar per funktion). Ingen GitHub-issue-hantering — uppföljning och beslut ligger i Obsidian-valvet (`docs/vault/Verktyg/Code-review 2026-09-25.md`).
- Stoppvillkor: efter enhet 1–2 bedöms utfallet. Lågt utfall → sänk nivå på resten / hoppa över enhet 7.

## Enheter (riskordning)

| # | Enhet | Omfång | Nivå | Status | Granskad SHA |
|---|---|---|---|---|---|
| 1 | Auth, säkerhet, publik yta | `AuthController`, `WebhooksController`, `PushController`, `Admin*`-behörighet, impersonation, publika endpoints (`EventsController` search-public, `FaqController`), auth/CORS/rate limiting i `Program.cs` | high | klar — 10 rangordnade fynd + övriga observationer, se [enhet-1.md](enhet-1.md) | `2c278d3` |
| 2 | Program.cs, Data, Models | seed, raw-SQL-block, migrationslogik, modell↔block | medium | klar — 8 rangordnade fynd, modell↔block-kontrollen ren, se [enhet-2.md](enhet-2.md) | `7e8f05b` |
| 3 | Ingestors + Services | ~1 900 rader | medium | klar — 13 rangordnade fynd (8 bekräftade, 5 plausibla) + ~20 mindre, se [enhet-3.md](enhet-3.md) | `4e33c06` |
| 4 | Övriga Controllers | ~3 000 rader | medium | klar — 12 rangordnade fynd (alla bekräftade), se [enhet-4.md](enhet-4.md) | `4e33c06` |
| 5 | Frontend-kärnan | `api/`, `context/`, `hooks/`, `lib/` | medium | klar — 14 rangordnade fynd (11 bekräftade, 3 plausibla) + ~30 mindre, se [enhet-5.md](enhet-5.md) | `a48685a` |
| 6 | Frontend Admin | `components/Admin/` (~8 250 rader, 18 filer) | medium | klar — 22 rangordnade fynd (alla bekräftade) + ~20 mindre, se [enhet-6.md](enhet-6.md) | `a48685a` |
| 7 | Frontend övrigt | `components/` (ej Admin) + `pages/` | low–medium | klar — 11 rangordnade fynd (9 bekräftade, 2 plausibla) + ~15 mindre, se [enhet-7.md](enhet-7.md) | `3bd097c` |
| 8 | Testlucka | vad saknar tester (jämförelse, ingen review) | – | klar — 157/157 gröna, 32 % täckning av handskriven logik, alla tester blinda för PostgreSQL-felklassen, se [enhet-8.md](enhet-8.md) | `3bd097c` |

## Körsätt
- Enhet 1–2: huvudsessionen. Enhet 3–4: ClaudeBE (subagent). Enhet 5–7: ClaudeFE (subagent). Subagenter skriver fynd till fil, inte tillbaka i chatten.

## Uppskattad kostnad
Enhet 1 ≈ 300–400k tokens, 2–5 ≈ 150–250k var, 6 ≈ 250k, 7 ≈ 300k, 8 ≈ 30k. Totalt ~1,5–2M.
