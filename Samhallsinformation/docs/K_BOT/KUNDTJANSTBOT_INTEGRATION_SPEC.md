# Integrationsspec: skicka kundtjänstbot-konversationer till Samhällsinformations supportinkorg

Det här är till en annan Claude-instans som jobbar i kundtjänstbotens egna
kodbas (`kundtjanstbot-production.up.railway.app`) — inte samma repo som
Samhällsinformation. Målet: när en besökare i bot-chatten vill ha hjälp av en
människa (eller boten inte kan svara), skicka konversationen till
Samhällsinformations riktiga supportinkorg istället för att den försvinner.

## Endpoint att anropa

```
POST https://<samhallsinformation-backend-url>/api/support/tickets
Content-Type: application/json
```

(Produktions-URL: fråga användaren om den exakta Railway-URL:en för
Samhällsinformation-backendet om den inte redan är känd.)

**Ingen autentisering krävs** — endpointen är uttryckligen öppen för anonyma
inskick (samma endpoint som webbsidans Feedback-knapp redan använder sedan
2026-08-03).

## Request-body

```json
{
  "subject": "Fråga från kundtjänstbot",
  "category": "Feedback",
  "message": "<hela eller sammanfattad konversation>",
  "channel": "kundtjanstbot",
  "contactEmail": "besökarens@epost.se"
}
```

Fältkrav:
- `message` (obligatoriskt, enda krävda fältet) — den faktiska texten.
  Rekommenderat: hela konversationshistoriken formaterad som ren text, inte
  bara sista meddelandet, så supportpersonen har full kontext.
- `contactEmail` (helt frivilligt) — bara nödvändigt om besökaren vill ha
  svar. Ett inskick utan e-post är giltigt och skapas precis som vanligt,
  men ingen kan då återkoppla till besökaren. Fråga gärna "vill du ha svar? I
  så fall, vilken e-post?" i chatten, men skicka ändå in även om svaret är nej/
  inget.
- `subject`/`category` — valfria, faller tillbaka till `"Feedback"` om de
  utelämnas.
- `channel` — sätt till `"kundtjanstbot"` (en ny sträng, inte tidigare
  använd) så att Samhällsinformations adminpanel kan skilja ut dessa
  ärenden från vanlig Feedback/Ärendehantering. **Kräver en liten
  motsvarande ändring i Samhällsinformation-repot** (lägga till
  `"kundtjanstbot"` som ett känt värde i kanalfiltret/etiketterna i
  `SupportInbox.tsx` och `api/support.ts` — annars visas bara "kundtjanstbot"
  som rå text istället för en snygg etikett. Inte gjort än, men själva
  ärendeskapelsen fungerar redan utan den ändringen.)

## Svar vid lyckat anrop

```json
{ "id": "guid-här", "ticketNumber": 42 }
```

`200 OK`. Vid fel (t.ex. tom `message`): `400 Bad Request` med en
textförklaring i body.

## Vad som händer efter

Ärendet dyker upp i Samhällsinformations admin-panel under Support →
Ärendehantering (`SupportInbox.tsx`), taggat med kanalen `kundtjanstbot`.
Adminanvändaren (idag bara en person) får också automatiskt en push-notis om
den redan aktiverat push-notiser i sin egen webbläsare — ingen extra
integration behövs för det, det sker redan automatiskt för alla nya ärenden
oavsett kanal.

## Förslag på trigger-logik i boten (upp till er implementation)

- En explicit "prata med en människa"-knapp i chattgränssnittet.
- ELLER: automatiskt när boten inte kan svara med tillräcklig säkerhet på en
  fråga.
- I båda fallen: fråga gärna om e-post för den som vill ha svar, men anropet
  fungerar och ska skickas även om besökaren inte vill uppge någon.
