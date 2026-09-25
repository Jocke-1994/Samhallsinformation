# Code review av hela kodbasen — plan och status

Startad 2026-09-25 på `main` @ `1da5cf1`. Syfte: granska hela kodbasen i riskordning, dokumentera varje enhet så att samma del inte behöver granskas om senare (om inte koden ändrats sedan den angivna commit-SHA:n).

## Principer
- Varje enhet körs som `/code-review <sökväg> <nivå>`. Ingen `--fix` under granskningen — fynd samlas först.
- Fynd sparas per enhet i `docs/code-review/enhet-N.md` med **granskad commit-SHA**. Ren dokumentation pushas direkt mot main.
- Bara bekräftade fynd går vidare. Fixar = en PR per funktion, aldrig staplat. EF-migrationer följer bool-raw-SQL-regeln.
- Efter granskningen: bekräftade fynd → GitHub-issues grupperade per funktion med allvarlighetsgrad.
- Stoppvillkor: efter enhet 1–2 bedöms utfallet. Lågt utfall → sänk nivå på resten / hoppa över enhet 7.

## Enheter (riskordning)

| # | Enhet | Omfång | Nivå | Status | Granskad SHA |
|---|---|---|---|---|---|
| 1 | Auth, säkerhet, publik yta | `AuthController`, `WebhooksController`, `PushController`, `Admin*`-behörighet, impersonation, publika endpoints (`EventsController` search-public, `FaqController`), auth/CORS/rate limiting i `Program.cs` | high | klar — 10 rangordnade fynd + övriga observationer, se [enhet-1.md](enhet-1.md) | `2c278d3` |
| 2 | Program.cs, Data, Models | seed, raw-SQL-block, migrationslogik, modell↔block | medium | ej påbörjad | |
| 3 | Ingestors + Services | ~1 900 rader | medium | ej påbörjad | |
| 4 | Övriga Controllers | ~3 000 rader | medium | ej påbörjad | |
| 5 | Frontend-kärnan | `api/`, `context/`, `hooks/`, `lib/` | medium | ej påbörjad | |
| 6 | Frontend Admin | `components/Admin/` (~6 000 rader) | medium | ej påbörjad | |
| 7 | Frontend övrigt | `components/` (ej Admin) + `pages/` | low–medium | ej påbörjad | |
| 8 | Testlucka | vad saknar tester (jämförelse, ingen review) | – | ej påbörjad | |

## Körsätt
- Enhet 1–2: huvudsessionen. Enhet 3–4: ClaudeBE (subagent). Enhet 5–7: ClaudeFE (subagent). Subagenter skriver fynd till fil, inte tillbaka i chatten.

## Uppskattad kostnad
Enhet 1 ≈ 300–400k tokens, 2–5 ≈ 150–250k var, 6 ≈ 250k, 7 ≈ 300k, 8 ≈ 30k. Totalt ~1,5–2M.
