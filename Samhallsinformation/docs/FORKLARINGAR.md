# Förklaringar — vad är det här, egentligen?

Den här filen förklarar projektet och det som händer i det, i vanligt språk. Ingen
teknisk bakgrund krävs — om en mening bara går att förstå om man redan kan
programmera så är den fel skriven, och ska skrivas om.

Den tekniska loggen (för den som vill ha detaljer: filnamn, PR-nummer, kodrader)
finns i `CLAUDE.md`. Den här filen är tänkt att gå att läsa och förstå istället för
den, inte som ett komplement man måste ha båda för.

---

## Vad är Samhällsinformation?

En webbsida som samlar viktig information från svenska myndigheter — polisen,
krisinformation.se, SMHI, Livsmedelsverket och fler — på ett och samma ställe.
Istället för att behöva besöka tio olika myndigheters hemsidor för att hålla koll,
samlas allt här. Sidan skriver aldrig om eller tolkar informationen — den visar
bara vidare det myndigheten själv sagt, med en länk till källan.

## Hur är sidan byggd, i stora drag?

Tänk på det som två delar som pratar med varandra:

- **En "baksida" (backend):** ett program som med jämna mellanrum går och hämtar
  ny information från myndigheternas egna flöden, och sparar den i en databas.
- **En "framsida" (frontend):** den webbsida du faktiskt ser och klickar på i
  webbläsaren. Den hämtar informationen från baksidan och visar upp den snyggt.

De två delarna utvecklas och uppdateras var för sig, men behöver prata samma
"språk" för att fungera ihop.

## Ord vi kommer använda (en gång, så slipper vi förklara varje gång)

- **PR (Pull Request):** ett paket med kodändringar som väntar på att bli
  godkänt och infogat i den riktiga, levande sidan. Ungefär som ett utkast som
  granskas innan det skickas i väg på riktigt.
- **Dependabot:** en robot som automatiskt håller koll på alla de färdiga
  byggklossar (kod som andra utvecklare skrivit och delat ut gratis) som sidan
  är byggd med. När en byggkloss får en uppdatering — ofta för att en säkerhets-
  brist upptäckts och lagats — föreslår roboten automatiskt att vi byter till
  den nya versionen.
- **CI (byggkontroll):** ett automatiskt test som körs varje gång vi föreslår en
  ändring. Det kollar att sidan fortfarande går att bygga och att inget uppenbart
  gått sönder, innan ändringen tillåts gå live.
- **Deploy (publicera):** när en ändring går från "kod på en dator" till att
  faktiskt synas på den riktiga, publika webbsidan.

---

## Del 1 — Funktionerna i appen, förklarade en och en

Byggs på över tid, viktigast (det en besökare möter direkt) först.

### Logga in och skapa konto

**Vad det är tänkt att göra:** ge besökare möjlighet att skapa ett konto med
e-post och lösenord, så att sidan kan komma ihåg vilka källor de bryr sig om och
senare skicka notiser när något viktigt händer.

**Nuläge (2026-07-25):** Tekniken finns och fungerar — man kan registrera ett
konto, logga in, logga ut, och glömma/återställa sitt lösenord via mejl. Men
**det finns inget sätt att hitta dit** om man inte redan känner till webbadressen
(`/login` respektive `/registrera`). Sidomenyn visar just nu ingenting alls för en
besökare som inte redan är inloggad — hela "Min profil"-knappen, som är den enda
platsen en inloggningslänk skulle synas, är gömd tills man redan är inloggad. Det
är alltså ett låst rum utan synlig dörr.

Utöver det saknas två saker som brukar räknas som grundskydd för ett publikt
konto-system:
- **Ingen spärr mot att gissa lösenord eller spamma registreringar** — vem som
  helst (eller ett automatiserat program) kan just nu försöka hur många gånger
  som helst i följd, utan att bli bromsad.
- **Ingen bekräftelse av att e-postadressen faktiskt tillhör den som registrerar
  sig** — man kan skapa ett konto med vilken e-postadress som helst, även någon
  annans, utan att den adressen behöver bekräfta något.

**Se avsnittet "Kan vi öppna registrering för allmänheten idag?" nedan** för en
samlad bedömning av vad som behöver vara på plats innan detta bör göras publikt.

---

## Del 2 — Kan vi öppna registrering för allmänheten idag? (2026-07-25)

Kort svar: **tekniskt går det, men det är inte klokt än.** Fyra saker bör lösas
först — inte för att koden är trasig, utan för att öppna upp ett konto-system
utan dem innebär onödig risk, både för besökarna och juridiskt.

1. **Ingen syns väg in.** Se ovan — även om vi öppnar registreringen finns det
   just nu ingen knapp någonstans som leder dit. Det här är den enklaste biten
   att fixa.
