---
typ: ide
status: i-pipeline  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ja
beroenden: ""
prioritet: ej-bedomd
pipelineNr: ""
kalla: "session 2026-09-13 (idé skriven direkt i Ideer/), kopplad till en äldre idé från session 38 (2026-08)"
---

# Dela en händelse

En användare vill kunna dela en händelse. Konkret UI-förslag: en ikon
eller ordet "Dela" på händelsekortet.

## Byggt 2026-09-13 (feat/dela-handelse, PR #574 — öppen, ej mergad/aktiverad)
- Ny 🔗-ikon i händelsekortets rad 2, bakom ny avstängd feature-flag
  `flode_dela` (samma mönster som `flode_sparat`)
- Delar alltid **källänken** (Polisen/SMHI/etc.), aldrig vår egen sida —
  grundprincipen om källkrav/transparens (CLAUDE.md) avgjorde frågan
  nedan om vad som delas
- Klick loggas alltid internt (ny `EventShareLog`-tabell: händelse-id +
  valfritt användar-id om inloggad) — svarar på frågan om mätning nedan.
  GA4 medvetet INTE använt (skulle bara varit en reserv om intern
  loggning inte gått)
- Tekniskt: `navigator.share()` (webbläsarens/enhetens egen delningsmeny,
  samma UX som t.ex. Instagrams dela-knapp men med OS:ets installerade
  appar/kontakter — inget vi bygger kanal för kanal), med
  `navigator.clipboard.writeText()` som fallback på desktop där stödet
  är opålitligt
- `DeladeHandelser` tillagt i GDPR-exporten (`AuthController.ExportMe`,
  samma PR) — upptäcktes sent att den saknades, samma mönster som
  `sparadeHandelser`
- Förhandsvisad lokalt (temporär flagg-override + mockläge, ingen
  backend krävdes), aldrig aktiverad i produktion

## Koppling till en äldre idé (session 38, 2026-08)
En extern testare föreslog något liknande då — dela en händelse till
sparade kontakter/sociala grupper med ett klick. Fortfarande oklart om
det här är samma idé i mindre skala eller ett medvetet enklare första
steg — se kvarvarande öppna fråga.

## Öppna frågor
- Är det här en enklare v1 av session 38:s idé (dela till sparade
  kontakter/grupper), eller en helt egen, avsiktligt minimal funktion?
  Det byggda är den enkla varianten (OS-delningsmeny) — kontakter/grupper
  inom appen är inte byggt och inte planerat i den här omgången

## Kopplat
- (session 38-anteckningen finns bara i minnessystemet, inte i valvet —
  säg till om du vill att den flyttas hit också)
