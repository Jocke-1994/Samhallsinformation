---
status: aktiv
typ: funktion
grupp: "[[konto|Konto]]"
uiPlats: "Konto → Datahantering"
kodPlats: "AuthController (ExportMe/DeleteMe), UserDeletionBackgroundService"
flagKey: konto_datahantering
sedan: 2026-08-17
pausadVarfor: ""
fallgropar:
  - "24h ångerfönster, INTE 7 dagar som ursprungsspecen (#57) beskrev — ett medvetet produktbeslut"
  - "Ingen self-service-ångra — IsActive=false blockerar inloggning direkt, måste kontakta support inom 24h för att ångra (admin kan ångra via Användarhantering)"
---

# GDPR-verktyg (export + radering)

Två separata verktyg under Konto → Datahantering: exportera all lagrad
persondata som JSON, eller radera kontot permanent.

## Status
Byggd session 33 (PR #477), efter att ha varit ren mock (bekräftelse-UI
utan backend-koppling) i flera tidigare sessioner. Verifierad live
2026-09-11 via ett kastkonto (registrera → begär radering → bekräfta
`403 Kontot är avstängt` vid nästa inloggningsförsök).

## Flöde — radering
```mermaid
flowchart TD
    A[Konto → Datahantering → Radera konto] --> B[DELETE /api/auth/me]
    B --> C[IsActive = false OMEDELBART]
    C --> D[DeletionScheduledAt = nu + 24h]
    D --> E[Inloggning blockeras direkt, 403]
    E --> F{Inom 24h?}
    F -->|Användaren kontaktar support| G[Admin: cancel-deletion i Användarhantering]
    G --> H[Kontot återaktiveras]
    F -->|Ingen åtgärd| I[UserDeletionBackgroundService anonymiserar]
    I --> J[Kontot permanent anonymiserat]
```

## Teknisk plats
I appen: Konto → Datahantering (`Datahantering.tsx`).
I koden: `AuthController.ExportMe`/`DeleteMe`, samma
anonymiseringsmekanism som adminens raderingsväg
(`AdminUsersController.Delete`), `UserDeletionBackgroundService`.

## Återkommande att tänka på
- Export innehåller INTE SMS-mottagare/samtycken — de fälten finns inte i
  produkten (SMS-kanalen byggdes aldrig), inte en bugg i exporten
- Radering via admin (Användarhantering) och radering via kontot självt
  (Datahantering) delar exakt samma 24h-anonymiseringsmekanism

## Kopplade FAQ

## Kopplade funktioner
- [[Autentisering]] — `IsActive`-kollen vid inloggning
