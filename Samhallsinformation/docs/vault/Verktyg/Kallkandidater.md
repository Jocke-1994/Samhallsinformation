---
typ: verktyg
status: pagaende  # levande lista, uppdateras när vi tittar på källor igen
uppdaterad: 2026-11-02
---

# Källkandidater — vilka myndigheter ska vi lägga till?

Levande lista. Efter lanseringen vill vi täcka in så mycket som möjligt
(din tanke 2026-11-02). Stående vana sedan 2026-09-12 (se `_Prioritering.md`,
#36-38): se över både nya källor och fler kanaler på befintliga, relativt ofta.

**Har i dag (8):** Polisen (+ Efterlysningar), SMHI (+ Nyheter), Krisinformation,
Trafikverket, Folkhälsomyndigheten, Läkemedelsverket, Livsmedelsverket, Kemikalieinspektionen.

**Hur listan togs fram (2026-11-02):** varje myndighets sajt hämtades och
sidkoden söktes efter RSS-länkar, och varje hittat flöde lästes för att se hur
många poster det har och när det senaste kom. Inget är gissat — står det
"inget flöde hittat" betyder det att det inte syntes på startsidan/nyhetssidan,
inte att det garanterat saknas.

## Internt betatest i Sandlådan — startat 2026-11-08
Ingen separat testmiljö behövs för källor: `IsActive=true` + `IsPublished=false` hämtar
skarpt i produktion men stoppas i flöde, Mitt flöde, platsfilter, källistor och push
(`PushDispatcher` avbryter för opublicerade). Syns bara i Adminpanel → Sandlåda.

**Inlagda 2026-11-08 (id 13–62, alla aktiva/opublicerade), testade först med torrkörning
mot riktiga `GenericRssIngestor`:**
- Nationella (20): Konsumentverket Återkallelser + Varning för säkerhetsbrist, Migrationsverket,
  Pensionsmyndigheten, Kronofogden Nyheter + Pressmeddelanden, Skatteverket (Alla nyheter),
  Strålsäkerhetsmyndigheten, E-hälsomyndigheten, Riksbanken Pressmeddelanden + Nyheter,
  MCF Räddningstjänst / Farligt gods / Rakel (ämnesflöden, inte "Alla"), IMY,
  HaV Aktuellt + Fiskeregler, Lantmäteriet, Arbetsmiljöverket, Riksgälden Insättningsgarantin
- Regioner (9): Stockholm, Gotland + Gotland Drift- och servicemeddelanden (vattenavbrott m.m.),
  Gävleborg, Norrbotten, Västernorrland, Örebro län, Östergötland, Blekinge
- Länsstyrelserna: alla 21 län (eget flöde per län, ShortName per län — grupperingen avgörs vid publicering)

**Plan:** låt gå ~1 vecka, gå sedan igenom källa för källa: volym, brus, texter (tecken,
tom brödtext, länkar), stabilitet → publicera / vänta / stryk.

### Kräver jobb men går att få in
| Vad | Problem | Jobb |
|---|---|---|
| Osynliga avstavningstecken (U+00AD) | Migrationsverket, Kronofogden, IMY, Region Stockholm/Gotland, HaV, ~10 länsstyrelser | Liten PR i `GenericRssIngestor`, sedan "Synka om". Görs först |
| Tom brödtext | Skatteverket (alla), Region Örebro (alla), Pensionsmyndigheten (37/44) | Ev. hämta sidans egen ingress (og:description) — myndighetens text, ingen tolkning. Medel |
| Ekobrottsmyndigheten | Giltig RSS men servern skickar `Content-Type: text/html` → avvisas | Liten: titta på innehållet, inte bara Content-Type |
| Svenska kraftnät | Kategoriparametern ignoreras, 1 880 poster bakåt | Åldersgräns vid första hämtning. Liten. Ej inlagd |
| Sandlådan | Förhandsvisningen tar 200 senaste totalt — stora källor tränger ut små | Gräns per källa. Liten PR |
| Platsfiltret | Länsstyrelse-/regionhändelse utan ortnamn i texten blir "nationell" | Standardgeografi per källa (nytt fält). Medel |

### Svårare men möjligt
- **Sitemap-ingestor** (ett bygge, ~70 källor): NCSC, Storstockholms brandförsvar, Räddningstjänsten
  Storgöteborg, Försäkringskassan, Transportstyrelsen, Tullverket, Sjöfartsverket, SHK,
  Elsäkerhetsverket, Jordbruksverket, Kustbevakningen (gamla RSS-adressen ger nu en webbsida)
- **API, en ingestor per källa:** Skogsstyrelsen (brandrisk), SGI (skred)
- **Flöde ej hittat än:** TLV, Finansinspektionen, PTS, Brå, Din Tur, Region Västerbotten

### Principbeslut, inte teknik
- Domstolar + Åklagarmyndigheten (brottmål/integritet) — inte inlagda
- Länsstyrelsernas/regionernas brus — avgörs efter veckan i Sandlådan

## Fullständigt svep 2026-11-02 (ersätter urvalet nedan som utgångspunkt)
Första versionen av listan byggde på ett urval Claude skrev ur huvudet — Migrationsverket saknades, och du frågade varför. Svar: kontrollerna var noggranna, men *urvalet* var gissat ("myndigheter som liknar de vi har"). Därför gjordes ett fullständigt svep:

- **Underlag:** alla svenska myndigheter i Wikidata med webbadress (330 med .se-adress, efter att utländska ambassader sorterats bort).
- **Metod:** ett skript hämtade varje sajt, letade RSS/Atom (startsida, nyhetssida, länkar som heter "RSS"/"Prenumerera", vanliga adresser som `/rss`), mätte inlägg senaste 90 dagar och senaste datum. Saknades RSS letades alternativ: sitemap, API/öppna data, pressrum (TT/Mynewsdesk), nyhetsbrev.
- **Resultat:** ~170 med RSS, ~130 utan, ~28 gick inte att nå.
- **Träffsäkerhet:** ~9 av 11 kända flöden hittades. Polisen och Läkemedelsverket missades (flödena ligger djupt). "Ingen RSS" = *hittades inte*, inte *finns inte*.
- **Fallgrop upptäckt:** Wikidata pekar "Lokala säkerhetsnämnden vid Ringhals" på varberg.se, så "nämndens flöde" var egentligen Varbergs kommuns. Kontrollera alltid domänen.

**Hela listan, sökbar, och urvalet i tre grupper:** https://claude.ai/artifact/TUuoTX2Lrh5DPmB5Lj64fC

### Nya fynd som det första urvalet missade
Pensionsmyndigheten (bedrägerivarningar), Kronofogden, Skatteverket, Riksbanken, E-hälsomyndigheten, TLV, Finansinspektionen, regionerna, kollektivtrafikmyndigheter, domstolarna, Nationella cybersäkerhetscentret, Storstockholms brandförsvar, Räddningstjänsten Storgöteborg, Skogsstyrelsen (brandrisk), SGI (skred), Myndigheten för psykologiskt försvar, Försäkringskassan, Arbetsförmedlingen, Tullverket.

### Vad de utan RSS kör i stället — och hur vi får in det
| Har i stället | Antal | Hur | Bedömning |
|---|---|---|---|
| Sitemap | ~72 | En **generell sitemap-ingestor**: bevaka sitemapen, ta nya sidor under t.ex. `/nyheter/`, läs sidans egen rubrik/ingress (og:title/og:description) | Bäst — byggs en gång, öppnar dussintals |
| API / öppna data | ~14 | En ingestor per källa (som Trafikverket/SMHI/Krisinformation) | Fall för fall, mycket är statistik |
| Nyhetsbrev (e-post) | många | Egen adress prenumererar, befintliga Resend inbound gör mejl till händelser | Experiment |
| Pressrum (TT/Mynewsdesk) | få | Har egen RSS (PTS via `via.tt.se`) | Enkelt |
| Inget | ~19 | Fråga myndigheten / läsa nyhetssidan direkt | Sista utväg, skört |

## Tabell (första, handplockade versionen)

| Källa | Vad vi skulle få | Varför | Flöde | Hur levande (2026-11-02) | Vad hindrar oss? | Förslag |
|---|---|---|---|---|---|---|
| **Konsumentverket – Återkallelser** | Produkter som dras tillbaka (t.ex. cykelhjälmar) | Direkt risk för folk, samma sort som Livsmedelsverkets återkallelser vi redan har | ✅ `konsumentverket.se/api/feed/rss/aterkallelser/` | 2 poster, senaste 30 okt | Inget tekniskt (vanlig RSS) | 🟢 **Lägg till först** |
| **Konsumentverket – Varning för säkerhetsbrist** | Varningar för farliga produkter | Samma som ovan | ✅ `…/rss/varning-for-sakerhetsbrist/` | 1 post, senaste okt 2025 | Sällan nytt, men billigt att ta med | 🟢 Tillsammans med Återkallelser |
| **Migrationsverket** (din fråga 2026-11-02) | Regeländringar som påverkar människor direkt (ny mottagandelag, nya regler för anhöriga, pausad prövning) | Direkt viktigt för många. Lite brus jämfört med länsstyrelser/MCF | ✅ `migrationsverket.se/rss` + 9 målgruppsflöden (`rss_arbetsgivare`, `rss_arbeta`, `rss_kommuner`, `rss_migrfs` …) | 87 inlägg, senaste 27 okt, ca 1–2/vecka | Liten teknisk fix: titlarna har osynliga avstavningstecken (U+00AD, "Pröv­ning") som måste rensas vid inläsning. Ämnet kan vara laddat, men vi förmedlar bara myndighetens text | 🟢 Lägg till (huvudflödet), målgruppsflöden senare |
| **Länsstyrelserna (21 län)** | Eldningsförbud, smittskydd (fågelinfluensa), kris, kungörelser | Lokal info, passar platsfiltret perfekt (varje flöde = ett län) | ✅ Ett per län: `lansstyrelsen.se/api/getnews?whichlst=<Län>&local=<id>&type=rss` | Skåne: 100 poster, senaste 29 okt | **Brus**: blandar viktigt med "Analys av ungas entreprenörskap". 21 flöden med var sitt id. Behöver beslut om vi filtrerar eller tar allt | 🟡 Hög nytta, kräver beslut om brus |
| **Strålsäkerhetsmyndigheten** | Strålning, kärnkraft, incidenter | Sällan, men mycket viktigt när det väl händer | ✅ `stralsakerhetsmyndigheten.se/press/nyheter/?view=rss` | 10 poster sedan juni, senaste 21 sep | Inget tekniskt. Låg volym | 🟢 "Försäkringskälla", lätt att lägga till |
| **MCF** (f.d. MSB) | Civilt försvar, räddningstjänst, farligt gods, Rakel | Beredskap | ✅ Flera ämnesflöden, t.ex. "alla", "räddningstjänst", "farligt gods" | Alla: 100 poster, senaste 29 okt | **Brus** (t.ex. "jämställdhet och inkludering") + **dubbletter**: MCF driver redan Krisinformation, som vi har | 🟡 Kanske bara ämnesflöden, t.ex. farligt gods |
| **Kustbevakningen** | Oljeutsläpp, händelser till sjöss | Miljö/säkerhet längs kusten | ✅ `kustbevakningen.se/nyheter/rss` | 50 poster, senaste 13 okt | Blandat med övningar/PR | 🟡 Medel |
| **Havs- och vattenmyndigheten** | Fiskeregler, havsmiljö | Berör fiskare/fritidsfiske | ✅ "Aktuellt", "Nyheter", "Nytt om fiskeregler" | 10 poster, senaste 29 okt | Låg brådska för de flesta | ⚪ Låg, ev. bara fiskeregler |
| **Kommuner, t.ex. Göteborgs Stad** (din idé 2026-11-02) | Lokala störningar (vattenavbrott, kokningsråd, sophämtning), kommunens krisinfo | Det som påverkar vardagen mest ligger ofta hos kommunen. Passar platsfiltret | ⚠️ Ofta: Malmö har flera (`malmo.se/rss/nyheter` m.fl.), Göteborg har en "Aktuellt"-RSS-länk på startsidan (gick inte att läsa ut direkt), Uppsala har en RSS-sida. Störningsflöden ej hittade | Malmö: 10 inlägg, senaste 30 okt | 290 kommuner med olika sajter/format. Nyhetsflödena är mest PR (Föreningsgalan, Kockumstiden). Det värdefulla — driftstörningar — saknar ofta flöde | 🟡 Börja med de 3 största? |
| **Sjöfartsverket – navigationsvarningar** | Varningar till sjöfarare | Båtfolk | ❌ Bara webbsida (navvarn.sjofartsverket.se) | – | Inget flöde: skulle kräva att läsa webbsidan (skört) | ⚪ Vänta / fråga Sjöfartsverket om API |
| **Elsäkerhetsverket** | Farliga elprodukter | Brandrisk i hemmet | ❌ Inget flöde hittat | – | Inget flöde | ⚪ Kolla igen |
| **Jordbruksverket / SVA** | Djursjukdomar (fågelinfluensa m.m.) | Berör djurägare, ibland alla | ❌ Inget flöde hittat | – | Inget flöde. Delvis täckt av länsstyrelserna | ⚪ Via länsstyrelserna i stället |
| **PTS** | Störningar i telefoni/internet | Alla berörs vid avbrott | ❌ Inget flöde hittat | – | Inget flöde | ⚪ Kolla igen |
| **Svenska kraftnät** | Elnätet, driftstörningar | Elavbrott/elbrist | ⚠️ Har RSS (nyhetskategorier, projekt, jobb) | Ej kontrollerat | Oklart om något flöde gäller störningar | ⚪ Behöver kollas närmare |
| **Försvarsmakten** | Försvarsnyheter | Beredskap | ❌ Inget flöde hittat | – | Inget flöde. Även en principfråga om innehållet | ⚪ Fråga |
| **SGU** | Geologi, grundvatten (torka) | Grundvattenbrist sommartid | ⚠️ Har en "RSS för nyheter"-sida, adressen ej utläst | – | Okänt | ⚪ Kolla igen |

🟢 = redo att lägga till · 🟡 = värt det, men något måste beslutas först · ⚪ = låg prio eller ingen väg in än

## Det största hindret är inte teknik, det är brus
De flesta nya flöden går att läsa med vår befintliga `GenericRssIngestor`.
Problemet är att länsstyrelser och MCF blandar viktigt med sådant som inte är
samhällsinformation för medborgare. Två vägar:
1. **Ta allt** — enkelt och helt neutralt (ingen tolkning), men flödet blir brusigt.
2. **Välj ämnesflöden** där myndigheten själv har delat upp det (MCF har det,
   Konsumentverket har det) — fortfarande myndighetens egen indelning, inte vår tolkning.

Att *vi* filtrerar på nyckelord ("eldningsförbud") vore att börja tolka, vilket
grundprinciperna säger nej till.

## Öppna frågor
- Ska vi börja med de gröna (Konsumentverkets två + Strålsäkerhetsmyndigheten + Migrationsverket)?
- Länsstyrelserna: alla 21 län på en gång, eller börja med några? Ta allt, eller vänta tills brusfrågan är löst?
- MCF: bara ämnesflöden (t.ex. farligt gods), eller inte alls eftersom Krisinformation redan täcker det viktigaste?
- Kommuner: börja med Stockholm, Göteborg och Malmö? Bara störningar/kris, eller även nyhetsflödena med mycket PR?

## Kopplat
- [[../1. Öppna_tankar/_Prioritering|Prioritering]] (#36-38, stående vana)
- [[../Ideer/Geografiskt-platsfilter-besokare|Platsfiltret]] (länsstyrelserna passar det)
