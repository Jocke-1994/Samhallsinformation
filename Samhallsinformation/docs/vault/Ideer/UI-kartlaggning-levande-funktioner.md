---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
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

## Öppna frågor
- Var börjar kartläggningen — en yta i taget (t.ex. Konto-sidan) eller en
  bred men grund första passering över allt?
- Ska detta göras som en enda stor genomgång, eller trancher per
  admin-vy/support-vy/användare/besökare?
- Behöver frontend-testinfrastrukturen (Vitest m.m.) finnas på plats INNAN
  kartläggningen börjar, eller kan de gå parallellt?

## Kopplat
- [[../Verktyg/Claudes-tankar|Claudes tankar]] — ursprungsdiskussionen
