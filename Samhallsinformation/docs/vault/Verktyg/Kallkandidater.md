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

## Tabell

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
