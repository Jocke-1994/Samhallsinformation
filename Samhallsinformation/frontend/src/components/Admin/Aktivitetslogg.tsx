import { useState, useMemo } from 'react'

type LoggTyp    = 'Ingestor' | 'Notis' | 'Fel'
type LoggStatus = 'OK' | 'Fel' | 'Varning' | 'Levererad' | 'Misslyckad'
type TidsFilter = 'Idag' | '7 dagar' | '30 dagar' | 'Alla'

interface LoggRad {
  id:     number
  tid:    string
  datum:  string
  typ:    LoggTyp
  rubrik: string
  detalj: string
  status: LoggStatus
}

const LOGG: LoggRad[] = [
  { id: 1,  tid: '10:05', datum: '2026-05-18', typ: 'Ingestor', rubrik: 'Ingestor-körning slutförd',          detalj: '847 händelser hämtade — Polisen, SMHI, Trafikverket, MSB',              status: 'OK'         },
  { id: 2,  tid: '09:50', datum: '2026-05-18', typ: 'Notis',    rubrik: 'Notis skickad — Polisen',            detalj: 'E-post till anna.svensson@mail.se — "Trafikolycka E4 Södertälje"',      status: 'Levererad'  },
  { id: 3,  tid: '09:48', datum: '2026-05-18', typ: 'Notis',    rubrik: 'Notis skickad — SMHI',               detalj: 'Push till 3 mottagare — "Gul varning: kraftigt regn Västra Götaland"', status: 'Levererad'  },
  { id: 4,  tid: '09:45', datum: '2026-05-18', typ: 'Fel',      rubrik: 'Timeout — Krisinformation',          detalj: 'HTTP-anrop tog >30 s, retry lyckades på försök 2',                      status: 'Varning'    },
  { id: 5,  tid: '08:05', datum: '2026-05-18', typ: 'Ingestor', rubrik: 'Ingestor-körning slutförd',          detalj: '612 händelser hämtade — Polisen, Trafikverket',                         status: 'OK'         },
  { id: 6,  tid: '07:00', datum: '2026-05-18', typ: 'Ingestor', rubrik: 'Ingestor-körning slutförd',          detalj: '390 händelser hämtade — alla aktiva källor',                            status: 'OK'         },
  { id: 7,  tid: '23:05', datum: '2026-05-17', typ: 'Ingestor', rubrik: 'Ingestor-körning slutförd',          detalj: '721 händelser hämtade — Polisen, SMHI, MSB',                            status: 'OK'         },
  { id: 8,  tid: '22:14', datum: '2026-05-17', typ: 'Notis',    rubrik: 'Notis skickad — MSB',                detalj: 'E-post till 12 mottagare — "VIKTIGT: Röd varning storm"',               status: 'Levererad'  },
  { id: 9,  tid: '20:05', datum: '2026-05-17', typ: 'Ingestor', rubrik: 'Ingestor-körning slutförd',          detalj: '544 händelser hämtade — Polisen, Trafikverket, Krisinformation',        status: 'OK'         },
  { id: 10, tid: '18:37', datum: '2026-05-17', typ: 'Fel',      rubrik: 'Parse-fel — Polisen RSS',            detalj: 'Ogiltig XML i feed, 0 händelser importerade från Polisen denna körning', status: 'Fel'        },
  { id: 11, tid: '17:05', datum: '2026-05-17', typ: 'Ingestor', rubrik: 'Ingestor-körning delvis slutförd',   detalj: '289 händelser hämtade — SMHI, Krisinformation (Polisen hoppades över)', status: 'Varning'    },
  { id: 12, tid: '14:22', datum: '2026-05-17', typ: 'Notis',    rubrik: 'Notis misslyckad — E-post',          detalj: 'SMTP-fel vid leverans till erik.lindgren@example.com',                  status: 'Misslyckad' },
  { id: 13, tid: '14:05', datum: '2026-05-17', typ: 'Ingestor', rubrik: 'Ingestor-körning slutförd',          detalj: '903 händelser hämtade — alla aktiva källor',                            status: 'OK'         },
  { id: 14, tid: '11:05', datum: '2026-05-17', typ: 'Ingestor', rubrik: 'Ingestor-körning slutförd',          detalj: '478 händelser hämtade — Polisen, MSB',                                  status: 'OK'         },
  { id: 15, tid: '08:12', datum: '2026-05-17', typ: 'Fel',      rubrik: 'Timeout — Krisinformation',          detalj: 'HTTP-anrop tog >30 s, retry lyckades på försök 3',                      status: 'Varning'    },
  { id: 16, tid: '08:05', datum: '2026-05-17', typ: 'Ingestor', rubrik: 'Ingestor-körning slutförd',          detalj: '654 händelser hämtade — alla aktiva källor',                            status: 'OK'         },
  { id: 17, tid: '02:00', datum: '2026-05-17', typ: 'Fel',      rubrik: 'HTTP 503 — SMHI',                    detalj: 'SMHI API svarade med 503, körning avbruten för källan',                 status: 'Fel'        },
  { id: 18, tid: '02:00', datum: '2026-05-17', typ: 'Ingestor', rubrik: 'Ingestor-körning delvis slutförd',   detalj: '201 händelser hämtade — Polisen, MSB (SMHI hoppades över)',             status: 'Varning'    },
]

