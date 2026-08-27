---
status: pausad  # giltiga värden: aktiv | pausad | nedlagd | planerad
typ: funktion
grupp: "[[konto|Konto]]"
uiPlats: "Konto → Push-notiser"
kodPlats: "PushDispatcher, User.PushNyaHandelser/PushNyVersion"
flagKey: notif_push
sedan: 2026-08-03
pausadVarfor: "[[Beslut - Lansering av Push-notiser]]"
fallgropar:
  - "Två oberoende gates måste båda vara sanna: User.PushEnabled (global mute) OCH enhetens egen prenumeration"
---

# Push-notiser

Web Push (VAPID) med två kategorier under Konto: "Ny händelse" (styrs av
valda källor + Polisen-bevakningar) och "Ny version". Ingen separat
"Aktivera push"-knapp — att slå på en kategori triggar webbläsarens
prenumeration automatiskt.

## Status
Grundpushen byggd session 26 (PR #392-395). Konsoliderad till Konto med
per-kategori-toggles session 32 (PR #464). Verifierad end-to-end i
produktion, men flaggan avstängd sedan 2026-08-03 — väntar bara på ett
produktbeslut om lansering, inget tekniskt kvar.

## Teknisk plats
I appen: Konto → Push-notiser
I koden: `User.PushNyaHandelser`/`PushNyVersion`, `PushDispatcher`,
`GET/PUT /api/push/settings`, `usePushSubscription()`-hooken.

## Återkommande att tänka på
- Två separata, oberoende gatingmekanismer måste båda vara sanna för att en
  användare faktiskt får push: `User.PushEnabled` (global mute, ingen egen
  UI ännu) OCH webbläsarens/enhetens egen prenumeration. Om en användare
  rapporterar "inga notiser" — kolla båda, inte bara en (session 30,
  admin-tystnad hade två helt orelaterade rotorsaker samtidigt: global mute
  + avstängd Android-notiskanal).

## Kopplade FAQ


## Kopplade funktioner
- [[Aktivitetslogg]] — varje utskick loggas i `NotificationDeliveryLog`
- [[Sparat]] — annat exempel på per-användare-val
- [[Polisen-bevakningar]] — styr vilka Polisen-händelser som pushas
