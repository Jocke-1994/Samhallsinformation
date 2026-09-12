---
typ: beslut
status: öppen
datum: 2026-08-19
---

# Beslut - Polisen-bevakningar, egna tester klara?

Byggd och fungerande (PR #483-485), men flaggan hålls medvetet avstängd
tills du själv kört tester i skarp produktion (så du kan se hur många
bevakningar folk faktiskt skapar innan taket eventuellt höjs igen — det
sänktes redan en gång, 10 → 5).

## Påverkar
- [[Polisen-bevakningar]]

## Öppen fråga — besvarad, men avslöjade ett problem
**Är dina egna produktionstester klara?** Nej — du aktiverade en bevakning
men fick inga aviseringar, okänd orsak. Två vägar framåt: fortsätt felsöka
tills det fungerar, eller slå på flaggan ändå och justera under tiden
skarpt.

## Att undersöka
Detta är en riktig teknisk avvikelse, inte bara ett produktbeslut — hör
ihop med [[Push-notiser]]s kända fallgrop (två oberoende gates måste båda
vara sanna: `User.PushEnabled` + enhetens egen prenumeration). Innan flaggan
slås på bör orsaken hittas, annars riskerar "ingen fick notiser"-buggen att
gå live samtidigt som funktionen. Värt en egen felsökningsrunda:
webbläsarens prenumerationsstatus, `User.PushEnabled`, och om
`PolisenBevakningMatcher` faktiskt matchade någon skarp händelse under
testperioden.

## Omtest 2026-09-12 — resultatet oklart, en ny riktig lucka hittad
Du utökade dina befintliga bevakningar med fler, men svaret säger inte om
du faktiskt fick en avisering den här gången eller inte — **behöver ett
rakt svar på det** för att kunna gå vidare.

Samtidigt hittade du en verklig, bekräftad lucka: **det finns ingenstans i
adminpanelen där man kan se en användares push-inställningar** (`Anvandare.
tsx` har noll referenser till `PushEnabled`/`PushNyaHandelser`, och inget
backend-endpoint exponerar det för admin — bara självbetjänings-endpoints
för den inloggade användaren själv, verifierat i koden 2026-09-12). Din
egen beskrivna omväg ("aktivera push i feature flag, logga in som
användaren själv, aktivera/avaktivera där") är alltså den enda vägen som
faktiskt finns idag — och du har rätt i att det inte borde behöva vara så.

## Öppna frågor
- **Fick du en avisering?** Svar 2026-09-12: inte än, men bevakningarna
  har bara varit aktiva ~1 timme — inte en slutsats än, du avvaktar
  ytterligare några timmar innan det räknas som ett verkligt "nej"
- Ska admin-insyn i en användares push-inställningar (läsläge räcker för
  felsökning, inget krav på att kunna ÄNDRA dem åt användaren) byggas som
  en egen liten uppgift?
