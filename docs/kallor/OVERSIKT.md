# Källor — Samhällsinformation

Dokumenterar vilka källor som ingår, deras status, hur data hämtas och eventuella begränsningar.

---

## Status-definitioner

| Status | Betydelse |
|--------|-----------|
| **Aktiv** | Implementerad och live i V1 |
| **Planerad** | Ingestor saknas, ska byggas |
| **Utvärderas** | Osäkert om API finns eller om det är lämpligt |

---

## V1 — Nationella källor (aktiva)

### Polisen
| Egenskap | Värde |
|----------|-------|
| **Status** | Aktiv |
| **Typ** | RSS |
| **URL** | `https://polisen.se/aktuellt/rss/` |
| **Ingestor** | `PolisenRssIngestor.cs` |
| **Polling-intervall** | Var 5:e minut (systemets standard) |
| **API-nyckel** | Nej |
| **Rate limit** | Ej dokumenterat — var 5:e minut bedöms rimligt |
| **Licens** | Offentlig information, fri att använda |
| **Notering** | Geografi extraheras från händelsetiteln (sista komma-segmentet) |

### Krisinformation.se
| Egenskap | Värde |
|----------|-------|
| **Status** | Aktiv |
| **Typ** | REST API (JSON) |
| **URL** | `https://api.krisinformation.se/v3/news` |
| **Ingestor** | `KrisinformationApiIngestor.cs` |
| **Polling-intervall** | Var 5:e minut (systemets standard) |
| **API-nyckel** | Nej |
| **Rate limit** | Ej officiellt dokumenterat — var 5:e minut bedöms rimligt |
| **Licens** | Offentlig information, fri att använda |
| **Notering** | MSB driver tjänsten. Uppdateras sällan, men viktiga händelser |

---

## V2 — Nationella källor (planerade)

### SMHI
| Egenskap | Värde |
|----------|-------|
| **Status** | Planerad |
| **Typ** | REST API (JSON) |
| **URL** | `https://opendata-download-warnings.smhi.se/api/version/2/warnings.json` |
| **API-nyckel** | Nej |
| **Rate limit** | Ej dokumenterat — rekommenderas max 1 req/min per SMHI:s öppna data-policy |
| **Licens** | Creative Commons CC0 (helt fri att använda) |
| **Notering** | Väder- och naturvarningar. Välstrukturerat API med god dokumentation |

### MSB — Myndigheten för samhällsskydd och beredskap
| Egenskap | Värde |
|----------|-------|
| **Status** | Utvärderas |
| **Typ** | Okänt — behöver undersökas |
| **URL** | `https://msb.se/sv/sok/opendata/` |
| **API-nyckel** | Okänt |
| **Rate limit** | Okänt |
| **Licens** | Okänt — behöver verifieras |
| **Notering** | MSB är redan representerat via Krisinformation.se. Dubbelkolla om separat integration tillför värde |

### Trafikverket
| Egenskap | Värde |
|----------|-------|
| **Status** | Planerad |
| **Typ** | REST API (JSON/XML) |
| **URL** | `https://api.trafikinfo.trafikverket.se/` |
| **API-nyckel** | **Ja — gratis registrering krävs** |
| **Rate limit** | 10 req/sekund, 10 000 req/dag (fri tier) |
| **Licens** | Öppen data, fri att använda med attribution |
| **Notering** | Täcker vägtrafikhändelser, störningar och vägarbeten. API-nyckel lagras som miljövariabel |

### Folkhälsomyndigheten
| Egenskap | Värde |
|----------|-------|
| **Status** | Planerad |
| **Typ** | RSS |
| **URL** | `https://www.folkhalsomyndigheten.se/nyheter-och-press/nyhetsarkiv/?topic=smittskydd-och-sjukdomar&syndication=rss` |
| **API-nyckel** | Nej |
| **Rate limit** | Ej dokumenterat — var 5:e minut bedöms rimligt |
| **Licens** | Offentlig information, fri att använda (PSI-lagen) |
| **Notering** | Ämnesfiltrerat RSS-flöde specifikt för smittskydd och sjukdomar. Också generellt nyhetsflöde tillgängligt. Uppdateras sällan men kritiskt vid utbrott |

