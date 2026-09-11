---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ej-bedomd
beroenden: "Kräver ett litet motsvarande arbete i det separata kundtjänstbot-projektet (deras #220) — den här planen täcker bara vår sida"
prioritet: ej-bedomd
pipelineNr: ""
kalla: "FAQ/0. Kopplas mot kundtjänst botten.md"
---

# FAQ-synk mot kundtjänstboten — hur håller vi den uppdaterad?

Formaliserad version av frågan i `FAQ/0. Kopplas mot kundtjänst botten.md`:
hur kopplar vi FAQ mot kundtjänstboten så den aldrig blir daterad?

## Bakgrund
Redan känt sedan session 47 (2026-09-09): kundtjänstboten är en fristående
AI-hybrid i ett eget projekt (fuzzy-matchad kunskapsbank → Claude-fallback
som växer KB:n automatiskt). En riktig KB-synk mot vår FAQ är redan
identifierad DÄR som en billig mellanlösning (#220 i kundtjänstbot-
projektet), som alternativ till ett större epic med live function-calling
mot vårt events-API (#203, parkerat, mycket större jobb).

## Verklig teknisk lucka hittad 2026-09-12
`GET /api/faq` (publikt — den rimliga endpointen för en extern konsument)
filtrerar BARA på `Publicerad`, inte på om frågans `FlagKey` faktiskt är
aktiv just nu. Det är medvetet och dokumenterat (`FaqItem.cs`) — flaggornas
`defaultAktiv`-värden finns bara i frontendens `featureFlags.ts`, backend
känner bara till admins avvikelser (`FeatureFlagOverrides`). Fungerar idag
eftersom enda konsumenten är vår egen frontend, som filtrerar om det själv.

En extern konsument som läser `/api/faq` direkt (kundtjänstboten) skulle
däremot få med frågor vars kopplade funktion är avstängd — boten skulle
kunna svara på frågor om något som inte ens syns i appen. Måste lösas
oavsett vilken synk-mekanism som väljs nedan.

## Föreslagen ordning
1. **Fixa filtreringsluckan i `/api/faq`** (görs oavsett synkval)
   - Flytta flagg-effektiv-status till backend: en liten statisk dictionary
     med samma `defaultAktiv`-värden som redan finns i `featureFlags.ts`,
     sammanslagen med `FeatureFlagOverrides`.
   - `GET /api/faq` returnerar bara frågor där `Publicerad = true` OCH
     (`FlagKey` är null ELLER flaggan är aktiv just nu).
   - Sidovinst: `FaqKort.tsx` kan sluta göra flaggfiltreringen själv.
   - Risk: två källor till samma `defaultAktiv`-sanning (frontend +
     backend) kan glida isär om en ny flagga bara läggs till på ena
     stället — kräver disciplin, eller på sikt en enda källa.

2. **Lägg till `UpdatedAt` på `FaqItem`**
   - Bara `CreatedAt` finns idag. En extern poller behöver kunna fråga
     "vad har ändrats sedan sist" istället för att hämta om ALLT varje
     gång. Litet tillägg — migration + sätt `UpdatedAt` vid varje
     `UpdateFaq`.

3. **Synk-mekanism — rekommendation: periodisk polling** (matchar #220)
   - Kundtjänstboten pollar `GET /api/faq` med jämna mellanrum (t.ex. varje
     timme, eller vid sessionsstart) och bygger om sin kunskapsbas.
   - Fördel: ingen ny endpoint/autentisering på vår sida utöver punkt 1–2,
     inget delat hemligt nyckelutbyte mellan projekten.
   - Nackdel: en fördröjning upp till pollingintervallet — acceptabelt för
     FAQ-innehåll som ändras sällan och inte är tidskritiskt.
   - Alternativ (webhook/push vid varje FAQ-ändring) är mer omedelbart men
     kräver autentiserad webhook, delad hemlighet, felhantering om boten är
     nere — inte värt det för FAQ-innehåll. Föreslår att inte bygga det.

4. **Cross-project-avstämning**
   - Vi kan bara bygga vår egen halva (punkt 1–2, plus dokumentera
     `/api/faq`-kontraktet). Själva pollingen byggs i kundtjänstbot-
     projektet (#220 där). Nästa steg: samma mönster som session 47 — en
     självständig, kontextfull fråga till den sessionen, med länk hit.

## Öppna frågor
- Ska punkt 1–2 (flagg-filtrering + `UpdatedAt`) byggas nu som en
  fristående förbättring, eller vänta tills kundtjänstbot-sidan är redo?
- Pollingintervall — någon känsla för hur färsk FAQ-informationen
  faktiskt behöver vara (minuter/timmar/en gång per dygn)?

## Kopplat
- Kundtjänstbot-projektets #220 (periodisk KB-synk, redan känt sedan
  session 47)
- Kundtjänstbot-projektets #203 (fullt live function-calling mot
  events-API, parkerat, separat och större)
