---
status: aktiv
typ: funktion
grupp: "[[konto|Konto]]"
uiPlats: "Konto → Kontouppgifter, Byt lösenord"
kodPlats: "KontoInfo.tsx, LösenordByte.tsx, AuthController (me/password, me/email-change)"
flagKey: ""
sedan: 2026-06-30
pausadVarfor: ""
fallgropar:
  - "E-postbyte kräver lösenord för lösenordskonton, men INTE för Google-konton (requiresPassword = authProvider === 'local') — avsiktligt, Google-konton har ingen PasswordHash att kontrollera mot"
---

# Kontouppgifter (namn, e-post, lösenord)

Tre separata sparningar: visningsnamn (direkt), e-postbyte (kräver
bekräftelselänk till NYA adressen + lösenord för lösenordskonton), och
lösenordsbyte (kräver nuvarande lösenord).

## Status
Namn/lösenord byggt session 18/25. E-postbytet byggdes om till
branschstandard session 41 (PR #503) efter en säkerhetsgenomgång: tidigare
bytte kontot e-post direkt och skickade bekräftelse EFTERÅT — nu skickas
bekräftelselänken till den nya adressen FÖRST, kontots faktiska e-post
ändras inte förrän länken klickas, plus ett varningsmejl till gamla
adressen och sessionsutloggning vid lyckat byte. Mobil layoutbugg
(fält+knapp klämdes ihop, klippt placeholder) fixad 2026-09-11 (PR #552).

## Teknisk plats
I appen: Konto → Kontouppgifter + Byt lösenord.
I koden: `KontoInfo.tsx`, `LösenordByte.tsx`, `EmailChangeToken`-modellen.

## Återkommande att tänka på
- E-postbyte kräver lösenord bara för lösenordskonton — se `fallgropar`
- Alla tre input+knapp-rader i `KontoInfo.tsx` staplar nu på mobil
  (`flex-col sm:flex-row`) istället för att klämmas ihop — samma mönster
  bör återanvändas om nya fält+knapp-rader läggs till här

## Kopplade FAQ

## Kopplade funktioner
- [[Autentisering]]
