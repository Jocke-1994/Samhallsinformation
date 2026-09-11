---
status: aktiv
typ: funktion
grupp: "[[konto|Konto]]"
uiPlats: "/register"
kodPlats: "OnboardingPage.tsx"
flagKey: ""
sedan: 2026-07-27
pausadVarfor: ""
fallgropar:
  - "\"Kör startguiden igen\" från profilen finns inte — bara nåbar via /register när utloggad"
---

# Onboarding-wizard

3-stegs guide (Konto → Källor → Klart) för nya konton, helt opt-in — varje
steg går att hoppa (Källor-steget kräver inget val).

## Status
Byggd session 24, mockup itererad flera varv. Skarp koppling mot backend
(riktiga källor, riktig `register()`) sedan session 25. Två buggar hittade
och fixade under en mobiltest-genomgång 2026-09-11 (PR #548, #549): ingen
väg att ångra ett valt källval i Källor-steget, och ett tyst sparfel om
källorna inte gick att spara efter kontot skapats.

## Teknisk plats
I appen: `/register`.
I koden: `OnboardingPage.tsx`, återanvänder `AllaKallorKort` från
[[../Grupper/mina-kallor|Mina källor]].

## Återkommande att tänka på
- Google-inloggning loggar in DIREKT i steg 1 (till skillnad från
  lösenordsvägen, där inloggning sker sist i steg 3) — `kontoSkapat`-flaggan
  i koden håller reda på vilket läge som gäller så redirect-bevakningen
  (som annars kickar ut redan inloggade besökare) inte stör mitt i guiden
- En misslyckad källsparning i steg 3 visar nu ett fel och låter
  användaren försöka igen istället för att svälja felet tyst (fixat
  2026-09-11)

## Kopplade FAQ

## Kopplade funktioner
- [[Autentisering]]
- [[../Grupper/mina-kallor|Mina källor]]
