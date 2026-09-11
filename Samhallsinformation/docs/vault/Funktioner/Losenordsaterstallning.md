---
status: aktiv
typ: funktion
grupp: "[[konto|Konto]]"
uiPlats: "/login → \"Glömt lösenordet?\" → /forgot-password → /reset-password"
kodPlats: "AuthController, AuthService, PasswordResetToken"
flagKey: ""
sedan: 2026-06-30
pausadVarfor: ""
fallgropar: []
---

# Lösenordsåterställning

Ange e-post → återställningslänk skickas (om adressen finns, samma svar
oavsett för att inte läcka vilka e-postadresser som har konton) → klicka
länken → sätt nytt lösenord.

## Status
Byggd session 18. Verifierad live end-to-end 2026-09-12 (skickat,
mottaget i huvudinkorgen inte skräppost, länken fungerade, nytt lösenord
gick att logga in med). Del av launch-checklistans rekommenderade tester,
nu avklarad.

## Flöde
```mermaid
flowchart TD
    A["/forgot-password"] --> B[Ange e-post]
    B --> C[POST /api/auth/forgot-password]
    C --> D["Alltid samma svar: 'Om adressen finns...'"]
    D --> E{Kontot finns?}
    E -->|Ja| F[PasswordResetToken skapas, 1h giltighet]
    F --> G[E-post skickas via Resend]
    E -->|Nej| H[Inget skickas, samma svar visas ändå]
    G --> I[Länk: /reset-password?token=...]
    I --> J[Nytt lösenord + bekräfta, min 8 tecken]
    J --> K[POST /api/auth/reset-password]
    K --> L[Redirect till /login efter 3s]
```

## Teknisk plats
I appen: `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`.
I koden: `PasswordResetToken`-modellen, samma Resend-baserade
e-postutskick som [[Autentisering]] och [[GDPR-verktyg]].

## Kopplade FAQ

## Kopplade funktioner
- [[Autentisering]]
