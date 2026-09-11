---
status: aktiv
typ: funktion
grupp: "[[admin|Admin]]"
uiPlats: "Adminpanel → Felsökning"
kodPlats: "Felsökning.tsx, admin health/push/ingestor-log-endpoints"
flagKey: ""
sedan: 2026-08-17
pausadVarfor: ""
fallgropar: []
---

# Felsökning (admin)

Självständig diagnostik utan att behöva gå via kod, databas eller vänta
på hjälp utifrån — Systemhälsa (4 riktiga kontroller), push-diagnostik,
ingestor-felloggning.

## Status
Byggd session 33, utökad med push-diagnostikendpoints (devices/logs/test)
under en akut felsökning session 30 innan verktyget officiellt fanns.

## Teknisk plats
I appen: Adminpanel → Felsökning.
I koden: `Felsökning.tsx`, `GET /api/admin/health`, `GET/POST /api/push/*`
(diagnostik), `IngestorRunLog` + `AdminIngestorLogController`.

## Återkommande att tänka på
- Vid en tyst, obekräftad notis-/leveransbugg: kolla ALLTID båda
  oberoende gatingmekanismerna (global mute + enhetens egen prenumeration)
  — de kan vara fel var för sig, samtidigt, av helt olika anledningar
  (hände två gånger, session 30)

## Kopplade FAQ

## Kopplade funktioner
- [[Adminpanel-roller]]
- [[Push-notiser]]
