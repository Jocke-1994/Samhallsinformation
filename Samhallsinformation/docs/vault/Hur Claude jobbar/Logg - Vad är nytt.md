---
typ: claude-logg
funktion: Vad är nytt-modal
start: 2026-11-02
---

# Logg — Vad är nytt-modal

Claude skriver ner varje beslut medan arbetet pågår. Efteråt jämförs loggen med
[[Ny funktion]] och [[Välja tester]] för att se var diagrammen stämde och var de inte gjorde det.

Format: **vad jag gjorde** → *varför*.

## Steg 1 — Förstå
1. **Läste idé-noten `Ideer/Vad ar nytt-modal.md`** → *för att se om beteendet redan är bestämt.* Det var det: varje release, en kryssruta avgör, djuplänk är "trevligt men inget krav".
2. **Kollade att funktionen inte redan finns** (sökte efter "vad är nytt"/"WhatsNew" i koden) → *projektet har tidigare haft färdigbyggda men bortglömda funktioner.* Inga träffar.

## Steg 2 — Läsa på
3. **Läste `Models/Uppdatering.cs`** → *det är "huset" modalen ska bygga på.* Fynd: det finns redan två kryssrutor av exakt samma sort (`SkickaPush`, `VisaBanderoll`). **Det blev grannfunktionen jag följer.**
4. **Sökte var `VisaBanderoll` används i hela projektet** → *för att följa grannfunktionen genom alla våningar.* Gav mig hela listan av ställen en ny kryssruta måste in på: modell → databasens uppstartsskript (`DatabaseBootstrapper.cs`) → controller (request + svar) → frontend-typ → adminformulär → tester.
5. **Läste controllern** → *för att se reglerna kring kryssrutorna.* Fynd: banderollen funkar bara vid *schemalagd* publicering. Modalen behöver inte det (den visas när någon läser, inte vid en viss tidpunkt) — så jag gör den oberoende av schemat.
6. **Kollade flaggornas FAKTISKA läge i produktion** (inte bara koden) → *regel från minnet, har gått fel förut.* Fynd: alla `uppdateringar_*`-flaggor är av i produktion — men den publika sidan `/uppdateringar` är inte flaggstyrd och har 9 publicerade releaser. Så modalen kan länka dit utan att leda till en tom sida.
7. **Mindes ett tidigare beslut:** en välkomst-popup togs bort i session 38 efter testarfeedback ("lös det genom design, inte tutorial"). → *En ny popup får inte bli samma sak i ny förpackning.* Det påverkar frågan om nya besökare (se nedan).

**Avvikelse mot diagrammet:** diagrammet säger "följ grannfunktionen genom huset". I verkligheten hittade jag huset med en enda sökning på grannfunktionens namn — snabbare än att läsa fil för fil.

