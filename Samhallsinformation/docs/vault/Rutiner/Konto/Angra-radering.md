---
kategori: "GDPR & uppgifter"
status: aktiv
uppdaterad: 2026-09-11
---

# En användare ångrar en kontoradering

Utlöses av: användaren (eller admin av misstag) begärde radering, och
hör av sig inom 24-timmarsfönstret innan anonymiseringen faktiskt körs.

## Självbetjäning
Finns INTE — ingen self-service-ångra. Kontot är spärrat direkt när
raderingen begärs (`IsActive = false`), så användaren kan inte logga in
för att ångra det själv. Det är ett medvetet designval (session 33) —
samma säkerhetsmarginal som en vanlig kontospärrning.

## Om det kommer in som ett supportärende
1. Verifiera att det verkligen är kontoägaren som hör av sig (samma
   e-postadress som kontot, eventuellt en kompletterande fråga för att
   bekräfta identitet — kontot går inte att logga in på just nu så du
   kan inte be dem "logga in och visa")
2. Kolla i Användarhantering om `DeletionScheduledAt` fortfarande ligger
   i framtiden — om den redan passerat är kontot redan anonymiserat och
   går INTE att återställa (se Gränser)
3. Ångra raderingen enligt adminverktyget nedan
4. Bekräfta för användaren att kontot är återaktiverat och att de kan
   logga in igen

## Adminverktyg / fallback
Användarhantering → hitta kontot (går att söka på e-post även om kontot
är spärrat) → **Ångra radering**.
- Sätter `DeletionScheduledAt = null`, `IsActive = true`,
  `SuspendedAt/SuspendedReason = null`
- Fungerar bara medan `DeletionScheduledAt` fortfarande är i framtiden

## Teknisk plats
`POST /api/admin/users/{id}/cancel-deletion` (AdminUsersController.
CancelDeletion). Se [[../../Funktioner/GDPR-verktyg]].

## Gränser / vad du INTE ska göra
- Om `UserDeletionBackgroundService` redan hunnit anonymisera kontot
  (mer än 24h har gått) — namn/e-post/lösenord är redan överskrivna,
  det går INTE att återställa. Var ärlig om det med användaren direkt,
  låtsas inte att det går att fixa
- Ångra aldrig en radering du inte kan verifiera begärdes av
  kontoägaren själv