const SIDA_STORLEK = 8

const TYP_MÄRKE: Record<LoggTyp, string> = {
  Ingestor: 'bg-sky-100 text-sky-700',
  Notis:    'bg-violet-100 text-violet-700',
  Fel:      'bg-red-100 text-red-700',
}

const TYP_IKON: Record<LoggTyp, string> = {
  Ingestor: '⚙️',
  Notis:    '🔔',
  Fel:      '⚠️',
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

function datumGräns(filter: TidsFilter): string | null {
  if (filter === 'Alla') return null
  const d = new Date('2026-05-18')
  if (filter === 'Idag')    return '2026-05-18'
  if (filter === '7 dagar') { d.setDate(d.getDate() - 7);  return d.toISOString().slice(0, 10) }
  if (filter === '30 dagar'){ d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) }
  return null
}

function exporteraCsv(rader: LoggRad[]) {
  const huvud  = ['Datum', 'Tid', 'Typ', 'Rubrik', 'Detalj', 'Status']
  const rader_ = rader.map(r => [r.datum, r.tid, r.typ, `"${r.rubrik}"`, `"${r.detalj}"`, r.status])
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
  const [expandadId,  setExpandadId]  = useState<number | null>(null)

  const filtrerad = useMemo(() => {
    const gräns = datumGräns(tidsFilter)
    const s     = sökning.toLowerCase()
    return LOGG.filter(r => {
      if (typFilter !== 'Alla' && r.typ !== typFilter) return false
      if (gräns && tidsFilter === 'Idag'    && r.datum !== gräns) return false
      if (gräns && tidsFilter !== 'Idag'    && r.datum < gräns)   return false
      if (s && !r.rubrik.toLowerCase().includes(s) && !r.detalj.toLowerCase().includes(s)) return false
      return true
    })
  }, [typFilter, tidsFilter, sökning])

  const visade  = filtrerad.slice(0, visaAntal)
  const harFler = filtrerad.length > visaAntal

  const summary = useMemo(() => ({
    ingestor:  LOGG.filter(r => r.typ === 'Ingestor').length,
    notiser:   LOGG.filter(r => r.typ === 'Notis').length,
    fel:       LOGG.filter(r => r.status === 'Fel' || r.status === 'Misslyckad').length,
    varningar: LOGG.filter(r => r.status === 'Varning').length,
  }), [])

  function nollställFilter() {
    setTypFilter('Alla')
    setTidsFilter('Alla')
    setSökning('')
    setVisaAntal(SIDA_STORLEK)
  }

  const filterAktivt = typFilter !== 'Alla' || tidsFilter !== 'Alla' || sökning !== ''

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Aktivitetslogg
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">MOCK</span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Systemnivå — ingestor-körningar, skickade notiser och fel.</p>
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
            {(['Alla', 'Ingestor', 'Notis', 'Fel'] as const).map(t => (
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
                    onClick={() => setExpandadId(expandadId === rad.id ? null : rad.id)}
                    className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_PRICK[rad.status]}`} />
                    <span className="text-xs text-slate-400 font-mono w-12 shrink-0">{rad.tid}</span>
                    <span className="text-xs text-slate-400 shrink-0 hidden lg:block w-24">{rad.datum}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYP_MÄRKE[rad.typ]}`}>
                      {TYP_IKON[rad.typ]} {rad.typ}
                    </span>
                    <p className="text-sm text-slate-700 flex-1 truncate">{rad.rubrik}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_MÄRKE[rad.status]}`}>
                      {rad.status}
                    </span>
                    <span className="text-slate-300 text-xs shrink-0">{expandadId === rad.id ? '▲' : '▼'}</span>
                  </button>

                  {expandadId === rad.id && (
                    <div className="px-6 pb-4 pt-2 bg-slate-50 border-t border-slate-100">
                      <p className="text-xs text-slate-600 leading-relaxed">{rad.detalj}</p>
                      <p className="text-xs text-slate-400 mt-1.5 font-mono">{rad.datum} {rad.tid}</p>
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
