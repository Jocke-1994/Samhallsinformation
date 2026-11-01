import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAdminSources, createAdminSource, updateAdminSource, deleteAdminSource, resyncAdminSource } from '../../api/sources'
import type { AdminSource } from '../../types'
import ConfirmDialog from '../common/ConfirmDialog'
import { MockBadge, MockBanner } from '../common/MockBadge'
import { MutationFel } from '../common/HamtningsStatus'
import { visaFel } from '../../lib/felmeddelande'

export type KällStatus = 'OK' | 'Begränsad drift' | 'Nere' | 'Okänd'
type Kategori        = 'Nationell' | 'Regional' | 'Kommunal' | 'Transport' | 'Väder'
type ÄndringTyp      = 'Underhåll' | 'Inaktivering' | 'Aktivering' | 'Källbyte'
type FlödesStatus    = 'OK' | 'Planerat underhåll' | 'Driftstörning'
type IngestTyp       = 'RSS' | 'API'

interface KureradKälla {
  namn:        string
  kortNamn:    string
  beskrivning: string
  url:         string
  baseUrl:     string
  kategori:    Kategori
  typ:         IngestTyp
  redo:        boolean
  anledning?:  string
}

const KURATERADE_KALLOR: KureradKälla[] = [
  {
    namn:        'Folkhälsomyndigheten',
    kortNamn:    'Folkhälsomyndigheten',
    beskrivning: 'Nyheter om smittskydd och sjukdomar',
    url:         'https://www.folkhalsomyndigheten.se/nyheter-och-press/nyhetsarkiv/?topic=smittskydd-och-sjukdomar&syndication=rss',
    baseUrl:     'https://www.folkhalsomyndigheten.se',
    kategori:    'Nationell',
    typ:         'RSS',
    redo:        true,
  },
  {
    namn:        'Livsmedelsverket',
    kortNamn:    'Livsmedelsverket',
    beskrivning: 'Matåterkallelser och livsmedelssäkerhet',
    url:         'https://www.livsmedelsverket.se/rss/rss-aterkallanden/',
    baseUrl:     'https://www.livsmedelsverket.se',
    kategori:    'Nationell',
    typ:         'RSS',
    redo:        true,
  },
  {
    namn:        'Läkemedelsverket',
    kortNamn:    'Läkemedelsverket',
    beskrivning: 'Säkerhetsvarningar och läkemedelsåterkallelser',
    url:         'https://www.lakemedelsverket.se/api/newslist/newsrss?query=&pageTypeId=&from=&to=',
    baseUrl:     'https://www.lakemedelsverket.se',
    kategori:    'Nationell',
    typ:         'RSS',
    redo:        true,
  },
  {
    namn:        'SMHI',
    kortNamn:    'SMHI',
    beskrivning: 'Väder- och naturvarningar',
    url:         'https://opendata-download-warnings.smhi.se/api/version/2/warnings.json',
    baseUrl:     'https://www.smhi.se',
    kategori:    'Väder',
    typ:         'API',
    redo:        true,
  },
  {
    namn:        'Kemikalieinspektionen',
    kortNamn:    'KEMI',
    beskrivning: 'Nyheter om kemikalier och kemikaliesäkerhet',
    url:         'https://www.kemi.se/4.39a6b9eb175a977d0431924/12.39a6b9eb175a977d043192c.portlet?state=rss&sv.contenttype=text/xml;charset=UTF-8',
    baseUrl:     'https://www.kemi.se',
    kategori:    'Nationell',
    typ:         'RSS',
    redo:        true,
  },
  {
    namn:        'Trafikverket',
    kortNamn:    'Trafikverket',
    beskrivning: 'Vägtrafikhändelser och störningar',
    url:         'https://api.trafikinfo.trafikverket.se/',
    baseUrl:     'https://www.trafikverket.se',
    kategori:    'Transport',
    typ:         'API',
    redo:        false,
    anledning:   'Kräver API-nyckel och egen ingestor',
  },
]

type Kanal = 'E-post' | 'SMS' | 'Push'

interface ExterntFlöde {
  id:              number
  källId:          number
  flödesUrl:       string
  senastKontroll:  string
  status:          FlödesStatus
  meddelande?:     string
  start?:          string
  slut?:           string
  kanaler:         Kanal[]
  autoImport:      boolean
  importerad:      boolean
}

const FLÖDES_CLS: Record<FlödesStatus, string> = {
  'OK':                  'bg-green-100 text-green-700 border border-green-200',
  'Planerat underhåll':  'bg-amber-100 text-amber-700 border border-amber-200',
  'Driftstörning':       'bg-red-100 text-red-700 border border-red-200',
}

