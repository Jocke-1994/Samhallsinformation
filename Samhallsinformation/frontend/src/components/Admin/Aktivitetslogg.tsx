import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAdminActivityLog, undoActivityLogEntry, type LoggPost, type ÅngraData } from '../../api/activityLog'
import { saveAdminUserEvent, unsaveAdminUserEvent } from '../../api/adminUsers'
import { fetchIngestorLogRecent, type IngestorLogRowDto } from '../../api/ingestorLog'

type LoggTyp    = 'Ingestor' | 'Notis' | 'Fel' | 'Kontoåtgärd'
type LoggStatus = 'OK' | 'Fel' | 'Varning' | 'Levererad' | 'Misslyckad'
type TidsFilter = 'Idag' | '7 dagar' | '30 dagar' | 'Alla'

interface LoggRad {
  id:         string
  tid:        string
  datum:      string
  typ:        LoggTyp
  rubrik:     string
  detalj:     string
  status:     LoggStatus
  vem?:       string
  ångrad?:    boolean
  ångraData?: ÅngraData
}

// Notis-raderna är fortfarande mock — kräver en egen global lista över
// NotificationDeliveryLog (utöver den redan per-användare-skopade
// GetNotificationLog i AdminUserDetailsController), inte del av den här
// omgången (bara Ingestor/Fel, se IngestorRunLog).
const NOTIS_MOCK: LoggRad[] = [
  { id: 'm2',  tid: '09:50', datum: '2026-05-18', typ: 'Notis', rubrik: 'Notis skickad — Polisen', detalj: 'E-post till anna.svensson@mail.se — "Trafikolycka E4 Södertälje"',      status: 'Levererad'  },
  { id: 'm3',  tid: '09:48', datum: '2026-05-18', typ: 'Notis', rubrik: 'Notis skickad — SMHI',    detalj: 'Push till 3 mottagare — "Gul varning: kraftigt regn Västra Götaland"', status: 'Levererad'  },
  { id: 'm8',  tid: '22:14', datum: '2026-05-17', typ: 'Notis', rubrik: 'Notis skickad — MSB',     detalj: 'E-post till 12 mottagare — "VIKTIGT: Röd varning storm"',               status: 'Levererad'  },
  { id: 'm12', tid: '14:22', datum: '2026-05-17', typ: 'Notis', rubrik: 'Notis misslyckad — E-post', detalj: 'SMTP-fel vid leverans till erik.lindgren@example.com',                status: 'Misslyckad' },
]

// Riktig ingestor-körningshistorik (IngestorRunLog) — en rad per käll-försök.
// En lyckad retry (samma källa senare OK igen) visas som Varning, inte Fel,
// eftersom felet självläkte — matchar samma "Kvarstår"/"OK vid retry"-logik
// som Rapporters felkort använder.
function ingestorRadTillLoggRad(r: IngestorLogRowDto): LoggRad {
  const d = new Date(r.runAt)
  return {
    id:     r.id,
    tid:    d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
    datum:  d.toISOString().slice(0, 10),
    typ:    r.success ? 'Ingestor' : 'Fel',
    rubrik: r.success ? `Ingestor-körning — ${r.sourceName}` : `Fel — ${r.sourceName}`,
    detalj: r.success ? `${r.eventsInserted} nya händelser hämtade` : (r.errorMessage ?? 'Okänt fel'),
    status: r.success ? 'OK' : (r.återförsökLyckades ? 'Varning' : 'Fel'),
  }
}

const SIDA_STORLEK = 8

const TYP_MÄRKE: Record<LoggTyp, string> = {
  Ingestor:    'bg-sky-100 text-sky-700',
  Notis:       'bg-violet-100 text-violet-700',
  Fel:         'bg-red-100 text-red-700',
  Kontoåtgärd: 'bg-emerald-100 text-emerald-700',
}

const TYP_IKON: Record<LoggTyp, string> = {
  Ingestor:    '⚙️',
  Notis:       '🔔',
  Fel:         '⚠️',
  Kontoåtgärd: '👤',
}

const STATUS_MÄRKE: Record<LoggStatus, string> = {
  OK:         'bg-green-100 text-green-700',
  Levererad:  'bg-green-100 text-green-700',
  Varning:    'bg-amber-100 text-amber-700',
  Fel:        'bg-red-100 text-red-700',
  Misslyckad: 'bg-red-100 text-red-700',
}

const STATUS_PRICK: Record<LoggStatus, string> = {
  OK:         'bg-green-500',
  Levererad:  'bg-green-500',
  Varning:    'bg-amber-400',
  Fel:        'bg-red-500',
  Misslyckad: 'bg-red-500',
}

