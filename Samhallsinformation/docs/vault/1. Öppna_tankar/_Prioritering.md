---
typ: prioritering
uppdaterad: 2026-09-12
---

# Prioritering — allt utestående på ett ställe

Byggd 2026-09-12 efter en full genomgång av GitHub-issues, GitHub-boarden
och Obsidian-valvet. Uppdatera det här dokumentet istället för att låta
prioriteringar bara leva i sessionsloggar — det är hela poängen med det.

## 🔴 Blockerar publik lansering

1. **Rate limiting** — ✅ **Rättad slutsats 2026-09-12: den här punkten var
   inaktuell.** Rate limiting-buggen (bekräftat trasig 2026-09-11) fixades
   och verifierades live samma helg — `ForwardedHeaders`-middlewaren
   korrigerad för Railways dubbla proxylager, live-testad med 8 rafflade
   inloggningsförsök (401×5 sen 429×3). Fungerar. Den här punkten skrevs
   in i granskningen INNAN fixen, borde ha uppdaterats direkt — ber om
   ursäkt för förvirringen
2. **`showLoginButton`/`showRegisterButton`** fortfarande av — bekräftat:
   förblir av tills testerna nedan är gjorda och du känner dig nöjd
3. **Google-inloggning mot en e-post som redan har ett lösenordskonto** —
   ✅ **Klargjort 2026-09-12, kod-läst istället för gissat:**
   `AuthService.GoogleLoginAsync` letar upp kontot på e-post, oavsett hur
   det ursprungligen skapades (lösenord eller Google) — hittas ett
   befintligt konto loggas man rakt in på DET kontot, ingen ny rad skapas,
   inget fel, ingen extra bekräftelse krävs (Google har redan bevisat
   e-postägarskapet via OAuth). Kombinerat med `isNewUser`-flaggan (fixad
   tidigare i den här sessionen) hoppar `OnboardingPage` dessutom över
   guiden i det här fallet — bekräftat både i kod och i tidigare
   sessionstest. Ingen kvarstående osäkerhet, stryks som blockerare
4. **`/login`-sidan, mobilgenomgången** — enligt dig redan testad. Litar på
   ditt minne, stryks som blockerare
5. **Kundtjänstboten redo för fler användare?** — Ny 2026-09-13, tillagd
   på din begäran inför att slå på punkt 2. Boten är byggd i ett separat
   projekt vi inte äger kodbasen till — kan inte avgöras härifrån utan
   att fråga den sessionen. Se
   [[../Ideer/Kundtjanstbot-launch-readiness|Kundtjänstbot-launch-readiness]]
   för ett färdigt, kopierbart meddelande till kundtjänstbot-projektets
   Claude-session. Väntar på ditt beslut att skicka det + deras svar

## 🟡 Rekommenderat innan lansering, inte blockerande

- PR #516 (Nyheter-sidan) + #517 (beta-badge) — medvetet omergade, väntar
  på LinkedIn-timing
- Rate limiting under en TRAFIKTOPP (flera SAMTIDIGA registreringar, inte
  bara sekventiella försök) — bör testas om igen efter fixen ovan
- **Staging-miljö** — flyttad hit 2026-09-12, du signalerade att den bör
  bli "ganska prio". En riktig lucka (produktion är enda miljön idag) —
  separat databas, test-SMS/e-post-gateway, BankID-sandbox. Inte
  blockerande för att öppna login/register, men värt att prioritera högre
  än övriga backlog-punkter
- **Riktig impersonation-backend** (admin kan faktiskt logga in som en
  användare för att se vad de ser, inte bara `Impersonation.tsx`s
  frontend-mock med påhittade sessioner) — flyttad hit 2026-09-12, du vill
  bygga den ganska snart. Detta blockerar i sin tur impersonation-loggning
  i aktivitetsloggen (se nedan)

## 🟢 Flaggade avvikelser, kräver ett beslut (inte akut)

Se [[Verktyg/GitHub-issues-granskning-2026-09-12|full granskning]] för
detaljer på varje.

