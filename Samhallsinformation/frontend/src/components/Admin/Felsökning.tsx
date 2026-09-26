import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAdminSources, updateAdminSource } from '../../api/sources'
import { dryRunSource } from '../../api/testing'
import { fetchAdminHealth, type AdminHealthDto, type HälsaStatus } from '../../api/health'
import type { AdminSource } from '../../types'
import LarmKort from './LarmKort'
import { MockBadge, MockBanner } from '../common/MockBadge'

type Hälsa = 'OK' | 'Varning' | 'Nere' | 'Kontrollerar...'

interface Tjänst {
  id:          string
  namn:        string
  beskrivning: string
  hälsa:       Hälsa
  svarstid:    string
  senast:      string
}

type FärskhetStatus = 'OK' | 'Försenad' | 'Kritisk'

interface KällKontroll {
  id:             number
  namn:           string
  url:            string
  hälsa:          Hälsa
  aktiv:          boolean
  senastHämtad:   string
  färskhetStatus: FärskhetStatus
  /** SourceType: 0 = RSS, 1 = WebAPI, 2 = CAP. Torrkörningen läser alltid källan som RSS. */
  typ:            number
}

interface Felrad {
  tid:    string
  tjänst: string
  nivå:   'Fel' | 'Varning' | 'Info'
  meddelande: string
}

const HÄLSA_MAP: Record<HälsaStatus, Hälsa> = { OK: 'OK', Varning: 'Varning', Nere: 'Nere' }

