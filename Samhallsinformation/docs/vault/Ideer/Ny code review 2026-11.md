---
status: idé
skapad: 2026-11-14
---

# Ny code review (efter FIXPLAN)

Den förra helgenomgången gjordes i session 50 (2026-09-25, `docs/code-review/FIXPLAN.md`).
Sedan dess har mycket ny kod tillkommit: platsfiltret, schemalagd lansering, Sandlådan med
50 nya källor, Vad är nytt och push-grupperingen.

## Varför nu
Säkerhetsgenomgången 2026-11-14 hittade luckor i både ny och gammal kod:
- Platsfiltret (ny kod) skickade `CanonicalEvent` rakt ut, fixat i PR #746.
- Publika `GET /api/faq` visade frågor om flaggor som bara admin ser (EndastAdmin), fixat i PR #747.
- `link-status` och `share` saknade publiceringsfilter och rate limiting, fixat i PR #748 och #749.
  Båda var redan märkta som misstänkta i `AnonymousEndpointsGuardTests` sedan FIXPLAN, men
  hade aldrig åtgärdats.

## Genomgång 2026-11-23 (hotmodell med STRIDE)
Vi gick igenom appen som en angripare: vad kan någon med curl skicka över gränsen
webbläsare → API? Det mesta höll redan. Det här gjordes:

- **Falsk `X-Forwarded-For`:** `Program.cs` litar på hela kedjan och tar första värdet,
  så det såg ut som att all rate limiting per IP gick att kringgå. Testat mot produktion:
  det går **inte**, eftersom Railways edge skriver över klientens header. Skyddet beror alltså
  på Railway och inte på vår kod. Därför finns nu `.github/workflows/live-rate-limit.yml`
  (PR #755), som varje natt kör 6 inloggningar och ett anrop med falsk header. Den blir röd,
  och GitHub mejlar, om Railway ändrar beteende eller hosting/proxy byts.
- **`POST /api/push/claim`:** fick rate limiting, 60/min per IP (PR #756). Verifierat i
  produktion: 429 efter taket. `sw.js` är fail-open, så i värsta fall blir det en dubblettnotis.
- **Guard-listan** (`AnonymousEndpointsGuardTests`): tre motiveringar beskrev saker som redan var
  lagade (`GetEvent`, support-ärenden, webhooken). De är uppdaterade och MISSTÄNKT-gruppen är tom
  (PR #756).
- **`SqlQueryRaw` i `StartupSchemaGuard`:** tar bara emot fyra kända tabellnamn och kastar
  annars. EF1002 är avstängd just där, med motivering (PR #757).
- **Tokens i `localStorage`:** ingen ändring. Ingen XSS-väg hittades i vår egen kod (ingen
  `innerHTML`/`dangerouslySetInnerHTML`, React 19 blockerar `javascript:`-länkar). Risken är de
  externa skripten (`chat.js`, gtag), precis som [[Beslut - Alt C refresh-token i cookie]] säger.
  Beslutet står kvar. Kundtjänstboten lämnas som den är tills vidare (ägarens val).
- **`ex.Message` i `SourcesController`/`TestingController`:** ingen ändring. Båda kräver admin,
  och admin ska se varför en källa inte gick att hämta.
- **Webhookens signatur och replay-skydd:** granskade och bra (HMAC, konstant-tidsjämförelse,
  5 minuters fönster).

## Kvar
- **Resend-webhooken:** att ett mejlsvar inte kan hamna i fel ärende (själva signaturen är klar).
- **Liveverifiering av övriga rate limiting-regler:** inloggningen och `push/claim` är
  verifierade. Kvar: `eventssearch`, support-ärenden, CSP-rapporter, `link-status` och `share`.
  De kan läggas till i `live-rate-limit.yml`.
- **Det som tillkommit sedan FIXPLAN:** granska i första hand `git diff` från FIXPLAN-commiten
  (platsfiltret, schemalagd lansering, Sandlådan, Vad är nytt, push-grupperingen).
