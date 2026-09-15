---
typ: ide
status: redo-for-pipeline  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ej-bedomd
beroenden: "Frontend-testinfrastruktur (Vitest + React Testing Library) — hänger delvis ihop men är inte ett hårt krav för att påbörja själva kartläggningen"
prioritet: ej-bedomd
pipelineNr: ""
kalla: "Claudes-tankar.md, svar 2026-09-12 på punkten om noll testtäckning i frontend"
---

# Full UI-kartläggning — vad ska vara kvar, och är det en levande funktion?

Gå igenom HELA UI:t — admin-vy, support-vy, inloggad användare, besökare —
komponent för komponent, och ta ett explicit beslut per funktion:

1. **Ska funktionen vara kvar?**
   - **Nej** → ta bort den, och skriv ner varför (samma mönster som redan
     används för borttagna funktioner, t.ex.
     `docs/MINA_KALLOR_BORTTAGNA_FUNKTIONER.md`)
   - **Ja** → gå till 2

2. **Är den en "levande funktion"?** Dvs: har den en riktig
   backend-koppling, är den testad, är den dokumenterad i
   [[../Funktioner/_Mall|Funktioner]]? Om inte — lägg upp den i
   adminpanelens funktionsidé-pipeline och fyll i vad som saknas (backend,
   tester, dokumentation) tills den faktiskt är komplett.

## Varför nu
Flera av mobiltestbuggarna från 2026-09-11 (avlånga kort, klippt
placeholder-text, saknad ångra-knapp vid källval) var rena UI-lagerfel som
en enkel komponent-/snapshot-testsvit borde ha fångat automatiskt. Frontend
har fortfarande noll testtäckning — den här kartläggningen är delvis
förutsättningen för att veta VAD som är värt att testa först (inga tester
skrivs för funktioner som ändå ska tas bort).

## Frågor — besvarade 2026-09-12
- **Var börjar kartläggningen?** → Din metod duger fint: lista allt först,
  bocka av en i taget. Ingen anledning att komplicera det mer än så.
- **En stor genomgång, eller trancher per yta?** → Trancher, prioriterade
  **användare > besökare > admin** (support hoppas över — ingen aktiv
  supportroll använder sin egen yta idag).
- **Behöver Vitest m.m. finnas på plats INNAN kartläggningen börjar?** →
  Ja, jag menade exakt testinfrastrukturen som idag inte finns alls i
  frontend (ingen Vitest/React Testing Library uppsatt än) — inte något
  annat. Svaret på själva frågan: nej, de kan gå parallellt. Kartläggningen
  (vad ska vara kvar, vad saknas) kräver inga tester i sig — testinfran
  behövs först när ni faktiskt ska SKRIVA tester för det som blir kvar.

## Kopplat
- [[../Verktyg/Claudes-tankar|Claudes tankar]] — ursprungsdiskussionen
