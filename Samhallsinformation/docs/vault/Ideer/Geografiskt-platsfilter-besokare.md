---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ej-bedomd
beroenden: ""
prioritet: ej-bedomd
pipelineNr: ""
kalla: "session 2026-10-04, användarens önskemål om att kunna filtrera redan som besökare"
---

# Geografiskt platsfilter för besökare

Idé: ett platsfilter i flödet, nåbart redan utan inloggning. Första
instinkten var "filtrera på län", men avstämt 2026-10-04 — det
användaren egentligen beskriver är **dynamiska pluppar/chips per plats
som redan finns i "Senaste nytt" just nu**, inte en filtrering mot de 21
formella svenska länen. Konkret exempel: finns det en händelse i
Botkyrka ska det finnas en "Botkyrka"-plupp i filtret. Finns ingen
Botkyrka-händelse finns ingen plupp.

**Rättelse från ursprungstexten:** jag skrev först att det INTE skulle
behövas en kommun→län-mappning för v1. Det stämmer inte längre efter
svaren på scenario 2+3 nedan — eftersom en länsvarning (SMHI) ska räknas
in automatiskt när man filtrerar på en kommun inom det länet (t.ex.
Botkyrka), måste systemet veta att Botkyrka ligger i Stockholms län.
Det kräver en statisk referenstabell (kommun → län, ca 290 rader,
Sveriges kommunindelning ändras i praktiken aldrig) — ett engångsjobb,
inte löpande underhåll, men ett genuint datajobb utöver att bara
aggregera `Geography`-strängar rakt av.

Status: 10 av 11 scenarier beslutade. Ett kvarstår, väntar på en
UI-skiss (se "Kvarstående frågor" längst ner).

## Beslut 2026-10-04 (efter dina svar)

1. **Grupperingsnivå** — platta pluppar, ingen nästling/gruppering.
   Botkyrka, Haninge och Stockholms län blir tre separata, jämbördiga
   pluppar sida vid sida — inte en expanderbar länsrubrik med kommuner
   under sig.
2. **Blandad granularitet** — en länsvarning (t.ex. SMHI på "Stockholms
   län") får sin EGEN plupp, OCH räknas in automatiskt för varje kommun
   inom länet. Det här är anledningen till att kommun→län-mappningen
   (se rättelsen ovan) faktiskt behövs.
3. **Vad en plupp filtrerar på** — att klicka "Botkyrka" visar ALLT som
   rör Botkyrka: direkta Botkyrka-märkta händelser OCH ärvda bredare
   händelser (länsvarningar, ev. nationella — se scenario 5).
4. **Flera pluppar samtidigt** — ja, flervalsbart (ELLER-logik). Vyn ska
   vara tydligt sektionerad per vald plats ("Dessa gäller Haninge",
   "Dessa gäller Botkyrka") snarare än en sammanslagen, odelad lista.
   UI-konsekvens: det här är i praktiken grupperade sektioner i
   resultatvyn, inte bara en filtrerad flat lista — viktigt att få med
   i skissen.
5. **Händelser utan plats** — ja, en egen väljbar "Nationellt"/"Hela
   Sverige"-plupp för händelser utan specifik ort (samma
   CLAUDE.md-fallback som redan gäller: saknas geografi = nationellt).
   Inte förvalt/automatiskt inkluderad — besökaren väljer den aktivt
   som vilken annan plupp som helst, annars är bilden för filtrerad
   "bara Botkyrka" renare.
6. **Tidsfönster** — bekräftat: pluppkatalogen byggs av de senaste 50
   händelserna, samma mängd `NewsFeed` redan hämtar för "Allt"-vyn.
   Ingen separat fråga mot backend bara för pluppkatalogen.
7. **Liveuppdatering** — bekräftat: ingen separat polling-mekanism
   byggs för v1. Pluppkatalogen räknas om varje gång den delade
   50-händelser-hämtningen (beslut 6) hämtas om — samma uppdateringstakt
   som resten av flödet redan har (sidladdning/fönsterfokus).