### Livsmedelsverket
| Egenskap | Värde |
|----------|-------|
| **Status** | Planerad |
| **Typ** | RSS |
| **URL** | `https://www.livsmedelsverket.se/om-oss/press/rss/` (indexsida — specifikt återkallelseflöde finns på återkallelsesidan) |
| **API-nyckel** | Nej |
| **Rate limit** | Ej dokumenterat — var 5:e minut bedöms rimligt |
| **Licens** | Creative Commons Attribution 4.0 (CC BY 4.0) |
| **Notering** | RSS täcker återkallanden, pressmeddelanden och nyheter. Ingen recall-specifik REST API finns — RSS är enda maskinläsbara vägen till matåterkallelser |

### Läkemedelsverket
| Egenskap | Värde |
|----------|-------|
| **Status** | Planerad |
| **Typ** | RSS |
| **URL** | `https://www.lakemedelsverket.se/sv/om-lakemedelsverket/press-och-nyheter/rss` (indexsida med kategorier) |
| **API-nyckel** | Nej |
| **Rate limit** | Ej dokumenterat — var 5:e minut bedöms rimligt |
| **Licens** | Öppen data (PSI-lagen) |
| **Notering** | Säkerhetsnyheter och läkemedelsåterkallelser. Öppen data-portal finns men täcker läkemedelsregisterdata — inte säkerhetsvarningar. RSS är primär ingestväg |

### Strålsäkerhetsmyndigheten (SSM)
| Egenskap | Värde |
|----------|-------|
| **Status** | Utvärderas |
| **Typ** | RSS |
| **URL** | `https://www.stralsakerhetsmyndigheten.se/en/news/news/?view=rss` |
| **API-nyckel** | Nej |
| **Rate limit** | Ej dokumenterat |
| **Licens** | Offentlig information |
| **Notering** | RSS finns men innehåller generella nyheter och rapporter — sällan realtidshändelser. Faktiska strålningsincidenter når troligen Krisinformation.se före SSM:s eget flöde. Låg uppdateringsfrekvens |

---

## V2 — Regionala källor (planerade)

### Länsstyrelsen Västra Götaland
| Egenskap | Värde |
|----------|-------|
| **Status** | Utvärderas |
| **Typ** | RSS (troligen) |
| **URL** | Behöver identifieras |
| **API-nyckel** | Troligen nej |
| **Rate limit** | Okänt |
| **Notering** | Länsstyrelserna har varierande digital mognadsgrad. Kan kräva skrapning om RSS saknas |

### Västra Götalandsregionen (VGR)
| Egenskap | Värde |
|----------|-------|
| **Status** | Utvärderas |
| **Typ** | Okänt |
| **URL** | `https://vgregion.se` |
| **API-nyckel** | Okänt |
| **Rate limit** | Okänt |
| **Notering** | Fokus på regional hälso- och sjukvårdsinformation |

### Göteborgs Stad
| Egenskap | Värde |
|----------|-------|
| **Status** | Utvärderas |
| **Typ** | Okänt |
| **URL** | `https://goteborg.se` / `https://opendata.goteborg.se` |
| **API-nyckel** | Troligen nej för öppna datasets |
| **Rate limit** | Okänt |
| **Notering** | Göteborg har en öppen dataportal — värt att undersöka vilka realtidsdataflöden som finns |

---

### Kemikalieinspektionen (KEMI)
| Egenskap | Värde |
|----------|-------|
| **Status** | Aktiv |
| **Typ** | RSS (Sitevision CMS) |
| **URL** | `https://www.kemi.se/4.39a6b9eb175a977d0431924/12.39a6b9eb175a977d043192c.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8` |
| **API-nyckel** | Nej |
| **Rate limit** | Ej dokumenterat — var 5:e minut bedöms rimligt |
| **Licens** | Offentlig information (PSI-lagen) |
| **Notering** | Sitevision-baserat RSS-flöde. URL verifierad via sandlåda 2026-06-25. IVO saknar RSS-flöde. |

---

## V3 — Nationella källor (svår ingest, utvärderas)

### Jordbruksverket
| Egenskap | Värde |
|----------|-------|
| **Status** | Utvärderas |
| **Typ** | REST API (grödprognoser) / XLSX-filer (djursjukdomar) |
| **URL** | `https://api.jordbruksverket.se/rest/povapi/` |
| **API-nyckel** | Ja — Basic Auth, testuppgifter finns, produktion kräver registrering |
| **Rate limit** | Ej dokumenterat |
| **Licens** | CC0 eller CC BY |
| **Notering** | API:et täcker grödprognoser och skadedjursvarningar — inte djursjukdomar. Djursjukdomsdata (salmonella, fågelinfluensa m.m.) publiceras som XLSX-filer, inte via API. SVA (Statens veterinärmedicinska anstalt) har smittlägesrapporter men enbart som PDF |