## Steg 3 — Planera
8. **Beslut jag tar själv (och berättar om):**
   - "Har sett"-minnet sparas i webbläsaren → *gäster har inget konto att spara i, och att se en nyhetsruta två gånger på två enheter är ofarligt.*
   - Bakom en ny flagga, av som standard → *så den kan testas skarpt "bara för admin" innan alla ser den (finns sedan PR #693).*
   - Kryssrutan fungerar både vid direkt publicering och schemaläggning.
9. **Beslut som är DITT (frågas):** ska en helt ny besökare se modalen? Och: utseendet (UI-godkännande krävs enligt projektets regler).
10. **Kollade hur appens dialoger och nyhets-taggar redan ser ut** (`ConfirmDialog.tsx`, `uppdateringTyp.ts`) och hämtade den senaste RIKTIGA releasen från produktion → *en skiss med påhittad text eller främmande färger ger fel bild av slutresultatet.*
11. **Gjorde två varianter i skissen, inte en** → *punkt 7 (borttagna popupen) gör det till en genuin smakfråga hur påträngande rutan får vara — då är det bättre att du ser båda än att jag gissar.*
    Skiss: https://claude.ai/artifact/S8CVBjDb8waNKb3M4Ag2cT
12. **Väntar på ditt svar innan någon kod skrivs** → *projektregel: vid visuella ändringar, godkännande först.*

**Avvikelse mot diagrammet:** [[Ny funktion]] har "fråga dig" som ett tidigt steg, före "hitta liknande funktion". I verkligheten kom frågorna EFTER att jag läst koden — det var läsningen som avslöjade vilka frågor som ens behövde ställas (t.ex. popup-historiken, flaggläget i produktion).

13. **Ditt svar: variant B + "bara inloggade"** (inte något av mina två förslag på fråga 2). → *Ändrade planen:* när bara inloggade ser rutan kan "har sett" sparas på KONTOT i stället för i webbläsaren — bättre, för då syns den inte igen på mobilen efter att du stängt den på datorn. Nya konton får inte gamla nyheter (jämförs mot kontots skapad-datum).

## Steg 4 — Göra (inifrån och ut)
14. **Ny gren `feat/vad-ar-nytt`** från en uppdaterad `main` → *en PR per funktion.*
15. **Databas:** två nya fält + migration. **Migrationen fick typerna `TEXT`/`INTEGER`** — exakt fällan som kraschade produktionen i session 32. → *La till raw-SQL-blocket med rätt Postgres-typer (`boolean`, `uuid`) i SAMMA PR, regel från minnet.*
16. **Server:** kryssrutan sparas, två nya adresser (hämta rutan / markera som sedd).
17. **Skärm:** API-funktioner, ny flagga (av som standard), själva rutan, kryssrutan i adminformuläret.

## Steg 5 — Kontrollera (det som faktiskt hände)
| Kontroll | Varför | Resultat |
|---|---|---|
| Bygger backend? | Alltid | ✅ |
| **13 nya backendtester**, en per regel (visas/inte visas, redan sedd, äldre än kontot, annonseringsfas, bara senaste…) | Logik som *bestämmer* → ett test per regel | ✅ |
| Gamla backendtester | Alltid | ❌ **1 gick sönder** — ett säkerhetstest kräver att alla skrivande adresser i Uppdateringar är admin-only. Min "markera som sedd" är för vanliga användare. **Jag ändrade inte testet** — flyttade adresserna till en egen controller. Testet var rätt, min placering fel. |
| Typkoll frontend | Alltid | ❌ Två fel: fel paketnamn (`react-router-dom` i stället för `react-router`), och två testfiler saknade det nya fältet. Rättat. |
| Lint | Syns på skärmen | ✅ 0 fel (35 gamla varningar oförändrade) |
| **10 nya frontendtester** | Flagga av/på, utloggad, dold i admin, Stäng/Esc/länk sparar | ❌ **3 röda** — alla rimliga larm: flaggregistret krävde att nya flaggan märktes, min hjälptext var identisk med banderollens, och **två knappar hette "Stäng"** (riktig tillgänglighetsbugg — skärmläsare kan inte skilja dem). Alla rättade. |
| Flagg-paritet frontend↔backend | Rör en flagga | ✅ (körde om backend efter att flaggan lagts till) |
| API-kedjan på riktigt (curl mot lokal server) | Tester med låtsas-databas bevisar inte att allt sitter ihop | ✅ 204 → release → 401 utan inloggning |
| **Skärmdumpar** dator/mobil × ljust/mörkt | Syns på skärmen | ❌ **Kundtjänstbubblan låg ÖVER Stäng-knappen på mobil** och nuddade kortet på dator. Inget test hade kunnat hitta det — bara att titta. Rättat, ny skärmdump ✅ |
| Stäng → ladda om → ny webbläsare | "Sparas på kontot" måste bevisas, inte antas | ✅ syns inte igen någonstans |

**Avvikelse mot [[Välja tester]]:** diagrammet säger inget om **externa saker på sidan** (kundtjänstwidgeten är ett skript från ett annat projekt). Den buggen hittades bara av skärmdumpen. → *Förslag: lägg till frågan "Delar det skärmyta med något annat?" i diagrammet.*

**Avvikelse 2:** diagrammet visar kontroll som ett steg EFTER byggandet. I verkligheten gick det i små cykler: bygg lite → kör tester → något rött → rätta → kör igen. Fyra varv totalt.
