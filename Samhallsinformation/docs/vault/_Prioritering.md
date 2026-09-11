---
typ: prioritering
uppdaterad: 2026-09-12
---

# Prioritering — allt utestående på ett ställe

Byggd 2026-09-12 efter en full genomgång av GitHub-issues, GitHub-boarden
och Obsidian-valvet. Uppdatera det här dokumentet istället för att låta
prioriteringar bara leva i sessionsloggar — det är hela poängen med det.

## 🔴 Blockerar publik lansering

1. **Rate limiting fungerar inte i produktion** — bekräftat trasigt
   2026-09-11 (10 rafflade inloggningsförsök, ingen blockerades). Trolig
   orsak: saknad `ForwardedHeaders`-middleware bakom Railways proxy.
   Registrerings-/inloggningsendpointen är i praktiken oskyddad mot
   spam/brute-force just nu. **Detta bör lösas INNAN
   `showLoginButton`/`showRegisterButton` slås på.**
2. **`showLoginButton`/`showRegisterButton`** fortfarande av — sista steget
   i launch-ordningen, väntar på ovanstående + resten av mobiltestet nedan
3. **Google-inloggning, kontokoppling** — det enda Google-scenariot som
   ALDRIG testats live (session 29): ett Google-konto vars e-post redan
   har ett lösenordskonto. Vad händer faktiskt?
4. **`/login`-sidan, hela mobilgenomgången** — aldrig separat testad, bara
   `/register` hittills

## 🟡 Rekommenderat innan lansering, inte blockerande

- PR #516 (Nyheter-sidan) + #517 (beta-badge) — medvetet omergade, väntar
  på LinkedIn-timing
- Rate limiting under en TRAFIKTOPP (flera SAMTIDIGA registreringar, inte
  bara sekventiella försök) — bör testas om igen efter fixen ovan

## 🟢 Flaggade avvikelser, kräver ett beslut (inte akut)

Se [[Verktyg/GitHub-issues-granskning-2026-09-12|full granskning]] för
detaljer på varje.

- **#298** — generisk källprenumerationsmodell vs. den Polisen-specifika
  lösningen som faktiskt byggdes. Behåll som är, eller bygg ut generiskt?
- **#111** — automatisk ärendearkivering (7 dagar/36 månader) önskas
  fortfarande, eller är den manuella knappen tillräcklig?
- **#109** — Support-dashboard med inbyggd hjälpguide, litet jobb om
  önskat
- **#128** — räcker `NewsItem.tsx`s expand-mekanik, eller vill ni ha en
  riktig händelsedetaljvy?
- **#157** — fortfarande fullt giltig, `betaConfig.ts` är fortfarande bara
  en statisk placeholder

## Öppna, avgränsade produktidéer (från Obsidian Idéer/)

- **Sök-funktion** (FAQ+sidor, källmärkt) — designklar, inget kodat.
  Naturligt nästa steg som gör en bottom nav bar värd att bygga
- **Bottom navigation bar** — väntar på Sök (ovan) eller Bevakningar som
  egen sida
- **Direction E** (tre staplade rader för Polisen-händelsekort) — mockup
  klar, inget kodat, väntar på ett "bygg det"
- Mobil design-genomgång av huvudflödet — pausad, väntar på att D vs E
  avgörs
- "Vad är nytt"-modal — väntar på att changelog-innehållet skrivs om
- Riktig app (Play Store via PWABuilder) — scopad, inte påbörjad

## Genuint öppna GitHub-issues, ingen brådska

#36-38 (fler ingestors), #52 (daglig sammanfattning), #66 (FAQ publik),
#68 (ansök om att bli källa), #124-125 (releaser↔versioner, hör ihop med
changelog-arbetet), #133-134 (SMS — väntar på en modellbeslut), #135
(undersökningar), #144 (staging-miljö — en riktig lucka, produktion är
enda miljön idag), #173 (formell självläkning för ingestorer), #175
(köhantering i support-inbox), #335 (verifiera om redan gjort), #434 (FAQ
— 15 nya frågor aldrig inlagda i DB, känt sedan session 42), #437 (BankID,
medvetet framtida), #491 (aktivitetslogg wave 2/3)

## Kandidater att stänga/arkivera (din bedömning, inte gjort än)

#42, #43, #46, #50, #51, #55, #116, #117, #120-123, #127, #138, #141,
#146, #168 — se granskningen för varför var och en är en kandidat.

## Obsidian-täckning, fortfarande ofullständig

Nya Funktioner-noter skapade 2026-09-12: Autentisering,
Onboarding-wizard, Lösenordsåterställning, GDPR-verktyg, Kontouppgifter,
Adminpanel-roller, Källhantering (admin), Användarhantering (admin),
Support-inbox, Felsökning (admin). Fortfarande utan egen not: FAQ,
Mina källor (källistan i sig, till skillnad från Polisen-bevakningar),
Notifieringar-inställningarna, Aktivitetslogg är redan skriven sedan
tidigare. Flödesscheman finns bara för de mest processorienterade
funktionerna hittills (Autentisering, GDPR-radering, Support-inbox,
Onboarding) — resten (adminpanel-CRUD-vyer) fick ingen diagram eftersom
en lista/formulär inte vinner på ett flödesschema.
