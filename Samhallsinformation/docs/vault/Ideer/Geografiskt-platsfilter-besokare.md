---
typ: ide
status: i-pipeline  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ja
beroenden: ""
prioritet: ej-bedomd
pipelineNr: "1"  # Funktionsidé #1 i adminpanelens pipeline (lokal, 2026-10-04), stadie: Testar
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

Status: alla 11 ursprungliga scenarier beslutade, plus tre tillkomna
UI-frågor (12-14). **UI-riktning godkänd 2026-10-04** — Variant E
(B+C-kombo) för både desktop och mobil, se beslut 14. Redo för
pipelinen — se Kopplat för kvarvarande tekniska förberedelser
(referenstabellen) innan byggstart.

**Kommun→län-referenstabellen byggd 2026-10-09** (lokal gren
`feat/kommun-lan-referenstabell`, väntar på granskning — INTE pushad
än): `backend/Application/Geografi/KommunLan.cs`, en inbäddad
konstantlista (inte en databastabell) med Sveriges 290 kommuner mot
sina 21 län, källa SCB via det öppna "kommunkoder"-npm-paketet,
stickprovskontrollerad. 21 egna tester gröna. Sista tekniska
förberedelsen innan Triage → Bygger är därmed klar — resten
(aggregeringslogik mot `CanonicalEvent.Geography`, ny `NewsFeed`-vy,
"har en aktiv händelse just nu"-flaggan från beslut 13) är inte
påbörjat och är ett betydligt större jobb, inte gjort i samma svep.

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
14. **Slutgiltig UI-riktning, godkänd 2026-10-04** — Variant E
    (chip-baserad B+C-kombo) för BÅDE desktop och mobil, inte någon av
    de andra renodlade varianterna. En alternativ presentation (Variant
    F, en riktig autocomplete-dropdown med namn+antal per rad, t.ex.
    "Kungälv — 0") byggdes och testades också, men chip-varianten (E)
    är den godkända — F ligger kvar i skissen som ett övervägt men
    avfärdat alternativ, inte byggstart-underlag.
    Konkret uppbyggnad (båda bredderna): sökfält alltid överst (sök mot
    ALLA platser, grå streckad "(0)"-plupp för de utan aktuell händelse
    — beslut 13) + en kort rad redan-aktiva platser (8 på desktop, 6 på
    mobil) med en "Visa fler (+N)"-knapp som expanderar resten. Skriver
    man i sökfältet vinner sökningen över "Visa fler" och söker alltid
    mot hela listan, inte bara de redan synliga pluckarna.

## Beslut 2026-10-09 — plupp-matchning, SMHI under utredning

Verifierat mot riktig lokal data (inte bara antagande) innan matchningen
byggdes: `backend/Application/Geografi/PlatsMatchare.cs`, enkel exakt
(skiftlägesokänslig) matchning av `Geography` mot kommun/länsnamnen i
`KommunLan` — ingen fuzzy-logik, ingen textutvinning ur fria meningar.

- **Polisen** (~99% av händelserna): ren kommun- eller länstext
  ("Botkyrka", "Hallands län") — matchar rent, bär huvuddelen av v1.
- **Trafikverket**: länsnamn, ibland med en vägsträcka bakom
  ("Stockholms län E4") — matchar när det bara är länet, annars null.
- **Krisinformation**: har i praktiken aldrig en Geography just nu —
  redan täckt av det befintliga "ingen plats = Nationellt"-fallet
  (beslut 5), inget extra jobb.