8. **Minns valet** — rekommendation: spara senaste plats-val i
   webbläsarens `localStorage` (samma mönster som t.ex. `theme`/
   `cookie_consent` redan använder för besökare utan konto), inte
   serverbundet eftersom ingen inloggning finns. Enkelt att rensa/byta.
   Invänder du inte: det här är beslutet.
9. *(omformulerad — se Kvarstående frågor)*
10. **Kombination med befintligt filter** — bekräftat: platsfiltret är
    en egen, fristående vy, INTE AND-kombinerad med det befintliga
    allvarlighetsfiltret (Alla/Kritisk/Viktigt/Bra att veta).
11. **Medlemmar också** — min rekommendation: ja, bygg det som en delad
    funktion från start, inte besökarspecifikt. `HomePage`/`NewsFeed`
    är redan samma komponent för besökare och medlemmar (bara "Mitt
    flöde" är inloggningsgated) — att även göra platsfiltret delat är
    alltså INTE merarbete, det är redan arkitekturen. Ingen konflikt
    med Polisen-bevakningar (session 35) — bevakningar är en stående
    push-prenumeration en medlem sätter upp i förväg, platsfiltret är
    en tillfällig vyinställning man växlar i stunden. Olika syften,
    kan leva sida vid sida.

## Kvarstående frågor

**9. Skalning vid många pluppar — UI-skiss klar, väntar på din favorit.**
Claude Artifact (Design-canvas): https://claude.ai/artifact/NRitLhJURPuw69QcJUsACA
— ett "Nuläge"-skärm (ingångspunkten, "📍 Filtrera på plats"-fliken) plus
fyra interaktiva varianter sida vid sida, alla med 22 exempel-pluppar,
klickbara (växla Botkyrka/Haninge/Stockholms län/Nationellt m.fl. och se
de sektionerade resultaten — inkl. SMHI:s länsvarning som ärvs in under
både Botkyrka och Haninge, enligt beslut 2+3):
  - **A — Skrollbar rad**: en rad, horisontell scroll
  - **B — Visa fler**: kort rad (8 st) + expanderbar knapp för resten
  - **C — Sökfält**: skriv för att hitta en specifik ort bland alla
  - **D — Fri radbrytning**: ingen gräns, raden växer nedåt över flera rader
Jag menade: om 50 händelser just nu råkar sprida sig över 20–30 olika
platser (inte bara ett fåtal), blir det en lång rad av pluppar att
visa på en gång. Hur ska UI:t hantera DEN situationen specifikt?
Exempel på alternativ (ingen rekommenderad ännu, vill se din reaktion
i skissen):
  - en horisontellt skrollbar rad med pluppar
  - en kort rad + en "Visa fler"-knapp som expanderar resten
  - ett sökfält ovanför pluppraden för att hitta en specifik ort
  - inget särskilt — låt raden radbryta över flera rader och acceptera
    att den blir hög
Jag bygger in alla fyra som alternativ i UI-skissen (Claude Artifact)
så du kan peka på den du gillar istället för att behöva svara i text.

## Kopplat
- [[../Verktyg/Schemalagd-lansering|Schemalagd lansering]] — samma
  avstämningsrunda (2026-10-04) tog upp en relaterad men separat idé
  (besökar-banner för "Ny version")
- `backend/Models/CanonicalEvent.cs` (`Geography`-fältet) och
  `backend/Ingestors/*.cs` (hur varje källa fyller i det) — tekniska
  utgångsläget för vad som faktiskt går att aggregera idag
- Ny, inte påbörjad: en statisk kommun→län-referenstabell (konsekvens
  av beslut 2) — hör hemma i backend, troligen en seedad lookup-tabell
  eller en inbäddad konstant-lista, inte en ingestor-ändring
