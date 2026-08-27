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
