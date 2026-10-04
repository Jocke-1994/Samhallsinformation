---
typ: ide
status: lanserad  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ja
beroenden: ""
prioritet: ej-bedomd
pipelineNr: ""
kalla: "session 2026-09-13 (idé skriven direkt i Ideer/), kopplad till en äldre idé från session 38 (2026-08) — skeppad PR #574, bakom flaggan flode_dela (session 49, rättat status 2026-09-15)"
---

# Dela en händelse

En användare vill kunna dela en händelse. Konkret UI-förslag: en ikon
eller ordet "Dela" på händelsekortet.

## Byggt 2026-09-13 (feat/dela-handelse, PR #574 — öppen, ej mergad/aktiverad)
- Ny 🔗-ikon i händelsekortets rad 2, bakom ny avstängd feature-flag
  `flode_dela` (samma mönster som `flode_sparat`)
- Delar alltid **källänken** (Polisen/SMHI/etc.), aldrig vår egen sida —
  grundprincipen om källkrav/transparens (CLAUDE.md) avgjorde frågan
  om vad som delas
- Tekniskt: `navigator.share()` (webbläsarens/enhetens egen delningsmeny,
  samma UX som t.ex. Instagrams dela-knapp men med OS:ets installerade
  appar/kontakter dynamiskt — ingen handplockad kanallista, inget vi
  bygger kanal för kanal), med `navigator.clipboard.writeText()` som
  fallback på desktop där stödet är opålitligt (kort "Länk kopierad!"-
  bekräftelse)
- Klick loggas alltid internt i en ny `EventShareLog`-tabell (händelse-id
  + valfritt användar-id om inloggad, `POST /api/events/{id}/share`,
  ingen inloggning krävs) — loggas vid KLICKET, inte vid bekräftad
  fullföljd delning (OS-menyn ger inget tillförlitligt sätt att veta om
  användaren faktiskt valde något där). GA4 medvetet INTE använt (skulle
  bara varit en reserv om intern loggning inte gått)
- `DeladeHandelser` tillagt i GDPR-exporten (`AuthController.ExportMe`,
  samma PR) — upptäcktes sent att den saknades, samma mönster som
  `sparadeHandelser`
- Förhandsvisad lokalt (temporär flagg-override + mockläge, ingen
  backend krävdes), aldrig aktiverad i produktion

**Inte byggt:** en admin-vy för att se delningsstatistik (bara loggningen
finns) — se `Verktyg/Lansering - Direction E + tre ikoner.md`, punkt 2.

## Koppling till en äldre idé (session 38, 2026-08)
En extern testare föreslog något liknande då — dela en händelse till
sparade kontakter/sociala grupper med ett klick. Beslutat 2026-10-04
(se nedan): det här är ett medvetet enklare första steg, inte samma
idé i mindre skala.

## Frågor — besvarade/lösta 2026-09-13
- **Vad delas?** → Källänken. Besvarat, byggt.
- **Mätning?** → Internt (se ovan), inte bara GA4. Besvarat, byggt.
- **Vilka kanaler?** → Klargjort: det finns ingen fast kanallista att
  bygga — `navigator.share()` visar OS:ets/enhetens egna installerade
  appar dynamiskt, exakt som Instagrams "fler sätt att dela"-rad. Ingen
  handplockning av SMS/Snapchat/etc. behövs eller går ens att styra
  från vår sida.

## Beslut 2026-10-04
Enklare v1 av session 38:s idé. Det byggda (OS-delningsmeny) är ett
medvetet första steg — kontakter/grupper-delning INOM appen (ett eget
socialt lager) kan byggas ovanpå senare, inte en separat, obesläktad idé.
Inte påbörjat i den här omgången.

## Kopplat
- (session 38-anteckningen finns bara i minnessystemet, inte i valvet —
  säg till om du vill att den flyttas hit också)
