# Flöde: ny idé

Vad som borde hända, rent praktiskt, från att en idé dyker upp till att
den antingen byggs eller läggs åt sidan. Första utkast (2026-09-12),
justerat efter svar samma dag. Viktigaste principen, bekräftad av dig:
**vi ska aldrig tappa bort en idé, oavsett varifrån den kommer** — resten
av det här dokumentet är bara detaljer kring HUR.

Från användare:

En användare berättar om en idé/önskemål, oftast via Feedback-knappen
("Hjälp & Feedback") som skapar ett supportärende, eller via
kundtjänstboten om den fångar upp något mitt i en konversation.

**Vad borde hända:** den som läser ärendet (idag: du) avgör om det är en
riktig idé eller en vanlig supportfråga. Är det en idé — plocka ut den ur
ärendet och skriv ner den som en rå tanke här i `1. Öppna_tankar/`, med en
kort referens till vilket ärende den kom från så ursprunget inte tappas.


Från support (ej aktuellt än):

Borttagen tills en andra supportperson faktiskt finns — bara du har
tillgång till Obsidian idag, så en support-person kan ändå inte skriva
direkt hit. Bygg den här grenen med riktiga rutiner den dagen det faktiskt
finns folk (troligen: eskalera till admin, som skriver ner tanken här å
deras vägnar) — inte innan, ingen anledning att gissa i förväg.


Från admin:

Den vanligaste källan idag — en idé som dyker upp under en session, ofta
mitt i en Claude-konversation.

**Vad borde hända:** skrivs direkt som en rå tanke här, eller om den redan
är tillräckligt formad, direkt som en `Ideer/`-not (se `Ideer/_Mall.md`) —
utan att behöva gå via den här mappen alls.


## Gemensamt flöde härifrån
1. **Rå tanke** — landar i `1. Öppna_tankar/`, ostrukturerad, inget krav på
   färdig text
2. **Formaliseras** — håller idén, blir den en riktig `Ideer/`-not (mall
   finns) med öppna frågor tydligt listade
3. **Pipeline** — redo att byggas, får ett `pipelineNr` i frontmatter och
   läggs upp i adminpanelens funktionsidé-pipeline
4. **Byggd eller avfärdad** — blir en `Funktioner/`-not (status: aktiv),
   eller avfärdas med en motivering (samma mönster som
   `Beslut/Beslut - SPAR avfärdat.md`) så den inte dyker upp som ett
   oavslutat spöke senare

## Frågor — besvarade 2026-09-12
- **Två parallella vägar (rå tanke ELLER direkt `Ideer/`-not), eller allt
  via `1. Öppna_tankar/` först?** → Behåll båda vägarna, beror på hur
  färdig tanken känns. `1. Öppna_tankar/` är tänkt för interna/lösa
  funderingar, `Ideer/` mer för "det här låter faktiskt som en bra grej".
  Du föreslog en möjlig framtida uppdelning ("öppna tankar_internt" vs.
  "öppna tankar_användare") men vill inte bygga den förrän det faktiskt
  behövs — huvudsaken är att ingen idé tappas bort, inte exakt vilken mapp
  den ligger i under tiden.
- **Ska källan (användare/support/admin) sparas som ett eget frontmatter-
  fält?** → Inget nytt fält behövs — `Ideer/_Mall.md` har redan ett
  `kalla`-fält (fritext, t.ex. "mejlfeedback session 38") som räcker precis
  lika bra för "användarfeedback, ärende #123" eller liknande.
- **Ska "Från support" tas bort tills en andra supportperson finns?** →
  Ja, borttagen ovan (se anteckningen i den sektionen).
