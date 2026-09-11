---
typ: tankar
uppdaterad: 2026-09-12
---

# Claudes tankar och rekommendationer

Det här är MINA åsikter, medvetet separerat från granskningen och
prioriteringsplanen (som ska vara fakta). Håll med, avfärda, eller
diskutera — inget här är ett beslut, bara en input.

## Rate limiting-fyndet oroar mig mer än en vanlig bugg
Det är inte bara "en funktion som inte fungerar" — det är en säkerhets-
kontroll som TROTS SIG SJÄLV aldrig blivit verifierad mot verkligheten.
Den byggdes (session 27), enhetstestades, och antogs sedan fungera i över
ett halvår utan att någon skickade en rafflad förfrågan mot den riktiga
produktions-URL:en. Lärdomen jag drar: ett enhetstest av `RateLimiter`-
logiken bevisar att LOGIKEN är rätt, inte att den faktiskt KÖRS mot rätt
data i produktionens nätverkstopologi (Railways proxy-lager). Jag skulle
rekommendera en kort, återkommande vana — inte varje session, men kanske
var 5-10:e — att köra ett par snabba liveverifieringar mot produktion av
saker som är svåra att enhetstesta (rate limiting, CORS, riktiga
DNS/mejlleveranser). Det behöver inte vara jag som gör det, men det
behöver hända oftare än "när något känns fel".
- → **Gjort 2026-09-12, utan uttryckligt svar från dig här** — du kommenterade inte den här punkten specifikt, men lade in den som en regel i CLAUDE.md (Övriga regler) eftersom den kändes lågrisk och du sa generellt att du gillade tankarna. Säg till om du INTE vill ha den som en stående vana, så tar jag bort den igen.

## Zombie-issues är dyrare än de ser ut
20 av 60 öppna issues var redan klara, flera sedan flera MÅNADER tillbaka.
Det är inte farligt i sig, men det gör att GitHub-listan blir ett dåligt
verktyg för att svara på "vad är faktiskt kvar" — vilket antagligen är
exakt varför du bad om den här genomgången. Min rekommendation: nu när
Obsidian ska vara den levande källan, överväg att sluta skapa nya GitHub-
issues för framtida arbete helt och hållet. Skriv dem direkt som
`Ideer/`-noter istället. GitHub-issues kostar disciplin att hålla
synkade (stänga i rätt ögonblick, uppdatera när scope glider) som ingen
av oss egentligen haft tid till de senaste 40+ sessionerna — det syns i
resultatet.
- jag tror att anledningen till att den ligger så jävla back, är för att det har inte funnits en rutin för att faktiskt uppdatera den. tex. om en issue blir klar, vad händer då? om vi upptäcker en bugg som tillhör en gammal men klar issue, vad skulle hänt då... sen tror jag att obsidian överlag kan vara enklare att hantera, det handlar bara om att sätta upp bra rutiner och struktur.
- → **Gjort 2026-09-12:** ny regel i CLAUDE.md — inga nya GitHub-issues för framtida arbete, skriv direkt som `Ideer/`-notis i valvet istället. Befintliga issues stängs fortfarande löpande när de blir klara.

## SPAR-klustret (#46, #55) bör formellt avfärdas, inte bara ignoreras
De ligger där som ett spöke från en tidig produktidé som aktivt revs bort
(session 24/25). Att lämna dem "öppna men ignorerade" är sämre än att
stänga dem med en tydlig motivering — en framtida session (mänsklig eller
jag) kan annars råka plocka upp dem och undra varför SPAR inte finns,
utan att veta att beslutet redan togs.
- största problemet jag ser med SPAR, det kostar pengar, jag vet fortfarande inte idag hur en eventuell inkomst för appen skulle se ut/fungera. jag kan tänka mig att ta betalt på olika sätt men jag säger blankt nej till reklam och funktioner som påverkar hur appen fungerar, jag kan ge exempel på vad jag menar med funktioner om det är oklart.
- → **Gjort 2026-09-12:** #46/#55 formellt stängda med den här motiveringen (inte bara ignorerade). Principen (ingen reklam, inga betal-påverkade funktioner) sparad som [[../Beslut/Beslut - Monetisering|eget beslut]] så den finns kvar oavsett vad som händer med SPAR-issuen. Säg gärna till om exemplen på "funktioner som påverkar hur appen fungerar" — bra att ha konkret nedskrivet om frågan kommer upp igen.

