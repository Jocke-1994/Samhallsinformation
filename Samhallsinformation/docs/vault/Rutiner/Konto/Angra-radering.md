---
kategori: "GDPR & uppgifter"
status: aktiv
uppdaterad: 2026-09-11
---

# En användare ångrar en kontoradering

Utlöses av: användaren (eller admin av misstag) begärde radering, och
hör av sig inom 24-timmarsfönstret innan raderingen faktiskt går igenom.

## Självbetjäning
**Sedan 2026-09-11 finns en riktig självbetjäningsväg.** I samma
ögonblick en radering begärs (oavsett om användaren själv gjorde det
eller en admin gjorde det åt dem) skickas ett mejl: "Ditt konto raderas
snart" med en **"Avbryt raderingen"-länk**. Ett klick räcker — ingen
inloggning krävs, länken i sig bevisar att personen har tillgång till
kontots inkorg.

Peka ALLTID användaren på mejlet först — be dem kolla skräpposten om de
inte ser det. Det löser situationen snabbare och säkrare än något
supportärendet kan göra.

## Om det kommer in som ett supportärende
Bara relevant om mejlet inte gick fram, eller kontots inkorg inte längre
är tillgänglig för användaren.

1. Fråga om de kollat skräpposten på kontots registrerade adress
2. **Osäker identitetskontroll om mejlet verkligen inte fungerar** —
   kontot går inte att logga in på, så du kan inte be dem "logga in och
   visa". Be om något mer som bara kontoägaren rimligen skulle veta
   (registrerat namn, vilka källor de följt, ett tidigare ärendenummer)
   innan du går vidare manuellt
3. Kolla i Användarhantering att raderingen fortfarande väntar (inte
   redan genomförd) — annars går den inte att ångra, se Gränser
4. Klicka **"Ångra radering"** på kontot
5. Bekräfta för användaren att kontot är tillbaka och att de kan logga
   in igen

## Adminverktyg / fallback
Användarhantering → sök upp kontot (funkar även spärrat, sök på e-post)
→ knappen **"Ångra radering"**. Fungerar bara medan raderingen
fortfarande väntar. Samma effekt som självbetjäningslänken, bara
manuellt utlöst.

## Teknisk plats
Självbetjäning: `POST /api/auth/cancel-deletion` (AuthController.
CancelDeletion → AuthService.CancelDeletionAsync), konsumerar
`User.DeletionCancelToken`.
Admin: `POST /api/admin/users/{id}/cancel-deletion` (AdminUsersController.
CancelDeletion) — samma effekt, rensar samma fält. Se
[[../../Funktioner/GDPR-verktyg]].

## Gränser / vad du INTE ska göra
- Om det redan gått mer än 24 timmar sen raderingen begärdes är kontot
  redan anonymiserat — namn/e-post/lösenord är överskrivna, det går INTE
  att återställa. Var ärlig om det direkt, låtsas inte att det går att
  fixa
- Ångra aldrig en radering manuellt om du inte känner dig rimligt säker
  på att det verkligen är kontoägaren som ber om det (se punkt 2 ovan) —
  peka först och främst på mejllänken, den behöver ingen manuell
  bedömning alls
