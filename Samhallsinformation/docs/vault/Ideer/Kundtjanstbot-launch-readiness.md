---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ej-bedomd
beroenden: "Väntar på svar/åtgärd från kundtjänstbot-projektets egna Claude-session — vi äger inte den kodbasen"
prioritet: hog
pipelineNr: ""
kalla: "session 2026-09-13, uppföljning inför att slå på showLoginButton/showRegisterButton"
---

# Är kundtjänstboten redo för fler användare?

Inför att öppna Logga in/Skapa konto-knapparna publikt (sista steget i
launch-ordningen, se `_Prioritering.md`) lyfte du en genuin oro: är
kundtjänstboten redo att ta emot skarpa frågor från riktiga användare,
eller bör den tydligt deklarera att den kan ha fel/sakna information
eftersom den är under uppbyggnad?

## Vad vi redan vet (session 47, 2026-09-09)
Boten är en fristående AI-hybrid i ett separat projekt
(`kundtjanstbot-production.up.railway.app`), inbäddad här via
`<script src=".../chat.js">` i `frontend/index.html`. Fuzzy-matchad
kunskapsbank → Claude-fallback som växer KB:n automatiskt, ingen "jag
förstår inte"-dödsände. FAQ-synken (se
[[FAQ-synk-kundtjanstbot]]) håller på att kopplas in men är inte
klar — väntar på polling-mekanism + cross-project-avstämning där.

## Vad vi INTE vet härifrån
Vi äger inte kundtjänstbot-projektets kodbas eller systemprompt, så vi
kan inte se härifrån:
- Om boten redan har någon typ av disclaimer/osäkerhetsmarkering inbyggd
- Hur den hanterar en fråga den saknar underlag för (gissar den fritt,
  eller är den transparent om osäkerhet?)
- Om den har någon confidence-signal eller källhänvisning i sina svar

## Två alternativ du ställde upp
1. Se till att boten faktiskt ÄR redo att ta emot skarpa frågor (kräver
   att först veta hur bra den redan är)
2. Om den inte är där än: lägg till en tydlig, synlig disclaimer ("jag
   kan ha fel eller sakna information, jag är under uppbyggnad") så
   förväntningarna är rätt satta från start

## Föreslaget nästa steg
Skicka nedanstående fråga till kundtjänstbot-projektets Claude-session
(samma mönster som FAQ-synken) för att få en ärlig statusbild innan
beslut — vi kan inte avgöra det här själva utan att gissa om en
kodbas vi inte har tillgång till.

---
📋 **Till kundtjänstbot-projektet** (kopiera till den sessionen):

Vi i Samhällsinformation-projektet planerar att öppna publik
inloggning/registrering inom kort, vilket sannolikt ökar antalet
riktiga användare som pratar med kundtjänstboten. Innan vi gör det vill
vi ha en ärlig statusbild från er sida:

1. Har boten idag någon inbyggd disclaimer/osäkerhetsmarkering — t.ex. i
   systemprompten eller i välkomstmeddelandet — som talar om att den kan
   ha fel eller sakna information?
2. Hur hanterar boten en fråga den saknar underlag för i
   kunskapsbanken? Gissar Claude-fallbacken fritt, eller är den
   försiktig/transparent om osäkerhet?
3. Finns det någon känd svaghet eller kategori av frågor ni själva
   bedömer att boten hanterar dåligt just nu?

Om svaret på (1) är nej och (3) avslöjar genuina svagheter: vår
rekommendation är en kort, synlig disclaimer i chattfönstret (t.ex.
"Jag är under uppbyggnad och kan ibland ha fel — dubbelkolla viktig
information") snarare än att försöka göra boten perfekt innan
lansering. Hör av er med er bedömning.
---

## Svar från kundtjänstbot-projektet, 2026-09-13 (baserat på faktisk kod)

**1. Disclaimer idag?** Nej, inte för riktiga tenants. En hårdkodad
disclaimer finns bara i den gamla demo-vyn (`Chat.jsx`, Lumio-det
fiktiva exempelföretaget). Både den hostade sidan (`/chat/:companyId`)
och embed-scriptet `chat.js` — det Samhällsinformation faktiskt
använder — saknar helt disclaimer-text.

**2. Hur hanteras en fråga utan underlag?** Delvis transparent, inget
hårt skydd:
- KB-träff → svaras direkt från kunskapsbanken, ingen AI inblandad
- Cache-miss → Claude-fallback, som får en global instruktion (alla
  tenants) att avsluta med en dold `[LOW_CONFIDENCE]`-markör om frågan
  är företagsrelaterad men inte kan besvaras konkret. Markören strippas
  före visning men sätter en `lowConfidence`-flagga UI:t kan reagera på
- **Viktigt förbehåll:** modellen bedömer sin egen osäkerhet — ingen
  oberoende verifiering. Lumio-demot har dessutom en egen, hårdkodad
  "hitta aldrig på information"-regel i sin systemprompt. Okänt om
  Samhällsinformations tenant-specifika systemprompt har motsvarande
  regel — inte kollat än

**3. Kända svagheter?**
- **Verklig lucka, hittad live:** `hasEscalation: false` för
  Samhällsinformation (`/api/public/8/config`, företag-id 8) — trots att
  hela eskalering-till-support-funktionen (#221/#222) byggdes SPECIFIKT
  med Samhällsinformation som målgrupp. `SupportEscalationUrl` är inte
  konfigurerad. Varken `lowConfidence`-nudgen eller den alltid synliga
  "Prata med support"-knappen har något att länka till för oss just nu
- KB-innehållets aktualitet är helt manuellt — ingen automatisk omsynk
  (det är precis vad [[FAQ-synk-kundtjanstbot]]/deras #220 ska lösa)
- Ingen KB-täckningsvarning — inget larmar om många frågor faller
  tillbaka på AI för att KB saknar täckning

Bekräftar vår slutsats: svaret på (1) är nej för riktiga tenants. De
frågade om de ska implementera en disclaimer-textrad i `chat.js`
(gäller då ALLA tenants, inte bara oss) eller vänta på vårt beslut.

## Vår rekommendation, skickad tillbaka 2026-09-13
1. **Ja, implementera disclaimern** — men helst tenant-konfigurerbar med
   ett neutralt default (t.ex. "Svar kan innehålla fel — dubbelkolla
   viktig information") snarare än en hårdkodad rad som gäller alla,
   ifall andra tenants har egna önskemål om ton/text. Om det är för
   mycket jobb just nu: en delad generisk rad för alla tenants duger som
   ett första steg, tenant-override kan komma senare
2. **Mer akut för oss specifikt:** `SupportEscalationUrl` måste
   konfigureras för företag-id 8 innan lansering — annars pekar
   escalation-knappen/nudgen ingenstans för våra användare. Föreslagen
   URL: `mailto:support@samhallsinformation.se` (redan en fungerande
   tvåvägskanal sedan Resend inbound, session 45)
3. Be dem kolla om Samhällsinformations tenant-specifika systemprompt
   redan har en "hitta aldrig på information"-regel likt Lumio-demots —
   om inte, lägg till den specifikt för oss

## Öppna frågor
- Väntar på bekräftelse att `SupportEscalationUrl` är satt för
  företag-id 8, och att disclaimer-beslutet (generisk vs.
  tenant-konfigurerbar) är genomfört
- Om en disclaimer väljs: var ska den synas (varje session, bara första
  gången, permanent i chattfönstrets header)? — inte beslutat av oss,
  rimligen deras UX-kall

## Kopplat
- [[FAQ-synk-kundtjanstbot]]
- [[../1. Öppna_tankar/_Prioritering|_Prioritering]]