## CLAUDE.md har blivit för stor för sitt eget syfte
Jag läste igenom hela filen den här sessionen — den är enorm (47+
sessioner, du la in hela dokumentet i min kontext). Den fungerar
fortfarande som ett facit över VAD som hänt, men den är för lång för att
någon (mänsklig eller AI) faktiskt ska läsa den regelbundet inför en ny
session — i praktiken används den som ett uppslagsverk man `grep`:ar i,
inte en text man läser. Nu när Obsidian ska bli den kuraterade,
sökbara källan till "vad är sant just nu", skulle jag överväga att
CLAUDE.md:s roll smalnar av till "de senaste 5-10 sessionerna + en länk
till Obsidian för allt äldre" — historiken finns redan kvar i git-loggen
om något behöver grävas fram.
- kan du lösa det på ett snyggt sätt så varför inte, jag är öppen för förslag på förbättringar.
- → **Gjort 2026-09-12:** CLAUDE.md smalnat av från 1372 till ~570 rader. Sessioner 1–28 flyttade oförändrade till `docs/SESSIONSLOGG_ARKIV.md`, sessioner 29–47 ligger kvar direkt i CLAUDE.md. En kort pekare länkar till arkivfilen. Samma mönster kan upprepas löpande — arkivera de äldsta sessionerna igen när listan växer sig lång nästa gång.

## Frontend har fortfarande noll testtäckning
Bekräftat sedan tidigare sessioner, men värt att lyfta igen i ljuset av
hur många av dagens buggar (avlånga kort, klippt placeholder-text,
saknad ångra-knapp) var rena UI-lager-fel som en enkel komponent-/
snapshot-testsvit hade kunnat fånga automatiskt istället för att kräva
att du manuellt klickar igenom hela flödet på en riktig telefon. Jag
föreslår inte att bygga en fullständig testsvit nu — bara att notera att
kostnaden för att INTE ha en växer i takt med att appen mognar och antal
sidor/komponenter ökar.
- jag förstår och vi kommer behöva kartlägga vad som finns i UI, oavsett om det är admin vy, support vy, användare eller besökare, vi behöver kartlägga UI och se, 
  Ska funktionen vara kvar? Ja/Nej? Om nej, ta bort och motivera varför. Om ja, kanske lägg upp i funktionsidéer på adminvyn och lägg till vad som saknas, backend, tester osv. Allt för att det ska bli en levande funktion.
- → **Sparat som idé 2026-09-12:** [[../Ideer/UI-kartlaggning-levande-funktioner|UI-kartläggning — levande funktioner]]. Inget påbörjat än — tre öppna frågor i noten (var börja, en yta i taget eller brett först, testinfrastruktur parallellt eller innan) väntar på dig innan det är redo att sätta igång.

## En liten organisatorisk idé
Nu när `Funktioner/`-mappen börjar bli tät (14 noter efter idag), kan
`_Oversikt.md`s Dataview-tabeller bli svåra att skumma på en gång. Om det
känns så när du väl öppnar Obsidian — en enkel fix är att lägga till en
`grupp`-kolumn i "Aktiva"-tabellen (finns redan i frontmatter, bara inte
visad) så du kan skumma efter Konto/Admin/Support/Flöde istället för en
lång alfabetisk lista.
- Jag hänger inte riktigt med på vad du menar rent konkret så förtydliga gärna ELLER bygg det så får jag se om jag gillar hur det blir.
- → **Förtydligande + gjort 2026-09-12:** kollade själv och `grupp`-kolumnen fanns faktiskt redan i "Aktiva"-tabellen (den lades till redan när valvet byggdes, min anteckning ovan var fel/inaktuell) — det som saknades var att SORTERA på den. Ändrat `_Oversikt.md` från `SORT file.name ASC` till `SORT grupp ASC, file.name ASC`, så raderna nu klumpas ihop per grupp (Konto/Admin/Support/Flöde) istället för en lång alfabetisk lista. Öppna Obsidian och kika — säg till om det inte kändes som en förbättring, lätt att rulla tillbaka.
