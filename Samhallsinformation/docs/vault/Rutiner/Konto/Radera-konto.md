---
kategori: "GDPR & uppgifter"
status: aktiv
uppdaterad: 2026-09-11
---

# En användare vill radera sitt konto

Utlöses av: ett supportärende, mejl till info@/support@, eller en muntlig
fråga du vidarebefordrar.

## Självbetjäning
Sedan PR #566 (2026-09-11) syns "Datahantering"-kortet som standard för
alla inloggade användare: **Konto → Datahantering → Radera konto**. Be
användaren göra det själv om de kan logga in — snabbast för alla.

## Om det kommer in som ett supportärende
1. Fråga om användaren kan logga in på kontot (de flesta kan — då pekar
   du bara på självbetjäningen ovan)
2. Kan de INTE logga in (glömt lösenord, spärrat konto, m.m.) — se
   [[Kan-inte-logga-in]] först, eller gå direkt till adminverktyget nedan
   om ärendet är brådskande
3. Bekräfta alltid att du pratar med KONTOÄGAREN, inte någon som utger
   sig för att vara det — e-postadressen i ärendet ska matcha kontots
   registrerade adress

## Adminverktyg / fallback
Användarhantering → hitta kontot → **Radera**.
- Kontot spärras OMEDELBART (kan inte logga in längre)
- En bakgrundstjänst anonymiserar kontot (namn/e-post/lösenord skrivs
  över) efter **24 timmar** — inte direkt, och inte 7 dagar som en
  gammal spec (issue #57, stängd 2026-09-11) en gång beskrev
- Fram tills de 24 timmarna gått: se [[Angra-radering]] om användaren
  ångrar sig
- Går INTE att radera sitt eget admin-konto via det här endpointet
  (`if (id == CurrentUserId) return BadRequest`)

## Teknisk plats
Självbetjäning: `DELETE /api/auth/me` (AuthController).
Admin: `DELETE /api/admin/users/{id}` (AdminUsersController.Delete) —
samma anonymiseringsmekanism, samma 24h-fönster, oavsett vilken väg som
användes. Se [[../../Funktioner/GDPR-verktyg]].

## Gränser / vad du INTE ska göra
- Radera aldrig ett konto bara för att någon SÄGER att de äger det utan
  att verifiera e-postadressen mot kontot
- Lova aldrig en OMEDELBAR, permanent radering — var tydlig om
  24h-fönstret om användaren frågar exakt när deras data faktiskt
  försvinner
