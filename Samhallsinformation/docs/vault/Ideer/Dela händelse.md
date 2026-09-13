---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ej-bedomd
beroenden: ""
prioritet: ej-bedomd
pipelineNr: ""
kalla: "session 2026-09-13 (idé skriven direkt i Ideer/), kopplad till en äldre idé från session 38 (2026-08)"
---

# Dela en händelse

En användare vill kunna dela en händelse. Konkret UI-förslag: en ikon
eller ordet "Dela" på händelsekortet.

## Koppling till en äldre idé (session 38, 2026-08)
En extern testare föreslog något liknande då — dela en händelse till
sparade kontakter/sociala grupper med ett klick, medvetet sparad till
"senare" eftersom du redan hade en egen tanke om hur den skulle fungera.
Den här nya, mycket enklare formuleringen ("en ikon eller ordet Dela")
kan vara samma idé i mindre skala, eller ett medvetet enklare första steg
innan den mer utbyggda kontakter/grupper-varianten. Oklart vilket —
se första öppna frågan.

## Öppna frågor
- Är det här en enklare v1 av session 38:s idé (dela till sparade
  kontakter/grupper), eller en helt egen, avsiktligt minimal funktion
  (bara dela länken någonstans)?
- Vad ska "dela" faktiskt göra rent tekniskt? Några alternativ, olika
  mycket jobb:
  - **Webbläsarens inbyggda delningsfunktion** (`navigator.share()`) —
    på mobil öppnas telefonens egna delningsmeny (SMS, Messenger,
    e-post, m.m.). Fungerar inte i alla skrivbordsbläddare, kräver en
    fallback där
  - **Kopiera länk-knapp** — enklast, fungerar överallt, men mindre
    "delExternal" än en riktig delningsmeny
  - **Dela till specifika kanaler** (t.ex. en färdig X/Facebook-länk) —
    mer jobb, låser fast vilka plattformar som stöds
- Vad delas — länken till vår egen sida (`/?shortName=...`), eller direkt
  till originalkällan (Polisen/SMHI/etc.)? Grundprincipen "källkrav,
  transparens" (CLAUDE.md) talar för att dela till primärkällan snarare
  än att vår sida blir mellanhanden
- Ska delning mätas (GA4-event, samma mönster som redan finns för
  `sidebar_open`/`theme_change`)? Bra att veta om funktionen faktiskt
  används

## Kopplat
- (session 38-anteckningen finns bara i minnessystemet, inte i valvet —
  säg till om du vill att den flyttas hit också)
