---
typ: prioritering
uppdaterad: 2026-09-12
---

# Prioritering — allt utestående på ett ställe

Byggd 2026-09-12 efter en full genomgång av GitHub-issues, GitHub-boarden
och Obsidian-valvet. Uppdatera det här dokumentet istället för att låta
prioriteringar bara leva i sessionsloggar — det är hela poängen med det.

## 🔴 Blockerar publik lansering

1. **Rate limiting fungerar inte i produktion** — bekräftat trasigt
   2026-09-11 (10 rafflade inloggningsförsök, ingen blockerades). Trolig
   orsak: saknad `ForwardedHeaders`-middleware bakom Railways proxy.
   Registrerings-/inloggningsendpointen är i praktiken oskyddad mot
   spam/brute-force just nu. **Detta bör lösas INNAN
   `showLoginButton`/`showRegisterButton` slås på.**
2. **`showLoginButton`/`showRegisterButton`** fortfarande av — sista steget
   i launch-ordningen, väntar på ovanstående + resten av mobiltestet nedan
3. **Google-inloggning, kontokoppling** — det enda Google-scenariot som
   ALDRIG testats live (session 29): ett Google-konto vars e-post redan
   har ett lösenordskonto. Vad händer faktiskt?
4. **`/login`-sidan, hela mobilgenomgången** — aldrig separat testad, bara
   `/register` hittills

## 🟡 Rekommenderat innan lansering, inte blockerande

- PR #516 (Nyheter-sidan) + #517 (beta-badge) — medvetet omergade, väntar
  på LinkedIn-timing
- Rate limiting under en TRAFIKTOPP (flera SAMTIDIGA registreringar, inte
  bara sekventiella försök) — bör testas om igen efter fixen ovan
- **#144 (staging-miljö)** — flyttad hit 2026-09-12, du signalerade att den
  bör bli "ganska prio". En riktig lucka (produktion är enda miljön idag)
  — separat databas, test-SMS/e-post-gateway, BankID-sandbox. Inte
  blockerande för att öppna login/register, men värt att prioritera högre
  än övriga backlog-punkter

## 🟢 Flaggade avvikelser, kräver ett beslut (inte akut)

Se [[Verktyg/GitHub-issues-granskning-2026-09-12|full granskning]] för
detaljer på varje.

- **#298** — generisk källprenumerationsmodell vs. den Polisen-specifika
  lösningen som faktiskt byggdes. Behåll som är, eller bygg ut generiskt?
- **#111** — automatisk ärendearkivering (7 dagar/36 månader) önskas
  fortfarande, eller är den manuella knappen tillräcklig?
- **#109** — Support-dashboard med inbyggd hjälpguide, litet jobb om
  önskat
- **#128** — räcker `NewsItem.tsx`s expand-mekanik, eller vill ni ha en
  riktig händelsedetaljvy?
- **#157** — fortfarande fullt giltig, `betaConfig.ts` är fortfarande bara
  en statisk placeholder

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
- **#52** (daglig sammanfattning) — förklaring: användaren väljer kanal
  (e-post/SMS/push), tid, frekvens (daglig/veckovis/bara viktiga
  händelser) och vilka källor som ska ingå i en sammanställd sammanfattning
  istället för enskilda notiser i realtid. Hänger ihop med SMS-frågan
  (#133/#134) och push-modellen. Inte utbruten i en egen `Ideer/`-not än
  — gör det när/om den faktiskt plockas upp, ingen brådska att göra det i
  förväg
- **#66** (FAQ publik) — förklaring: en FAQ nåbar UTAN inloggning (skiljer
  sig från dagens FAQ, som bara syns inloggad). Innehåller även två
  konkreta delar värda att känna till: en **SMS-mallsektion** (visar alla
  SMS-mallar systemet skickar, så en mottagare kan jämföra ett riktigt SMS
  mot mallen för att verifiera äkthet — inte att SMS:et i sig bevisar
  något) och en manuellt uppdaterbar sektion för **kända driftstörningar
  hos teleoperatörer**. Väntar dels på beslut om publik-vs-inloggad FAQ
  (känt sedan session 42), dels på SMS-kanalen som helhet
- **#68** (ansök om att bli källa) — din oro (namn, URL, hur hämtar vi
  datan) är redan exakt vad issuet självt specar för formuläret. Det som
  INTE finns nedskrivet är den interna RUTINEN för vad som händer efter
  en ansökan kommit in (hur bedömer vi/integrerar en ny källa tekniskt) —
  helt rimligt att lämna ogjort tills funktionen faktiskt byggs, samma
  princip som "Från support" i [[Flöde ny idé]]
- **#124-125** (releaser↔versioner) — bekräftat: hänger ihop med
  changelog-arbetet, kommer hanteras inom kort
- **#133-134** (SMS) — bekräftat: kostnadsfråga, kopplat till
  [[../Beslut/Beslut - Monetisering|Beslut - Monetisering]]. Ser mörkt ut
  om det tillkommer en löpande kostnad utan bestämd intäktsmodell
- **#135** (undersökningar) — bekräftat: genuint intressant, men du
  funderar på om förslag ändå kommer in organiskt från användare när de
  finns. Ingen brådska, ingen ny information att lägga till
- **#144** (staging-miljö) — **flyttad till 🟡 nedan**, du signalerade att
  den bör vara högre prioriterad än "ingen brådska"
