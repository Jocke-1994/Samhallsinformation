import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAdminSources, createAdminSource, updateAdminSource, deleteAdminSource } from '../../api/sources'
import type { AdminSource } from '../../types'

type KällStatus      = 'OK' | 'Begränsad drift' | 'Nere' | 'Okänd'
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

const STATUS_DOT: Record<KällStatus, string> = {
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

function deriveStatus(s: AdminSource): KällStatus {
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


export default function Kallhantering() {
  const queryClient = useQueryClient()

  const { data: apiSources = [], isLoading, isError, error } = useQuery({
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
  })

  const kallor: Källa[] = apiSources.map(s => toKälla(s))

  const [sök,         setSök]         = useState('')
  const [filterKat,   setFilterKat]   = useState<Kategori | ''>('')
  const [redigerar,   setRedigerar]   = useState<Källa | null>(null)
  const [visaForm,    setVisaForm]    = useState(false)
  const [aktiverar,   setAktiverar]   = useState<Set<string>>(new Set())
  const [sparad,      setSparad]      = useState<number | null>(null)
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

  function toggleAktiv(k: Källa) {
    updateMutation.mutate({ id: k.id, req: { isActive: !k.aktiv } })
    flashSparad(k.id)
  }

  function togglePublicerad(k: Källa) {
    updateMutation.mutate({ id: k.id, req: { isPublished: !k.publicerad } })
    flashSparad(k.id)
  }

  function sparaRedigering() {
    if (!redigerar) return
    updateMutation.mutate({
      id: redigerar.id,
      req: { name: redigerar.namn, url: redigerar.url, category: redigerar.kategori, isPublished: redigerar.publicerad },
    })
    flashSparad(redigerar.id)
    setRedigerar(null)
  }

  function aktiveraKälla(k: KureradKälla) {
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
      onError: () => {
        setAktiverar(prev => { const n = new Set(prev); n.delete(k.url); return n })
      },
    })
  }

  function taBort(id: number) {
    deleteMutation.mutate(id)
    if (redigerar?.id === id) setRedigerar(null)
  }

  function kontrolleraFlöde(id: number) {
    setKontrollerarFlöde(prev => new Set(prev).add(id))
    const delay = 1000 + Math.random() * 1500
    setTimeout(() => {
      const nu = new Date().toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
      setFlöden(prev => prev.map(f => f.id === id ? { ...f, senastKontroll: nu } : f))
      setKontrollerarFlöde(prev => { const n = new Set(prev); n.delete(id); return n })
    }, delay)
  }

  function kontrolleraAllaFlöden() {
    flöden.forEach(f => kontrolleraFlöde(f.id))
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Källhantering
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">LIVE</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isLoading ? 'Laddar...' : `${kallor.length} källor registrerade · ${kallor.filter(k => k.aktiv).length} aktiva`}
          </p>
        </div>
        <button
          onClick={() => { setVisaForm(true); setRedigerar(null) }}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          + Lägg till källa
        </button>
      </div>

      {/* Auth-fel */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="text-red-500 text-lg shrink-0">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Kunde inte hämta källista från backend</p>
            <p className="text-xs text-red-600 mt-0.5 font-mono">{error instanceof Error ? error.message : String(error)}</p>
            <p className="text-xs text-red-500 mt-1">
              401 = JWT-token ogiltig (prova att logga ut och in igen) · 403 = saknar Admin-roll · 500 = serverfel (kolla Railway-loggar)
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-red-600 hover:text-red-800 font-medium shrink-0"
          >
            Ladda om
          </button>
        </div>
      )}

      {/* Kuraterad källlista */}
      {visaForm && (() => {
        const tillagdaBaseUrls = new Set(apiSources.map(s => s.baseUrl))
        const tillgängliga = KURATERADE_KALLOR.filter(k => !tillagdaBaseUrls.has(k.baseUrl))
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
                        onClick={() => setRedigerar(redigerar?.id === k.id ? null : { ...k })}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium opacity-0 group-hover:opacity-100 transition-all"
                      >
                        Redigera
                      </button>
                      <button
                        onClick={() => taBort(k.id)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium opacity-0 group-hover:opacity-100 transition-all"
                      >
                        Ta bort
                      </button>
                    </div>
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
                          <input type="text" value={redigerar.namn} onChange={e => setRedigerar(p => p ? { ...p, namn: e.target.value } : p)} className={inputCls} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-slate-500">URL</label>
                          <input type="url" value={redigerar.url} onChange={e => setRedigerar(p => p ? { ...p, url: e.target.value } : p)} className={inputCls} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-medium text-slate-500">Kategori</label>
                          <select value={redigerar.kategori} onChange={e => setRedigerar(p => p ? { ...p, kategori: e.target.value as Kategori } : p)} className={selectCls}>
                            {KATEGORIER.map(kat => <option key={kat} value={kat}>{kat}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => setRedigerar(p => p ? { ...p, publicerad: !p.publicerad } : p)}
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
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={sparaRedigering}
                          disabled={updateMutation.isPending}
                          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                        >
                          {updateMutation.isPending ? 'Sparar...' : 'Spara'}
                        </button>
                        <button onClick={() => setRedigerar(null)} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">Avbryt</button>
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
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">MOCK</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Planerat underhåll, av- och påslagningar</p>
          </div>
          <button
            onClick={() => setVisaÄndring(v => !v)}
            className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            + Schemalägg
          </button>
        </div>

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
      </div>

      {/* Externa statusflöden */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              Externa statusflöden
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">MOCK</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Läser källornas egna driftstatus — uppdateras automatiskt</p>
          </div>
          <button
            onClick={kontrolleraAllaFlöden}
            className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            Kontrollera alla
          </button>
        </div>

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
      </div>

    </div>
  )
}
