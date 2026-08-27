---
status: pausad  # giltiga värden: aktiv | pausad | nedlagd | planerad
typ: funktion
grupp: "[[mina-kallor|Mina källor]]"
uiPlats: "Mina källor → Polisen"
kodPlats: "PolisenBevakningar-tabellen, PolisenBevakningMatcher"
flagKey: kallor_polisen_filter
sedan: 2026-08-19
pausadVarfor: "[[Beslut - Polisen-bevakningar egna tester]]"
fallgropar:
  - "Matcha mot CanonicalEvent.EventType, ALDRIG mot Title (titlar börjar med datum, inte typ)"
  - "POLISEN_KATEGORIER (16 st) täcker inte hela Polisens vokabulär — okänd typ = alltid synlig/pushad (avsiktligt, inte en bugg)"
---

# Polisen-bevakningar

Låter användare skapa flera oberoende bevakningar (typ × kommun, upp till 5 st)
för att begränsa mängden Polisen-information/push-notiser de får — t.ex.
"allt i Göteborg" + "skjutningar i Stockholm" samtidigt. Hette tidigare
"Polisen-filter" innan den byggdes om till flera bevakningar (PR #484).

## Status
Byggd (backend+UI), flaggan avstängd i väntan på att du kör egna tester i
produktion innan den slås på i Adminpanel → Feature flags.

## Teknisk plats
I appen: Mina källor → Polisen
I koden: `PolisenBevakningar`-tabellen, `UserPolisenBevakningController`,
`PolisenBevakningMatcher`, `PolisenBevakningarContext`,
`PolisenBevakningarLista.tsx`, `PrenumerationsKlocka.tsx`

## Återkommande att tänka på
- Matchning måste ske mot `CanonicalEvent.EventType`, ALDRIG mot `Title`.
  Polisens titlar börjar med ett datum ("14 augusti 13.05, Trafikolycka..."),
  inte typen — ett textmatch mot `Title` ser ut att fungera i kod men
  matchar aldrig något skarpt i produktion (hänt en gång, session 35, PR #483).
- `POLISEN_KATEGORIER`-listan (16 kategorier) täcker inte Polisens fulla
  vokabulär. Händelser med okänd typ (t.ex. "Rattfylleri", "Bedrägeri")
  faller igenom och visas/pushas alltid oavsett bevakning — avsiktlig
  passthrough, inte en bugg, men värt att komma ihåg vid felsökning.

## Kopplade FAQ
- [[FAQ - Polisen-bevakningar]] (finns inte än)

## Kopplade funktioner
- [[Push-notiser]] — bevakningarna styr vilka Polisen-händelser som pushas
