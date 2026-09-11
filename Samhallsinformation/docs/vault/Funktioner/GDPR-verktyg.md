---
status: aktiv
typ: funktion
grupp: "[[konto|Konto]]"
uiPlats: "Konto → Datahantering"
kodPlats: "AuthController (ExportMe/DeleteMe/CancelDeletion), UserDeletionBackgroundService"
flagKey: konto_datahantering
sedan: 2026-08-17
pausadVarfor: ""
fallgropar:
  - "24h ångerfönster, INTE 7 dagar som ursprungsspecen (#57) beskrev — ett medvetet produktbeslut"
  - "Export har inget adminverktyg — bara självbetjäning via den inloggade sessionens egna JWT"
---

# GDPR-verktyg (export + radering)

Två separata verktyg under Konto → Datahantering: exportera all lagrad
persondata som JSON, eller radera kontot (med en 24h ångerfönster och
en självbetjänings-ångra-länk via mejl).

## Status
Byggd session 33 (PR #477), efter att ha varit ren mock i flera
sessioner. `konto_datahantering`-flaggan aktiverad som standard
2026-09-11 (PR #566), efter att ha legat dold sedan den byggdes.
Självbetjänings-ångra via mejllänk (`DeletionCancelToken`) tillagd
samma dag — innan dess fanns ingen notifiering ALLS när en radering
begärdes, och ingen väg att ångra utan att kontakta support.

## Flöde — radering
```mermaid
flowchart TD
    A[Konto → Datahantering → Radera konto] --> B[DELETE /api/auth/me]
    B --> C[IsActive = false OMEDELBART]
    C --> D[DeletionScheduledAt = nu + 24h]
    D --> E[Mejl skickas: "Ditt konto raderas snart" + ångra-länk]
    E --> F[Inloggning blockeras direkt, 403]
    F --> G{Inom 24h?}
    G -->|Klickar ångra-länken| H[POST /api/auth/cancel-deletion, ingen inloggning krävs]
    G -->|Kontaktar support istället| I[Admin: Ångra radering i Användarhantering]
    H --> J[Kontot återaktiverat]
    I --> J
    G -->|Ingen åtgärd| K[UserDeletionBackgroundService anonymiserar]
    K --> L[Kontot permanent anonymiserat]
```

## Teknisk plats
I appen: Konto → Datahantering (`Datahantering.tsx`),
`/cancel-deletion?token=...` (`CancelDeletionPage.tsx`).
I koden: `AuthController.ExportMe`/`DeleteMe`/`CancelDeletion`,
`AuthService.CancelDeletionAsync`, `User.DeletionCancelToken`,
`IEmailService.SendAccountDeletionScheduledAsync`. Samma
anonymiseringsmekanism delas med adminens raderingsväg
(`AdminUsersController.Delete`/`CancelDeletion`) — båda sätter samma
`DeletionCancelToken`, så ångra-länken fungerar oavsett vem som
initierade raderingen. `UserDeletionBackgroundService` kör det
faktiska anonymiseringssteget.

## Återkommande att tänka på
- Export innehåller INTE SMS-mottagare/samtycken — de fälten finns inte i
  produkten (SMS-kanalen byggdes aldrig), inte en bugg i exporten
- Ångra-länken kräver INGEN inloggning — token:et i sig är beviset på
  identitet (bara kontoägarens inkorg fick länken). Fungerar därför även
  om kontot redan är utloggat/spärrat
- Se [[../Rutiner/Konto/Angra-radering]] för svag identitetskontroll om
  ångra-länken av någon anledning inte går fram och supporten måste
  hantera det manuellt istället

## Kopplade FAQ
"Kan jag ångra en radering av mitt konto?", "Hur tar jag bort mitt
konto?", "Hur laddar jag ner min data?" — alla tre kopplade till
`konto_datahantering`-flaggan.

## Kopplade funktioner
- [[Autentisering]] — `IsActive`-kollen vid inloggning