// Bygger om backendens /api/admin/health-svar till samma Tjänst[]-form
// gränssnittet redan renderar. Under laddning/refetch visas alla rader som
// "Kontrollerar..." — matchar den gamla mockens ping-UX, men bakom en riktig
// nätverksanrop nu.
function tjänsterFrånHälsa(h: AdminHealthDto | undefined, isFetching: boolean, senastKl: string): Tjänst[] {
  const kontrollerar = isFetching || !h
  const status = (s: HälsaStatus): Hälsa => kontrollerar ? 'Kontrollerar...' : HÄLSA_MAP[s]

  return [
    {
      id: 'api', namn: 'Backend-API', beskrivning: 'REST-API',
      hälsa: h ? status(h.api.status) : 'Kontrollerar...',
      svarstid: h ? `${h.api.latencyMs} ms` : '—', senast: h ? senastKl : '—',
    },
    {
      id: 'db', namn: 'Databas', beskrivning: 'EF Core — SQLite lokalt, PostgreSQL i produktion',
      hälsa: h ? status(h.db.status) : 'Kontrollerar...',
      svarstid: h ? `${h.db.latencyMs} ms` : '—', senast: h ? senastKl : '—',
    },
    {
      id: 'ingestor', namn: 'Ingestor', beskrivning: h ? `${h.ingestor.aktivaKällor - h.ingestor.källorMedFel}/${h.ingestor.aktivaKällor} aktiva källor utan fel` : 'Bakgrundstjänst — 5 min-cykel',
      hälsa: h ? status(h.ingestor.status) : 'Kontrollerar...',
      svarstid: '—', senast: h?.ingestor.lastFetchedAt ? new Date(h.ingestor.lastFetchedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '—',
    },
    {
      id: 'notis', namn: 'Notifieringar', beskrivning: h
        ? (h.notifieringar.totaltSenaste24h === 0
          ? 'Inga notiser skickade senaste 24h'
          : `${h.notifieringar.totaltSenaste24h - h.notifieringar.felSenaste24h}/${h.notifieringar.totaltSenaste24h} lyckade senaste 24h`)
        : 'Push-utskick',
      hälsa: h ? status(h.notifieringar.status) : 'Kontrollerar...',
      svarstid: '—', senast: h ? senastKl : '—',
    },
  ]
}

type KontrollTyp = 'Ingestor' | 'Fullständigt flödestest' | 'Event-drivet' | 'Intern'
type KontrollKategori = 'Källa' | 'Intern'
type KontrollStatus = 'Schemalagd' | 'Köad' | 'Pågår'

interface KommandeKontroll {
  id:          number
  typ:         KontrollTyp
  kategori:    KontrollKategori
  beskrivning: string
  tid:         string
  om:          string
  status:      KontrollStatus
}

const KOMMANDE: KommandeKontroll[] = [
  { id: 1, typ: 'Event-drivet',            kategori: 'Källa',  beskrivning: 'Polisen — datafärskhetslarm',          tid: '19:07', om: 'om 1 min',      status: 'Köad'       },
  { id: 2, typ: 'Intern',                  kategori: 'Intern', beskrivning: 'Retry-kö — misslyckade operationer',    tid: '19:08', om: 'om 2 min',      status: 'Schemalagd' },
  { id: 3, typ: 'Event-drivet',            kategori: 'Källa',  beskrivning: 'Trafikverket — datafärskhetslarm',      tid: '19:09', om: 'om 3 min',      status: 'Köad'       },
  { id: 4, typ: 'Ingestor',               kategori: 'Källa',  beskrivning: 'Alla aktiva källor',                    tid: '19:10', om: 'om 4 min',      status: 'Schemalagd' },
  { id: 5, typ: 'Intern',                  kategori: 'Intern', beskrivning: 'Notis-verifiering — utskickskontroll',  tid: '19:16', om: 'om 10 min',     status: 'Schemalagd' },
  { id: 6, typ: 'Fullständigt flödestest', kategori: 'Källa',  beskrivning: 'Alla aktiva källor',                    tid: '04:00', om: 'om 8 h 53 min', status: 'Schemalagd' },
  { id: 7, typ: 'Intern',                  kategori: 'Intern', beskrivning: 'Sessionsrensning',                      tid: '04:00', om: 'om 8 h 53 min', status: 'Schemalagd' },
  { id: 8, typ: 'Intern',                  kategori: 'Intern', beskrivning: 'Databaskontroll — integritetskoll',     tid: '04:05', om: 'om 8 h 58 min', status: 'Schemalagd' },
]

const TYP_CLS: Record<KontrollTyp, string> = {
  'Ingestor':               'bg-violet-100 text-violet-700 border border-violet-200',
  'Fullständigt flödestest':'bg-sky-100 text-sky-700 border border-sky-200',
  'Event-drivet':           'bg-amber-100 text-amber-700 border border-amber-200',
  'Intern':                 'bg-slate-100 text-slate-600 border border-slate-200',
}

const STATUS_CLS: Record<KontrollStatus, string> = {
  'Schemalagd': 'text-slate-400',
  'Köad':       'text-amber-600 font-medium',
  'Pågår':      'text-violet-600 font-medium',
}

const KATEGORI_FILTER: KontrollKategori[] = ['Källa', 'Intern']

function KommandeKontroller() {
  const [filter, setFilter] = useState<KontrollKategori | 'Alla'>('Alla')
  const visade = filter === 'Alla' ? KOMMANDE : KOMMANDE.filter(k => k.kategori === filter)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">Kommande kontroller <MockBadge /></h3>
          <p className="text-xs text-slate-400 mt-0.5">Schemalagda och köade körningar</p>
        </div>
        <div className="flex gap-1">
          {(['Alla', ...KATEGORI_FILTER] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                filter === f ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="px-6 py-3 border-b border-slate-100">
        <MockBanner>Påhittad lista — det finns ingen körschemaläggning att läsa. Ingestorn körs var 5:e minut i bakgrunden.</MockBanner>
      </div>
      <div className="divide-y divide-slate-50">
        {visade.map(k => (
          <div key={k.id} className="flex items-center gap-4 px-6 py-3">
            <div className="w-24 shrink-0 text-right">
              <p className="text-sm font-mono text-slate-700">{k.tid}</p>
              <p className="text-xs text-slate-400">{k.om}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${TYP_CLS[k.typ]}`}>{k.typ}</span>
            <p className="flex-1 text-sm text-slate-600">{k.beskrivning}</p>
            <span className={`text-xs shrink-0 ${STATUS_CLS[k.status]}`}>{k.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const FELLOGGAR: Felrad[] = [
  { tid: '10:30:11', tjänst: 'Notifieringar', nivå: 'Varning', meddelande: 'SMS-utskick till +46701234567 fick inget svar — retry 1/3' },
  { tid: '09:15:44', tjänst: 'Ingestor',      nivå: 'Varning', meddelande: 'Trafikverket svarade inte inom 10 s — källa markerad som Nere' },
  { tid: '09:15:44', tjänst: 'Ingestor',      nivå: 'Info',    meddelande: 'Trafikverket: automatisk retry schemalagd om 5 min' },
  { tid: '08:02:03', tjänst: 'Backend-API',   nivå: 'Fel',     meddelande: 'Oväntad exception i EventsController.GetById — NullReferenceException' },
  { tid: '07:00:00', tjänst: 'Ingestor',      nivå: 'Info',    meddelande: 'Schemalagd insamling slutförd — 847 händelser inlästa, 12 dubbletter ignorerade' },
]

const FÄRSKHET_CLS: Record<FärskhetStatus, string> = {
  'OK':       'text-green-600',
  'Försenad': 'text-amber-600',
  'Kritisk':  'text-red-600 font-semibold',
}

const HÄLSA_CLS: Record<Hälsa, { pill: string; dot: string }> = {
  'OK':              { pill: 'bg-green-100 text-green-700 border border-green-200',  dot: 'bg-green-500'              },
  'Varning':         { pill: 'bg-amber-100 text-amber-700 border border-amber-200',  dot: 'bg-amber-400'              },
  'Nere':            { pill: 'bg-red-100 text-red-700 border border-red-200',        dot: 'bg-red-500'                },
  'Kontrollerar...': { pill: 'bg-slate-100 text-slate-500 border border-slate-200',  dot: 'bg-slate-400 animate-pulse'},
}

const NIVÅ_CLS: Record<Felrad['nivå'], string> = {
  'Fel':     'bg-red-100 text-red-700 border border-red-200',
  'Varning': 'bg-amber-100 text-amber-700 border border-amber-200',
  'Info':    'bg-slate-100 text-slate-500 border border-slate-200',
}

type StegStatus = 'väntar' | 'kör' | 'OK' | 'Varning' | 'Fel'

interface PipelineSteg {
  namn:    string
  status:  StegStatus
  detalj?: string
}

const STEG_IKON: Record<StegStatus, string> = {
  'väntar':  '○',
  'kör':     '◌',
  'OK':      '✓',
  'Varning': '⚠',
  'Fel':     '✕',
}

const STEG_CLS: Record<StegStatus, string> = {
  'väntar':  'text-slate-300',
  'kör':     'text-violet-500 animate-pulse',
  'OK':      'text-green-600',
  'Varning': 'text-amber-500',
  'Fel':     'text-red-500',
}

interface HistorikRad {
  id:          number
  typ:         KontrollTyp
  beskrivning: string
  tid:         string
  resultat:    'OK' | 'Varning' | 'Fel'
  varaktighet: string
}

const HISTORIK: HistorikRad[] = [
  { id: 1, typ: 'Fullständigt flödestest', beskrivning: 'Alla aktiva källor',           tid: '04:00', resultat: 'Varning', varaktighet: '1 min 12 s' },
  { id: 2, typ: 'Event-drivet',            beskrivning: 'Trafikverket',                  tid: '09:16', resultat: 'Fel',     varaktighet: '10 s'       },
  { id: 3, typ: 'Event-drivet',            beskrivning: 'Polisen',                       tid: '14:24', resultat: 'OK',      varaktighet: '8 s'        },
  { id: 4, typ: 'Ingestor',               beskrivning: 'Alla aktiva källor',             tid: '18:50', resultat: 'OK',      varaktighet: '23 s'       },
  { id: 5, typ: 'Intern',                  beskrivning: 'Retry-kö — 1 operation omköad', tid: '18:53', resultat: 'OK',      varaktighet: '2 s'        },
]

const RESULTAT_CLS: Record<HistorikRad['resultat'], string> = {
  'OK':      'bg-green-100 text-green-700 border border-green-200',
  'Varning': 'bg-amber-100 text-amber-700 border border-amber-200',
  'Fel':     'bg-red-100 text-red-700 border border-red-200',
}

const ärRss = (k: KällKontroll) => k.typ === 0

function toKällKontroll(s: AdminSource): KällKontroll {
  let hälsa: Hälsa = 'Varning'
  let färskhetStatus: FärskhetStatus = 'OK'
  let senastHämtad = '—'

  if (s.lastFetchError) {
    hälsa = 'Nere'
    färskhetStatus = 'Kritisk'
  } else if (s.lastFetchedAt) {
    const mins = (Date.now() - new Date(s.lastFetchedAt).getTime()) / 60000
    hälsa = mins < 10 ? 'OK' : 'Varning'
    färskhetStatus = mins < 120 ? 'OK' : mins < 360 ? 'Försenad' : 'Kritisk'
    senastHämtad = new Date(s.lastFetchedAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  }

  return {
    id:             s.id,
    namn:           s.name,
    url:            s.url ?? s.baseUrl,
    hälsa,
    aktiv:          s.isActive,
    senastHämtad,
    färskhetStatus,
    typ:            s.type,
  }
}

export default function Felsökning() {
  const queryClient = useQueryClient()

  const { data: apiSources = [], isLoading: källorLaddar } = useQuery({
    queryKey: ['admin-sources'],
    queryFn:  fetchAdminSources,
    retry: 1,
    refetchInterval: 60_000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: number; req: Parameters<typeof updateAdminSource>[1] }) =>
      updateAdminSource(id, req),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sources'] }),
  })

  const källorLive: KällKontroll[] = apiSources.map(toKällKontroll)

  const { data: health, isFetching: hälsaKontrolleras, refetch: pingaAlla } = useQuery({
    queryKey: ['admin-health'],
    queryFn:  fetchAdminHealth,
    refetchInterval: 60_000,
  })
  const tjänster = tjänsterFrånHälsa(health, hälsaKontrolleras, new Date().toLocaleTimeString('sv-SE'))

  const [testar, setTestar]     = useState<number | null>(null)
  const [pipeline, setPipeline] = useState<Record<number, PipelineSteg[]>>({})
  const [loggFilter, setLoggFilter] = useState<Felrad['nivå'] | 'Alla'>('Alla')

  function toggleAktiv(k: KällKontroll) {
    updateMutation.mutate({ id: k.id, req: { isActive: !k.aktiv } })
  }

  async function testaAnslutning(k: KällKontroll) {
    if (!ärRss(k)) return
    setTestar(k.id)
    setPipeline(prev => ({ ...prev, [k.id]: [{ namn: 'Torrkörning (RSS)', status: 'kör' }] }))
    try {
      // Ett enda anrop: servern hämtar flödet och parsar det, inget sparas. Bara det som
      // faktiskt uppmättes visas — inga påhittade steg för mappning, deduplicering eller skrivning.
      const result = await dryRunSource(k.url, k.namn)
      setPipeline(prev => ({
        ...prev,
        [k.id]: [{ namn: 'Hämtning och parsning (torrkörning)', status: result.count > 0 ? 'OK' : 'Varning', detalj: `${result.count} poster lästes — inget sparades` }],
      }))
    } catch (err) {
      setPipeline(prev => ({
        ...prev,
        [k.id]: [{ namn: 'Hämtning och parsning (torrkörning)', status: 'Fel', detalj: err instanceof Error ? err.message : 'Timeout eller nätverksfel' }],
      }))
    } finally {
      setTestar(null)
    }
  }

  const systemOK      = tjänster.every(t => t.hälsa === 'OK')
  const systemVarning = !systemOK && tjänster.every(t => t.hälsa !== 'Nere')

  return (
    <div className="flex flex-col gap-6">

      {/* Larm från övervakningen (V1-9) */}
      <LarmKort />

      {/* Systemhälsa */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              Systemhälsa
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">LIVE</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Riktiga kontroller — databasanslutning, källornas senaste hämtning, notisleverans</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${systemOK ? 'bg-green-100 text-green-700 border-green-200' : systemVarning ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
              <span className={`w-2 h-2 rounded-full ${systemOK ? 'bg-green-500' : systemVarning ? 'bg-amber-400' : 'bg-red-500'}`} />
              {systemOK ? 'Alla system OK' : systemVarning ? 'Varningar finns' : 'Driftstörning'}
            </div>
            <button
              onClick={() => pingaAlla()}
              disabled={hälsaKontrolleras}
              className="text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              {hälsaKontrolleras ? 'Kontrollerar...' : 'Uppdatera'}
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {tjänster.map(t => {
            const cls = HÄLSA_CLS[t.hälsa]
            return (
              <div key={t.id} className="flex items-center gap-4 px-6 py-4">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cls.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{t.namn}</p>
                  <p className="text-xs text-slate-400">{t.beskrivning}</p>
                </div>
                <span className="text-xs text-slate-400 w-24 text-right">{t.svarstid}</span>
                <span className="text-xs text-slate-400 w-20 text-right">kl {t.senast}</span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border w-32 text-center ${cls.pill}`}>{t.hälsa}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Källkontroller — live */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              Källkontroller
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">LIVE</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {källorLaddar
                ? 'Hämtar källor...'
                : `${källorLive.length} källor · ${källorLive.filter(k => k.aktiv).length} aktiva`
              }
            </p>
          </div>
        </div>

        {källorLaddar ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">Laddar källdata...</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {källorLive.map(k => {
              const cls   = HÄLSA_CLS[k.hälsa]
              const pågår = testar === k.id
              return (
                <div key={k.id} className="px-6 py-4 flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cls.dot}`} />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{k.namn}</p>
                      <p className="text-xs text-slate-400 truncate">{k.url}</p>
                    </div>

                    {/* Senast hämtad */}
                    <div className="text-right shrink-0 w-36">
                      <p className="text-xs text-slate-400">Senast hämtad</p>
                      <p className={`text-xs ${FÄRSKHET_CLS[k.färskhetStatus]}`}>
                        {k.senastHämtad === '—' ? '—' : `kl ${k.senastHämtad}`}
                        {k.färskhetStatus !== 'OK' && k.senastHämtad !== '—' && (
                          <span className="ml-1">⚠</span>
                        )}
                      </p>
                    </div>

                    {/* Aktiv-toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">Aktiv</span>
                      <button
                        onClick={() => toggleAktiv(k)}
                        disabled={updateMutation.isPending}
                        className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-60 ${k.aktiv ? 'bg-green-500' : 'bg-slate-200'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${k.aktiv ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </div>

                    {/* Kör nu — ingen endpoint finns, så knappen är avstängd i stället för att låtsas */}
                    <button
                      disabled
                      title="Inte kopplat — det finns ingen endpoint som startar en hämtning; ingestorn kör var 5:e minut"
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed"
                    >
                      Kör nu
                    </button>

                    {/* Torrkörning — endast RSS-källor (servern läser URL:en som RSS) */}
                    <button
                      onClick={() => testaAnslutning(k)}
                      disabled={pågår || !ärRss(k)}
                      title={ärRss(k) ? 'Hämtar RSS-flödet och räknar poster, sparar inget' : 'Torrkörningen läser bara RSS — den här källan är ett API och kan inte testas här'}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-slate-200 text-slate-600 hover:border-sky-200 hover:text-sky-600 hover:bg-sky-50"
                    >
                      {pågår ? 'Testar...' : 'Torrkör RSS'}
                    </button>
                  </div>

                  {/* Pipeline-trace */}
                  {pipeline[k.id] && (
                    <div className="ml-6 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex flex-col gap-1.5">
                      {pipeline[k.id].map((steg, i) => (
                        <div key={i} className="flex items-baseline gap-2">
                          <span className={`text-xs font-bold w-4 shrink-0 ${STEG_CLS[steg.status]}`}>
                            {STEG_IKON[steg.status]}
                          </span>
                          <span className="text-xs text-slate-600 w-44 shrink-0">{steg.namn}</span>
                          {steg.detalj && (
                            <span className={`text-xs ${steg.status === 'Fel' ? 'text-red-500' : steg.status === 'Varning' ? 'text-amber-500' : 'text-slate-400'}`}>
                              {steg.detalj}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Kommande kontroller */}
      <KommandeKontroller />

      {/* Kontrollhistorik */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">Kontrollhistorik <MockBadge /></h3>
          <p className="text-xs text-slate-400 mt-0.5">Senast genomförda kontroller</p>
        </div>
        <div className="px-6 py-3 border-b border-slate-100">
          <MockBanner>Påhittad historik — inga kontroller sparas. Riktiga ingestor-körningar finns i Aktivitetslogg och Rapporter.</MockBanner>
        </div>
        <div className="divide-y divide-slate-50">
          {HISTORIK.map(h => (
            <div key={h.id} className="flex items-center gap-4 px-6 py-3">
              <span className="text-xs text-slate-400 font-mono w-12 shrink-0">{h.tid}</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${TYP_CLS[h.typ]}`}>{h.typ}</span>
              <p className="flex-1 text-sm text-slate-600">{h.beskrivning}</p>
              <span className="text-xs text-slate-400 shrink-0">{h.varaktighet}</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${RESULTAT_CLS[h.resultat]}`}>{h.resultat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Felloggar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">Felloggar <MockBadge /></h3>
            <p className="text-xs text-slate-400 mt-0.5">Exempelrader — inte riktiga fel</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(['Alla', 'Fel', 'Varning', 'Info'] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setLoggFilter(n)}
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                    loggFilter === n ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              disabled
              title="Inte kopplat — ingen riktig fellogg att exportera"
              className="text-xs font-medium text-slate-300 border border-slate-200 px-3 py-1.5 rounded-lg cursor-not-allowed"
            >
              Exportera
            </button>
          </div>
        </div>
        <div className="px-6 py-3 border-b border-slate-100">
          <MockBanner>Påhittade felrader (bl.a. exception och SMS-utskick som aldrig hänt). Riktiga fel: Rapporter → Fel i datainsamling och Aktivitetslogg.</MockBanner>
        </div>
        <div className="divide-y divide-slate-50">
          {FELLOGGAR.filter(f => loggFilter === 'Alla' || f.nivå === loggFilter).map((f, i) => (
            <div key={i} className="flex items-start gap-3 px-6 py-3">
              <span className="text-xs text-slate-400 font-mono w-20 shrink-0 pt-0.5">{f.tid}</span>
              <span className="text-xs font-medium text-slate-500 w-28 shrink-0 pt-0.5">{f.tjänst}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${NIVÅ_CLS[f.nivå]}`}>{f.nivå}</span>
              <p className="text-sm text-slate-700">{f.meddelande}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
