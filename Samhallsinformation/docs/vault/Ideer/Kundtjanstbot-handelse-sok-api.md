---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ej-bedomd
beroenden: "Detta är det tidigare parkerade epic #203 i kundtjänstbot-projektet (se FAQ-synk-kundtjanstbot.md) — nu aktiverat"
prioritet: ej-bedomd
pipelineNr: ""
kalla: "session 2026-09-13, spec-fråga från kundtjänstbot-projektets Claude-session"
---

# Kundtjänstboten vill fråga om skarpa händelser — sök-API-spec

Kundtjänstbot-projektet vill bygga en "fråga om vad som hänt"-funktion
(t.ex. "Har det hänt något i Stockholm idag?") istället för att bara
avvisa frågan (vilket är dagens medvetna beteende, se
[[Kundtjanstbot-launch-readiness]]). De skickade 7 konkreta frågor för
att kunna speca ett Claude-tool-use-anrop mot vårt events-API. Det här
är [[FAQ-synk-kundtjanstbot|deras tidigare parkerade epic #203]],
plockat upp igen.

## Svar, baserat på faktisk kod (inte gissat)

**1. Finns redan ett API? Kan det exponeras publikt?**
Ja — `GET /api/events` (`EventsController.cs`) är EXAKT det "Alla
händelser"/"Mitt flöde" använder, redan helt publikt (ingen
autentisering, samma öppna mönster som escalation-endpointen). Stöder
`geography` (exakt match), `shortName`/`source`, `from`/`to`,
`national`, paginering (max 100/sida).

Men det finns ett BÄTTRE match redan byggt, fast Admin/Support-låst:
`GET /api/admin/events/search` (`AdminEventSearchController.cs`,
byggd session 25 för admins Händelsesök) har redan:
- `geography` som **fuzzy substring-match** (`LIKE %x%`), inte exakt
- `eventType` (exakt)
- `sokord` — fritextsökning mot BÅDE Title och Content (`LIKE %x%`)
- `from`/`to`
- Returnerar redan `SourceName` joinad in i svaret

**Rekommendation:** bygg en NY publik endpoint modellerad efter
`AdminEventSearchController.Search` (samma filter, samma fuzzy
geography-matchning, samma `sokord`-fritextsökning) men skopad till
bara `IsPublished`-källor (som den publika `GetEvents` redan gör) —
återanvänd inte adminendpointen rakt av (den läcker opublicerade
källor och kräver admin-roll).

**2. Hur är plats lagrad — fritext, kommun, geo-koordinater?**
**Fritext, INGEN normaliserad taxonomi, ingen geokodning.** Format
varierar per källa:
- **Polisen:** sista kommaseparerade delen av RSS-titeln (t.ex.
  "Trafikolycka, Göteborg" → `Göteborg`) — en stad/ort, inte verifierad
  mot någon lista, ren strängdelning
- **Krisinformation:** deras eget `Area`-fält, oftast läns-nivå
- **SMHI:** varningsområdets namn, också oftast läns-nivå
- **Trafikverket:** eget geo-fält, inte granskat i detalj här

**Konsekvens:** en sökning på "Stockholm" kan träffa Polisens
stadsnivå men missa Krisinformations/SMHIs "Stockholms län", eller
tvärtom. Ingen geokodning finns att falla tillbaka på. Fuzzy
substring-matchning (som admin-endpointen redan gör) är bättre än
exakt match, men löser inte alias-problemet (stad vs. län). Om
precision blir viktigt: hanteras bäst på er sida (bot/prompt-nivå),
inte något vi kan lösa med bättre datalagring utan ett större
geodata-projekt.

**3. Datum/tid-filter? Källa/kategori-filter?**
- **Datum/tid:** ja, `from`/`to` redan stött i båda endpoints.
- **Källa:** ja, `shortName` (t.ex. "Polisen", "SMHI",
  "Krisinformation", "Trafikverket").
- **Kategori/typ (t.ex. "trafikolycka"):** delvis. `EventType` finns
  som fält men är **bara populerat för Polisen** idag (byggt PR #373,
  session 35) — SMHI/Krisinformation/Trafikverket-händelser har
  `EventType: null`. En fråga om "väder" skulle alltså inte kunna
  filtrera på EventType, bara falla tillbaka på `sokord`-fritextsökning
  eller `shortName=SMHI`.

**4. Föreslagen svarsform**
Matchar nästan exakt vår modell:
| Ert fält | Vårt fält | Kommentar |
|---|---|---|
| `title` | `Title` | Rakt av |
| `summary` | `Content` | **Inte en sammanfattning** — det är källans fulla extraherade text. Föreslår ni döper om till `content` så det inte antyder att vi redan sammanfattat något |
| `sourceName` | `SourceName` (joinad från `Source.ShortName`) | Redan byggt i admin-endpointen |
| `sourceUrl` | `Url` | **Bekräftat: redan källans EGEN artikel-länk, aldrig vår sida** — matchar ert krav exakt, ingen ändring behövs |
| `location` | `Geography` | Se punkt 2 ovan för begränsningar |
| `timestamp` | `PublishedAt` | Rakt av |

**5. Hur många träffar vid breda sökningar?**
Era 5–10, sorterat på tid, är rimligt — matchar redan hur båda
endpoints sorterar (`OrderByDescending(PublishedAt)`). Föreslår att
den nya endpointen defaultar `pageSize` lägre (t.ex. 10) än dagens 20,
eftersom ett bot-svar med 20 händelser är oanvändbart i en chatt.

**6. Kan API:et skilja "bekräftat inget hänt" från "ingen bevakning
i området"?**
**Nej, ärligt svar: det kan det inte**, av samma skäl som punkt 2 —
ingen formell geografisk täckningsgaranti finns. Det enda ärliga
svaret är "noll träffar bland de källor vi har, för den här perioden/
platsen" — inte "bekräftat att inget hänt". Föreslår att svaret alltid
inkluderar VILKA källor som söktes (Polisen, SMHI, Krisinformation,
Trafikverket) så ni kan formulera "Inga träffar bland våra källor
(Polisen, SMHI, Krisinformation, Trafikverket) för den perioden" —
transparent om vad som faktiskt kollades, utan att påstå total
täckning. Det här är samma "källkrav/ingen tolkning"-princip som
gäller resten av produkten.

**7. Autentisering och rate limit?**
Idag: `GET /api/events` har **ingen autentisering och ingen rate
limit alls** — vår enda rate limiter är scopad till `/api/auth/*`
(5/min/IP, se `Program.cs`). Ingen API-nyckel behövs, samma öppna
mönster som escalation-endpointen. **Men:** eftersom en ny endpoint
skulle anropas per chattmeddelande (potentiellt mycket fler anrop per
besökare än en vanlig sidladdning), föreslår vi en EGEN, separat
rate-limit-policy bara på den nya endpointen — inte återanvänd den
befintliga öppna `/api/events` utan skydd. Förslag: 20–30 anrop/
minut/IP, generöst för legitim chattanvändning men ett golv mot
missbruk.

## Föreslaget nästa steg
Bygga en ny endpoint, t.ex. `GET /api/events/search-public` (namn ej
låst), som kombinerar:
- Publicerad-filtret från `GetEvents`
- Fuzzy `geography`/fritext-`sokord`/`eventType`/`from`/`to` från
  admin-sökningen
- `SourceName` joinad in
- Ny, egen rate-limit-policy
- Default `pageSize` lägre (10)

**Inte byggt än** — väntar på ditt godkännande att bygga det, eller på
ett svar från kundtjänstbot-sessionen om ovanstående räcker som spec
innan vi kodar.

## Kopplat
- [[FAQ-synk-kundtjanstbot]] — deras epic #203, nu aktiverat
- [[Kundtjanstbot-launch-readiness]] — varför frågan om skarpa
  händelser kom upp överhuvudtaget
