---
kategori: "GDPR & uppgifter"
status: aktiv
uppdaterad: 2026-09-11
---

# En användare ångrar en kontoradering

Utlöses av: användaren (eller admin av misstag) begärde radering, och
hör av sig inom 24-timmarsfönstret innan raderingen faktiskt går igenom.

## Självbetjäning
Finns inte idag — kontot spärras direkt när raderingen begärs, så
användaren kan inte logga in för att ångra det själv. Ett förslag på en
riktig självbetjäningslösning (en ångra-länk via mejl) finns sparad i
[[../../Ideer/Sjalvbetjaning-angra-radering-via-mejllank|en idé]], inte
byggd än.

## Om det kommer in som ett supportärende
1. Fråga vilken e-postadress kontot är registrerat på — jämför mot vad
   du ser i Användarhantering
2. **Osäker identitetskontroll just nu** — kontot går inte att logga in
   på, så du kan inte be dem "logga in och visa". Be om något mer som
   bara kontoägaren rimligen skulle veta (registrerat namn, vilka
   källor de följt, ett tidigare ärendenummer) innan du går vidare. Det
   här är en riktig lucka, se idén ovan för den framtida riktiga
   lösningen
3. Kolla i Användarhantering att raderingen fortfarande väntar (inte
   redan genomförd) — annars går den inte att ångra, se Gränser
4. Klicka **"Ångra radering"** på kontot
5. Bekräfta för användaren att kontot är tillbaka och att de kan logga
   in igen

## Adminverktyg / fallback
Användarhantering → sök upp kontot (funkar även spärrat, sök på e-post)
→ knappen **"Ångra radering"**. Fungerar bara medan raderingen
fortfarande väntar.

## Teknisk plats
`POST /api/admin/users/{id}/cancel-deletion` (AdminUsersController.
CancelDeletion) — nollar `DeletionScheduledAt`, sätter `IsActive = true`,
rensar `SuspendedAt`/`SuspendedReason`. Se [[../../Funktioner/GDPR-verktyg]].

## Gränser / vad du INTE ska göra
- Om det redan gått mer än 24 timmar sen raderingen begärdes är kontot
  redan anonymiserat — namn/e-post/lösenord är överskrivna, det går INTE
  att återställa. Var ärlig om det direkt, låtsas inte att det går att
  fixa
- Ångra aldrig en radering om du inte känner dig rimligt säker på att
  det verkligen är kontoägaren som ber om det (se punkt 2 ovan)
