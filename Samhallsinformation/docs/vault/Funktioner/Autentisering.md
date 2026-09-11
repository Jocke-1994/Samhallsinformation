---
status: aktiv  # giltiga värden: aktiv | pausad | nedlagd | planerad
typ: funktion
grupp: "[[konto|Konto]]"
uiPlats: "/login, /register"
kodPlats: "AuthController, AuthService, AuthContext.tsx"
flagKey: ""
sedan: 2026-06-30
pausadVarfor: ""
fallgropar:
  - "showLoginButton/showRegisterButton är fortfarande AV i produktion — knapparna syns inte i sidomenyn, bara nåbara via direkt-URL. Sista steget i launch-ordningen."
  - "Google-inloggning mot en e-post som redan har ett lösenordskonto är bara enhetstestad, aldrig verifierad live (session 29)"
---

# Autentisering

Två inloggningsvägar (lösenord och Google), båda mynnar ut i samma
access+refresh-token-par. Registrering sker via en 3-stegs onboarding-guide
(se [[Onboarding-wizard]]), inte ett enkelt formulär.

## Status
FAS 1 (backend auth-grund, refresh tokens) byggd session 20. Google OAuth
(FAS 3) byggd session 29. Access-token 15 min, refresh-token roterar vid
varje `/api/auth/refresh`-anrop, auto-refresh ~2 min innan utgång
(`AuthContext.tsx`). Fullt fungerande, men login/register-knapparna är
medvetet avstängda i produktion — se `fallgropar`.

## Flöde
```mermaid
flowchart TD
    A[Besökare på /register] --> B{Väljer väg}
    B -->|Lösenord| C[Steg 1: namn/e-post/lösenord/villkor]
    B -->|Google| D[Google-knapp, samtycke]
    C --> E[Steg 2: välj källor]
    D --> E
    E --> F[Steg 3: sammanfattning]
    F -->|Lösenordsväg| G[register-anrop, konto skapas HÄR]
    F -->|Googleväg| H[konto redan skapat i steg 1]
    G --> I[Access+refresh-token utfärdas]
    H --> I
    I --> J[Inloggad, till huvudflödet]

    K[/login] -->|Lösenord| L[e-post+lösenord]
    K -->|Google| M[Google-knapp]
    L --> N{IsActive?}
    M --> N
    N -->|Nej| O[403 Kontot är avstängt]
    N -->|Ja| I
```

## Teknisk plats
I appen: `/login`, `/register` (OnboardingPage.tsx).
I koden: `AuthController.cs`, `Application/Auth/AuthService.cs`,
`AuthContext.tsx`. Rate limiting: 5 anrop/min/IP på hela `/api/auth/*`
— se [[../Verktyg/GitHub-issues-granskning-2026-09-12|GitHub-issues-granskningen]],
**bekräftat trasig i produktion 2026-09-11** (saknar ForwardedHeaders-
middleware bakom Railways proxy, se `Beslut`-mappen för uppföljning).

## Återkommande att tänka på
- Ett lösenordskonto kräver `AuthProvider == "local"` för att logga in med
  lösenord — ett Google-skapat konto avvisas med ett tydligt felmeddelande
  om man försöker logga in med lösenord där
- `IsActive == false` (t.ex. efter en GDPR-raderingsbegäran) blockerar
  inloggning direkt med 403, oavsett rätt lösenord

## Kopplade FAQ

## Kopplade funktioner
- [[Onboarding-wizard]] — själva registreringsguiden
- [[GDPR-verktyg]] — `IsActive=false` sätts därifrån
- [[Losenordsaterstallning]]