- **Generisk källfiltermodell vs. Polisen-specifik lösning** — **Besvarat
  2026-09-12:** inte emot att bygga ut det till fler källor, men ser
  nyttan som liten just nu — Polisen har filter för att det kommer väldigt
  mycket information därifrån, övriga källor har inte alls samma volym.
  Behåll Polisen-specifikt, ta upp igen om en annan källas volym växer
- **Automatisk ärendearkivering (7 dagar/36 månader)** — **Beslutat
  2026-09-12:** manuell knapp räcker så länge ärendevolymen är låg. Om det
  börjar komma ~20 ärenden/dag, ta upp automatiken igen då — inte förrän
- **Support-dashboard med inbyggd hjälpguide** — en helt egen ingångssida
  för Support-rollen (inte bara dagens filtrerade adminpanel), som visar:
  öppna ärenden, driftstatus, planerat underhåll, och en intern
  "supportguide" med expanderbara hjälpkort (typ "Hur låser jag upp ett
  spärrat nummer?"). Bekräftat 2026-09-12: ja, det stämmer med hur du
  tänkte dig det. Litet jobb om/när det önskas, ingen brådska själv
- **Händelsedetaljvy (egen sida/modal per händelse)** — idag klickar man
  på ett kort i flödet och det expanderar direkt inline (`NewsItem.tsx`) —
  visar redan rubrik, källa, tid, innehåll och en länk till originalet.
  Det här issuet föreslår en RIKTIG separat vy istället (egen route/modal,
  delbar länk), plus "relaterade händelser från samma källa" som en
  eventuell extra funktion. Ingen brådska — dagens expand-mekanik täcker
  det mesta redan
- **Beta-kampanjhantering i adminpanelen** — `betaConfig.ts` är fortfarande
  en statisk textfil, inte en riktig adminfunktion. **Bekräftat
  2026-09-12:** ska göras men inte prioriterat — ni har inga användare än

## Öppna, avgränsade produktidéer (från Obsidian Idéer/)

- **Sök-funktion** (FAQ+sidor, källmärkt) — designklar, inget kodat.
  Naturligt nästa steg som gör en bottom nav bar värd att bygga
- **Bottom navigation bar** — väntar på Sök (ovan) eller Bevakningar som
  egen sida. **Bekräftat 2026-09-12:** kommer troligen byggas nån gång,
  men inte tillräckligt underlag för att vara nyttig just nu — oförändrat
- **Mobil huvudflöde — Polisen-händelsekort (Direction D vs E)** — egen
  not nu: [[../Ideer/Mobil-design-handelsekort|Mobil-design-handelsekort]].
  Du frågade om nackdelar med E — fyra saker flaggade där (höjd/skroll-
  kostnad, de två tidsstämplarna hamnar långt isär, severity-färgen kan
  vinna över fetstilen, expand-pilen saknas i mockupens stängda läge).
  Inget blockerande, men värt att läsa innan ett beslut
- "Vad är nytt"-modal — väntar på att changelog-innehållet skrivs om.
  **Bekräftat 2026-09-12:** ingen närtidsfunktion, räknar inte med en flod
  av nya användare bara för att login/register öppnas — oförändrat
- **Riktig app (Play Store via PWABuilder)** — har redan en egen, komplett
  not: [[../Ideer/Riktig app (Play Store och App Store)|Riktig app]], med
  fördelar/nackdelar för alla tre vägar (Android/iOS/full omskrivning) och
  redan besvarade öppna frågor. Status: `redo-for-pipeline`. Fanns redan
  sedan session 41 (2026-08-27) — den här radens gamla listformat var
  bara en dubblett, borttagen nu

## Genuint öppna GitHub-issues, ingen brådska

- **#36-38** (fler ingestors) — bekräftat: du vill kunna se över det här
  relativt ofta (både nya källor och fler kanaler på redan befintliga).
  Ingen enskild uppgift, snarare en stående vana — inget att bygga just nu
- **Daglig sammanfattning** (kanal + tid + frekvens + källval för en
  sammanställd sammanfattning istället för enskilda realtidsnotiser) —
  hänger ihop med SMS-frågan och push-modellen. **Bekräftat 2026-09-12:**
  ses över om/när det blir aktuellt, ingen brådska
- **Publik FAQ (utan inloggning)** — **Avfärdat 2026-09-12, GitHub-issuet
  stängt:** FAQ förblir inloggad-bara, besökare hänvisas till
  kundtjänstboten istället. Samma beslut gäller SMS-mallsektionen (bara
  aktuell om SMS byggs som notifieringskanal) och den manuellt
  uppdaterbara sektionen för kända driftstörningar hos teleoperatörer —
  ingen av dem blir aktuell utan publik FAQ. Se
  [[../Ideer/FAQ for utloggade besokare|FAQ för utloggade besökare]]
- **Ansök om att bli källa** (formulär för myndigheter: namn, kontakt, URL
  till RSS/API, beskrivning) — din oro om vilken info som behövs är redan
  exakt vad formuläret självt specar. Det som saknas är den interna RUTINEN
  för vad som händer EFTER en ansökan (hur bedömer/integrerar vi en ny
  källa tekniskt). **Du är öppen för en skiss av den rutinen** — inte
  gjort än, säg till om du vill att jag gör ett första utkast
- **Releaser↔versioner-koppling** (visa vilka ärenden/versioner hör ihop)
  — bekräftat: hänger ihop med changelog-arbetet, kommer hanteras inom kort
- **SMS som notifieringskanal** — bekräftat: kostnadsfråga, kopplat till
  [[../Beslut/Beslut - Monetisering|Beslut - Monetisering]]. Ser mörkt ut
  om det tillkommer en löpande kostnad utan bestämd intäktsmodell
- **Undersökningar/enkäter till användare** — bekräftat: genuint
  intressant, men du funderar på om förslag ändå kommer in organiskt från
  användare när de finns. Ingen brådska
- **Internt forum** — flyttad hit från kandidatlistan (inte en död idé,
  bara inte aktuellt förrän det finns fler användare/behov av det)
- **Staging-miljö** — **flyttad till 🟡 ovan**, du signalerade att den bör
  vara högre prioriterad än "ingen brådska"
- **Formell självläkning för ingestorer** (verifiera kritiska skrivningar
  mot databasen efteråt, kö:a om och försök igen automatiskt vid fel, larma
  admin om en källa varit tyst längre än förväntat) — **Bekräftat
  2026-09-12: ska absolut göras, men ingen bestämd tidpunkt än**
- **Köhantering i support-inbox** (varje agent ser bara sina egna
  tilldelade ärenden + fritext-taggar för kategorisering) — **Delvis
  avfärdat 2026-09-12, kommenterat på GitHub:** att begränsa varje agent
  till sin egen kö känns för komplicerat (oklart vem som skulle tilldela)
  — alla i supporten ska se alla ärenden. Fritext-taggningen är
  fortfarande en öppen, oberoende idé. Bara relevant när en andra
  supportperson finns, precis som Support-dashboarden ovan
- **Nyheter-sidans avgränsningstext** (förklara skillnaden mellan den
  publika Nyheter-sidan och den inloggade Uppdateringar-sidan) —
  verifierat: korrekt fortfarande inte gjort, och ska inte göras än — den
  är uttryckligen villkorad på att login/register-knapparna blir publikt
  synliga och användbara, vilket de fortfarande inte är
- **FAQ — rätta innehåll + nya frågor** — verifierat i koden, **delvis
  klart, inte helt, du håller med om att hålla den öppen:**
  - ✅ Rätta felaktigt innehåll om radera konto/dataexport — klar, kopplad
    till den riktiga GDPR-mekanismen med ångra-länk
  - ✅ Delvis — Google-inloggning, lösenordsbyte, namn/e-post-byte, Alla
    källor-skillnaden, "vad är nytt" och ångra-radering finns redan som
    frågor. **Saknas fortfarande:** "Vad är skillnaden på Alla händelser
    och Mitt flöde?", frågan om Polisen-typfilter (Polisen-bevakningar),
    kontospärrning, och en länk till `/villkor`
  - ❌ Dynamiska svar baserat på källstatus (t.ex. "källan X är pausad just
    nu") — inte påbörjad alls
  - Innehåll för `flode_sparat`/`notif_push` — korrekt oskrivet, väntar på
    att de flaggorna faktiskt slås på
- **BankID-inloggning** — bekräftat: en önskan, men samma återkommande
  kostnadsfråga, kopplat till
  [[../Beslut/Beslut - Monetisering|Beslut - Monetisering]]
- **Enhetlig aktivitetslogg, återstående delar** — wave 1 (admin/system-
  händelser) är klar och byggd. Tre konkreta luckor kvar:
  - **Impersonation-loggning** — blockerad, ingen riktig
    impersonation-BACKEND finns än (bara en frontend-mock,
    `Impersonation.tsx`, som visar påhittade sessioner utan att faktiskt
    logga in som användaren). **Du vill bumpa detta högre** — se
    impersonation-raden i 🟡-sektionen ovan (tillagd 2026-09-12)
  - **"Arkivera"-knapp i UI:t** — förtydligande av vad jag menade: fältet
    i databasen som markerar en logg-rad som arkiverad finns redan
    (`Arkiverad`), och FILTRET som döljer arkiverade rader från
    standardvyn finns redan (`visaArkiverade`) — men det finns ingen KNAPP
    någonstans i gränssnittet som en admin faktiskt kan klicka på för att
    sätta det fältet. Rörledningen finns, bara själva strömbrytaren saknas
  - **Test-/betakonto-taggning** — samma sak: fältet finns i databasen,
    men inget skriver till det någonstans — ingen mekanism känner
    igen ett test-/betakonto för att sätta flaggan automatiskt
  - Wave 2 (vanliga användares egna handlingar — temaval, Mina
    källor-ändringar, Sparat) medvetet senare, tyngre GDPR-fråga på en
    mycket större volym, måste räknas in i GDPR-exporten när den byggs ut

## Kandidater att stänga/arkivera (din bedömning, inte gjort än)

**Bekräftat 2026-09-12:** du går inte gärna in på GitHub för att slå upp
vad ett nummer betyder — så här är listan med vad varje kandidat faktiskt
handlar om, inte bara siffror (sparat som stående regel framöver):

- **Logga in med BankID** — duplikat, samma sak som "BankID"-punkten ovan
- **Logga in med Freja eID** — aldrig nämnd igen sedan den skapades,
  sannolikt en övergiven idé
- **Lägg till SMS-mottagare med verifieringskod** + **Rate limiting för
  SMS-verifiering** — duplikat av SMS-punkten ovan
- **Standardinställningar för allvarlighetsfilter/pausläge/testnotis** +
  **Källinställningar med expanderbara mottagaroverrides** — beskriver en
  gammal mail/SMS-per-källa-notismodell, känd sedan session 25 att behöva
  ett omdesign-beslut innan den är relevant igen
- **Testare-roll-klustret** (dedikerad testroll, bjuda in testare,
  hantera testarkonton, feedback-knapp för testare) — verkar redan
  ersatt av en enklare lösning (Feedback-knappen + en "Testare"-kategori
  i supportformuläret)
- **"Launch-scope"-diskussion** + **"Definiera funktionsomfång v1.0"** —
  två dubbletter av varandra, båda redan ersatta av de faktiska
  launch-prep-sessionerna som aldrig loggades tillbaka till dem
- **Konto-sidans tvåkolumns grid-layout** — sannolikt från innan dagens
  Konto-sida-design fanns, matchar inte nuvarande enkolumns-kort-layout

(SPAR-integrationen + samtycke redan stängda 2026-09-12, se
[[../Beslut/Beslut - SPAR avfärdat]]. Gåvor/donationer hålls medvetet
öppen — se [[../Beslut/Beslut - Monetisering]]. Internt forum flyttat till
"genuint öppna" ovan — inte en dublett/död idé, bara inte aktuellt än.)

## Andra anteckningar som väntar på ditt svar (tillagt 2026-09-12)
Gick igenom hela valvet efter din fråga om fler filer med obesvarade
öppna frågor. Dessa har genuint olösta frågor — resten (`Vad ar
nytt-modal.md` m.fl.) är redan färdigsvarade eller redo för pipeline:

- **[[../Verktyg/Mobil-synk-Obsidian|Mobil-synk-Obsidian]]** — noten har
  faktiskt redan en steg-för-steg-guide (rubrikerna "Steg — Desktop" och
  "Steg — Mobil" i samma fil), du kanske missade att den fanns. Läs igenom
  den och säg till om något steg är otydligt eller om du vill ha den mer
  detaljerad (skärmdumpar osv) — annars är den redo att följas som den är.
  Två öppna frågor kvar där (fungerar undermapp-vault-läget på riktig
  mobil, och Bot-valvet som eget repo eller fristående mapp) kan bara
  besvaras genom att du faktiskt provar
- FAQ för utloggade besökare — **redan besvarad ovan** (samma fråga som
  GitHub-issuet om publik FAQ) — borttagen härifrån
- **[[../Beslut/Beslut - Polisen-bevakningar egna tester|Beslut - Polisen-bevakningar, egna tester]]**
  — förslag för morgondagens test: välj EN kommun (inte en storstad — för
  hög volym) och lämna typ-filtret tomt (alla typer), eller tvärtom en
  bred storstad men bara en typ som inte händer varje dag (t.ex.
  "Försvunnen person" eller "Skottlossning" snarare än "Trafikolycka").
  Målet är minst en träff inom något dygn utan att du dränks. Innan du
  testar: dubbelkolla att push fortfarande är påslagen i Konto (samma
  två-oberoende-orsaker-fälla som admin-tystnaden i session 30 — global
  mute OCH enhetens egen notiskanal måste båda vara på)
- **[[../Beslut/Beslut - Lansering av Sparat|Beslut - Lansering av Sparat]]**
  — din oro om döda Polisen-länkar **verifierad och inte bekräftad:**
  testade två Polisen-artiklar från juni 2026 (3 månader gamla) live just
  nu, båda svarade 200 med texten intakt. Full analys, rekommendation att
  inte bygga om Sparat baserat på det här:
  [[../Ideer/Sparat-lankarnas-livslangd]]. Ingen kvarstående blockering
  utöver den ursprungliga UI-översynen
- **[[../Beslut/Beslut - Lansering av Push-notiser|Beslut - Lansering av Push-notiser]]**
  — fortfarande `status: öppen`, ren timingfråga, ingen ny information

## Obsidian-täckning, fortfarande ofullständig

Ren transparens, inte en uppgiftslista — jag skrev den här så du vet
exakt vad som redan finns dokumenterat kontra vad som saknas, inte för
att be dig strukturera upp något. Ingen åtgärd krävs om du inte själv vill
prioritera att täcka igen luckorna.

Nya Funktioner-noter skapade 2026-09-12: Autentisering,
Onboarding-wizard, Lösenordsåterställning, GDPR-verktyg, Kontouppgifter,
Adminpanel-roller, Källhantering (admin), Användarhantering (admin),
Support-inbox, Felsökning (admin). Fortfarande utan egen not: FAQ,
Mina källor (källistan i sig, till skillnad från Polisen-bevakningar),
Notifieringar-inställningarna, Aktivitetslogg är redan skriven sedan
tidigare. Flödesscheman finns bara för de mest processorienterade
funktionerna hittills (Autentisering, GDPR-radering, Support-inbox,
Onboarding) — resten (adminpanel-CRUD-vyer) fick ingen diagram eftersom
en lista/formulär inte vinner på ett flödesschema.
