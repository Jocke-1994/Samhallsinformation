---
typ: index
---

# Hur Claude jobbar

Här visas med enkla bilder hur Claude tänker och jobbar när du ber om något.

**Grundidén:** alla uppgifter har samma skelett (förstå → läsa på → planera → göra → kontrollera → lämna över).
Men olika sorters uppgifter gör olika steg stora eller små. Precis som en kock: receptet ser
likadant ut för soppa och tårta, men tårtan kräver mycket mer på "smaka och kontrollera".

## Börja här
- [[0. Grundflödet]]: skelettet som gäller allt
- [[Välja tester]]: hur Claude avgör vilka kontroller som måste göras

## Varianter (en per sorts uppgift)
| Uppgift | Status |
|---|---|
| [[Ny funktion]] | ✅ ritad (ej verifierad mot riktigt bygge än) |
| Buggfix | planerad |
| Bara backend (inget syns på skärmen) | planerad |
| Bara frontend (bara utseende/skärm) | planerad |
| Ny datakälla (myndighet) | planerad |
| Code review | planerad |
| Bara dokumentation | planerad |
| Felsökning ("det funkar inte") | planerad |
| När Claude tar hjälp av andra agenter | planerad |

## Loggar från riktiga uppgifter
| Logg | Sorts uppgift | Förbättring som kom ur den |
|---|---|---|
| [[Logg - Vad är nytt]] | Ny funktion (alla lager) | Skärmdump tidigare, skript för lokal körning, minnesregler → tester |
| [[Logg - Migrationsregel som test]] | Skyddsnät | Databasregeln är nu automatisk (PR #707) |

## Iakttagelser utan egen logg
- **2026-11-02, källresearch:** Claude valde kandidater ur huvudet ("myndigheter som liknar de vi har") och missade Migrationsverket. Kontrollerna var noggranna, men **urvalet var gissat**. Samma mönster som i [[Logg - Vad är nytt]]: man letar där man förväntar sig att hitta. **Förbättring:** utgå från en fullständig lista (register) och låt ett skript gå igenom allt — därefter gör människa + Claude urvalet. Kontrollera dessutom skriptet mot facit (kända källor): första versionen missade flera, inklusive två vi redan använder.

## Hur diagrammen tas fram
1. Claude ritar utifrån hur det brukar gå till (det du läser nu).
2. Vi bygger en riktig liten funktion, och Claude skriver ner varje beslut medan arbetet pågår.
3. Vi jämför och rättar diagrammen där verkligheten skilde sig.

> Status: steg 1 påbörjat 2026-11-02.