### Naturvårdsverket
| Egenskap | Värde |
|----------|-------|
| **Status** | Utvärderas |
| **Typ** | REST API (geodata/naturvårdsregister) |
| **URL** | `https://geodata.naturvardsverket.se/naturvardsregistret/rest/v3/` |
| **API-nyckel** | Nej |
| **Rate limit** | Ej dokumenterat |
| **Licens** | Fri (PSI-lagen) |
| **Notering** | API:et täcker naturreservat och skyddade områden — inte miljövarningar eller föroreningslarm. Inget RSS-flöde för nyheter hittades. Akuta miljöhändelser (algblomning, föroreningar) når användare via länsstyrelserna eller Krisinformation, inte Naturvårdsverket direkt |

### Sjöfartsverket
| Egenskap | Värde |
|----------|-------|
| **Status** | Utvärderas |
| **Typ** | REST API (fartygsrörelser) / PDF (sjökungorelser) |
| **URL** | `https://snt-public-api.sjofartsverket.se/` |
| **API-nyckel** | Ja — JWT-token, registrering krävs |
| **Rate limit** | Ej dokumenterat |
| **Licens** | MIT (API-kod), öppen data (innehåll) |
| **Notering** | API:et täcker fartygsankomster/avgångar — inte sjösäkerhetskungörelser (NtM). Säkerhetsmeddelanden till sjöfarten publiceras som veckovisa PDF-häften på `ufs.sjofartsverket.se` — ingen RSS eller API finns. Ingest kräver PDF-skrapning |

---

## Allmänna riktlinjer

### Polling-frekvens
- **Standard:** Var 5:e minut (`IngestorBackgroundService`)
- **Minimum:** Aldrig snabbare än var 60:e sekund mot samma källa
- Hög frekvens riskerar att IP-adressen blockeras även om rate limit inte är dokumenterat

### API-nycklar
- Lagras **alltid** som miljövariabler, aldrig i kod eller git
- Nuvarande nyckel som krävs: Trafikverket (vid implementation)

### Skrapning (scraping)
- Används bara som absolut sista utväg om varken RSS eller API finns
- Kontrollera alltid `robots.txt` och användarvillkor innan skrapning
- Skrapning bör ske max var 30:e minut

### Licens och attribution
- All data presenteras med källhänvisning (källa visas i varje händelsekortt)
- Ingen redigering eller tolkning av källmaterialet

---

## Långsiktig vision — Hela Sverige

Målet på lång sikt är att täcka hela Sverige: alla nationella myndigheter, alla 21 länsstyrelser, alla 21 regioner och alla 290 kommuner.

### Potentiellt antal källor

| Nivå | Antal | Realistisk tillgång |
|------|-------|-------------------|
| Nationellt | ~8 | God — de flesta har RSS eller API |
| Länsstyrelser | 21 | Medel — troligen RSS, varierar |
| Regioner | 21 | Medel — varierar per region |
| Kommuner | 290 | Låg — många saknar maskinläsbar data |
| **Totalt** | **~340** | |

### Lagstöd
Sverige har implementerat EU:s öppna data-direktiv (PSI-direktivet) som kräver att offentliga myndigheter tillgängliggör sin data maskinläsbart. Nationell portal: **dataportal.se**. Det innebär att fler myndigheter aktivt bör arbeta mot öppna API:er — trenden går åt rätt håll.

### Roadmap

| Fas | Innehåll |
|-----|----------|
| **V1** (klart) | Polisen, Krisinformation |
| **V2** | SMHI, Trafikverket, Folkhälsomyndigheten, Livsmedelsverket, Läkemedelsverket, MSB (utvärderas), SSM (utvärderas) |
| **V3** | Jordbruksverket, Naturvårdsverket, Sjöfartsverket (svår ingest), alla 21 Länsstyrelser |
| **V4** | Alla 21 Regioner |
| **V5** | Kommuner via gemensamma plattformar (Mynewsdesk, Cision, osv) |

### Datapartnerskap
På sikt är ambitionen att kontakta myndigheter och föreslå strukturerade dataflöden skräddarsydda för systemet — istället för att extrahera geografi och kategori från fritext. Polisens RSS-feed är ett exempel där ett strukturerat API med koordinater och händelsekategorier hade gett betydligt rikare data.

Myndigheter som ser värdet av att deras information når fler medborgare via en samlad plattform kan ha intresse av ett sådant samarbete.