const FLÖDES_DOT: Record<FlödesStatus, string> = {
  'OK':                  'bg-green-500',
  'Planerat underhåll':  'bg-amber-400',
  'Driftstörning':       'bg-red-500',
}

const KANAL_CLS: Record<Kanal, string> = {
  'E-post': 'bg-violet-100 text-violet-700',
  'SMS':    'bg-sky-100 text-sky-700',
  'Push':   'bg-amber-100 text-amber-700',
}

const INITIAL_FLÖDEN: ExterntFlöde[] = [
  {
    id: 1, källId: 1, flödesUrl: 'https://polisen.se/status/rss',
    senastKontroll: '2026-03-21 10:42', status: 'OK',
    kanaler: ['E-post', 'SMS', 'Push'], autoImport: true, importerad: false,
  },
  {
    id: 2, källId: 2, flödesUrl: 'https://smhi.se/statusflöde/rss',
    senastKontroll: '2026-03-21 10:40', status: 'Planerat underhåll',
    meddelande: 'Planerat serverunderhåll — API och datafeed otillgängliga',
    start: '2026-03-22 02:00', slut: '2026-03-22 04:00',
    kanaler: ['E-post', 'SMS'], autoImport: true, importerad: false,
  },
  {
    id: 3, källId: 4, flödesUrl: 'https://trafikverket.se/om-oss/driftinfo/rss',
    senastKontroll: '2026-03-21 10:41', status: 'Driftstörning',
    meddelande: 'Oplanerat avbrott i öppna API:et — utreds just nu',
    start: '2026-03-21 09:15', slut: '',
    kanaler: ['E-post', 'Push'], autoImport: true, importerad: false,
  },
  {
    id: 4, källId: 3, flödesUrl: 'https://msb.se/statusflöde/rss',
    senastKontroll: '2026-03-21 10:42', status: 'OK',
    kanaler: ['E-post'], autoImport: true, importerad: false,
  },
  {
    id: 5, källId: 5, flödesUrl: 'https://krisinformation.se/rss/status',
    senastKontroll: '2026-03-21 10:42', status: 'OK',
    kanaler: ['E-post', 'SMS', 'Push'], autoImport: true, importerad: false,
  },
]

interface SchemalagdÄndring {
  id:        number
  källId:    number
  typ:       ÄndringTyp
  start:     string
  slut:      string
  notering:  string
}

let nextÄndringId = 200

const INITIAL_ÄNDRINGAR: SchemalagdÄndring[] = [
  { id: 1, källId: 2, typ: 'Underhåll',   start: '2026-03-22 02:00', slut: '2026-03-22 04:00', notering: 'Planerat serverunderhåll hos SMHI' },
  { id: 2, källId: 7, typ: 'Aktivering',  start: '2026-03-25 08:00', slut: '',                  notering: 'Regeringen.se aktiveras efter teknisk kontroll' },
]

const ÄNDRING_CLS: Record<ÄndringTyp, string> = {
  'Underhåll':   'bg-amber-100 text-amber-700 border border-amber-200',
  'Inaktivering':'bg-red-100 text-red-700 border border-red-200',
  'Aktivering':  'bg-green-100 text-green-700 border border-green-200',
  'Källbyte':    'bg-sky-100 text-sky-700 border border-sky-200',
}

const ÄNDRING_IKON: Record<ÄndringTyp, string> = {
  'Underhåll':   '🔧',
  'Inaktivering':'⏸',
  'Aktivering':  '▶',
  'Källbyte':    '🔄',
}

interface Källa {
  id:             number
  namn:           string
  url:            string
  kategori:       Kategori
  status:         KällStatus
  aktiv:          boolean
  publicerad:     boolean
  senastKontroll: string
  fetchError:     string | null
  händelser:      number
}

export const STATUS_DOT: Record<KällStatus, string> = {
  'OK':              'bg-green-500',
  'Begränsad drift': 'bg-amber-400',
  'Nere':            'bg-red-500',
  'Okänd':           'bg-slate-400',
}

