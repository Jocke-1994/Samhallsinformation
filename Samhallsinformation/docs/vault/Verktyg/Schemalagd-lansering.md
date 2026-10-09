---
typ: verktyg
status: klart  # giltiga värden: att-gora | pagaende | klart
uiGodkand: ja  # gäller "Ny version"-tillägget, godkänt 2026-10-08 (se Beslut 2026-10-08)
pipelineNr: "2"  # Funktionsidé #2 i adminpanelens pipeline, stadie: Triage
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
   2026-10-04 nedan) — inte byggt än. Utökat 2026-10-08 med annonsering
   i förväg och en banderoll för alla (se Beslut 2026-10-08).

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

Inget av detta byggt än. Inlagt som Funktionsidé #2 i adminpanelens
pipeline (lokal, 2026-10-04), stadie: Triage.

## Beslut 2026-10-08
UI godkänt efter två skissrundor i en klickbar Artifact:
https://claude.ai/artifact/LbFxKHDWR2t4xsvVWDbJhb (version 2 är den
godkända). Ersätter och bygger ut Beslut 2026-10-04 på följande punkter:

- **Inget syns när man sparar.** Allt sker vid de schemalagda tiderna.
  Formulärets sidfot visar en sammanfattning av exakt vad som händer
  vid varje tidpunkt.
- **Annonsera i förväg** (ny kryssruta, eget datum). Två tidpunkter
  istället för en:
  - *Annonsering* (t.ex. 10 okt): posten publiceras med punkttypen
    "Kommer snart" (finns redan) och texten "Släpps 15 oktober".
  - *Lansering* (t.ex. 15 okt): flaggorna slås på, punkterna byts
    automatiskt från "Kommer snart" till "Ny funktion" och
    "Släpps …"-texten tas bort.
  - Utan kryssrutan: som idag, en enda tidpunkt.
  - Kräver ett andra nullable datumfält på `Uppdatering` och att
    `ScheduledReleaseBackgroundService` hanterar två faser.
- **Push** ("Skicka push till inloggade"): version + meddelande
  (meddelandet förifyllt från titeln). Med annonsering väljer man
  "Skicka vid": Annonsering / Lansering / Båda. Annonseringspushen har
  rubriken "Kommer 15 oktober", lanseringspushen "Ny version: X". Den
  manuella knappen finns kvar för ad-hoc.
- **Banderollen når de som berörs av nyheten** (ändrat från
  2026-10-04, där den bara var för besökare):
  - Berör nyheten alla (besökare, användare, support, admin) → målgrupp
    "Alla" i MaintenanceBanner. Inloggade utan push hade annars aldrig
    fått veta om den.
  - Berör den bara inloggade → målgrupp "Användare" (inloggade, alla
    roller). Ingen banderoll till besökare.
  - Målgruppen härleds automatiskt från punkternas befintliga "Syns
    för"-val: minst en punkt "Alla (även besökare)" → Alla, bara
    "Endast inloggade" → Användare. Formuläret visar resultatet ("Visas
    för: alla" / "Visas för: inloggade") så det aldrig är en gissning.
  - Kryssrutan heter "Visa banderoll på sajten" istället för "Synas för
    besökare?". En post utan punkter (ren flagg-aktivering) kan inte få
    banderoll — det finns inget att visa.
  - Två rader: rubrik + vad som är nytt (fritext, förifylld från
    titeln) + länken **"Läs mer"** till `/uppdateringar`. På dator på
    en rad, på mobil på varsin rad.
  - Rubriken följer fasen: grön **"Kommer 15 oktober"** från
    annonsering till lansering, violett **"Nytt på
    Samhällsinformation"** från lansering och 3/7/14 dagar framåt.
  - Kräver ett nytt fält på `MaintenanceBanner` (Drift / Nyhet) så
    nyhetsbanderollen inte blir orange som driftmeddelanden.
  - Skapas av bakgrundstjänsten när fasen körs, inte när posten sparas
    — tas schemat bort i förväg blir inget kvar att städa. Märks "Från
    lansering" i Driftmeddelanden.
  - Den som stängde "Kommer"-banderollen ser "Nytt"-banderollen en gång
    till (nytt innehåll = ny stängs-nyckel, redan så det fungerar).
- **Kopplade FAQ-frågor listas** i formuläret (inte bara ett antal)
  med vad som händer med var och en: publicerad → "Syns vid
  lansering", utkast → "Förblir dold". Inget nytt beteende, bara
  synliggjort — `FaqItem.FlagKey` styr redan visningen.

Redo att gå från Triage till Bygger när kodarbetet faktiskt startar
(se [[../1. Öppna_tankar/Flöde ny idé|Rutin per pipeline-steg]]).

## Byggstatus
Byggs i fyra delar, en PR per del, mergade i tur och ordning.

- [x] **Del 1 — banderollens stil** (PR #673, mergad 2026-10-08):
  `MaintenanceBanner.Stil` (Drift/Nyhet/Kommande), `Rubrik`, `LankUrl`
  (bara intern sökväg). Ny `Banderoll`-komponent, adminformuläret för
  driftmeddelanden fick stil/rubrik/länk. Går redan att använda manuellt.
- [ ] **Del 2 — push + banderoll vid lansering**: de två kryssrutorna i
  Uppdateringar, körda av `ScheduledReleaseBackgroundService`. Banderollen
  skapas av tjänsten (inte vid sparande), målgrupp härledd från
  punkternas "Syns för".
- [ ] **Del 3 — annonsering i förväg**: andra datumfält på `Uppdatering`,
  två faser, Kommer snart → Ny funktion, Kommande → Nyhet, push "Skicka
  vid".
- [ ] **Del 4 — FAQ-listan** i formuläret.

Pipeline: flyttad från Triage till **Bygger** av användaren 2026-10-09
(Funktionsidé id 8 i produktionens adminpanel).

## Kopplat
- [[../Ideer/Uppdateringar-schemalagd-publicering|Uppdateringar
  schemalagd publicering]] — ursprungsidén (session 24, aldrig migrerad
  till valvet förrän nu), en bredare vision där bara en del byggdes här
- [[Checklista-innan-lansering|Checklista innan lansering]] — punkt 7
  ("avstängningsbar bakom en riktig feature-flag") är en förutsättning
  för att en funktion överhuvudtaget kan schemaläggas med det här verktyget