2. **Ingen spärr mot missbruk (rate limiting).** Utan en broms kan ett
   automatiserat program skapa hur många konton som helst, eller försöka gissa
   sig till någons lösenord i all oändlighet. Det här stod redan med på
   ursprungsplanen (GitHub-ärende #295) men blev aldrig byggt.
3. **Ingen dataexport eller kontoradering (GDPR).** Så fort riktiga människor
   registrerar sig med sina riktiga uppgifter gäller GDPR — lagen som ger var
   och en rätt att både få ut all sin sparade data och få den permanent
   raderad. Just nu finns ingen av delarna (GitHub-ärenden #56 och #57). Det är
   inte valfritt att bygga det här om kontot är publikt och riktigt.
4. **Kärnfunktionen i kontot är inte byggd än** — att välja vilka källor och
   vilka geografiska områden man vill få information om (kallat FAS 4,
   GitHub-ärende #298). Ett konto utan detta ger besökaren väldigt lite
   anledning att faktiskt skapa ett — se punkt 4 i dagens att-göra-lista, som är
   nästa stora bit att bygga.

**Det som inte behöver vara klart för en första, ansvarsfull publicering:**
Google-inloggning, BankID, SMS-notiser, och den guidade rundturen för nya
användare — allt det är trevliga förbättringar men inget som gör tjänsten
riskabel att öppna utan.

---

## Del 3 — Ändringslogg (vad har hänt, förklarat)

### 2026-07-25 — Bytte ut en gammal byggkloss mot en ny (react-router)

Sidan använder en färdig byggkloss för att hantera navigering — vilken sida som
visas när man klickar runt utan att webbläsaren behöver ladda om hela sidan.
Den byggklossen hade en känd säkerhetsbrist i en funktion vi inte ens använder,
men för att bli av med varningen helt behövde vi byta till en ny huvudversion
av den (PR #355). Bytet var enkelt eftersom vi bara använder de grundläggande
delarna av byggklossen — inga avancerade funktioner som skulle krävt en stor
ombyggnad. Samtidigt höjde vi kravet på vilken version av Node.js (verktyget
som kör och bygger sidan bakom kulisserna) som får användas, från version 20
till version 22, eftersom den nya byggklossen kräver det.

### 2026-07-25 — Stoppade en trasig automatisk uppdatering (TypeScript)

Dependabot (roboten som föreslår uppdateringar) föreslog en uppdatering av
TypeScript — själva programmeringsspråket koden är skriven i — till en helt ny
huvudversion (PR #341). Den uppdateringen visade sig krocka med en annan
byggkloss som inte hunnit anpassa sig till den nya versionen än, så bygget
gick sönder. Vi stängde det förslaget och bad Dependabot att inte föreslå
samma sak igen förrän de två byggklossarna faktiskt fungerar ihop (PR #349).

### 2026-07-25 — Mindre uppdateringar av byggklossar (flera PR:ar)

Ett gäng mindre uppdateringar av de färdiga byggklossarna sidan är gjord av
— alla från Dependabot, alla av typen "samma funktion, nyare och bättre
version":

- PR #339, #340, #342, #343 — uppdaterade byggverktyg och ett par bibliotek
  (bland annat React självt, grundbiblioteket hela sidan är byggd i)
- PR #350, #351, #352, #353, #354 — uppdaterade utvecklingsverktyg som bara
  används när vi bygger och kodar, aldrig av besökaren på riktiga sidan
  (Tailwind CSS-verktyg, kodkontrollverktyget ESLint, TypeScript-typkontroll,
  och Node.js-typer)

Inget av det här ändrar hur sidan ser ut eller fungerar för en besökare — det
är underhåll som håller sidan säker och byggbar.

### 2026-07-24 — Lagade tre säkerhetsvarningar, lämnade en medvetet (PR #347)

Tre byggklossar hade kända säkerhetsbrister (en handlade om att ett verktyg
kunde få hänga sig om det fick konstig indata, en om att kunna läsa filer man
inte skulle kunna läsa, en om ett litet dataläckage) — alla tre satt i
verktyg som bara används när vi utvecklar, aldrig i den färdiga sidan
besökaren ser. Uppdaterades utan vidare eftertanke.

En fjärde varning — i just react-router (se ovan) — lämnades medvetet
olöst just då, eftersom att fixa den innebar ett större jobb (bytet som
beskrivs högst upp i den här loggen). Byggkontrollen (CI) fick tillfälligt
en regel som sa "acceptera just den här kända varningen, men stoppa direkt om
en ny, okänd varning dyker upp". Den regeln togs bort igen så fort den riktiga
fixen (react-router v8) var på plats.
