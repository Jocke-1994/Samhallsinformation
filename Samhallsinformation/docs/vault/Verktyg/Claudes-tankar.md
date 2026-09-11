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

## SPAR-klustret (#46, #55) bör formellt avfärdas, inte bara ignoreras
De ligger där som ett spöke från en tidig produktidé som aktivt revs bort
(session 24/25). Att lämna dem "öppna men ignorerade" är sämre än att
stänga dem med en tydlig motivering — en framtida session (mänsklig eller
jag) kan annars råka plocka upp dem och undra varför SPAR inte finns,
utan att veta att beslutet redan togs.

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

## Frontend har fortfarande noll testtäckning
Bekräftat sedan tidigare sessioner, men värt att lyfta igen i ljuset av
hur många av dagens buggar (avlånga kort, klippt placeholder-text,
saknad ångra-knapp) var rena UI-lager-fel som en enkel komponent-/
snapshot-testsvit hade kunnat fånga automatiskt istället för att kräva
att du manuellt klickar igenom hela flödet på en riktig telefon. Jag
föreslår inte att bygga en fullständig testsvit nu — bara att notera att
kostnaden för att INTE ha en växer i takt med att appen mognar och antal
sidor/komponenter ökar.

## En liten organisatorisk idé
Nu när `Funktioner/`-mappen börjar bli tät (14 noter efter idag), kan
`_Oversikt.md`s Dataview-tabeller bli svåra att skumma på en gång. Om det
känns så när du väl öppnar Obsidian — en enkel fix är att lägga till en
`grupp`-kolumn i "Aktiva"-tabellen (finns redan i frontmatter, bara inte
visad) så du kan skumma efter Konto/Admin/Support/Flöde istället för en
lång alfabetisk lista.
