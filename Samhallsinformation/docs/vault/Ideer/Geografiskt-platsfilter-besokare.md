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
instinkten var "filtrera på län", men avstämt 2026-10-04 (se
`docs/vault/Verktyg/Schemalagd-lansering.md`s syskonresonemang i chatten)
— det användaren egentligen beskriver är **dynamiska pluppar/chips per
plats som redan finns i "Senaste nytt" just nu**, inte en filtrering mot
de 21 formella svenska länen. Konkret exempel: finns det en händelse i
Botkyrka ska det finnas en "Botkyrka"-plupp i filtret. Finns ingen
Botkyrka-händelse finns ingen plupp.

Tekniskt enklare än först trott: `CanonicalEvent.Geography` är redan
fritext per källa (Polisen = kommun, extraherat ur titeln; SMHI = eget
varningsområde, ofta redan länsnivå; Krisinformation/Trafikverket = egen
granularitet). En ren "visa distinkta platser som finns i flödet"-
funktion kräver alltså ingen ny kommun→län-mappningstabell för v1 — bara
en aggregering av redan existerande `Geography`-värden.

Flera detaljer är dock olösta — se scenarierna nedan, väntar på svar
innan detta kan gå vidare.

## Öppna frågor — scenarier att ta ställning till

1. **Grupperingsnivå.** Botkyrka och Haninge har båda en händelse just
   nu — visas de som två separata, platta pluppar, eller grupperade
   under en gemensam "Stockholms län"-rubrik/plupp man kan expandera?
2. **Blandad granularitet.** SMHI utfärdar en varning för hela
   "Stockholms län" (ingen specifik kommun). Blir det en egen plupp
   ("Stockholms län") helt separat från "Botkyrka", eller ska den
   automatiskt räknas in om besökaren filtrerar på "Botkyrka" (eftersom
   Botkyrka ligger i Stockholms län)?
3. **Vad en plupp faktiskt filtrerar på.** Om besökaren klickar
   "Botkyrka" — visas BARA Botkyrka-märkta händelser, eller även
   bredare händelser som täcker Botkyrka (t.ex. en nationell SMHI-
   varning, eller scenario 2:s länsvarning)?
4. **Flera pluppar samtidigt.** Går det att välja flera pluppar på en
   gång (t.ex. Botkyrka + Haninge, ELLER-logik — visa händelser för
   endera), eller bara en plats åt gången?
5. **Händelser utan plats.** Vissa händelser saknar `Geography` helt
   (CLAUDE.md-principen: saknas geografi räknas det som nationellt).
   Finns en "Hela Sverige"/nationell-plupp, och är den vald som
   standard eller måste besökaren aktivt välja den också?
6. **Tidsfönster för vilka pluppar som visas.** Styrs pluppkatalogen av
   exakt det som råkar vara laddat på skärmen just nu (NewsFeed hämtar
   50 senaste), eller ett bredare fönster (t.ex. senaste 7 dagarna) så
   en plats inte plötsligt försvinner ur filtret bara för att dess
   händelse skrollat ur vy?
7. **Liveuppdatering.** Ska pluppkatalogen uppdateras live i takt med
   att nya händelser kommer in (polling), eller räcker det att den
   sätts vid sidladdning?
8. **Minns valet.** Om en besökare väljer "Botkyrka" och sedan laddar
   om sidan eller kommer tillbaka senare — ska valet komma ihåg
   (webbläsarlokalt, ingen inloggning finns) eller nollställas varje
   besök?
9. **Skalning vid många pluppar.** Om 20-30 olika platser har
   händelser samtidigt — skrollbar rad, "visa fler"-knapp, sökfält,
   eller något annat? Finns ett tak på hur många som visas samtidigt?
10. **Kombination med befintligt filter.** Hur samspelar platspluppen
    med det redan befintliga allvarlighetsfiltret (Alla/Kritisk/
    Viktigt/Bra att veta) — AND-kombinerade (båda måste matcha), eller
    är platsfiltret en helt egen, fristående vy?
11. **Medlemmar också?** Ska samma pluppfilter senare även gälla i
    "Mitt flöde" för inloggade, eller är det här medvetet en
    besökarspecifik funktion (jfr session 35s Polisen-bevakningar, som
    redan låter medlemmar bevaka specifika kommuner på ett annat sätt)?

## Kopplat
- [[../Verktyg/Schemalagd-lansering|Schemalagd lansering]] — samma
  avstämningsrunda (2026-10-04) tog upp en relaterad men separat idé
  (besökar-banner för "Ny version")
- `backend/Models/CanonicalEvent.cs` (`Geography`-fältet) och
  `backend/Ingestors/*.cs` (hur varje källa fyller i det) — tekniska
  utgångsläget för vad som faktiskt går att aggregera idag
