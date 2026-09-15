---
kategori: "Inloggning"
status: aktiv
uppdaterad: 2026-09-11
---

# En användare kan inte logga in

Utlöses av: "mitt lösenord fungerar inte", "jag är utloggad och kan inte
komma tillbaka in", "det säger att kontot är avstängt", "Google-knappen
gör något konstigt".

## Självbetjäning
- **Glömt lösenordet:** `/login` → "Glömt lösenordet?" →
  [[Losenordsaterstallning|hela flödet]], verifierat fungerande live
  2026-09-11
- **"Kontot loggar in via Google, använd Google-knappen"** — helt
  normalt felmeddelande, inte ett fel. Kontot skapades en gång via
  Google (`AuthProvider != "local"`), det har inget lösenord att
  återställa. Peka på Google-knappen på `/login` istället
- **För många försök / "vänta en liten stund"** — rate limiting
  (5 anrop/min/IP, bekräftat fungerande i produktion sedan 2026-09-11).
  Helt normalt om de testat flera lösenord snabbt, försvinner efter en
  minut

## Om det kommer in som ett supportärende
1. Fråga EXAKT vilket felmeddelande de ser — de tre fallen ovan
   (fel lösenord / fel inloggningsväg / rate limit) ser olika ut och
   kräver olika svar
2. Om inget av ovan stämmer — kolla i Användarhantering om kontot är
   **spärrat** (`IsActive = false`, `SuspendedReason` ifyllt). Om det är
   en GDPR-radering på väg (`DeletionScheduledAt` satt) — se
   [[Angra-radering]] istället, ett helt annat scenario
3. Är kontot spärrat av en admin (inte GDPR-relaterat) — läs
   `SuspendedReason` för att förstå varför innan du återaktiverar

## Adminverktyg / fallback
Användarhantering → hitta kontot → **status/spärrning**. Går att sätta
en påminnelse (`SuspensionReminderAt`/`Note`) om spärrningen ska följas
upp senare, t.ex. vid en tidsbegränsad avstängning.

## Teknisk plats
`PUT /api/admin/users/{id}/status` (AdminUsersController.SetStatus). Se
[[../../Funktioner/Autentisering]] för hela inloggningsflödet och rate
limiting-detaljer.

## Gränser / vad du INTE ska göra
- Återaktivera aldrig ett konto utan att förstå VARFÖR det spärrades
  (läs `SuspendedReason` först) — om det var en admin-åtgärd (t.ex.
  missbruk) kan det finnas en anledning att inte bara slå på det igen
- Sätt aldrig ett nytt lösenord manuellt åt en användare — hänvisa
  alltid till självbetjäningens återställningslänk, även om det känns
  långsammare
