---
typ: ide
status: avfardad
uiGodkand: ej-bedomd
beroenden: ""
prioritet: ej-bedomd
pipelineNr: ""
kalla: "session 42, uppmärksammad av användaren under FAQ-genomgång"
---

# FAQ för utloggade besökare

Idag är FAQ (`FaqKort.tsx`) bara nåbar inloggad — den ligger i Support-fliken inuti `ProfilePage`, som visar `GästProfil` (bara Logga in/Skapa konto) för utloggade istället för det riktiga profilinnehållet (`ProfilePage.tsx:46`).

Det gjorde att en fråga som "Hur registrerar jag ett konto?" inte har någon publik att träffa — den som ser frågan har redan ett konto. Löst för nu genom att stryka den ur den publicerade FAQ-listan (session 42), men den bredare frågan är olöst.

## Avfärdad — beslut 2026-09-12
FAQ förblir inloggad-bara. Besökare med frågor hänvisas till
kundtjänstboten istället för en publik FAQ-yta — den täcker redan
pre-signup-frågor utan att vi behöver bygga och underhålla en separat
publik sektion. Samma beslut löser GitHub-issuet om publik FAQ (#66) och
gäller även SMS-mallsektionen därifrån — bara aktuellt OM SMS någonsin
byggs som notifieringskanal, inte annars.

## Kopplat
- [[Funktioner/FAQ]] (om/när den skapas — vaultet har inte en egen Funktioner-not för FAQ än)
- `docs/vault/Grupper/support.md`
