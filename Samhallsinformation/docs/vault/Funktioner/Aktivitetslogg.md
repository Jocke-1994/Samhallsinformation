---
status: aktiv
typ: funktion
grupp: "[[admin|Admin]]"
uiPlats: "Adminpanel → Aktivitetslogg"
kodPlats: "AdminActivityLog, IAktivitetsloggService"
fallgropar:
  - "Issue #491 fortfarande öppet: ingen impersonation-loggning, ingen Arkivera-knapp, ingen test-/betakonto-taggning"
---

# Aktivitetslogg

Delad logg (`AdminActivityLog`) för admin/support-synliga händelser —
konfiguration, konto, ärende, push, registrering. Server-side filtrering
och paginering, Aktör-filter (Alla/System/Admin).

## Status
Wave 1 byggd och mergad session 38 (PR #493-495, issue #491). Live i
produktion, men issue #491 är medvetet lämnat öppet — se nedan.

## Teknisk plats
I appen: Adminpanel → Aktivitetslogg
I koden: `AdminActivityLog`, `IAktivitetsloggService`,
`GET /api/admin/activity-log`, `Aktivitetslogg.tsx`.

## Återkommande att tänka på
- Tre saker saknas fortfarande enligt issue #491: impersonation-loggning
  (väntar på att `Impersonation.tsx` byggs på riktigt), en Arkivera-knapp i
  UI:t (datamodell/filter finns, ingen knapp), och test-/betakonto-taggning
  vid källan. Kolla issuet innan du antar att något av detta redan finns.

## Kopplade FAQ


## Kopplade funktioner
- [[Sparat]] — spara/ta bort loggas hit
- [[Push-notiser]] — utskick loggas hit
