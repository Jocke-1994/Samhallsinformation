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

## Kvar från dagens lista (gå igenom först)
- **Resend-webhooken:** Svix-signaturen, skydd mot att gamla anrop skickas igen, och att ett
  svar inte kan hamna i fel ärende.
- **`POST /api/push/claim`:** anonym och saknar rate limiting (står i guard-listan).
- **`POST /api/support/tickets`:** guard-listan säger att rate limiting och längdgränser
  saknas. Kontrollera om det redan är fixat (`SupportTicketRateLimit` finns) och uppdatera i
  så fall motiveringen.
- **`SqlQueryRaw`** i `StartupSchemaGuard.cs:103` och `:108` (varning EF1002).
- **Liveverifiering** av alla rate limiting-regler mot produktion.

## Förslag på upplägg
Granska i första hand det som tillkommit sedan 2026-09-25 (`git diff` från FIXPLAN-commiten),
plus en ny genomgång av alla rader i `AnonymousEndpointsGuardTests` som fortfarande har
en anmärkning i motiveringen.
