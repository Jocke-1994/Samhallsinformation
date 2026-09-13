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

## Byggd 2026-09-13
En första version är byggd bakom en ny, avstängd flagga (`flode_dela`):
- 🔗-ikon i händelsekortets åtgärdsrad (samma plats som Sparat-ikonen)
- Delar **källänken** (Polisen/SMHI/etc.), aldrig vår egen sida
- Klickar man delar `navigator.share()` genom webbläsarens/enhetens egen
  delningsmeny på mobil (samma sorts fönster som Instagrams "fler sätt att
  dela" — kontakter/appar som finns PÅ ENHETEN, inte något vi bygger
  kanal för kanal). På desktop, där stödet är opålitligt, kopieras länken
  till urklipp istället med en kort "Länk kopierad!"-bekräftelse
- Varje klick loggas i en ny `EventShareLogs`-tabell (händelse-id,
  användar-id om inloggad annars null, tidpunkt) — internt, inte bara
  GA4. Loggas vid KLICKET, inte vid bekräftad fullföljd delning (OS-menyn
  ger inget tillförlitligt sätt att veta om användaren faktiskt valde
  något där)
- `POST /api/events/{id}/share`, ingen inloggning krävs

**Inte byggt:** en admin-vy för att se delningsstatistik (bara loggningen
finns). Säg till om du vill kunna se den någonstans i adminpanelen.

## Koppling till en äldre idé (session 38, 2026-08)
En extern testare föreslog något liknande då — dela en händelse till
sparade kontakter/sociala grupper med ett klick, medvetet sparad till
"senare" eftersom du redan hade en egen tanke om hur den skulle fungera.
Den här nya, mycket enklare formuleringen ("en ikon eller ordet Dela")
kan vara samma idé i mindre skala, eller ett medvetet enklare första steg
innan den mer utbyggda kontakter/grupper-varianten. Oklart vilket —
se första öppna frågan.

## Frågor — besvarade/lösta 2026-09-13
- **Vad delas?** → Källänken. Besvarat, byggt.
- **Mätning?** → Internt (se ovan), inte bara GA4. Besvarat, byggt.
- **Vilka kanaler?** → Klargjort: det finns ingen fast kanallista att
  bygga — `navigator.share()` visar OS:ets/enhetens egna installerade
  appar dynamiskt, exakt som Instagrams "fler sätt att dela"-rad. Ingen
  handplockning av SMS/Snapchat/etc. behövs eller går ens att styra
  från vår sida.
- **Kvar olöst:** är detta samma idé som session 38:s (dela till sparade
  kontakter/grupper INOM appen, ett eget socialt lager), eller en helt
  skild, avsiktligt enklare funktion? Det byggda är den enkla varianten
  — session 38:s idé (om den fortfarande är aktuell) är ett separat,
  större jobb som kräver en egen kontakter/grupper-datamodell.

## Kopplat
- (session 38-anteckningen finns bara i minnessystemet, inte i valvet —
  säg till om du vill att den flyttas hit också)
