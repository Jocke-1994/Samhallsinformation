import type { CanonicalEvent, EventsResponse } from '../types'
import { adminFetch } from './adminFetch'

interface FetchEventsParams {
  shortName?: string
  geography?: string
  national?: boolean
  page?: number
  pageSize?: number
}

const MOCK_EVENTS: CanonicalEvent[] = [
  {
    id: 'p-001', sourceId: 1,
    title: 'Rån, Göteborg',
    content: 'En man rånades på sin mobiltelefon utanför Centralstationen i Göteborg vid 18-tiden. Gärningspersonen, beskriven som yngre man i mörk jacka, avvek till fots mot Drottningtorget. Polisen söker vittnen.',
    publishedAt: '2026-06-10T18:23:00Z', url: 'https://polisen.se', geography: 'Göteborg', severity: 'Viktigt', isNational: false,
  },
  {
    id: 'p-002', sourceId: 1,
    title: 'Trafikolycka, Stockholm',
    content: 'Två personbilar kolliderade på Essingeleden vid 07:30 på fredagsmorgonen. Inga allvarliga personskador men trafiken var avstängd i norrgående led under 45 minuter. Räddningstjänst och polis var på plats.',
    publishedAt: '2026-06-10T07:42:00Z', url: 'https://polisen.se', geography: 'Stockholm', severity: 'Bra att veta', isNational: false,
  },
  {
    id: 'p-003', sourceId: 1,
    title: 'Brand i lägenhet, Malmö',
    content: 'Brand utbröt i en lägenhet på fjärde våningen i ett flerfamiljshus i Husie. Boende evakuerades och räddningstjänsten fick branden under kontroll efter en timme. En person fördes till sjukhus med rökskador.',
    publishedAt: '2026-06-09T22:11:00Z', url: 'https://polisen.se', geography: 'Malmö', severity: 'Viktigt', isNational: false,
  },
  {
    id: 'p-004', sourceId: 1,
    title: 'Inbrott, Uppsala',
    content: 'Okänd gärningsperson tog sig in i en villa i Luthagen under natten och tillgrep elektronik samt smycken. Inga personer var hemma vid tillfället. Polisen har inlett en förundersökning om grov stöld.',
    publishedAt: '2026-06-09T06:05:00Z', url: 'https://polisen.se', geography: 'Uppsala', severity: 'Bra att veta', isNational: false,
  },
  {
    id: 'p-005', sourceId: 1,
    title: 'Misshandel, Linköping',
    content: 'En man misshandlades utanför en restaurang på Storgatan vid midnatt. Offret fördes till sjukhus med lättare skador. Två personer greps i närheten och är misstänkta för brott.',
    publishedAt: '2026-06-09T00:34:00Z', url: 'https://polisen.se', geography: 'Linköping', severity: 'Viktigt', isNational: false,
  },
  {
    id: 'p-006', sourceId: 1,
    title: 'Narkotikabrott, Helsingborg',
    content: 'Polisen genomförde en husrannsakan i en bostad i Centrum och beslagtog narkotika till ett gatuförsäljningsvärde av uppskattningsvis 80 000 kronor. En man i 30-årsåldern greps och är misstänkt för narkotikabrott av normalgraden.',
    publishedAt: '2026-06-08T14:58:00Z', url: 'https://polisen.se', geography: 'Helsingborg', severity: 'Bra att veta', isNational: false,
  },
  {
    id: 'p-007', sourceId: 1,
    title: 'Bedrägeri via telefon, nationellt',
    content: 'Polisen varnar för en pågående bluffkampanj där gärningspersoner utger sig för att vara bankanställda och ber om inloggningsuppgifter via telefon. Flertalet anmälningar har inkommit från hela landet. Lämna aldrig ut dina bankuppgifter via telefon.',
    publishedAt: '2026-06-08T10:00:00Z', url: 'https://polisen.se', geography: null, severity: 'Viktigt', isNational: true,
  },
  {
    id: 'p-008', sourceId: 1,
    title: 'Skadegörelse, Örebro',
    content: 'Okänd gärningsman krossade rutor på fem parkerade fordon längs Karlavägen under natten mot torsdagen. Skadeståndsvärdet beräknas till ca 40 000 kronor. Polisen efterlyser tips från allmänheten.',
    publishedAt: '2026-06-08T06:20:00Z', url: 'https://polisen.se', geography: 'Örebro', severity: 'Bra att veta', isNational: false,
  },
  {
    id: 'p-009', sourceId: 1,
    title: 'Rattfylleri, Västerås',
    content: 'En personbil stoppades vid en trafikkontroll på E18 och föraren visade sig vara kraftigt påverkad av alkohol. Personen greps och blodprov togs. Bilen kördes till en uppställningsplats.',
    publishedAt: '2026-06-07T23:47:00Z', url: 'https://polisen.se', geography: 'Västerås', severity: 'Bra att veta', isNational: false,
  },
  {
    id: 'p-010', sourceId: 1,
    title: 'Skottlossning, Norrköping',
    content: 'Skottlossning inträffade vid ett bostadsområde i Hageby under torsdagskvällen. Ingen person ska ha träffats av skott. Polisen söker i området och ett flertal vittnen har hörts. Händelsen utreds som försök till grov misshandel.',
    publishedAt: '2026-06-07T21:15:00Z', url: 'https://polisen.se', geography: 'Norrköping', severity: 'Kritisk', isNational: false,
  },
  {
    id: 'p-011', sourceId: 1,
    title: 'Cykelstöld, Stockholm',
    content: 'Polisen har fått in ett ökat antal anmälningar om cykelstölder i Södermalm-området under den senaste veckan. Stölderna sker främst vid tunnelbanestationer. Tips om misstänkt aktivitet tas emot via polisens app.',
    publishedAt: '2026-06-07T11:30:00Z', url: 'https://polisen.se', geography: 'Stockholm', severity: 'Bra att veta', isNational: false,
  },
  {
    id: 'p-012', sourceId: 1,
    title: 'Trafikolycka med personskada, Umeå',
    content: 'En motorcyklist kolliderade med en personbil vid en korsning på Västra Esplanaden. Motorcyklisten fördes med ambulans till Norrlands universitetssjukhus med allvarliga skador. Trafiken leddes om under utredningsarbetet.',
    publishedAt: '2026-06-06T16:03:00Z', url: 'https://polisen.se', geography: 'Umeå', severity: 'Viktigt', isNational: false,
  },
  {
    id: 'p-013', sourceId: 1,
    title: 'Explosion, Göteborg',
    content: 'En mindre explosion inträffade i trapphuset i ett flerfamiljshus i Angered under tidig morgon. Polisen misstänker att en sprängkapsel placerats i trapphuset. Inga personer skadades. Bombtekniker kallas till platsen.',
    publishedAt: '2026-06-06T05:44:00Z', url: 'https://polisen.se', geography: 'Göteborg', severity: 'Kritisk', isNational: false,
  },
  {
    id: 'p-014', sourceId: 1,
    title: 'Försvunnen person efterlyst, Jönköping',
    content: 'En 78-årig man försvann från sitt äldreboende i Huskvarna under torsdagseftermiddagen. Han är 175 cm lång, kraftig bygd och klädd i beige jacka och grå byxor. Den som har sett honom uppmanas att ringa 114 14.',
    publishedAt: '2026-06-05T17:30:00Z', url: 'https://polisen.se', geography: 'Jönköping', severity: 'Viktigt', isNational: false,
  },
  {
    id: 'p-015', sourceId: 1,
    title: 'Butiksstöld, Malmö',
    content: 'Tre personer greps sedan de stulit varor för ca 6 000 kronor från ett varuhus i Triangeln. Personerna, i åldrarna 19–24 år, är misstänkta för ringa stöld alternativt stöld.',
    publishedAt: '2026-06-05T13:22:00Z', url: 'https://polisen.se', geography: 'Malmö', severity: 'Bra att veta', isNational: false,
  },

  // Folkhälsomyndigheten
  {
    id: 'fhm-001', sourceId: 6,
    title: 'Ökad spridning av kikhosta i Sverige',
    content: 'Folkhälsomyndigheten rapporterar om en ovanligt hög förekomst av kikhosta under våren. Flest fall ses hos spädbarn och ovaccinerade ungdomar. Myndigheten påminner om vikten av att hålla vaccinationsskyddet aktuellt.',
    publishedAt: '2026-06-10T09:00:00Z', url: 'https://folkhalsomyndigheten.se', geography: null, severity: 'Viktigt', isNational: true,
  },
  {
    id: 'fhm-002', sourceId: 6,
    title: 'Säsongsinfluensan avtar — normal nivå uppnådd',
    content: 'Antalet influensafall i Sverige har nu sjunkit till under epidemitröskeln. Folkhälsomyndigheten bedömer att säsongens influensavåg är på väg att klinga av. Totalbelastningen på sjukvården bedöms som hanterbar.',
    publishedAt: '2026-06-08T10:30:00Z', url: 'https://folkhalsomyndigheten.se', geography: null, severity: 'Bra att veta', isNational: true,
  },
  {
    id: 'fhm-003', sourceId: 6,
    title: 'Utbrott av magsjuka på äldreboende i Västra Götaland',
    content: 'Ett utbrott av calicivirus har konstaterats på ett äldreboende i Borås. Totalt 18 boende och 4 personal är drabbade. Smittskyddsenheten i regionen har kontaktats och besöksförbud råder tillsvidare.',
    publishedAt: '2026-06-07T14:00:00Z', url: 'https://folkhalsomyndigheten.se', geography: 'Västra Götaland', severity: 'Viktigt', isNational: false,
  },

  // Livsmedelsverket
  {
    id: 'lv-001', sourceId: 7,
    title: 'Återkallelse: Färsk spenat — risk för salmonella',
    content: 'Livsmedelsverket och importören återkallar ett parti färsk babyspenat förpackad i 200 g påsar med bäst-före-datum 2026-06-12. Produkten säljs i livsmedelsbutiker i hela landet. Konsumenter uppmanas att inte äta produkten och returnera den till inköpsstället för full återbetalning.',
    publishedAt: '2026-06-10T08:00:00Z', url: 'https://livsmedelsverket.se', geography: null, severity: 'Viktigt', isNational: true,
  },
  {
    id: 'lv-002', sourceId: 7,
    title: 'Återkallelse: Mjölkchoklad — odeklarerade nötter',
    content: 'Tillverkaren återkallar ett parti mjölkchokladkakor på grund av att hasselnötter kan förekomma utan att det anges på förpackningen. Produkten kan vara farlig för personer med nötallergi. Bäst-före-datum: 2026-09-30.',
    publishedAt: '2026-06-09T11:00:00Z', url: 'https://livsmedelsverket.se', geography: null, severity: 'Viktigt', isNational: true,
  },
  {
    id: 'lv-003', sourceId: 7,
    title: 'Information om nya regler för märkning av livsmedel',
    content: 'Från och med 1 juli 2026 gäller uppdaterade krav på ursprungsmärkning för kött och mejeriprodukter. Livsmedelsverket informerar om vad de nya reglerna innebär för producenter och konsumenter.',
    publishedAt: '2026-06-07T09:00:00Z', url: 'https://livsmedelsverket.se', geography: null, severity: 'Bra att veta', isNational: true,
  },

  // Läkemedelsverket
  {
    id: 'lmv-001', sourceId: 8,
    title: 'Säkerhetsvarning: Metformin — batchåterkallelse',
    content: 'Läkemedelsverket och distributören återkallar ett parti Metformin 500 mg tabletter (batch MT2603) på grund av avvikelse i tillverkningsprocessen. Berörda patienter uppmanas att kontakta sin förskrivare för alternativ medicinering.',
    publishedAt: '2026-06-10T10:00:00Z', url: 'https://lakemedelsverket.se', geography: null, severity: 'Viktigt', isNational: true,
  },
  {
    id: 'lmv-002', sourceId: 8,
    title: 'Ny godkänd behandling mot KOL',
    content: 'Läkemedelsverket har godkänt en ny inhalationsbehandling för patienter med kroniskt obstruktiv lungsjukdom (KOL). Preparatet tillhör en ny läkemedelsklass och erbjuder ett komplement till befintliga behandlingar.',
    publishedAt: '2026-06-08T13:00:00Z', url: 'https://lakemedelsverket.se', geography: null, severity: 'Bra att veta', isNational: true,
  },
  {
    id: 'lmv-003', sourceId: 8,
    title: 'Brist på blodtrycksmedicin — alternativ finns',
    content: 'Läkemedelsverket informerar om tillfällig brist på Amlodipin 10 mg från en tillverkare. Förskrivare uppmanas att byta till alternativa produkter med samma aktiva substans. Bristen beräknas vara löst under juli 2026.',
    publishedAt: '2026-06-06T09:30:00Z', url: 'https://lakemedelsverket.se', geography: null, severity: 'Viktigt', isNational: true,
  },

  // Trafikverket
  {
    id: 'tv-001', sourceId: 4,
    title: 'Vägarbete E4 Sundsvall — körfältsinskränkning',
    content: 'Trafikverket utför beläggningsarbete på E4 norr om Sundsvall. Ett körfält stängs av i norrgående riktning mellan avfarterna Kovland och Njurundabommen. Arbetet pågår dygnet runt och beräknas vara klart 2026-06-20.',
    publishedAt: '2026-06-10T06:00:00Z', url: 'https://trafikverket.se/trafikinformation', geography: 'Västernorrland', severity: 'Bra att veta', isNational: false,
  },
  {
    id: 'tv-002', sourceId: 4,
    title: 'Trafikolycka E6 Göteborg — stopp i trafiken',
    content: 'En trafikolycka med två fordon har inträffat på E6 söderut vid avfarten Kungsbackamotet. Räddningstjänst och polis är på plats. Trafiken leds förbi via nödkörfält. Beräknad restid ökar med 30–40 minuter.',
    publishedAt: '2026-06-09T16:45:00Z', url: 'https://trafikverket.se/trafikinformation', geography: 'Västra Götaland', severity: 'Viktigt', isNational: false,
  },
  {
    id: 'tv-003', sourceId: 4,
    title: 'Broprovning Ölandsbron — kortvarig trafikstyrning',
    content: 'Trafikverket genomför en planerad broprovning av Ölandsbron natten mot fredag. Trafiken regleras med trafikljus och väntetider om upp till 15 minuter kan förekomma mellan 22:00 och 05:00.',
    publishedAt: '2026-06-08T15:00:00Z', url: 'https://trafikverket.se/trafikinformation', geography: 'Kalmar', severity: 'Bra att veta', isNational: false,
  },

  // Krisinformation
  {
    id: 'k-001', sourceId: 5,
    title: 'Skogsbrand i Dalarna — förhöjd risk',
    content: 'MSB och Krisinformation uppmanar boende i Dalarna att följa lokala myndigheters anvisningar. Torrt väder och hårda vindar skapar förhöjd brandrisk. Undvik öppen eld utomhus. Följ SMHI:s varningar och håll dig uppdaterad via krisinformation.se.',
    publishedAt: '2026-06-10T11:00:00Z', url: 'https://krisinformation.se', geography: 'Dalarna', severity: 'Viktigt', isNational: false,
  },
  {
    id: 'k-002', sourceId: 5,
    title: 'Dricksvattenvarning, Östersund',
    content: 'Östersunds kommun uppmanar invånare i centrala Östersund att koka dricksvattnet tills vidare. Provtagning har visat på förhöjda halter av bakterier i ledningsnätet. Flaskvatten finns tillgängligt på kommunens servicecentrum.',
    publishedAt: '2026-06-09T09:30:00Z', url: 'https://krisinformation.se', geography: 'Östersund', severity: 'Kritisk', isNational: false,
  },
  {
    id: 'k-003', sourceId: 5,
    title: 'Elavbrott drabbar delar av Skåne',
    content: 'Ett fel i en transformatorstation i nordvästra Skåne har lett till elavbrott för ca 12 000 hushåll. E.ON arbetar med att åtgärda felet och beräknar att strömmen återkopplas inom 4–6 timmar. Undvik att använda hissar tills strömmen är återställd.',
    publishedAt: '2026-06-08T20:15:00Z', url: 'https://krisinformation.se', geography: 'Skåne', severity: 'Viktigt', isNational: false,
  },
  {
    id: 'k-004', sourceId: 5,
    title: 'Viktigt meddelande till allmänheten — CBRN-övning',
    content: 'Myndigheten för samhällsskydd och beredskap genomför en nationell övning den 2 april. Allmänheten kan komma att höra VMA-signalen (Viktigt meddelande till allmänheten) vid övningstillfället. Det är inte ett riktigt larm. Inga åtgärder behöver vidtas.',
    publishedAt: '2026-06-07T08:00:00Z', url: 'https://krisinformation.se', geography: null, severity: 'Bra att veta', isNational: true,
  },
  {
    id: 'k-005', sourceId: 5,
    title: 'Översvämningsrisk längs Klarälven',
    content: 'SMHI utfärdar klass 2-varning för höga flöden längs Klarälven i Värmland. Boende nära åns stränder uppmanas att flytta värdefulla föremål till höjdläge och följa kommunens anvisningar. Vägavstängningar kan förekomma.',
    publishedAt: '2026-06-06T14:45:00Z', url: 'https://krisinformation.se', geography: 'Värmland', severity: 'Viktigt', isNational: false,
  },
]

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchEvents(params: FetchEventsParams = {}): Promise<EventsResponse> {
  if (USE_MOCK) {
    return { total: MOCK_EVENTS.length, page: 1, pageSize: MOCK_EVENTS.length, events: MOCK_EVENTS }
  }

  const query = new URLSearchParams()
  if (params.shortName) query.set('shortName', params.shortName)
  if (params.geography) query.set('geography', params.geography)
  if (params.national !== undefined) query.set('national', String(params.national))
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))

  const res = await fetch(`${API_BASE}/api/events?${query}`)
  if (!res.ok) throw new Error(`fetchEvents: ${res.status}`)
  return res.json()
}

