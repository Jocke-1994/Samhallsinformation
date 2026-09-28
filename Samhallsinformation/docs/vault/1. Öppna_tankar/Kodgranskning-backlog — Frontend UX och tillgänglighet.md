---
typ: rå-tanke
källa: "V4-5, uppföljning av enhet-6/enhet-7 'under rangordningsgränsen', 2026-09-27"
---

# Kodgranskning-backlog — Frontend UX och tillgänglighet

Rå tanke, del av V4-5 (se "Auth, sessioner och inloggning" för bakgrund).
Verifierat mot NUVARANDE kod 2026-09-27. Det mesta här är lågt allvarligt
(UX-brister, inte säkerhet), men sparas ändå eftersom flera är riktiga,
reproducerbara buggar — inte bara smaktycke.

## Laddnings-/fellägen som glömmer bort mobilmenyn eller ljuger

- **`NewsFeed.tsx`: laddnings- och felvyerna (`isLoading`/`isError`)
  returnerar fortfarande UTAN `<MobilTopBar>`** — på mobil finns ingen
  hamburgerknapp medan flödet laddar eller om det failar (kant-swipe
  fungerar fortfarande, men ingen SYNLIG väg till menyn). Felmeddelandet
  ("Just nu har vi tekniska problem...") visas fortfarande oavsett orsak
  (429/timeout/genuint fel) och har fortfarande ingen "försök igen"-knapp.
- `MinaKallor/index.tsx`: `useQuery(['user-sources'])` har fortfarande
  varken `isLoading` eller `isError` kopplat till UI — `AktivaKallorKort.tsx`
  visar fortfarande "Inga aktiva källor" identiskt under laddning OCH vid ett
  misslyckat anrop.
