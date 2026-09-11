---
status: aktiv
typ: funktion
grupp: "[[admin|Admin]]"
uiPlats: "Adminpanel → Källhantering"
kodPlats: "Kallhantering.tsx, SourcesController (admin)"
flagKey: ""
sedan: 2026-06-13
pausadVarfor: ""
fallgropar:
  - "Oklart om ett hårt DELETE av en källa faktiskt fungerar givet FK-kopplingar till Events — inte verifierat, se GitHub-issues-granskningen"
---

# Källhantering (admin)

Lista/lägg till/aktivera/inaktivera myndigheter direkt från adminpanelen,
ingen koddeploy krävs för en ny RSS-källa (`GenericRssIngestor` läser URL
från databasen).

## Status
Byggd session 8-9, `GenericRssIngestor` gör att nya RSS-källor kan läggas
till helt utan kod. `IsActive`/`IsPublished` separerar "ingestorn kör"
från "synlig för besökare" — gör att en ny källa kan testas skarpt innan
den exponeras (se [[../Verktyg/GitHub-issues-granskning-2026-09-12|granskningen]]
för sandlåda-kopplingen).

## Teknisk plats
I appen: Adminpanel → Källhantering.
I koden: `Kallhantering.tsx`, admin-endpoints i `SourcesController`,
`GenericRssIngestor`.

## Återkommande att tänka på
- "Synka om"-knappen skriver ÖVER redan hämtade händelser för en källa
  (`EventSync.SyncAsync(overwriteExisting: true)`) — det är rätt verktyg
  när en ingestor-fix ska slå igenom på gammal, redan hämtad data

## Kopplade FAQ

## Kopplade funktioner
- [[Adminpanel-roller]]
