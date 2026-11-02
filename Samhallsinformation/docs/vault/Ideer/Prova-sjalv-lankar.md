---
typ: ide
status: lanserad  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ja  # giltiga värden: ja | nej | ej-bedomd
beroenden: "Förhandsvisningen i Uppdateringar bör vara mergad först (länken ska synas i förhandsvisningen och kontrolleras av checklistan)."
prioritet: ej-bedomd  # giltiga värden: hog | medel | lag | ej-bedomd
pipelineNr: ""
kalla: "din idé 2026-11-02, när vi pratade om vart Ny version-pushen ska leda"
---

# "Prova själv"-länkar i Uppdateringar

Varje rad i en uppdatering kan få en klickbar **"Prova själv →"** som tar
användaren direkt till platsen i appen där det nya finns, med rätt flik öppen.

Ditt flöde:
> Notis → **Uppdateringar** (text om vad som är nytt) → **"Prova själv →"** → rätt plats i appen

Exempel: *"Filtrera flödet på din kommun"* → **Prova själv →** öppnar Senaste nytt
med fliken **Filtrera på plats** vald.

## Varför
Man lär sig funktionen genom att använda den, inte genom en guide (samma
tanke som när välkomst-popupen togs bort, session 38). Uppdaterings-texten
slutar inte vid "det här finns nu" utan leder dit.

## Förslag (Claude, 2026-11-02)
1. **Fast lista med destinationer** i formuläret, inte fritext-länk, t.ex.
   "Senaste nytt → Filtrera på plats", "Konto → Push-notiser". Går inte att skriva fel.
2. **Länken följer funktionens flagga.** Är funktionen avstängd syns ingen
   "Prova själv". Annars leder den till något som inte finns.
3. **Syns överallt där nyheten syns:** Nyheter-sidan, Profil → Uppdateringar,
   Vad är nytt-rutan och förhandsvisningen. Checklistan kan fråga om en
   "Ny funktion" saknar länk.
4. **Notisen landar på Profil → Uppdateringar** (där inloggade ser alla rader),
   och därifrån leder varje rad vidare.

## Tekniskt att veta
- Fliken "Filtrera på plats" (`NewsFeed.tsx`) har ingen egen adress i dag, den
  måste få en (t.ex. `/?vy=plats`). Profilens delar har redan adresser
  (`/profil?section=konto`).
- Profil → Uppdateringar är avstängd (flaggorna `uppdateringar_senaste`/`_historik`)
  sedan 2026-08-16 för "gammalt innehåll". **Den anledningen gäller inte längre**:
  sedan 2026-09-15 hämtas innehållet från databasen (samma som Nyheter-sidan).
  Pågång och Kända problem är fortfarande mock och har egna flaggor.

## Beslut 2026-11-02 (dina svar, från mobilen)
- **Destinationer från start:** Senaste nytt → Filtrera på plats, Mina källor, Konto, Support. Fler kan läggas till senare.
- **Besökare:** ja, de ser "Prova själv" även på funktioner som kräver konto, **men det ska framgå att det kräver ett konto** (t.ex. "Prova själv · kräver konto"), och länken leder till inloggning först.

## Byggt 2026-11-02 (PR #713)
- Skiss godkänd: https://claude.ai/artifact/3zCQvEMiaKnNbHBEG8cXrk. Skärmdumpar av det byggda: https://claude.ai/artifact/SfnLLVcsMzB3r4ygt74KKc
- Profil → Uppdateringar slås på i lanseringen 3 november (frågan löst).
- **Mål (fast lista):** Senaste nytt → Filtrera på plats, Profil → Uppdateringar, Konto → Push-notiser, Mitt flöde → Sparat, Mina källor, Support. Nytt mål = lägg till i `frontend/src/lib/provaSjalv.ts` OCH `UppdateringsVärden.ProvaSjalvMål` (ett paritetstest fäller bygget annars).
- Länken följer funktionens flagga, döljs på sidan man redan står på, och besökare ser "🔒 kräver konto" och går via inloggningen.
- Adresserna `/?vy=plats` och `/?vy=sparat` öppnar rätt flik.
- Förhandsvisningen visar länkarna efter lanseringens flaggor; checklistan frågar om "Ny funktion" saknar länk och varnar om länken pekar på något avstängt.
- Två förarbeten i samma veva: förhandsvisningen fick fliken Profil (PR #712), och "Ny uppdatering" sparar osparat utkast + alla flaggor valbara (PR #711).

## Kopplat
- [[Uppdateringar-forhandsvisning]]
- [[Vad ar nytt-modal]]
- [[../Rutiner/1. Rutiner för admin/Lansera en ny funktion]]
