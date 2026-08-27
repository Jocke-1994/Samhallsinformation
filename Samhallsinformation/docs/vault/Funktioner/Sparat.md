---
status: pausad  # giltiga värden: aktiv | pausad | nedlagd | planerad
typ: funktion
grupp: "[[flode|Flöde]]"
uiPlats: "Bokmärkesikon i flödet, Flöde/Sparat-pill i Mitt flöde"
kodPlats: "UserSavedEvent-tabellen, SavedEventsContext"
flagKey: flode_sparat
sedan: 2026-08-04
pausadVarfor: "[[Beslut - Lansering av Sparat]]"
fallgropar:
  - "Adminsidan (Händelsesök, Anvandare.tsx) är INTE gated av flode_sparat-flaggan, den fungerar redan"
---

# Sparat

Bokmärk en händelse i flödet (bokmärkesikon på varje källa i `NewsItem.tsx`).
Syns under "Flöde/Sparat"-pillen i Mitt flöde.

## Status
Byggd session 24 (lokal state), migrerad till riktig backend session 33
(PR #472) — tidigare `localStorage`-baserad, nu `UserSavedEvent`-tabellen.
Flaggan medvetet avstängd sedan 2026-08-04, "vilande för en framtida
funktionslansering" (PR #380/384/385).
`Aktivitetslogg`s Typ-värde för dessa rader normaliserades till "Kontoåtgärd"
session 38 (PR #495).

## Teknisk plats
I appen: bokmärkesikon i flödet, Flöde/Sparat-pill i Mitt flöde
I koden: `UserSavedEvent`-modellen, `GET/POST/DELETE /api/user/saved-events`,
`GET /api/admin/saved-events/by-event`, `SavedEventsContext.tsx`,
`HandelsesokKort.tsx`, `Anvandare.tsx` (Sparat-flik).

## Återkommande att tänka på
- Adminsidan (Händelsesök "Spara till användare", `Anvandare.tsx`
  Sparat-flik) är INTE gated av `flode_sparat`-flaggan — den fungerar redan
  på riktigt även när slutanvändarens egen bokmärkesknapp är dold. Lätt att
  tro att "flaggan är av = ingenting fungerar", men admin-sidan är live.

## Kopplade FAQ
- [[FAQ - Hur sparar jag en handelse]]

## Kopplade funktioner
- [[Aktivitetslogg]] — varje spara/ta bort loggas här
- [[Push-notiser]] — annat exempel på per-användare-val som styr vad som
  visas/skickas
