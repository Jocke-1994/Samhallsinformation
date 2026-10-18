---
typ: ide
status: ide  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ej-bedomd  # giltiga värden: ja | nej | ej-bedomd
beroenden: ""
prioritet: ej-bedomd
pipelineNr: ""
kalla: "session 2026-10-18, användarens egen idé om en kalendervy för planerade/historiska uppdateringar"
---

# Kalendervy i Uppdateringar

Idé: en kalendervy ovanpå den redan databas-backade Uppdateringar-fliken
(inte en ny flik) — schemalagda (framtida) och redan publicerade
uppdateringar/lanseringar visade på ett datum, inte bara i en lista.
Utlöst av att [[../Verktyg/Schemalagd-lansering|Schemalagd lansering]] nu
lanserar poster på ett specifikt datum/tid, men det enda sättet att se
DEM idag är att bläddra i listan.

Avstämt 2026-10-18 — tre beslut redan fattade i samtalet:
1. **Ingen ny flik.** Användaren var uttryckligen orolig för
   flik-antalet i adminpanelen ("börjar bli ganska många nu") —
   kalendern ska vara en vy INUTI Uppdateringar (t.ex. en
   Lista/Kalender-växlare), inte en egen sidomenypost.
2. **Smal datakälla till att börja med.** Bara det som redan har ett
   riktigt datum i Uppdateringar-modellen: schemalagda
   (`SchemalagdPubliceringUtc`/annonseringsdatumet, del 3 av
   Schemalagd lansering) och redan publicerade poster. Källhändelser
   (det ingestade nyhetsflödet), supportärenden och Aktivitetsloggen är
   medvetet UTE — de har egna vyer redan och är inte "planering".
3. Scope kan breddas senare om kalendern känns för tom, men startar
   minimal.

## Öppna frågor
Vad måste vara svarat innan detta kan gå vidare till pipelinen?
- Kalender-form: en månadsvy (rutnät) eller en kronologisk agenda-lista
  grupperad per dag? En månadsvy ger en riktig "kalenderkänsla" men få
  poster per månad kan göra den gles.
- Var sitter växlaren (Lista/Kalender) i `AdminUppdateringar.tsx` —
  flikar inom fliken, eller en enkel ikonknapp?
- En post med TVÅ datum (annonsering + lansering, del 3 av Schemalagd
  lansering) — visas som två kalenderposter eller en post med båda
  tiderna synliga?
- UI inte skissad än — värt en Artifact-skiss innan kodning, samma
  mönster som Platsfiltret/Schemalagd lansering använde.

## Kopplat
- [[../Verktyg/Schemalagd-lansering|Schemalagd lansering]] — datakällan
  (schemalagda/publicerade poster), redan byggd och mergad
- `AdminUppdateringar.tsx` — vyn kalendern ska leva inuti, inte en ny
  sidomenypost