- **#173** (formell självläkning för ingestorer) — förklaring: idag kan en
  skrivoperation (t.ex. spara ett telefonnummer) tekniskt misslyckas tyst
  — användaren tror det sparades, systemet vet inte om det. Idén: verifiera
  kritiska skrivningar mot databasen efteråt, kö:a om och försök igen
  automatiskt vid fel (med backoff), och larma admin om en källa varit
  tyst längre än förväntat. Stort infra-jobb, ingen brådska idag
- **#175** (köhantering i support-inbox) — förklaring: när fler än en
  supportperson finns ska var och en bara se ÄRENDEN TILLDELADE TILL DEM
  (inte hela inkorgen), plus fritext-taggar för att kategorisera/filtrera
  ärenden. Samma "inte relevant förrän en andra supportperson finns"-läge
  som "Från support" i [[Flöde ny idé]] och #109
- **#335** (Nyheter-sidans avgränsningstext) — verifierat: korrekt
  fortfarande INTE gjort, och ska inte göras än — den är uttryckligen
  villkorad på att login/register-knapparna blir publikt synliga och
  användbara, vilket de fortfarande inte är. Inget att åtgärda just nu
- **#434** (FAQ — rätta innehåll + nya frågor) — verifierat i koden,
  **delvis klart, inte helt besvarat:**
  - ✅ Del 1 (rätta felaktigt innehåll om radera konto/dataexport) — klar,
    kopplad till den riktiga GDPR-mekanismen med ångra-länk
  - ✅ Del 3, delvis — Google-inloggning, lösenordsbyte, namn/e-post-byte,
    Alla källor-skillnaden, "vad är nytt" och ångra-radering finns redan
    som frågor. **Saknas fortfarande:** "Vad är skillnaden på Alla
    händelser och Mitt flöde?", frågan om Polisen-typfilter
    (Polisen-bevakningar), kontospärrning, och en länk till `/villkor`
  - ❌ Del 2 (dynamiska svar baserat på källstatus, t.ex. "källan X är
    pausad just nu") — inte påbörjad alls
  - Del 4 (innehåll för `flode_sparat`/`notif_push`) — korrekt oskrivet,
    väntar på att de flaggorna faktiskt slås på
  - Rekommendation: håll öppen, den är inte klar
- **#437** (BankID) — bekräftat: en önskan, men samma återkommande
  kostnadsfråga som #133/#134, kopplat till
  [[../Beslut/Beslut - Monetisering|Beslut - Monetisering]]
- **#491** (aktivitetslogg wave 2/3) — förklaring: wave 1 (admin/system-
  händelser) är klar och byggd. **Wave 2** = vanliga användares egna
  handlingar (temaval, Mina källor-ändringar, Sparat) i samma logg —
  medvetet senare eftersom IP+enhet+historik på en mycket större, mindre
  betrodd volym är en tyngre GDPR-fråga, och måste räknas in i GDPR-
  exporten när den byggs ut. Tre konkreta luckor kvar även inom det som
  redan är byggt: Impersonation-loggning (blockerad — ingen riktig
  impersonation-backend finns än), en "Arkivera"-knapp i UI:t (datamodellen
  finns, ingen knapp), och en mekanism för att tagga test-/betakonton vid
  källan (fältet finns, inget sätter det). Ingen brådska på någon av delarna

## Kandidater att stänga/arkivera (din bedömning, inte gjort än)

#42, #43, #50, #51, #116, #117, #120-123, #127, #138, #146, #168 — se
granskningen för varför var och en är en kandidat. (#46/#55 redan stängda
2026-09-12, se [[../Beslut/Beslut - SPAR avfärdat]]. #141 hålls medvetet
öppen — se [[../Beslut/Beslut - Monetisering]].)

## Andra anteckningar som väntar på ditt svar (tillagt 2026-09-12)
Gick igenom hela valvet efter din fråga om fler filer med obesvarade
öppna frågor. Dessa har genuint olösta frågor — resten (`Vad ar
nytt-modal.md` m.fl.) är redan färdigsvarade eller redo för pipeline:

- **[[../Verktyg/Mobil-synk-Obsidian|Mobil-synk-Obsidian]]** — kräver att
  du faktiskt testar på telefonen (fungerar undermapp-vault-läget i
  Obsidian Git-pluginet på mobil, eller behövs fallback-git-appen direkt?)
  plus ett beslut om Bot-valvet ska vara eget repo eller en fristående mapp
- **[[../Ideer/FAQ for utloggade besokare|FAQ for utloggade besökare]]** —
  samma underliggande fråga som GitHub #66 ovan: ska FAQ vara helt
  inloggad (som idag), helt publik, eller delad i två delmängder?
- **[[../Beslut/Beslut - Polisen-bevakningar egna tester|Beslut - Polisen-bevakningar, egna tester]]**
  — INTE bara en timingfråga: enligt noten aktiverade du en bevakning men
  fick aldrig någon avisering, okänd orsak. Värt att kolla om det
  fortfarande stämmer eller om det löste sig av sig självt
- **[[../Beslut/Beslut - Lansering av Sparat|Beslut - Lansering av Sparat]]**
  och **[[../Beslut/Beslut - Lansering av Push-notiser|Beslut - Lansering av Push-notiser]]**
  — båda `status: öppen`, ren timingfråga (inget datum/villkor satt),
  ingen brådska men bra att veta att de ligger olösta

## Obsidian-täckning, fortfarande ofullständig

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
