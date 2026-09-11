---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: nej
beroenden: "Bottom navigation bar väntar på detta, eller på att Sök byggs — se Ideer/Bottom bar (mobil).md"
prioritet: ej-bedomd
pipelineNr: ""
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

## Status
Pausad — väntar på ett beslut mellan D och E. Bottom navigation bar
(se `Ideer/Bottom bar (mobil).md`) väntar i sin tur delvis på det här.

## Kopplat
- `Ideer/Bottom bar (mobil).md`
