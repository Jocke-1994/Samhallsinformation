---
typ: ide
status: redo-for-pipeline  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
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

Status: alla 11 ursprungliga scenarier beslutade, plus två tillkomna
mobil-frågor (12-13). Redo för pipelinen — se Kopplat för kvarvarande
tekniska förberedelser (referenstabellen) innan byggstart.

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
9. **Skalning vid många pluppar** — favoriten är en kombo av Variant B
   (Visa fler) och C (Sökfält), inte någon av de fyra renodlade. Se
   beslut 12 nedan för den slutgiltiga mobil-riktningen.
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

## Beslut 2026-10-04, forts. — mobil

12. **Mobil-riktning** — favoriten är en kombo av B (Visa fler) och C
    (Sökfält), inte någon av de fyra renodlade. Byggd som en femte
    mobilskiss ("E · B + C kombo") i samma Artifact: sökfältet ligger
    alltid överst (genväg för den som redan vet vad den letar efter),
    och under det en kort rad (6 pluppar, som B) med "Visa fler" för
    den som bara vill bläddra. Så fort man skriver i sökfältet söks det
    över HELA listan (inte bara de 6 synliga), inte bara de redan
    expanderade.
13. **Sökträff som saknar en aktiv händelse** (testat med "Kungälv") —
    **omvärderat och beslutat annorlunda än mitt första förslag.** Sökfältet
    söker mot ALLA svenska kommuner/län, inte bara de som redan har en
    aktiv plupp. En ort utan en aktuell händelse visas som en gråmarkerad,
    streckad plupp märkt "(0)" — synlig men INTE klickbar — med en
    förklarande rad: "Gråmarkerade orter har inga aktuella händelser just
    nu — gå tillbaka hit senare om det händer något." Byggt och testbart
    live i Variant E (prova "Kungälv", "Kiruna", "Halmstad", "Kalmar",
    "Örnsköldsvik" eller "Växjö").
    **Teknisk konsekvens:** kräver en riktig, komplett katalog att söka
    mot — rekommendation: SCB:s officiella kommun- och länslista
    (~290 + 21), inte ett försök att räkna upp varje områdessträng
    källorna råkar producera. Samma referenstabell som redan krävs för
    kommun→län-mappningen (beslut 2) — i praktiken bara en extra
    "har en aktiv händelse just nu"-flagga på den tabellen, ingen ny
    separat datakälla.

## UI-skiss

Claude Artifact (Design-canvas, interaktiv): https://claude.ai/artifact/NRitLhJURPuw69QcJUsACA
— ett "Nuläge"-skärm (ingångspunkten, "📍 Filtrera på plats"-fliken),
fyra renodlade desktop/mobil-varianter (A skrollbar rad, B visa fler,
C sökfält, D fri radbrytning) och en femte, vald mobil-kombo (E · B+C)
med sök-mot-alla-platser + gråmarkerade inaktiva pluppar (beslut 13).
Alla pluppar klickbara, sektionerad resultatvy inkl. SMHI:s länsvarning
som ärvs in under både Botkyrka och Haninge (beslut 2+3).

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