// Använder verklig aktuell tid, inte ett fast datum — nödvändigt sedan
// Kontoåtgärder (riktiga, tidsstämplade poster) blandades in med den
// statiska Ingestor/Notis/Fel-mocken. Konsekvens: mock-raderna (frusna vid
// 2026-05-17/18) syns numera bara under "Alla", inte "Idag"/"7 dagar"/
// "30 dagar" — förväntat, inte en bugg, eftersom de faktiskt ligger
// månader tillbaka i tiden jämfört med verkligt idag.
function datumGräns(filter: TidsFilter): string | null {
  if (filter === 'Alla') return null
  const d = new Date()
  if (filter === 'Idag')    return d.toISOString().slice(0, 10)
  if (filter === '7 dagar') { d.setDate(d.getDate() - 7);  return d.toISOString().slice(0, 10) }
  if (filter === '30 dagar'){ d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) }
  return null
}

function postTillRad(p: LoggPost): LoggRad {
  const d = new Date(p.tid)
  return {
    id:        p.id,
    tid:       d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
    datum:     d.toISOString().slice(0, 10),
    typ:       'Kontoåtgärd',
    rubrik:    p.rubrik,
    detalj:    p.detalj,
    status:    'OK',
    vem:       p.vem,
    ångrad:    p.ångrad,
    ångraData: p.ångraData,
  }
}

