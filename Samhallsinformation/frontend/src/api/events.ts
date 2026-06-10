import type { CanonicalEvent, EventsResponse } from '../types'

interface FetchEventsParams {
  sourceId?: number
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

export async function fetchEvents(params: FetchEventsParams = {}): Promise<EventsResponse> {
  if (USE_MOCK) {
    const filtered = MOCK_EVENTS.filter(e =>
      params.sourceId === undefined || e.sourceId === params.sourceId
    )
    return { total: filtered.length, page: 1, pageSize: filtered.length, events: filtered }
  }

  const query = new URLSearchParams()
  if (params.sourceId !== undefined) query.set('source', String(params.sourceId))
  if (params.geography) query.set('geography', params.geography)
  if (params.national !== undefined) query.set('national', String(params.national))
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))

  const res = await fetch(`/api/events?${query}`)
  if (!res.ok) throw new Error(`fetchEvents: ${res.status}`)
  return res.json()
}
