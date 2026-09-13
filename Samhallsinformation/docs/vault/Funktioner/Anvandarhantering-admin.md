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
  - "\"Notifieringsinställningar\"-fliken (MOCK_NOTIF) ser ut som riktig per-användare-data men är 100% mock — beskriver en gammal mail/SMS/kanal-per-källa-modell som aldrig byggdes. Förväxla den inte med det RIKTIGA push-systemet (User.PushEnabled/PushNyaHandelser/PushNyVersion), som saknar EGEN representation i admin helt och hållet (upptäckt 2026-09-12)"
  - "\"Aktivitet\"-fliken (MOCK_AKTIVITET, inloggningsspårning) och senastAktiv-fältet (alltid \"—\") är också 100% mock — ingen inloggnings-/sessionsspårning finns i backend överhuvudtaget, inte bara i UI:t"
  - "\"Ändra roller\"-knappen är ärligt disabled med en förklarande tooltip — ingen backend-endpoint finns för att byta en användares roll"
---

# Användarhantering (admin)

Lista registrerade användare, se detaljer, hjälpa dem med kontofrågor.
Detaljvyn har sex flikar — se nedan för vilka som är riktiga och vilka
som fortfarande är mock.

## Status
Kopplad mot riktig data session 33 (var tidigare 100% frikopplad mock).
Kartlagd fullständigt 2026-09-12 (se fallgropar) efter att en användare
letade efter push-inställningar i admin och inte hittade några.

## Detaljvyns flikar

**Översikt** — helt riktig:
- Roller, registreringsdatum, inloggningsmetod, kontaktuppgifter
- Polisen-bevakningar (läs+skriv, `GET/POST/PUT/DELETE
  /api/admin/users/{id}/polisen-bevakningar`)
- Aktiva källor (läs+skriv `isActive`, aldrig `sortOrder`)
- Sparat (läs+ta bort, med länk-status-koll innan öppning)
- Åtgärder: skicka lösenordsåterställning/verifieringsmejl (PR #569),
  aktivera/stäng av konto, radera konto (GDPR), ångra radering. **Enda
  undantaget:** "Ändra roller" är disabled, ingen endpoint finns

**Notishistorik** — riktig (`NotificationDeliveryLog`/`PushDispatcher`)

**Inställningshistorik** — riktig (`UserSettingAuditLog`, session 18/42)

**Ärenden** — riktig (delar query med Support-inboxen)

**Notifieringsinställningar** — ⚠️ **100% mock.** Visar en gammal
mail/SMS/kanal-per-källa-modell (kanaler, geografier, kategorier per
källa) som aldrig byggdes på riktigt — känd sedan session 25 att behöva
ett omdesign-beslut. Detta är INTE samma sak som det riktiga push-systemet
(se nedan) — lätt att förväxla dem

**Aktivitet** — ⚠️ **100% mock.** Tänkt att visa inloggningsspårning
("Loggade in", "Läste 4 artiklar") men ingen sådan spårning finns i
backend. `senastAktiv`-fältet i Översikt är av samma anledning alltid
`"—"`, ärligt visat snarare än påhittat

## Bekräftad lucka 2026-09-12: ingen push-insyn alls
Varken det globala `User.PushEnabled`, per-kategori-inställningarna
(`PushNyaHandelser`/`PushNyVersion`) eller en användares registrerade
enheter (`UserDevice`) syns NÅGONSTANS i admin — inte ens som en mock-flik,
helt frånvarande. Enda sättet att felsöka en användares push idag är att
logga in som den användaren själv (eller vänta på riktig impersonation,
se [[../Beslut/Beslut - Polisen-bevakningar egna tester]]). Session 30
byggde diagnostikendpoints (`/api/push/devices`, `/logs`, `/test`) men de
är scopade till den INLOGGADE admin-sessionen själv, inte en godtycklig
användare.

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
- [[Push-notiser]] — systemet som saknar admin-insyn, se ovan
