---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ej-bedomd  # giltiga värden: ja | nej | ej-bedomd
beroenden: "Schemalagd lansering (klar) och Prova själv-knappen 'aktivera-push' (PR #717) finns redan att bygga vidare på."
prioritet: ej-bedomd  # giltiga värden: hog | medel | lag | ej-bedomd
pipelineNr: ""
kalla: "din idé 2026-11-07 (session 59), efter att 1.2 Push annonserats som bara 'Släpps …'"
---

# Annonsering med intresselista

Ändrar hur en **annonsering** (trailern före lanseringen) ser ut. I dag visar
den bara "Släpps fredag 13 november" och döljer resten. I stället ska den
berätta allt om vad som kommer, och låta folk anmäla sig i förväg.

## Beslutat 2026-11-07
- **Riktiga texten visas direkt** under annonseringen, inte bara "Släpps …".
- **Datumet syns** (när den släpps).
- **Aktivera-knappen syns och går att trycka på redan under annonseringen**,
  men funktionen slås inte på förrän vid lanseringen. Att trycka blir som
  att skriva upp sig på en **intresselista**: vid lanseringen aktiveras
  funktionen automatiskt för alla som tryckt.
- **Texten säger inte var funktionen ligger**, bara "för att aktivera, klicka
  här". Den som inte trycker hittar funktionen ändå på sin vanliga plats
  (t.ex. Konto).

Detta är exakt den "förhandsprenumeration" som
[[Uppdateringar-schemalagd-publicering]] avvaktade 2026-10-03 i väntan på ett
konkret behov. Nu finns behovet.

## Öppna frågor
- **Funktioner utan något att aktivera** (t.ex. Dela): två alternativ från
  dig — antingen säger annonseringen bara att funktionen kommer och var man
  hittar den, ELLER så visar den bilder på hur det kommer se ut. Inte valt än.
- **Platsetiketten** ("Konto", "Nyhetsflöde" — den lilla etiketten som varje
  punkt i Uppdateringar har i dag): ska den synas, döljas, eller bara döljas
  under annonseringen? Hänger ihop med frågan ovan — om annonseringen ska
  säga var man hittar funktionen kan etiketten vara just det.
- Vad händer för en utloggad besökare som trycker Aktivera under
  annonseringen? (I dag: "kräver konto →".)

## Kopplat
- [[Uppdateringar-schemalagd-publicering]] — förhandsprenumerationen som
  avvaktades
- [[../Verktyg/Schemalagd-lansering|Schemalagd lansering]] — det byggda
  annonsering/lansering-flödet
- [[Prova-sjalv-lankar]] — Aktivera-knappen i nyheten