- **SMHI — medvetet under utredning för v1.** Dess `Geography` är fri
  text (havsområden som "Skagerrak", hela meningar som "Delar av
  Gävleborgs län", flerläns-beskrivningar) som nästan aldrig matchar en
  exakt kommun/länssträng. En riktig SMHI-specifik tolkning (extrahera
  länsnamn ur en mening, hantera havsområden, dela upp flerläns-
  beskrivningar) är ett eget, separat jobb — inte löst här. Tills dess
  deltar SMHI:s händelser inte i platsfiltret; de syns som vanligt i
  det ofiltrerade flödet. **Konsekvens för UI-skissens exempel** (rad
  140-141 nedan): en riktig SMHI-länsvarning triggar i praktiken sällan
  ärvningen till Botkyrka/Haninge som visas i mockupen — mekaniken
  (beslut 2) är fortfarande korrekt och fungerar redan för Polisen/
  Trafikverkets länsnivå-träffar, det är bara SMHI specifikt som inte
  bidrar förrän den egna tolkningen byggs.
- En `Geography`-sträng som FINNS men inte går att tolka (SMHIs fall)
  räknas INTE som "Nationellt" — det skulle vara missvisande (en
  regional varning som påstås gälla hela Sverige). Den utesluts helt
  enkelt ur platsfiltret, "Nationellt" gäller bara när `Geography`
  helt saknas.

18 egna tester, inkl. verifiering mot riktiga SMHI/Trafikverket-strängar
hittade i den lokala databasen. Byggt och mergat i tre PR:ar: #675
(kommun→län-referenstabell), #676 (sektionerad resultatvy/plupp-
matchning), #677 (frontend-UI, Variant E), bakom flaggan
`flode_platsfilter` (av som standard). Pipeline flyttad till **Testar**
2026-10-19 — manuell/automatiserad verifiering (Checklista innan
lansering) kvar innan Lanseringsklar.

## Beslut 2026-11-03 — efter lansering: Trafikverket + dygnsfönster

Lanserat 2026-11-03 kl. 09:00. Direkt efteråt visade filtret bara 4
pluppar i produktion. Två fel, verifierade mot produktionens API:

1. **Trafikverket matchade aldrig.** Antagandet ovan (2026-10-09:
   "Stockholms län E4") stämde inte. Ingestorn skriver länets grundnamn
   utan "län", ofta med vägnummer: `Skåne`, `Skåne E6`,
   `Västra Götaland Väg 1040`.
2. **Fönstret med 50 händelser (beslut 6) var för smalt.** Trafikverket
   står för ~95 % av alla händelser, så de 50 senaste var 46
   Trafikverket + 4 Polisen och täckte bara ~1,5 timme.

**Beslut:**
- Trafikverket får en egen, källmedveten matchningsregel (explicit
  tabell med 21 län). **En Trafikverket-händelse syns bara under länets
  egen plupp och ärvs inte till kommunerna** (ersätter beslut 2 för
  just Trafikverket). Vägarbeten på E6 i Skåne är inte en varning för
  hela länet, och skulle annars fylla varje kommun. Riktiga
  länsvarningar (Polisens "Hallands län") ärvs som förut.
- **Beslut 6 ändrat:** katalogen och sektionerna bygger på senaste
  24 timmarna i stället för de 50 senaste. Max 50 händelser per sektion.
- Märket "Länsvarning — gäller hela …" visas bara i kommunsektioner.

PR #715. Verifierat i produktion direkt efter deploy (10:15 UTC):
214 aktiva pluppar (20 län, 193 kommuner, Nationellt). Malmö-sektionen
visar bara Polisen, Skåne län visar Trafikverkets vägsituationer.

## UI-skiss

Claude Artifact (Design-canvas, interaktiv): https://claude.ai/artifact/NRitLhJURPuw69QcJUsACA
— **godkänd 2026-10-04.** Innehåller: ett "Nuläge"-skärm (ingångspunkten,
"📍 Filtrera på plats"-fliken), fyra renodlade desktop/mobil-varianter
(A skrollbar rad, B visa fler, C sökfält, D fri radbrytning) byggda
under utforskningen, **Variant E i både desktop- och mobilbredd — den
godkända, slutgiltiga riktningen** (beslut 14), ett exempelresultat
("sök Kungälv → 0 träffar") och Variant F (autocomplete-dropdown,
övervägd men inte vald). Alla pluppar klickbara, sektionerad resultatvy
inkl. SMHI:s länsvarning som ärvs in under både Botkyrka och Haninge
(beslut 2+3).

## Kopplat
- [[../Verktyg/Schemalagd-lansering|Schemalagd lansering]] — samma
  avstämningsrunda (2026-10-04) tog upp en relaterad men separat idé
  (besökar-banner för "Ny version")
- `backend/Models/CanonicalEvent.cs` (`Geography`-fältet) och
  `backend/Ingestors/*.cs` (hur varje källa fyller i det) — tekniska
  utgångsläget för vad som faktiskt går att aggregera idag
- Kommun→län-referenstabellen (konsekvens av beslut 2) och
  plupp-matchningen (beslut 2026-10-09) är byggda — se ovan.
