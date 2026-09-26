---
typ: beslut
status: öppen
datum: 2026-09-26
---

# Beslut - Ärendesvar via mejl: avsändarautentisering (V3-16)

**PR:en ligger öppen men INTE mergad — väntar på ditt val.** (PR "Ärendesvar via mejl: avsändarautentisering", nummer #643 på GitHub, V3-16 i åtgärdsplanen, fynd E1#10 i [[Code-review 2026-09-25]].)

## Problemet
Ett svar på ett supportärende via mejl (`svar+<ärendenr>@samhallsinformation.se`) litar på `From`-headern. En angripare som gissar ärendenumret (löpande heltal) och förfalskar kundens adress kan lägga in ett meddelande "från kunden" i ärendet, med notis till support.

## Vad Resend faktiskt ger (verifierat mot Resends dokumentation 2026-09-26, inte mot live-API)
Webhooken innehåller bara metadata. När koden hämtar själva mejlet (`GET /emails/receiving/{id}`) finns ett fält `authentication` med `spf`, `dkim`, `dmarc` (pass / fail / gray / unknown / processing_failed). Fältet är `null` för mejl som mottogs innan Resend införde det. **Overifierat:** att fältet är ifyllt för just våra riktiga mejl, och att Gmail/Hotmail ger `dkim=pass`.

## Vad PR:en gör
1. **Autentiseringskrav:** svaret läggs in som kundens meddelande bara om `dmarc=pass` eller `dkim=pass`. Annars sparas det som en **intern anteckning** ("Ej verifierat mejl") utan notis till kund/support-push.
2. **Ej gissningsbar adress:** nya utgående svar får `Reply-To: svar+<nr>-<token>@…` (8 hex, HMAC av ärendenumret med nyckel härledd ur `JWT_SECRET`). Äldre adresser utan token fungerar fortsatt tills `SUPPORT_REPLY_ACCEPT_LEGACY=false` sätts.

## Frågan: vad ska hända när `authentication` saknas helt (`null`)?
- **A. Strikt (PR:ens ursprungsversion):** saknas fältet → behandla som *ej verifierat* (intern anteckning). Säkrast. **Risk:** om Resend av något skäl inte fyller fältet för våra riktiga mejl hamnar *alla* kundsvar som flaggade anteckningar hos support, tyst — en fungerande funktion försämras utan att någon märker det direkt.
- **B. Mjukare (PR:ens nuvarande version, Claudes rekommendation):** `authentication == null` → acceptera som kundsvar som förut, logga Warning. Har objektet fälten men varken `dmarc` eller `dkim` är `pass` → flaggad anteckning. En angripares mejl bedöms alltid av Resends mottagande server, så för ett falskt mejl finns objektet; `null` gäller i praktiken bara gamla mejl. Dessutom en av/på-brytare `SUPPORT_REPLY_REQUIRE_AUTH` (default `true`; `false` = bara loggning) som kan sättas i Railway utan ny deploy. **Säkerhetsspärren i sessionen flaggade den här mjukningen ("Security Weaken") — därför väntar den på dig.**
- **C. Merga inte** — falska svar via mejl kvarstår som risk.

## Efter merge (oavsett A/B)
Första dagen: kontrollera att kundsvar från Hotmail och Gmail fortfarande kommer in som **kundmeddelanden** och inte som "Ej verifierat mejl"; sök loggen efter "authentication saknas" och "kunde inte autentiseras". Sätt `SUPPORT_REPLY_ACCEPT_LEGACY=false` när äldre utskickade mejl inte längre är aktuella (annars ger token inget skydd, eftersom en angripare kan utelämna den).

## Kopplat
- [[Code-review 2026-09-25]] · [[Beslut - Migreringsskydd vid start (V2-1)]]
