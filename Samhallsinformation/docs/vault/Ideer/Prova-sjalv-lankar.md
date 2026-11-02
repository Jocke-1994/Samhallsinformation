---
typ: ide
status: fragor-olosta  # giltiga värden: ide | fragor-olosta | redo-for-pipeline | i-pipeline | lanserad | avfardad
uiGodkand: ej-bedomd  # giltiga värden: ja | nej | ej-bedomd
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

## Öppna frågor
- Vilka destinationer ska finnas i listan från start?
- Ska en besökare se "Prova själv" på en funktion som kräver inloggning
  (t.ex. leda till inloggning), eller ska länken döljas för besökare?
- Slå på Profil → Uppdateringar (Senaste version + Versionshistorik) när detta byggs?

## Kopplat
- [[Uppdateringar-forhandsvisning]]
- [[Vad ar nytt-modal]]
- [[../Rutiner/1. Rutiner för admin/Lansera en ny funktion]]
