---
typ: ide
status: fragor-olosta
uiGodkand: ej-bedomd
beroenden: ""
prioritet: ej-bedomd
pipelineNr: ""
kalla: "session 42, uppmärksammad av användaren under FAQ-genomgång"
---

# FAQ för utloggade besökare

Idag är FAQ (`FaqKort.tsx`) bara nåbar inloggad — den ligger i Support-fliken inuti `ProfilePage`, som visar `GästProfil` (bara Logga in/Skapa konto) för utloggade istället för det riktiga profilinnehållet (`ProfilePage.tsx:46`).

Det gjorde att en fråga som "Hur registrerar jag ett konto?" inte har någon publik att träffa — den som ser frågan har redan ett konto. Löst för nu genom att stryka den ur den publicerade FAQ-listan (session 42), men den bredare frågan är olöst.

## Öppna frågor
- Ska FAQ vara helt inloggad (som idag), helt publik, eller delad i två delmängder (en publik för "vad är det här/hur registrerar jag mig", en inloggad för kontospecifika how-to:s)?
- Om delad: var ska den publika delen visas — i `GästProfil.tsx`, på Om-sidan, eller en egen sektion?
- Finns det fler frågor i den nuvarande listan som egentligen är "pre-signup"-frågor (t.ex. vad kostar det, hur hanteras min data) som borde vara publika oavsett?

## Kopplat
- [[Funktioner/FAQ]] (om/när den skapas — vaultet har inte en egen Funktioner-not för FAQ än)
- `docs/vault/Grupper/support.md`
