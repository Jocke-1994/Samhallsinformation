---
status: aktiv
typ: funktion
grupp: "[[support|Support]]"
uiPlats: "Adminpanel → Support-inbox, Konto → Support (kontaktformulär/Feedback)"
kodPlats: "SupportInbox.tsx, SupportController, WebhooksController.ResendInbound"
flagKey: ""
sedan: 2026-03-20
pausadVarfor: ""
fallgropar:
  - "Ingen separat admin-only-inkorg för källansökningar finns — allt går genom samma inkorg (den funktionen, #68, är aldrig byggd)"
  - "Arkivering är MANUELL (en knapp), inte automatisk efter 7 dagar som ursprungsspecen (#111) beskrev — se granskningen för beslut"
  - "En 'Mina ärenden'-vy för användaren själv verkar saknas — bara admin ser ärendehistorik idag"
---

# Support-inbox (ärendehantering)

Medborgare kontaktar support via Feedback-knappen eller mejl till
info@/support@ (Resend inbound) — allt hamnar i samma admin-inkorg med
konversation, interna anteckningar, tilldelning, arkivering, och
push-/oläst-notiser.

## Status
Den mest utbyggda enskilda funktionen i hela adminpanelen, byggd i lager
över många sessioner: grundinbox → interna noter → tilldelning →
påminnelser → schemalagda åtgärder → arkiv+oläst-indikatorer (session 30)
→ Resend inbound-mejl som riktig tvåvägskonversation utan Zoho (session
43-45, fyra buggfixar) → push-notis+oläst-plupp vid nya svar (session 45).

## Flöde
```mermaid
flowchart TD
    A[Medborgare] -->|Feedback-knapp| B[FeedbackModal]
    A -->|mejl till info@/support@| C[Resend inbound webhook]
    B --> D[POST /api/support/tickets]
    C --> D
    D --> E[Nytt ärende i admin-inkorg]
    E --> F[Push-notis till Admin/Support]
    F --> G[Admin/Support öppnar, tilldelar sig]
    G --> H{Svar}
    H -->|Inloggat svar eller mejl-svar| I[Ny medborgar-rad]
    I --> J[Oläst-plupp återställs, push-notis igen]
    H -->|Klart| K[Status: löst]
    K -->|Manuell knapp| L[Arkiverat]
```

## Teknisk plats
I appen: Adminpanel → Support-inbox, Konto → Support.
I koden: `SupportInbox.tsx`, `SupportController.cs`,
`WebhooksController.ResendInbound`, `SupportTicket`/`SupportTicketMessage`.

## Återkommande att tänka på
- `LastViewedAt`/`LastUserMessageAt` styr oläst-status (inte den gamla
  `FirstOpenedAt`, som bara mätte "öppnad NÅGONSIN") — ett nytt
  medborgarsvar på ett redan öppnat ärende gör det oläst igen
- Se `fallgropar` för de tre avvikelserna från ursprungsspecen

## Kopplade FAQ

## Kopplade funktioner
- [[Adminpanel-roller]]
- [[../Verktyg/GitHub-issues-granskning-2026-09-12|Arkiverings-frågan (#111)]]
