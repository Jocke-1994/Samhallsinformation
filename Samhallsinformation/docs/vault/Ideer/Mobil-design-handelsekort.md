---
typ: ide
status: i-pipeline  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ja
beroenden: "Bottom navigation bar väntar på detta, eller på att Sök byggs — se Ideer/Bottom bar (mobil).md"
prioritet: ej-bedomd
pipelineNr: "#2"
kalla: "session 47 (2026-09-09), mockup-iteration för Polisen-händelsekort på mobil"
---

# Mobil huvudflöde — Polisen-händelsekort (Direction D vs E)

Pausad mobil design-genomgång av huvudflödets händelsekort. Två riktningar
mockade upp, ingen kodad än.

## Direction D — nuvarande favorit
Dagens layout: en rad med tid + fet "vad hände" + plats, följt av en
kompakt meta-rad (severity-pill · källa · mottagningstid) med "·" som
avskiljare. Allt sekundärt hamnar i EN rad under huvudinnehållet.

## Direction E — tre staplade rader
Samma tre fält (`eventType`/`geography`, redan bara ifyllda av Polisen),
ny läsordning:
1. Severity-pill + händelsens egen tid
2. **Vad + var** (fet, störst) — tänkt som kortets enda "måste läsas"-rad
3. Källa + källans publiceringstid, litet och tonat

Mockup: https://claude.ai/code/artifact/168ec088-e4b3-47fb-9a4b-85e7753d331c

## Min bedömning av Direction E (2026-09-12, på begäran)
Fyra saker jag skulle vilja se lösta innan E byggs:

1. **Höjd/skrollkostnad.** Tre fasta rader tar mer vertikal plats än D:s
   mer flexibla rad+meta-rad — färre kort syns ovanför mobilens "fold".
   I ett flöde där man skummar många händelser i rad är det en reell
   kostnad, inte bara estetik.
2. **De två tidsstämplarna hamnar långt ifrån varandra** (rad 1 överst,
   rad 3 längst ner) istället för sida vid sida som i D. Designens egen
   poäng — visa transparent att Polisen ibland dröjer med att posta — blir
   svårare att se på ett ögonkast när de två tiderna inte längre står
   bredvid varandra.
3. **Severity-pillen ligger överst, i färg, före huvudinnehållet.** Färg
   drar ögat oavsett textstorlek — inte säkert att rad 2 (fetstil "vad
   hände") faktiskt vinner uppmärksamheten först, trots att den är tänkt
   att vara kortets viktigaste rad.
4. **Expand-pilen (chevron) saknas i det vanliga (ej öppnade) läget i
   mockupen** — finns bara med i "vid klick"-exempelkolumnen. Troligen
   bara ett mockup-förbiseende, men värt att dubbelkolla att en stängd
   rad faktiskt signalerar "det går att klicka på mig" innan detta byggs.

Ingen av dessa är blockerande i sig — bara saker att ha koll på om E väljs
istället för D.

**Svar 2026-09-13:** #2 (ikonplacering i rad 3, se nedan) godkänd. #4
(chevronen) — ok att alltid ha den synlig, inte bara vid expand.

## Scope-gap: Direction E fungerar bara för Polisen
Direction E:s rad 2 ("vad + var") bygger på `eventType`/`geography` —
båda fälten är i praktiken bara ifyllda för Polisen-händelser (samma
begränsning som `kallor_polisen_filter`/bevakningarna). Andra källor
(SMHI, Krisinformation, m.fl.) skulle inte kunna använda samma radlayout
rakt av utan de fälten.

**Beslut 2026-09-13:** blanda inte design mellan källor — hellre hålla
alla källor i samma layout (D) tills vidare än att ha D och E sida vid
sida i samma flöde. Öppet för att mocka upp Direction E (eller en
motsvarande enhetlig design) för fler källor senare, men inget bråttom
och inget beslutat om hur den skulle se ut för källor utan
eventType/geography.

## De tre ikonerna (Bevakning/Sparat/Dela) i Direction E
Mockup: https://claude.ai/code/artifact/828719bf-2216-47b2-9537-6d549051f323
("Kortets tre ikoner") — visar 🔔 (Polisen-bevakning), 🔖/📑 (Sparat) och
🔗 (Dela) tillsammans i både nuvarande layout (D) och Direction E, på
desktop och mobil.

**Godkänt 2026-09-13:** ikonernas placering i rad 3 (tillsammans med
"Källa · tid") ser bra ut. Se ovan för chevron-svaret.

**Explicit instruktion 2026-09-13: inget av detta (Direction E eller de
tre ikonerna) ska aktiveras i produktion ännu** — följ
`Verktyg/Checklista-innan-lansering.md` innan lansering. Se
`Verktyg/Lansering - Direction E + tre ikoner.md` för en genomgång av
checklistan mot det här paketet.

## Status
**Beslutat 2026-09-12: Direction E** — "mer clean". De fyra
observationerna ovan är inte blockerande (#2 och #4 nu uttryckligen
godkända/besvarade). Kod inte påbörjad — väntar på launch-checklistan
(se ovan) innan aktivering, inte på fler designbeslut.
Bottom navigation bar (se `Ideer/Bottom bar (mobil).md`) väntar i sin tur
delvis på det här.

## Kopplat
- `Ideer/Bottom bar (mobil).md`
- `Ideer/Dela händelse.md`
- `Verktyg/Checklista-innan-lansering.md`
- `Verktyg/Lansering - Direction E + tre ikoner.md`
