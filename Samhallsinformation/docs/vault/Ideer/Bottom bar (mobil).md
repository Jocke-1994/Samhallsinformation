---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ej-bedomd  # giltiga värden: ja | nej | ej-bedomd
beroenden: "Väntar på att appen faktiskt har flera tunga destinationer att navigera mellan — se Öppna frågor. Inte en kodfråga just nu."
prioritet: ej-bedomd  # giltiga värden: hog | medel | lag | ej-bedomd
pipelineNr: ""
kalla: "session 2026-08-27"
---

# Bottom bar (mobil)

Idé: en bottom navigation bar för mobilvyn (samma mönster som t.ex.
Instagram/Spotify — 3–5 ikoner längst ner, alltid synliga).

## Varför inte bara bygga den
En bottom bar tjänar ett navigationsproblem med FLERA tunga destinationer.
Appen har idag egentligen bara **en** tung destination (källflödet) plus
lättviktiga inställningar/profil som redan sitter i den utfällbara
sidomenyn. Att bygga baren nu skulle bli UI-krom utan riktigt innehåll
bakom knapparna, och den skulle konkurrera med hamburgermenyn som ett
andra, parallellt navigationssystem.

De enda kandidaterna som diskuterades (Flöde, Sparat, Profil, ev. Notiser)
kändes tunna — inte fel, men inte heller tillräckligt för att motivera
permanent skärmyta på små telefoner.

## Öppna frågor
- Finns det tillräckligt många TUNGA destinationer för att en bottom bar
  ska tjäna ett riktigt syfte? Två kända kandidater som skulle kunna ändra
  på det om de byggs — **inte en uttömmande lista** (förtydligat
  2026-09-12, oklart ännu vilka fler som kan dyka upp):
  - Ett citizen-facing **Sök** (Händelsesök finns idag bara på
    admin-sidan)
  - **Bevakningar** som en egen förstaklasssida, istället för begravd
    under Konto
- Om/när någon av dessa byggs: räcker det, eller behövs fler destinationer
  innan baren är värd att bygga?

## Kopplat
- [[Polisen-bevakningar]] — nuvarande hemvist för bevaknings-UI:t (under
  Konto/Mina källor), skulle kunna bli en egen bottom bar-flik