- `Support/FaqKort.tsx`: tomt sökresultat visar fortfarande "Inga frågor
  matchade """ även när sökfältet är tomt. `UppdateringarPage.tsx` har
  fortfarande varken laddnings- eller fel-läge.
- `Konto/index.tsx`: vid ett misslyckat `fetchMe` visas fortfarande
  platshållarna "JO"/"din@epost.se" i toppbannern som om de vore riktiga
  kontouppgifter (felmeddelandet finns bredvid, men formulären förblir
  aktiva/redigerbara).
- `Konto/Datahantering.tsx`: texten säger fortfarande "Ångrar du dig —
  kontakta supporten" trots att backend faktiskt skickar en riktig
  avbrytslänk via mejl (`AuthController.cs`, `CancelDeletionPage`) — texten
  nämner fortfarande aldrig mejlet, så en användare som ångrar sig letar
  efter supporten i stället för att öppna mejlet.

*(enhet-7, "Hanterare som ljuger/tystnar")*

## Krasch-risk: okänd severity/typ

Se den separata filen "Admin-API validering och dataintegritet" — samma
`SEVERITY_CONFIG`/`TYP_CONFIG`-utan-fallback-bugg finns fortfarande på fem
ställen, både i admin och i medborgarflödet (`NewsItem.tsx`).

## Tillgänglighet

- **`common/Toggle.tsx` har fortfarande varken `role="switch"` eller
  `aria-checked`, och `focus:outline-none` utan ersättande fokusindikator**
  — tangentbords-/skärmläsaranvändare ser varken fokus eller läge. Används
  bl.a. för Push-notiskategorierna i Konto.
- `NewsItem.tsx`: `keydown`-hanteraren för Enter/Space på kortets
  `role="button"` bubblar fortfarande upp från nästlade knappar (Spara/
  Dela/🔔) — Enter/Space på en inre knapp växlar OCKSÅ kortets expandering,
  och Space kan rulla sidan.
- Modaler (`KategoriFilterModal`, Gäst-profil-modalen, Betatestare-modalen)
  har fortfarande klick-utanför-stängning men ingen Escape-tangent (utom
  Betatestare/Gäst) och ingen fokusfälla — blockerar ingen funktion, men en
  riktig a11y-brist.

*(enhet-7, "Tillgänglighet")*

## Google-skript laddas innan cookie-samtycke

**`MaybeGoogleOAuthProvider` (monterad i `main.tsx`) laddar fortfarande
ovillkorligt Googles GSI-skript (`accounts.google.com/gsi/client`) för ALLA
besökare vid appstart**, innan cookiebannern är besvarad. Inte en
analys-cookie, men en tredjepartsbegäran (läcker IP till Google) före
samtycke — bannern och `OmPage` säger idag att bara analys kräver
samtycke. Kräver en juridisk bedömning snarare än en ren teknisk fix;
enklaste tekniska lösning vore att bara ladda GSI-skriptet på
`/login`/`/register`, inte globalt.

*(enhet-7, "Övrigt" — flaggad PLAUSIBLE i granskningen, inte avfärdad)*

## Övriga UI-korrekthetsfynd, fortfarande verifierade i kod

- `pages/OmPage.tsx`: källistan är fortfarande hårdkodad och saknar
  fortfarande SMHI (som har en egen dedikerad ingestor sedan tidigare
  session) — bör hämtas dynamiskt från `fetchSources` eller uppdateras för
  hand.
- `MinaKallor/KategoriFilterModal.tsx`: "Avmarkera alla" på typer sparar
  fortfarande `kategorier = []` (inte `null`) — samma `[]`-betyder-"matcha
  ingenting"-fälla som beskrivs i admin-filen, nu bekräftad även i
  klient-koden som producerar den.
- `pages/ProfileLanding.tsx`: `text-8xl` på "Min profil"-rubriken är
  fortfarande bredare än en 360 px-skärm inom sin `px-10`-marginal —
  horisontell överflöd/radbrytning på mobil.
- `App.tsx`: `select-none` på huvudytan (avsett för swipe-gester) gäller
  fortfarande hela ytan, inte bara kant-området — hindrar all
  textmarkering/kopiering ur händelseinnehåll (adresser, telefonnummer).
- `pages/AdminPage.tsx`: hooks (`usePushSubscription`,
  `fetchAdminTickets` med 30 s `refetchInterval`) körs fortfarande innan
  redirecten för en inloggad icke-admin som öppnar `/admin` — ett onödigt
  403-anrop innan sidan lämnas, ofarligt men värt att städa vid nästa
  beröring av den filen.

*(enhet-7, "Övrigt")*

## Admin-UI, mobilanpassning och dead code

- `AdminFaq.tsx` (`w-[520px]`) och `AdminUppdateringar.tsx` (`w-[560px]`)
  är fortfarande fasta sidopaneler utan `w-full md:`-brytpunkt — samma fel
  som redan fixades för `Anvandare.tsx` i en tidigare PR, bara inte
  applicerat här än. `AdminFaq.tsx` har fortfarande en `grid grid-cols-6`
  utan brytpunkt.
- `Anvandare.tsx`: **`RollModal`/`applicerapRoller`/`applicerapRollerEnkild`
  är fortfarande dead code** — knapparna är `disabled`, en eventuell
  aktivering skulle bara mutera lokalt state (ingen backend-koppling).
  Kvar som en fälla för nästa person som råkar koppla in den mot lokalt
  state utan att märka att den aldrig skickar något till servern.
- `Anvandare.tsx`: "Ta bort Polisen-bevakning" och "Ta bort sparad
  händelse" saknar fortfarande en bekräftelsedialog innan radering.
- `Handelsesok.tsx`: sidbyte (Nästa/Föregående) läser fortfarande de ANDRA,
  redan ändrade men ej inskickade formulärfälten — en ändrad plats/sökord
  följt av "Nästa" ger fortfarande sida 2 av en annan fråga än den som
  visades.
- `Kallhantering.tsx`: "Synka om/Redigera/Ta bort"-knapparna är
  fortfarande hover-only (svåra att nå via touch), och `aktiveraKälla`
  skapar fortfarande alltid en RSS-källa (`type: 0`) även för kuraterade
  API-källor som SMHI.

*(enhet-6, "Layout / mobil", "Övriga korrekthets-/robusthetsobservationer")*

## Bedömt trivialt, förkastat

Rena stilanmärkningar utan verklig substans som INTE tas vidare härifrån:
`Kallhantering.tsx`s saknade `key` på ett React-fragment (bara en
konsol-varning/onödig omritning, ingen funktionell effekt),
`useFeatureFlags.ts`s `eslint-disable exhaustive-deps` (ren
referensstabilitet, ingen bugg), och `SupportInbox.tsx`s "→ null"-textvisning
när `reassignToName` saknas (kosmetiskt, självförklarande i sammanhanget).

Ursprung: `docs/code-review/enhet-6.md` §"Under rangordningsgränsen",
`enhet-7.md` §"Under rangordningsgränsen (mindre observationer...)".