// Mitt flöde, filtrerat på servern (V3-11): användarens aktiva källor, med
// Polisen matchad mot användarens bevakningar. Kräver inloggning (401 annars).
export async function fetchMittFlode(page: number, pageSize: number): Promise<EventsResponse> {
  if (USE_MOCK) {
    return { total: MOCK_EVENTS.length, page: 1, pageSize: MOCK_EVENTS.length, events: MOCK_EVENTS, hasMore: false, totalExakt: true }
  }
  const res = await adminFetch(`/api/user/feed?page=${page}&pageSize=${pageSize}`)
  if (!res.ok) throw new Error(`fetchMittFlode: ${res.status}`)
  return res.json()
}

// Ren analytics, ingen UI beror på svaret — skickas via adminFetch (trots
// namnet den delade, valfria-auth-wrappern) så en inloggad användares JWT
// följer med om den finns, men anropet fungerar likagärna helt utloggat.
// Anropas oavsett om webbläsarens delningsmeny/kopiera-länk faktiskt
// fullföljs eller avbryts av användaren.
export async function logEventShare(eventId: string): Promise<void> {
  if (USE_MOCK) return
  try {
    await adminFetch(`/api/events/${eventId}/share`, { method: 'POST' })
  } catch {
    // tyst — misslyckad loggning ska aldrig störa själva delningen
  }
}

// Tre lägen. Bara 'dead' (källan svarade entydigt 404/410) får få UI:t att
// varna — 'unknown' betyder att kollen inte kunde avgöra något (timeout,
// 403 från bot-blockering, 5xx, nätverksfel hos servern eller hos oss) och ska
// behandlas som "ingenting hänt". Kollen får aldrig hindra någon från att nå källan.
export type LänkStatus = 'alive' | 'dead' | 'unknown'

export async function checkEventLinkStatus(eventId: string): Promise<LänkStatus> {
  if (USE_MOCK) return 'alive'
  try {
    const res = await fetch(`${API_BASE}/api/events/${eventId}/link-status`)
    if (!res.ok) return 'unknown'
    const data: { status?: string } = await res.json()
    // Bara ett uttryckligt 'dead' räknas — saknat/okänt fält (t.ex. äldre backend) blir 'unknown'.
    return data.status === 'dead' || data.status === 'alive' ? data.status : 'unknown'
  } catch {
    return 'unknown'
  }
}
