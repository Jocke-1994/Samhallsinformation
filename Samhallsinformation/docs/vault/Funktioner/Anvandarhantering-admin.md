---
status: aktiv
typ: funktion
grupp: "[[admin|Admin]]"
uiPlats: "Adminpanel → Användarhantering"
kodPlats: "Anvandare.tsx, AdminUsersController, AdminUserDetailsController"
flagKey: ""
sedan: 2026-06-13
pausadVarfor: ""
fallgropar:
  - "Telefonnummer och en UseBankId-kolumn ur ursprungsspecen (#64) finns inte — de fälten existerar inte i produkten alls, inte en lucka i admin-vyn specifikt"
---

# Användarhantering (admin)

Lista registrerade användare, se roll/registreringsdatum, ändra roll,
spärra/återaktivera konto, ångra en GDPR-radering inom 24h-fönstret.

## Status
Kopplad mot riktig data session 33 (var tidigare 100% frikopplad mock).
Fick en Inställningshistorik-flik session 42 (per-användare-ändringslogg,
`UserSettingAuditLog`, funnits sedan session 18 men aldrig haft en läsvy).

## Teknisk plats
I appen: Adminpanel → Användarhantering.
I koden: `Anvandare.tsx`, `AdminUsersController.cs`,
`AdminUserDetailsController.cs` (läsvyer delade med Support-rollen).

## Återkommande att tänka på
- Lösenord visas ALDRIG i admin-vyn — återställning sker alltid via
  e-postlänk ([[Losenordsaterstallning]]), aldrig genom att admin sätter
  ett nytt lösenord direkt

## Kopplade FAQ

## Kopplade funktioner
- [[Adminpanel-roller]]
- [[GDPR-verktyg]] — cancel-deletion-knappen här
