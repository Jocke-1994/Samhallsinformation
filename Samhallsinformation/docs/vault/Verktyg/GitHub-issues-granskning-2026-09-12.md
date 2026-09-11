---
typ: granskning
status: att-gora  # giltiga värden: att-gora | pagaende | klart
---

# GitHub-issues-granskning (2026-09-12)

Full genomgång av alla 60 öppna GitHub-issues mot faktisk kod/sessionslogg,
på användarens begäran. 20 stängda direkt (solklart redan byggda), resten
kategoriserat nedan. Varje stängt issue har en kommentar på GitHub med
motivering och ev. avvikelse från ursprungsspecen — den här noten är bara
en samlad överblick, facit ligger på GitHub-issuet självt.

## Stängda (20) — redan byggda, verifierade mot kod

| # | Titel | Avvikelse från ursprungsspec |
|---|---|---|
| [#44](https://github.com/Jocke-1994/Samhallsinformation/issues/44) | Logga in med Google | Duplikat av #297 |
| [#45](https://github.com/Jocke-1994/Samhallsinformation/issues/45) | Glömt lösenord | Ingen — verifierad live idag |
| [#54](https://github.com/Jocke-1994/Samhallsinformation/issues/54) | Byta lösenord | Ingen |
| [#56](https://github.com/Jocke-1994/Samhallsinformation/issues/56) | Exportera persondata (GDPR) | SMS/samtycken finns inte i produkten, inget att exportera där |
| [#57](https://github.com/Jocke-1994/Samhallsinformation/issues/57) | Radera konto (GDPR) | 24h ångerfönster (inte 7 dagar), inget lösenordskrav vid begäran |
| [#58](https://github.com/Jocke-1994/Samhallsinformation/issues/58) | Onboarding-wizard | "Kör startguiden igen" från profilen saknas |
| [#60](https://github.com/Jocke-1994/Samhallsinformation/issues/60) | Admin-dashboard grundstruktur | Ingen |
| [#61](https://github.com/Jocke-1994/Samhallsinformation/issues/61) | Roller (User/Admin) | Admin seedas via env-var, inte "första kontot blir Admin" |
| [#62](https://github.com/Jocke-1994/Samhallsinformation/issues/62) | Källhantering admin | Oklart om hårt DELETE finns (vs. avaktivering) |
| [#64](https://github.com/Jocke-1994/Samhallsinformation/issues/64) | Användarhantering admin | Telefonnummer/BankID-kolumner finns inte (de fälten finns inte i produkten) |
| [#65](https://github.com/Jocke-1994/Samhallsinformation/issues/65) | Support-inbox admin | Ingen separat admin-only-inkorg (kräver #68, aldrig byggd) |
| [#67](https://github.com/Jocke-1994/Samhallsinformation/issues/67) | Kontaktformulär → admin-inbox | "Mina ärenden"-vy för användaren själv verkar saknas — se Öppna frågor |
| [#69](https://github.com/Jocke-1994/Samhallsinformation/issues/69) | Felsökningsverktyg admin | Ingen |
| [#108](https://github.com/Jocke-1994/Samhallsinformation/issues/108) | Support-roll behörigheter | Ingen |
| [#110](https://github.com/Jocke-1994/Samhallsinformation/issues/110) | Tilldela Support-rollen | Ingen |
| [#114](https://github.com/Jocke-1994/Samhallsinformation/issues/114) | Alla källor | Filterflikar (Nationell/Regional/Kommunal) saknas — moot, bara nationella källor finns |
| [#183](https://github.com/Jocke-1994/Samhallsinformation/issues/183) | Välj hostingplattform | Ingen |
| [#295](https://github.com/Jocke-1994/Samhallsinformation/issues/295) | FAS 1: Backend auth-grund | Ingen |
| [#297](https://github.com/Jocke-1994/Samhallsinformation/issues/297) | FAS 3: Google OAuth | Ingen |
| [#299](https://github.com/Jocke-1994/Samhallsinformation/issues/299) | FAS 5: Konto-sidan | Ingen |

## Flaggade — behöver DITT beslut (inte stängda)

Byggda till en del, men avviker tillräckligt mycket från ursprungsspecen
att en stängning känns fel utan att du sett skillnaden.

- **[#298](https://github.com/Jocke-1994/Samhallsinformation/issues/298) FAS 4: Källprenumerationer och geografifilter per källa** — specen beskriver en GENERISK `UserSourcePreference`-modell med filter per källa. Det som faktiskt byggdes (session 35) är `PolisenBevakningar` — en Polisen-SPECIFIK lösning. Ingen annan källa (SMHI, Krisinformation, osv.) har typ/geografifilter. Fråga: är den generiska ambitionen fortfarande relevant, eller är Polisen-bevakningar den permanenta lösningen och issuet bör skrivas om/stängas som "löst annorlunda"?
- **[#109](https://github.com/Jocke-1994/Samhallsinformation/issues/109) Support-dashboard, dedikerad vy** — Support-rollen ser en delmängd av adminpanelen idag (samma layout, färre flikar), men den beskrivna "Support-guiden" (expanderbara hjälpkort, som FAQ men internt) finns inte alls. Litet, avgränsat jobb om ni vill ha den.
- **[#111](https://github.com/Jocke-1994/Samhallsinformation/issues/111) Ärendearkivering — automatisk livscykel** — specen beskriver AUTOMATISK arkivering efter 7 dagar och radering efter 36 månader. Det som faktiskt byggdes (session 30) är en MANUELL "📦 Arkivera"-knapp — ingen automatik, ingen 36-månaders-radering. Värt att bestämma om automatiken fortfarande önskas.
- **[#128](https://github.com/Jocke-1994/Samhallsinformation/issues/128) Händelsedetaljvy** — täcks delvis av `NewsItem.tsx`s expand-i-kortet-mekanik, men ingen dedikerad vy/modal med "relaterade händelser" finns. Bedöm om expand-mekaniken räcker eller om en riktig detaljvy fortfarande är önskad.
- **[#157](https://github.com/Jocke-1994/Samhallsinformation/issues/157) Hantera öppen beta-kampanj i admin** — INTE byggd som specat. `betaConfig.ts` är fortfarande den statiska placeholder som issuet uttryckligen beskriver som något att ERSÄTTA. Fortfarande fullt giltigt, inte en föråldrad idé.

## Troligen föråldrade/duplicerade — kandidater att stänga, men du bör titta själv

- **#42** (BankID-inloggning) — duplikat av #437, som är den senare/mer uppdaterade versionen
- **#43** (Freja eID) — aldrig nämnd igen sedan skapelsen, sannolikt övergiven idé
- **#46** (SPAR-integration) + **#55** (Samtycke vid SPAR) — SPAR revs bort helt ur produkten (session 24/25), kräver personnummer+BankID som inte finns. Båda troligen döda.
- **#50/#51** (SMS-mottagare + rate limiting för SMS) — duplikat av #133/#134
- **#116/#117** (Standardinställningar/Källinställningar) — beskriver en gammal mail/SMS-per-källa-notismodell, känd sedan session 25 att behöva en omdesign-beslut innan den är relevant igen
- **#120–#123** (Testare-roll-klustret: dedikerad roll, bjuda in, hantera testarkonton, feedback-knapp) — verkar ha ersatts av en enklare lösning (Feedback-knapp + "Testare"-kategori i supportformuläret, bekräftat i session 46-diskussionen om Sök-funktionen)
- **#127** (DISC: Launch-scope) + **#146** (Definiera funktionsomfång v1.0) — dubbletter av varandra, båda ersatta av de FAKTISKA launch-prep-sessionerna (24, 25, 27, 43-46) som aldrig loggades tillbaka till dessa issues
- **#168** (Konto tvåkolumns grid-layout) — sannolikt från innan dagens Konto-sida-design fanns, matchar inte nuvarande enkolumns-kort-layout

## Genuint fortfarande öppna, inget att göra åt just nu

#36, #37, #38 (fler ingestors), #52 (daglig sammanfattning), #66 (FAQ publik — redan känt öppet sedan session 42), #68 (ansök om att bli källa), #124/#125 (releaser↔ärenden, versionsindikatorer — hör ihop med den redan speccade schemalagda changelog-publiceringen), #133/#134 (SMS), #135 (undersökningar), #138 (internt forum), #141 (gåvor — kopplat till olöst monetiseringsfråga), #144 (staging-miljö), #173 (formell självläkning — ad-hoc-täckt av IngestorRunLog men ingen riktig retry-mekanism), #175 (köhantering i support-inbox — delvis täckt av Kategori-fältet), #335 (Nyheter-sidans avgränsningstext — status okänd, inte verifierad), #434 (FAQ — gamla innehållet rättat, de 15 nya frågorna aldrig inlagda i DB), #437 (BankID, medvetet framtida), #491 (enhetlig aktivitetslogg, wave 2/3 kvar).

## Öppna frågor
- #67: finns en "Mina ärenden"-vy för inloggade användare, eller ser bara admin sina egna inskickade ärenden?
- #62: går det att hårdradera en källa, eller bara avaktivera?
- #335: verifiera om avgränsningstexten på `/uppdateringar` faktiskt lades till
