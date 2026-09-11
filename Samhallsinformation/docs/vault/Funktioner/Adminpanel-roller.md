---
status: aktiv
typ: funktion
grupp: "[[admin|Admin]]"
uiPlats: "Adminpanel (hela), rollväljare i Användarhantering"
kodPlats: "AdminPage.tsx, User.Role, AdminUsersController"
flagKey: ""
sedan: 2026-03-20
pausadVarfor: ""
fallgropar:
  - "Admin skapas via ADMIN_EMAIL/ADMIN_PASSWORD-miljövariabler vid uppstart (seedat singelkonto) — INTE \"första registrerade kontot blir Admin\" som ursprungsspecen (#61) beskrev"
  - "[Authorize(Roles=\"X\")] på klassnivå + snävare på metodnivå ANDAS ihop (kumulativt), kan aldrig luckra upp — kräver en helt separat controller om en enskild endpoint ska vara bredare tillåten än resten av klassen"
---

# Adminpanel — grundstruktur och roller

Tre roller (Användare/Support/Admin). Adminpanelen har egen layout,
route-skydd, och en delad sidomeny mellan Support/Admin där Admin ser fler
sektioner.

## Status
Grundstrukturen byggd tidigt (session ~6-8), rollmodellen etablerad
parallellt. Rolltilldelning (Admin kan ändra andras roll) och
Support-rollens avgränsade behörigheter (`AdminUserDetailsController` med
`Admin,Support` där avsett, striktare `Admin`-only annars) klara sedan
session 33-34.

## Teknisk plats
I appen: `/admin` (hela adminpanelen).
I koden: `AdminPage.tsx`, `AdminSidebar.tsx` (delad Support/Admin-struktur,
`SUPPORT_SEKTIONER`), `User.Role`.

## Återkommande att tänka på
- Se `fallgropar` — kontrollera alltid om en ny admin-endpoint behöver
  bredare behörighet än resten av sin controller INNAN den läggs till i en
  redan Admin-only-klass; bryt ut till en ny controller istället för att
  försöka luckra upp på metodnivå

## Kopplade FAQ

## Kopplade funktioner
- [[Kallhantering-admin]]
- [[Anvandarhantering-admin]]
- [[Support-inbox]]
- [[Felsokning-admin]]
