---
typ: verktyg
status: klart  # giltiga värden: att-gora | pagaende | klart
---

# Schemalagd lansering — så fungerar det

Löser: kod kan mergas och deployas till produktion när som helst utan att
synas, och du bestämmer i förväg NÄR den blir synlig — allt från ETT
ställe (Uppdateringar-fliken i admin), inte genom att hoppa mellan
Feature flags-panelen och Uppdateringar separat. Byggt 2026-09-21 efter
en längre dialog om exakt hur flödet skulle kännas (se konversationen för
resonemanget bakom valen nedan).

## Flödet i praktiken

1. **Bygg funktionen bakom en flagga** (av som standard). Merga och
   deploya när som helst — syns inte förrän flaggan slås på.
2. **Markera flaggan "redo att lanseras"** — antingen automatiskt (flytta
   den kopplade idén i Funktionsidéer till stadiet "lanseringsklar", med
   `FlagKey` satt på idén) eller manuellt i Feature flags-panelen. Detta
   är bara en synlighetsmarkör för urvalslistan i steg 3 — rör aldrig om
   flaggan faktiskt är på eller av.
3. **I Uppdateringar, skapa en post**: välj en eller flera "redo"-
   flaggade flaggor, skriv valfria changelog-punkter (kan vara noll — en
   ren flagg-aktivering utan publik nyhet är giltigt), kryssa i
   "Schemalägg lansering" och sätt ETT delat datum/tid för hela posten.
   Har den valda flaggan kopplade FAQ-frågor (`FlagKey` på FAQ-posten)
   visas en påminnelse med länk till FAQ-fliken — granska/uppdatera dem
   själv där, ingen separat redigeringsyta byggd för det.
4. **Vid schemalagd tidpunkt** (bakgrundstjänst, kollar varje minut):
   flaggorna slås på, posten publiceras BARA om den har innehåll (annars
   förblir den en tyst intern flagg-aktivering, syns aldrig publikt).
   Allt loggas i Aktivitetsloggen som System-rader.
5. **Push ("Ny version"-notisen)** — den befintliga manuella knappen i
   Uppdateringar finns kvar för ad-hoc-pushar. Sedan 2026-10-04 beslutat
   att även lägga till en checkbox i schemaläggningsflödet som auto-
   triggar pushen när den schemalagda posten publiceras (se Beslut
   2026-10-04 nedan) — inte byggt än.

## Varför designen ser ut såhär (beslut från dialogen)

- **Ingen ny "Release"-modell.** Återanvänder tre system som redan fanns
  (feature flags, funktionsidé-pipelinens `Stage`/`FlagKey`, Uppdateringar)
  istället för att bygga en fjärde, egen datamodell för "en release".
- **Schemaläggningen ligger bara i Uppdateringar, inte i Feature
  flags-panelen** — uttryckligt beslut, för att hålla allt samlat på ett
  ställe istället för att hoppa mellan två sidor.
- **En delad tid för hela posten**, inte en tid per flagga — täcker det
  faktiska behovet (bunta ihop flera flaggor + en changelog-post) utan
  extra komplexitet.
- **FAQ hanteras som en granskningspåminnelse, inte ny redigeringsyta** —
  `FaqItem.FlagKey` styr redan visning/döljning automatiskt (sedan
  session 42), så det enda nya behovet var att INTE glömma bort att
  kolla FAQ-texten, inte att bygga om hur den visas.

## Teknisk karta (för framtida ändringar)

- `FeatureFlagOverride.RedoAttLanseras` (bool) — satt av
  `AdminFeatureIdeaController.SetStage` (när Stage blir
  `"lanseringsklar"` och idén har en `FlagKey`) eller manuellt via
  `PUT /api/admin/feature-flags/{key}/redo`.
- `Uppdatering.SchemalagdPubliceringUtc` (nullable) +
  `SchemalagdaFlaggorJson` (JSON string[]) — satt via
  `POST`/`PUT /api/admin/uppdateringar`.
- `ScheduledReleaseBackgroundService` (60s-poll, modellerad efter
  `SupportScheduledActionService`) — aktiverar flaggorna, publicerar
  posten om den har punkter, nollställer schemat (idempotens-vakt).
- Admin-UI: `FeatureFlagsAdmin.tsx` (redo-togglen),
  `AdminUppdateringar.tsx` → `FormPanel` (hela schemaläggningsflödet).

## Beslut 2026-10-04
Två separata kryssrutor i schemaläggningsflödet (steg 3, Uppdateringar),
inte en delad:
- **Push-kryssrutan** — auto-triggar "Ny version"-pushen till inloggade
  (push gäller bara dem) när den schemalagda posten publiceras. Den
  befintliga manuella knappen behålls för ad-hoc-pushar utanför en
  schemalagd post.
- **"Synas för besökare?"-kryssrutan** — "Ny version" gäller specifikt
  besökare (utloggade har ingen push att ta emot). Ikryssad: en
  "Ny version"-banner visas för besökare via det befintliga
  MaintenanceBanner-systemet (`App.tsx`/`MaintenanceBannerAdmin.tsx`,
  målgrupp Besökare, schemalagd till samma publiceringstidpunkt).

Inget av detta byggt än.

## Kopplat
- [[../Ideer/Uppdateringar-schemalagd-publicering|Uppdateringar
  schemalagd publicering]] — ursprungsidén (session 24, aldrig migrerad
  till valvet förrän nu), en bredare vision där bara en del byggdes här
- [[Checklista-innan-lansering|Checklista innan lansering]] — punkt 7
  ("avstängningsbar bakom en riktig feature-flag") är en förutsättning
  för att en funktion överhuvudtaget kan schemaläggas med det här verktyget