const KATEGORIER: Kategori[] = ['Nationell', 'Regional', 'Kommunal', 'Transport', 'Väder']

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)  return 'Just nu'
  if (mins < 60) return `${mins} min sedan`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs} h sedan`
  return `${Math.floor(hrs / 24)} d sedan`
}

export function deriveStatus(s: AdminSource): KällStatus {
  if (!s.isActive) return 'Okänd'
  if (s.lastFetchError) return 'Nere'
  if (!s.lastFetchedAt) return 'Okänd'
  const mins = (Date.now() - new Date(s.lastFetchedAt).getTime()) / 60000
  return mins < 10 ? 'OK' : 'Begränsad drift'
}

function toKälla(s: AdminSource): Källa {
  return {
    id:             s.id,
    namn:           s.name,
    url:            s.url ?? s.baseUrl,
    kategori:       (s.category ?? 'Nationell') as Kategori,
    status:         deriveStatus(s),
    aktiv:          s.isActive,
    publicerad:     s.isPublished,
    senastKontroll: relativeTime(s.lastFetchedAt),
    fetchError:     s.lastFetchError,
    händelser:      s.eventCount,
  }
}

// Fält som redigeringsformuläret äger. Bara det användaren faktiskt rört sparas i utkastet.
export type KällUtkast = Partial<Pick<Källa, 'namn' | 'url' | 'kategori' | 'publicerad'>>

// Delta mot källans AKTUELLA läge (inte en kopia från när formuläret öppnades): bara ändrade fält
// skickas, och aldrig isActive — så att en ändring gjord någon annanstans under tiden
// (snabbknapp, annan flik, annan admin) inte skrivs över med ett föråldrat värde.
export function beräknaKällDelta(aktuell: Källa, utkast: KällUtkast): Parameters<typeof updateAdminSource>[1] {
  const delta: Parameters<typeof updateAdminSource>[1] = {}
  if (utkast.namn       !== undefined && utkast.namn       !== aktuell.namn)       delta.name        = utkast.namn
  if (utkast.url        !== undefined && utkast.url        !== aktuell.url)        delta.url         = utkast.url
  if (utkast.kategori   !== undefined && utkast.kategori   !== aktuell.kategori)   delta.category    = utkast.kategori
  if (utkast.publicerad !== undefined && utkast.publicerad !== aktuell.publicerad) delta.isPublished = utkast.publicerad
  return delta
}

// Simulerad kontrolltid (1–2,5 s). Ligger utanför komponenten så render förblir
// ren — Math.random() i komponentkroppen flaggas av react-hooks/purity.
function slumpadKontrollFördröjning() {
  return 1000 + Math.random() * 1500
}

export default function Kallhantering() {
  const queryClient = useQueryClient()

  const { data: apiSources = [], isLoading, isError, isFetching, error, refetch } = useQuery({
    queryKey: ['admin-sources'],
    queryFn: fetchAdminSources,
    retry: 1,
  })

  const createMutation = useMutation({
    mutationFn: createAdminSource,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sources'] }),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: number; req: Parameters<typeof updateAdminSource>[1] }) =>
      updateAdminSource(id, req),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sources'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteAdminSource,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sources'] }),
    onError: (err, id) => {
      // Visa serverns text (t.ex. att dedikerade källor inte kan raderas) på källans rad — samma ruta som omsynk.
      setResyncResultat({ id, text: err instanceof Error ? `✗ ${err.message}` : '✗ Borttagning misslyckades' })
      setTimeout(() => setResyncResultat(null), 6000)
    },
  })
  const resyncMutation = useMutation({
    mutationFn: resyncAdminSource,
    onSuccess: (result, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-sources'] })
      setResyncResultat({ id, text: `✓ ${result.updated} uppdaterade, ${result.inserted} nya` })
      setTimeout(() => setResyncResultat(null), 4000)
    },
    onError: (err, id) => {
      setResyncResultat({ id, text: err instanceof Error ? `✗ ${err.message}` : '✗ Misslyckades' })
      setTimeout(() => setResyncResultat(null), 4000)
    },
  })

  const kallor: Källa[] = apiSources.map(s => toKälla(s))

  const [sök,         setSök]         = useState('')
  const [filterKat,   setFilterKat]   = useState<Kategori | ''>('')
  // Redigering: bara vilken källa som är öppen + det användaren ändrat. Övriga fält läses live
  // från serverns senaste läge (query-cachen), så formuläret aldrig håller en gammal kopia.
  const [redigerarId, setRedigerarId] = useState<number | null>(null)
  const [utkast,      setUtkast]      = useState<KällUtkast>({})
  const aktuellRedigerad = redigerarId != null ? kallor.find(k => k.id === redigerarId) : undefined
  const redigerar: Källa | null = aktuellRedigerad ? { ...aktuellRedigerad, ...utkast } : null
  const [attTaBort,   setAttTaBort]   = useState<{ id: number; namn: string } | null>(null)
  const [visaForm,    setVisaForm]    = useState(false)
  const [aktiverar,   setAktiverar]   = useState<Set<string>>(new Set())
  const [sparad,      setSparad]      = useState<number | null>(null)
  const [resyncResultat, setResyncResultat] = useState<{ id: number; text: string } | null>(null)
  const [aktiveringFel, setAktiveringFel] = useState<{ url: string; text: string } | null>(null)
  const [ändringar,   setÄndringar]   = useState<SchemalagdÄndring[]>(INITIAL_ÄNDRINGAR)
  const [visaÄndring,    setVisaÄndring]    = useState(false)
  const [nyÄndring,      setNyÄndring]      = useState<Omit<SchemalagdÄndring, 'id'>>({
    källId: 1, typ: 'Underhåll', start: '', slut: '', notering: '',
  })
  const [redigerarÄndring, setRedigerarÄndring] = useState<SchemalagdÄndring | null>(null)
  const [flöden,          setFlöden]          = useState<ExterntFlöde[]>(INITIAL_FLÖDEN)
  const [kontrollerarFlöde, setKontrollerarFlöde] = useState<Set<number>>(new Set())

  function flashSparad(id: number) {
    setSparad(id)
    setTimeout(() => setSparad(null), 2000)
  }

  // V3-8: "Sparad" visas och formuläret stängs först när servern bekräftat. Vid fel
  // finns felet kvar i UI:t och (för redigering) användarens inmatning.
  function toggleAktiv(k: Källa) {
    if (updateMutation.isPending) return
    updateMutation.mutate({ id: k.id, req: { isActive: !k.aktiv } }, { onSuccess: () => flashSparad(k.id) })
  }

  function togglePublicerad(k: Källa) {
    if (updateMutation.isPending) return
    updateMutation.mutate({ id: k.id, req: { isPublished: !k.publicerad } }, { onSuccess: () => flashSparad(k.id) })
  }

  function öppnaRedigering(id: number | null) {
    setRedigerarId(id)
    setUtkast({})
    updateMutation.reset()
  }

  function sparaRedigering() {
    if (!aktuellRedigerad || updateMutation.isPending) return
    const delta = beräknaKällDelta(aktuellRedigerad, utkast)
    if (Object.keys(delta).length === 0) {
      öppnaRedigering(null)
      return
    }
    const id = aktuellRedigerad.id
    updateMutation.mutate({ id, req: delta }, {
      onSuccess: () => { flashSparad(id); öppnaRedigering(null) },
    })
  }

  function aktiveraKälla(k: KureradKälla) {
    setAktiveringFel(null)
    setAktiverar(prev => new Set(prev).add(k.url))
    createMutation.mutate({
      name:      k.namn,
      shortName: k.kortNamn,
      baseUrl:   k.baseUrl,
      url:       k.url,
      category:  k.kategori,
      type:      0,
    }, {
      onSuccess: (created) => {
        setAktiverar(prev => { const n = new Set(prev); n.delete(k.url); return n })
        flashSparad(created.id)
      },
      onError: (err) => {
        setAktiverar(prev => { const n = new Set(prev); n.delete(k.url); return n })
        setAktiveringFel({ url: k.url, text: visaFel(err, `Kunde inte lägga till ${k.namn}. Försök igen.`) })
      },
    })
  }

  // Borttagning är permanent och tar via cascade bort ALLA användares
  // prenumerationer på källan — därför alltid via bekräftelsedialogen.
  function begärTaBort(k: Källa) {
    setAttTaBort({ id: k.id, namn: k.namn })
  }

  function taBort(id: number) {
    setAttTaBort(null)
    deleteMutation.mutate(id)
    if (redigerarId === id) öppnaRedigering(null)
  }

  function kontrolleraFlöde(id: number) {
    setKontrollerarFlöde(prev => new Set(prev).add(id))
    const delay = slumpadKontrollFördröjning()
    setTimeout(() => {
      const nu = new Date().toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
      setFlöden(prev => prev.map(f => f.id === id ? { ...f, senastKontroll: nu } : f))
      setKontrollerarFlöde(prev => { const n = new Set(prev); n.delete(id); return n })
    }, delay)
  }

  function importeraÄndring(f: ExterntFlöde) {
    const typmapp: Record<FlödesStatus, ÄndringTyp> = {
      'Planerat underhåll': 'Underhåll',
      'Driftstörning':      'Inaktivering',
      'OK':                 'Aktivering',
    }
    setÄndringar(prev => [...prev, {
      id:       nextÄndringId++,
      källId:   f.källId,
      typ:      typmapp[f.status],
      start:    f.start ?? '',
      slut:     f.slut  ?? '',
      notering: f.meddelande ?? '',
    }])
    setFlöden(prev => prev.map(x => x.id === f.id ? { ...x, importerad: true } : x))
  }

  const filtrerade = kallor.filter(k => {
    const matchSök = k.namn.toLowerCase().includes(sök.toLowerCase()) || k.url.toLowerCase().includes(sök.toLowerCase())
    const matchKat  = !filterKat    || k.kategori === filterKat
    return matchSök && matchKat
  })

  const selectCls = "bg-slate-100 text-slate-700 text-sm px-3 py-2 rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer"
  const inputCls  = "bg-white text-slate-900 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-400 w-full"

  return (
    <div className="flex flex-col gap-5">

      {attTaBort && (
        <ConfirmDialog
          rubrik={`Ta bort källan "${attTaBort.namn}"?`}
          bekräftaText="Ta bort källan"
          onBekräfta={() => taBort(attTaBort.id)}
          onAvbryt={() => setAttTaBort(null)}
        >
          <p>
            Det här tar bort källan <strong>{attTaBort.namn}</strong> och alla användares
            prenumerationer på den — kan inte ångras. Källans hämtade händelser (och användares
            sparade/delade händelser från den) tas bort samtidigt.
          </p>
        </ConfirmDialog>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Källhantering
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">LIVE</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isLoading ? 'Laddar...' : isError && apiSources.length === 0 ? 'Antal okänt — källistan kunde inte hämtas' : `${kallor.length} källor registrerade · ${kallor.filter(k => k.aktiv).length} aktiva`}
          </p>
        </div>
        <button
          onClick={() => { setVisaForm(true); öppnaRedigering(null) }}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          + Lägg till källa
        </button>
      </div>

      {/* Auth-fel */}
      {isError && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="text-red-500 text-lg shrink-0">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Kunde inte hämta källista från backend</p>
            <p className="text-xs text-red-600 mt-0.5 font-mono">{error instanceof Error ? error.message : String(error)}</p>
            <p className="text-xs text-red-500 mt-1">
              401 = JWT-token ogiltig (prova att logga ut och in igen) · 403 = saknar Admin-roll · 500 = serverfel (kolla Railway-loggar)
            </p>
          </div>
          <button
            onClick={() => { void refetch() }}
            disabled={isFetching}
            className="text-xs text-red-600 hover:text-red-800 font-medium shrink-0 disabled:opacity-40"
          >
            {isFetching ? 'Försöker...' : 'Försök igen'}
          </button>
        </div>
      )}

      {/* Misslyckad av/på- eller publiceringsväxling (redigeringsformuläret visar sitt eget fel) */}
      {redigerar === null && (
        <MutationFel fel={updateMutation.error} reserv="Ändringen kunde inte sparas. Försök igen." className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3" />
      )}

      {/* Kuraterad källlista */}
      {visaForm && (() => {
        const tillagdaBaseUrls = new Set(apiSources.map(s => s.baseUrl))
        const tillagdaNamn    = new Set(apiSources.map(s => s.name.toLowerCase()))
        const tillgängliga = KURATERADE_KALLOR.filter(k =>
          !tillagdaBaseUrls.has(k.baseUrl) && !tillagdaNamn.has(k.namn.toLowerCase())
        )
        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Tillgängliga källor</h3>
                <p className="text-xs text-slate-400 mt-0.5">Verifierade källor redo att ansluta</p>
              </div>
              <button
                onClick={() => setVisaForm(false)}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                Stäng
              </button>
            </div>

            {tillgängliga.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                Alla tillgängliga källkandidater är redan tillagda.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tillgängliga.map(k => {
                  const laddar = aktiverar.has(k.url)
                  return (
                    <div key={k.url} className="flex items-center gap-4 px-6 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{k.namn}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            k.typ === 'RSS'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>{k.typ}</span>
                          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{k.kategori}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{k.beskrivning}</p>
                        {aktiveringFel?.url === k.url && <p role="alert" className="text-xs text-red-600 mt-1">{aktiveringFel.text}</p>}
                      </div>
                      <div className="shrink-0">
                        {k.redo ? (
                          <button
                            onClick={() => aktiveraKälla(k)}
                            disabled={laddar}
                            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                          >
                            {laddar ? 'Aktiverar...' : 'Aktivera'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl">
                            {k.anledning}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Filter + sök */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          value={sök}
          onChange={e => setSök(e.target.value)}
          placeholder="Sök källa eller URL..."
          className="bg-white text-slate-900 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-400 w-64"
        />
        <select value={filterKat} onChange={e => setFilterKat(e.target.value as Kategori | '')} className={selectCls}>
          <option value="">Alla kategorier</option>
          {KATEGORIER.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {/* Tabell */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-[40%]">Källa</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-28">Kategori</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-right w-24">Händelser</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-center w-20">Aktiv</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-center w-24">Publicerad</th>
              <th className="px-5 py-3 w-44" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">Laddar källor...</td>
              </tr>
            ) : filtrerade.map(k => (
              <>
                <tr key={k.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-5 py-4 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[k.status]}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{k.namn}</p>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono truncate" title={k.url}>{k.url}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{k.kategori}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700 text-right font-medium tabular-nums">{k.händelser.toLocaleString('sv-SE')}</td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => toggleAktiv(k)}
                      className={`w-10 h-5 rounded-full relative transition-colors ${k.aktiv ? 'bg-violet-600' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${k.aktiv ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => togglePublicerad(k)}
                      title={k.publicerad ? 'Publicerad — synlig för besökare' : 'Opublicerad — osynlig för besökare'}
                      className={`w-10 h-5 rounded-full relative transition-colors ${k.publicerad ? 'bg-green-500' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${k.publicerad ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 justify-end">
                      {sparad === k.id && <span className="text-xs text-green-500 font-medium">✓</span>}
                      <span className="text-xs text-slate-400 tabular-nums">{k.senastKontroll}</span>
                      <button
                        onClick={() => resyncMutation.mutate(k.id)}
                        disabled={resyncMutation.isPending && resyncMutation.variables === k.id}
                        title="Hämta om och skriv över redan sparade händelser med senaste ingestor-logiken"
                        className="text-xs text-sky-600 hover:text-sky-800 font-medium [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all disabled:opacity-50"
                      >
                        {resyncMutation.isPending && resyncMutation.variables === k.id ? 'Synkar...' : 'Synka om'}
                      </button>
                      <button
                        onClick={() => öppnaRedigering(redigerarId === k.id ? null : k.id)}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
                      >
                        Redigera
                      </button>
                      <button
                        onClick={() => begärTaBort(k)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
                      >
                        Ta bort
                      </button>
                    </div>
                    {resyncResultat?.id === k.id && (
                      <p className={`text-xs text-right mt-1 font-medium ${resyncResultat.text.startsWith('✗') ? 'text-red-500' : 'text-green-600'}`}>
                        {resyncResultat.text}
                      </p>
                    )}
                    {k.fetchError && (
                      <p className="text-xs text-red-500 mt-1 text-right truncate max-w-[16rem] ml-auto" title={k.fetchError}>
                        {k.fetchError}
                      </p>
                    )}
                  </td>
                </tr>

                {/* Inline redigering */}
                {redigerar?.id === k.id && (
                  <tr key={`edit-${k.id}`}>
                    <td colSpan={6} className="bg-violet-50 border-t border-b border-violet-100 px-5 py-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-slate-500">Namn</label>
                          <input type="text" value={redigerar.namn} onChange={e => setUtkast(u => ({ ...u, namn: e.target.value }))} className={inputCls} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-slate-500">URL</label>
                          <input type="url" value={redigerar.url} onChange={e => setUtkast(u => ({ ...u, url: e.target.value }))} className={inputCls} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-slate-500">Kategori</label>
                          <select value={redigerar.kategori} onChange={e => setUtkast(u => ({ ...u, kategori: e.target.value as Kategori }))} className={selectCls}>
                            {KATEGORIER.map(kat => <option key={kat} value={kat}>{kat}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => setUtkast(u => ({ ...u, publicerad: !redigerar.publicerad }))}
                          className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${redigerar.publicerad ? 'bg-green-500' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${redigerar.publicerad ? 'left-5' : 'left-0.5'}`} />
                        </button>
                        <span className="text-xs text-slate-500">
                          {redigerar.publicerad
                            ? <span className="text-green-600 font-medium">Publicerad — synlig för besökare</span>
                            : <span className="text-amber-600 font-medium">Opublicerad — osynlig (testläge)</span>
                          }
                        </span>
                      </div>
                      <MutationFel fel={updateMutation.error} reserv="Ändringen kunde inte sparas. Din inmatning finns kvar — försök igen." className="mt-3" />
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={sparaRedigering}
                          disabled={updateMutation.isPending}
                          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                        >
                          {updateMutation.isPending ? 'Sparar...' : 'Spara'}
                        </button>
                        <button onClick={() => öppnaRedigering(null)} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">Avbryt</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {!isLoading && !isError && filtrerade.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-slate-400">Inga källor matchar filtret.</div>
        )}
      </div>

      {/* Schemalagda ändringar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              Schemalagda ändringar
              <MockBadge />
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Planerat underhåll, av- och påslagningar</p>
          </div>
          <button
            disabled
            title="Inte kopplat — schemalagda ändringar sparas ingenstans och ändrar inget"
            className="bg-slate-100 text-slate-400 text-sm font-medium px-4 py-2 rounded-xl cursor-not-allowed"
          >
            + Schemalägg
          </button>
        </div>
        <div className="px-6 py-3 border-b border-slate-100">
          <MockBanner>Exempeldata i webbläsaren — inget sparas och inget slås av eller på enligt schemat.</MockBanner>
        </div>
        <fieldset disabled className="min-w-0 border-0 p-0 m-0 opacity-60">

        {/* Formulär */}
        {visaÄndring && (
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex flex-col gap-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Källa</label>
                <select
                  value={nyÄndring.källId}
                  onChange={e => setNyÄndring(p => ({ ...p, källId: Number(e.target.value) }))}
                  className={selectCls}
                >
                  {kallor.map(k => <option key={k.id} value={k.id}>{k.namn}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Typ</label>
                <select
                  value={nyÄndring.typ}
                  onChange={e => setNyÄndring(p => ({ ...p, typ: e.target.value as ÄndringTyp }))}
                  className={selectCls}
                >
                  {(['Underhåll', 'Inaktivering', 'Aktivering', 'Källbyte'] as ÄndringTyp[]).map(t =>
                    <option key={t} value={t}>{ÄNDRING_IKON[t]} {t}</option>
                  )}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Start</label>
                <input
                  type="datetime-local"
                  value={nyÄndring.start}
                  onChange={e => setNyÄndring(p => ({ ...p, start: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Slut (valfritt)</label>
                <input
                  type="datetime-local"
                  value={nyÄndring.slut}
                  onChange={e => setNyÄndring(p => ({ ...p, slut: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500">Notering</label>
              <input
                type="text"
                value={nyÄndring.notering}
                onChange={e => setNyÄndring(p => ({ ...p, notering: e.target.value }))}
                placeholder="Beskriv ändringen kort..."
                className={inputCls}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (!nyÄndring.start) return
                  setÄndringar(prev => [...prev, { ...nyÄndring, id: nextÄndringId++ }])
                  setNyÄndring({ källId: kallor[0]?.id ?? 1, typ: 'Underhåll', start: '', slut: '', notering: '' })
                  setVisaÄndring(false)
                }}
                className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                Spara
              </button>
              <button onClick={() => setVisaÄndring(false)} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">Avbryt</button>
            </div>
          </div>
        )}

        {/* Lista */}
        {ändringar.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">Inga schemalagda ändringar.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {ändringar.map(ä => {
              const källa = kallor.find(k => k.id === ä.källId)
              const redigeras = redigerarÄndring?.id === ä.id
              return (
                <div key={ä.id}>
                  <div className="flex items-start gap-4 px-6 py-4 group">
                    <span className="text-xl mt-0.5">{ÄNDRING_IKON[ä.typ]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{källa?.namn ?? '—'}</span>
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${ÄNDRING_CLS[ä.typ]}`}>{ä.typ}</span>
                      </div>
                      {ä.notering && <p className="text-xs text-slate-500 mt-0.5">{ä.notering}</p>}
                      <p className="text-xs text-slate-400 mt-1">
                        {ä.start}{ä.slut ? ` → ${ä.slut}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5">
                      <button
                        onClick={() => setRedigerarÄndring(redigeras ? null : { ...ä })}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                      >
                        Ändra
                      </button>
                      <button
                        onClick={() => {
                          setÄndringar(prev => prev.filter(x => x.id !== ä.id))
                          if (redigeras) setRedigerarÄndring(null)
                        }}
                        className="text-xs text-red-400 hover:text-red-600 font-medium"
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>

                  {/* Inline redigering */}
                  {redigeras && redigerarÄndring && (
                    <div className="px-6 py-5 bg-violet-50 border-t border-violet-100 flex flex-col gap-4">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-slate-500">Källa</label>
                          <select
                            value={redigerarÄndring.källId}
                            onChange={e => setRedigerarÄndring(p => p ? { ...p, källId: Number(e.target.value) } : p)}
                            className={selectCls}
                          >
                            {kallor.map(k => <option key={k.id} value={k.id}>{k.namn}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-slate-500">Typ</label>
                          <select
                            value={redigerarÄndring.typ}
                            onChange={e => setRedigerarÄndring(p => p ? { ...p, typ: e.target.value as ÄndringTyp } : p)}
                            className={selectCls}
                          >
                            {(['Underhåll', 'Inaktivering', 'Aktivering', 'Källbyte'] as ÄndringTyp[]).map(t =>
                              <option key={t} value={t}>{ÄNDRING_IKON[t]} {t}</option>
                            )}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-slate-500">Start</label>
                          <input
                            type="datetime-local"
                            value={redigerarÄndring.start}
                            onChange={e => setRedigerarÄndring(p => p ? { ...p, start: e.target.value } : p)}
                            className={inputCls}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-slate-500">Slut (valfritt)</label>
                          <input
                            type="datetime-local"
                            value={redigerarÄndring.slut}
                            onChange={e => setRedigerarÄndring(p => p ? { ...p, slut: e.target.value } : p)}
                            className={inputCls}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-slate-500">Notering</label>
                        <input
                          type="text"
                          value={redigerarÄndring.notering}
                          onChange={e => setRedigerarÄndring(p => p ? { ...p, notering: e.target.value } : p)}
                          placeholder="Beskriv ändringen kort..."
                          className={inputCls}
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setÄndringar(prev => prev.map(x => x.id === redigerarÄndring.id ? redigerarÄndring : x))
                            setRedigerarÄndring(null)
                          }}
                          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                        >
                          Spara
                        </button>
                        <button
                          onClick={() => setRedigerarÄndring(null)}
                          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          Avbryt
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        </fieldset>
      </div>

      {/* Externa statusflöden */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              Externa statusflöden
              <MockBadge />
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Skulle läsa källornas egna driftstatus — inte byggt</p>
          </div>
          <button
            disabled
            title="Inte kopplat — statusen är påhittad och inga externa flöden läses"
            className="bg-slate-100 text-slate-400 text-sm font-medium px-4 py-2 rounded-xl cursor-not-allowed"
          >
            Kontrollera alla
          </button>
        </div>
        <div className="px-6 py-3 border-b border-slate-100">
          <MockBanner>Påhittad status — inga externa driftflöden läses, och "Kontrollera" ändrar bara en tidsstämpel. Texten under rubriken om automatisk uppdatering gäller inte.</MockBanner>
        </div>
        <fieldset disabled className="min-w-0 border-0 p-0 m-0 opacity-60">

        <div className="divide-y divide-slate-100">
          {flöden.map(f => {
            const källa  = kallor.find(k => k.id === f.källId)
            const laddar = kontrollerarFlöde.has(f.id)
            const harNotis = f.status !== 'OK' && f.meddelande

            return (
              <div key={f.id} className="px-6 py-4 flex flex-col gap-3">

                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${FLÖDES_DOT[f.status]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{källa?.namn ?? '—'}</span>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${FLÖDES_CLS[f.status]}`}>{f.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{f.flödesUrl}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs text-slate-400">
                      {laddar
                        ? <span className="text-violet-500 animate-pulse">Kontrollerar...</span>
                        : f.senastKontroll
                      }
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Auto-import</span>
                      <button
                        onClick={() => setFlöden(prev => prev.map(x => x.id === f.id ? { ...x, autoImport: !x.autoImport } : x))}
                        className={`w-8 h-4 rounded-full relative transition-colors ${f.autoImport ? 'bg-violet-600' : 'bg-slate-200'}`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${f.autoImport ? 'left-4' : 'left-0.5'}`} />
                      </button>
                    </div>
                    <button
                      onClick={() => kontrolleraFlöde(f.id)}
                      disabled={laddar}
                      className="text-xs text-sky-600 hover:text-sky-800 font-medium disabled:opacity-30 transition-colors"
                    >
                      Kontrollera
                    </button>
                  </div>
                </div>

                {harNotis && (
                  <div className="ml-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-800">Meddelande från {källa?.namn ?? 'källan'}</p>
                      <p className="text-xs text-amber-700">{f.meddelande}</p>
                      {f.start && (
                        <p className="text-xs text-amber-500 mt-0.5">
                          {f.start}{f.slut ? ` → ${f.slut}` : ''}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-xs text-amber-600 font-medium">Påverkar:</span>
                        {f.kanaler.map(k => (
                          <span key={k} className={`text-xs font-medium px-2 py-0.5 rounded-full ${KANAL_CLS[k]}`}>{k}</span>
                        ))}
                      </div>
                    </div>
                    {f.importerad ? (
                      <span className="text-xs text-green-600 font-medium shrink-0 mt-0.5">✓ Importerad</span>
                    ) : (
                      <button
                        onClick={() => importeraÄndring(f)}
                        className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
                      >
                        Importera som schemalagd ändring
                      </button>
                    )}
                  </div>
                )}

              </div>
            )
          })}
        </div>
        </fieldset>
      </div>

    </div>
  )
}
