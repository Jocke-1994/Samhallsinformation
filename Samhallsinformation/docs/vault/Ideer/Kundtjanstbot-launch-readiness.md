---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | avfardad
uiGodkand: ej-bedomd
beroenden: "Kräver svar från kundtjänstbot-projektets egna Claude-session — vi äger inte den kodbasen"
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

## Öppna frågor
- Väntar på svar från kundtjänstbot-projektets session innan beslut
- Om en disclaimer väljs: var ska den synas (varje session, bara första
  gången, permanent i chattfönstrets header)?

## Kopplat
- [[FAQ-synk-kundtjanstbot]]
- [[../1. Öppna_tankar/_Prioritering|_Prioritering]]
