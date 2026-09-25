---
typ: beslut
status: öppen
datum: 2026-09-25
---

# Beslut - Alt C: refresh-token i httpOnly-cookie

**Parkerat, inte avfärdat.** Ingen åtgärd nu — men det här ska inte glömmas.
Tas upp till beslut så fort **något** av villkoren nedan inträffar. Bevakningen
ska köras av övervakningen (se [[Code-review 2026-09-25]], V1-9) där det går.

## Bakgrund
Vid code review 2026-09-25 (fynd E5#11) noterades att både access-token och
30-dagars refresh-token ligger i `localStorage`, samtidigt som ett skript
(`chat.js`, från kundtjänstbotens egen server) körs på alla sidor och alltså
kan läsa dem. Ingen bekräftad exploit — en arkitekturrisk, inte ett hål idag.

## Beslut 2026-09-25
- **Alt A nu:** gör inget just nu.
- **Alt B senare:** CSP (webbläsarregel för vilka skript som får köras) först i
  "rapportera-läge" — byggs i V3-22 i [[Code-review 2026-09-25|åtgärdsplanen]].
- **Alt C parkerat:** flytta refresh-token till en cookie som JavaScript inte
  kan läsa. Starkaste skyddet men en större ombyggnad av login/refresh/logout
  i både backend och frontend.

**Trolig komplikation (overifierad):** frontend (Vercel) och API
(`…up.railway.app`) ligger på olika sajter, så en cookie skulle bli en
tredjepartscookie som allt fler webbläsare blockerar. Alt C kräver troligen
att API:t flyttas till en subdomän under samma sajt som frontend, t.ex.
`api.samhallsinformation.se`. Undersök det innan något beslut.

## Villkor — kryssa när det inträffat
Räcker med **ett** kryss för att alt C ska tas upp till beslut.

- [ ] **1. Ny extern skriptkälla** läggs in på sidorna (analys, reklam,
  widget) utöver `chat.js`. *Upptäcks:* skript-vakt i CI (test som läser
  `index.html` mot en tillåtelselista, byggs i V1-0b).
- [ ] **2. CSP-rapporter visar oväntade skriptkällor.** *Upptäcks:* CSP i
  rapportera-läge (V3-22) loggar till backend → larm i övervakningen.
- [ ] **3. Känsligare data eller betalning/anslag** ska hanteras. *Upptäcks:*
  funktionsidéer som rör detta märks med `säkerhetsomprövning` och länkar hit.
  (Se även [[Beslut - Monetisering]] — ingen reklam, inga betalfunktioner som
  ändrar hur appen fungerar.)
- [ ] **4. Säkerhetsincident, tillbud eller extern granskning/penetrationstest**
  kräver det. *Upptäcks:* manuellt — kan inte automatiseras.
- [ ] **5. API:t flyttas till egen domän/subdomän** (då är den svåraste delen
  redan gjord). *Upptäcks:* den PR som ändrar `VITE_API_URL` eller domänen ska
  länka hit.
- [ ] **6. Tillväxt:** **500 registrerade användare** nås (tröskel satt av
  ägaren 2026-09-25) eller första pressomnämnande/marknadsföringskampanj.
  *Upptäcks:* användarräknare i övervakningen (regel `users_threshold`, V1-9).

## Rutin
- Läses vid sessionsstart när åtgärdsplanen tas upp, och efter varje våg.
- När V3-22 (CSP) slutförs: stäm av villkor 2 och lägg in CSP-larmet.

## Kopplat
- [[Code-review 2026-09-25]] — hela granskningen och åtgärdsplanen
- [[Beslut - Monetisering]]
