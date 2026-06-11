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
| **V2** | SMHI, MSB, Trafikverket |
| **V3** | Alla 21 Länsstyrelser |
| **V4** | Alla 21 Regioner |
| **V5** | Kommuner via gemensamma plattformar (Mynewsdesk, Cision, osv) |

### Datapartnerskap
På sikt är ambitionen att kontakta myndigheter och föreslå strukturerade dataflöden skräddarsydda för systemet — istället för att extrahera geografi och kategori från fritext. Polisens RSS-feed är ett exempel där ett strukturerat API med koordinater och händelsekategorier hade gett betydligt rikare data.

Myndigheter som ser värdet av att deras information når fler medborgare via en samlad plattform kan ha intresse av ett sådant samarbete.