function exporteraCsv(rader: LoggRad[]) {
  const huvud  = ['Datum', 'Tid', 'Typ', 'Rubrik', 'Detalj', 'Status', 'Vem']
  const rader_ = rader.map(r => [r.datum, r.tid, r.typ, `"${r.rubrik}"`, `"${r.detalj}"`, r.status, r.vem ?? ''])
  const csv    = [huvud, ...rader_].map(r => r.join(';')).join('\n')
  const blob   = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href       = url
  a.download   = `aktivitetslogg-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Aktivitetslogg() {
  const [typFilter,   setTypFilter]   = useState<LoggTyp | 'Alla'>('Alla')
  const [tidsFilter,  setTidsFilter]  = useState<TidsFilter>('Alla')
  const [sökning,     setSökning]     = useState('')
  const [visaAntal,   setVisaAntal]   = useState(SIDA_STORLEK)
  const [expandadId,  setExpandadId]  = useState<string | null>(null)
  const [väntarÅngra, setVäntarÅngra] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: kontoLogg = [] } = useQuery({
    queryKey: ['admin-activity-log'],
    queryFn:  fetchAdminActivityLog,
  })

  const { data: ingestorRader = [] } = useQuery({
    queryKey: ['admin-ingestor-log-recent'],
    queryFn:  () => fetchIngestorLogRecent({ limit: 100 }),
  })

  const undoMutation = useMutation({
    mutationFn: undoActivityLogEntry,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['admin-activity-log'] }),
  })

  // Kontoåtgärder (Sparat-ändringar m.m.) skrivna av admin/support i
  // Användarhantering + riktig ingestor-körningshistorik, slås ihop med den
  // fortfarande mockade Notis-listan, sorterade tillsammans nyast först.
  const alla = useMemo(() => {
    const dynamiska = kontoLogg.map(postTillRad)
    const ingestor  = ingestorRader.map(ingestorRadTillLoggRad)
    return [...dynamiska, ...ingestor, ...NOTIS_MOCK].sort((a, b) => (b.datum + b.tid).localeCompare(a.datum + a.tid))
  }, [kontoLogg, ingestorRader])

  const filtrerad = useMemo(() => {
    const gräns = datumGräns(tidsFilter)
    const s     = sökning.toLowerCase()
    return alla.filter(r => {
      if (typFilter !== 'Alla' && r.typ !== typFilter) return false
      if (gräns && tidsFilter === 'Idag'    && r.datum !== gräns) return false
      if (gräns && tidsFilter !== 'Idag'    && r.datum < gräns)   return false
      if (s && !r.rubrik.toLowerCase().includes(s) && !r.detalj.toLowerCase().includes(s)) return false
      return true
    })
  }, [alla, typFilter, tidsFilter, sökning])

  const visade  = filtrerad.slice(0, visaAntal)
  const harFler = filtrerad.length > visaAntal

  const summary = useMemo(() => ({
    ingestor:  alla.filter(r => r.typ === 'Ingestor').length,
    notiser:   alla.filter(r => r.typ === 'Notis').length,
    fel:       alla.filter(r => r.status === 'Fel' || r.status === 'Misslyckad').length,
    varningar: alla.filter(r => r.status === 'Varning').length,
  }), [alla])

  function nollställFilter() {
    setTypFilter('Alla')
    setTidsFilter('Alla')
    setSökning('')
    setVisaAntal(SIDA_STORLEK)
  }

  async function ångra(rad: LoggRad) {
    if (!rad.ångraData) return
    if (väntarÅngra !== rad.id) {
      setVäntarÅngra(rad.id)
      return
    }
    const { anvandareId, handelse, undoAction } = rad.ångraData
    if (undoAction === 'lägg-till') await saveAdminUserEvent(anvandareId, handelse.eventId)
    else await unsaveAdminUserEvent(anvandareId, handelse.eventId)
    await undoMutation.mutateAsync(rad.id)
    setVäntarÅngra(null)
  }

  const filterAktivt = typFilter !== 'Alla' || tidsFilter !== 'Alla' || sökning !== ''

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Aktivitetslogg
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200" title="Notis-raderna är fortfarande mockdata, resten är live">MOCK + LIVE</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Riktig ingestor-körningshistorik (lyckade/fel) + kontoåtgärder tagna av admin/support i Användarhantering (live, går att ångra) — skickade notiser fortfarande mock.
          </p>
        </div>
        <button
          onClick={() => exporteraCsv(filtrerad)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          title="Exportera aktuellt urval som CSV"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportera CSV
        </button>
      </div>

      {/* Sammanfattning */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ingestor-körningar', value: summary.ingestor,  color: 'text-sky-600',    ikon: '⚙️' },
          { label: 'Skickade notiser',   value: summary.notiser,   color: 'text-violet-600', ikon: '🔔' },
          { label: 'Fel',                value: summary.fel,       color: 'text-red-500',    ikon: '❌' },
          { label: 'Varningar',          value: summary.varningar, color: 'text-amber-500',  ikon: '⚠️' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5 flex flex-col gap-1 items-center text-center">
            <span className="text-xl">{k.ikon}</span>
            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-400 font-medium">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Logg */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Filter-rad */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">

          {/* Fritextsökning */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={sökning}
              onChange={e => { setSökning(e.target.value); setVisaAntal(SIDA_STORLEK) }}
              placeholder="Sök i loggen..."
              className="text-xs pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 w-44"
            />
          </div>

          {/* Typ */}
          <div className="flex items-center gap-1.5">
            {(['Alla', 'Ingestor', 'Notis', 'Fel', 'Kontoåtgärd'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTypFilter(t); setVisaAntal(SIDA_STORLEK) }}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  typFilter === t ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >{t}</button>
            ))}
          </div>

          {/* Tidsfilter */}
          <div className="flex items-center gap-1.5">
            {(['Idag', '7 dagar', '30 dagar', 'Alla'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTidsFilter(t); setVisaAntal(SIDA_STORLEK) }}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  tidsFilter === t ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >{t}</button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {filterAktivt && (
              <button onClick={nollställFilter} className="text-xs text-violet-600 hover:text-violet-800 transition-colors">
                Rensa filter
              </button>
            )}
            <p className="text-xs text-slate-400">{filtrerad.length} poster</p>
          </div>
        </div>

        {/* Rader */}
        {filtrerad.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm text-slate-500">Inga poster matchar filtret.</p>
            <button onClick={nollställFilter} className="mt-3 text-xs text-violet-600 hover:text-violet-800 transition-colors">
              Rensa filter
            </button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-50">
              {visade.map(rad => (
                <div key={rad.id}>
                  <button
                    onClick={() => { setExpandadId(expandadId === rad.id ? null : rad.id); setVäntarÅngra(null) }}
                    className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_PRICK[rad.status]}`} />
                    <span className="text-xs text-slate-400 font-mono w-12 shrink-0">{rad.tid}</span>
                    <span className="text-xs text-slate-400 shrink-0 hidden lg:block w-24">{rad.datum}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYP_MÄRKE[rad.typ]}`}>
                      {TYP_IKON[rad.typ]} {rad.typ}
                    </span>
                    <p className="text-sm text-slate-700 flex-1 truncate">{rad.rubrik}</p>
                    {rad.typ === 'Kontoåtgärd' ? (
                      rad.ångrad && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 bg-slate-100 text-slate-500">
                          Ångrad
                        </span>
                      )
                    ) : (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_MÄRKE[rad.status]}`}>
                        {rad.status}
                      </span>
                    )}
                    <span className="text-slate-300 text-xs shrink-0">{expandadId === rad.id ? '▲' : '▼'}</span>
                  </button>

                  {expandadId === rad.id && (
                    <div className="px-6 pb-4 pt-2 bg-slate-50 border-t border-slate-100">
                      <p className="text-xs text-slate-600 leading-relaxed">{rad.detalj}</p>
                      <p className="text-xs text-slate-400 mt-1.5 font-mono">
                        {rad.datum} {rad.tid}{rad.vem && ` · ${rad.vem}`}
                      </p>
                      {rad.ångraData && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => ångra(rad)}
                            disabled={rad.ångrad}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                              väntarÅngra === rad.id
                                ? 'border-red-200 text-red-700 hover:bg-red-50'
                                : 'border-violet-200 text-violet-700 hover:bg-violet-50'
                            }`}
                          >
                            {rad.ångrad ? 'Redan ångrad' : väntarÅngra === rad.id ? 'Bekräfta ångra?' : '↩ Ångra'}
                          </button>
                          {väntarÅngra === rad.id && !rad.ångrad && (
                            <button
                              onClick={() => setVäntarÅngra(null)}
                              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              Avbryt
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {harFler && (
              <div className="px-6 py-4 border-t border-slate-100 text-center">
                <button
                  onClick={() => setVisaAntal(v => v + SIDA_STORLEK)}
                  className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
                >
                  Visa fler ({filtrerad.length - visaAntal} kvar)
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
