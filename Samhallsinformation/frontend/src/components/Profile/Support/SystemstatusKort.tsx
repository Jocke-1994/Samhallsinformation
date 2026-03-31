import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import type { Tjanst, PlaneratUnderhall, NastaSteg } from '../../../types'

const TJANSTER: Tjanst[] = [
  {
    namn: 'API',
    status: 'Begränsad drift',
    dotColor: 'bg-amber-400',
    kollad: '2026-03-19 10:00',
    nastaKontroll: null,
    subkallor: [
      {
        namn: 'Regeringen.se', status: 'Svarar inte', dotColor: 'bg-red-800', kollad: '2026-03-19 10:00', nastaKontroll: '2026-03-19 20:00',
        paverkan: 'Nyheter från Regeringen.se visas inte i ditt flöde och notifieringar från denna källa uteblir tills tjänsten återgår till drift.',
        nastaSteg: { typ: 'ersattare', datum: '2026-03-24 00:00' },
        kanalPaverkan: ['E-post', 'SMS'],
      },
      {
        namn: 'SMHI', status: 'Nedlagd', dotColor: 'bg-slate-400', kollad: '2026-03-18 18:00', nastaKontroll: null,
        paverkan: 'SMHI är inte längre en aktiv källa. Väderrelaterade nyheter från SMHI visas inte.',
        nastaSteg: { typ: 'borttagning', datum: '2026-03-24 00:00' },
        kanalPaverkan: ['Alla kanaler'],
      },
      {
        namn: 'Riksdagen.se', status: 'Okänd', dotColor: 'bg-slate-300', kollad: '2026-03-19 06:00', nastaKontroll: null,
        paverkan: 'Det går inte att avgöra om Riksdagen.se fungerar. Nyheter härifrån kan vara inaktuella.',
        kanalPaverkan: ['E-post'],
      },
    ],
  },
  { namn: 'Datainsamling',  status: 'I drift',        dotColor: 'bg-green-500', kollad: '2026-03-19 09:45', nastaKontroll: null },
  {
    namn: 'Notifieringar', status: 'Begränsad drift', dotColor: 'bg-amber-400', kollad: '2026-03-19 09:45', nastaKontroll: null,
    paverkan: 'Vissa notifieringar kan fördröjas eller utebli. Vi arbetar på att lösa problemet.',
    kanalPaverkan: ['SMS'],
    beraknatIDrift: '2026-03-19 18:00',
  },
  { namn: 'Webbgränssnitt', status: 'I drift',        dotColor: 'bg-green-500', kollad: '2026-03-19 08:00', nastaKontroll: null },
  {
    namn: 'Autentisering', status: 'Underhåll', dotColor: 'bg-blue-400', kollad: '2026-03-19 07:00', nastaKontroll: '2026-03-19 22:00',
    paverkan: 'Inloggning kan vara otillgänglig under underhållet. Redan inloggade användare påverkas inte.',
    kanalPaverkan: ['Alla kanaler'],
    beraknatIDrift: '2026-03-19 22:00',
  },
]

const PLANERAT_UNDERHALL: PlaneratUnderhall[] = [
  {
    namn: 'Autentisering',
    typ: 'Intern tjänst',
    start: '2026-03-19 07:00',
    beraknatSlut: '2026-03-19 22:00',
    beskrivning: 'Planerat systemunderhåll. Inloggning kan vara otillgänglig under perioden.',
  },
  {
    namn: 'Regeringen.se',
    typ: 'Extern källa',
    start: '2026-03-19 10:00',
    beraknatSlut: '2026-03-24 00:00',
    beskrivning: 'Källan svarar inte. En ersättande källa aktiveras automatiskt vid återgång.',
  },
  {
    namn: 'Länsstyrelsen Västra Götaland',
    typ: 'Extern källa',
    start: '2026-03-15 09:00',
    beraknatSlut: '2026-03-28 00:00',
    beskrivning: 'Källan genomgår planerat underhåll. Nyheter från Länsstyrelsen Västra Götaland kan vara inaktuella under perioden.',
  },
  {
    namn: 'MSB',
    typ: 'Extern källa',
    start: '2026-03-13 16:00',
    beraknatSlut: '2026-03-30 00:00',
    beskrivning: 'MSB genomgår teknisk migrering. Källan är temporärt otillgänglig och återaktiveras automatiskt när migreringen är klar.',
  },
]

function InfoPanel({ paverkan, nastaSteg, kanalPaverkan, beraknatIDrift }: {
  paverkan: string
  nastaSteg?: NastaSteg
  kanalPaverkan?: string[]
  beraknatIDrift?: string
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200">
      <div className="bg-white px-4 py-3 flex gap-3">
        <span className="text-base shrink-0 mt-0.5">⚠️</span>
        <p className="text-xs text-slate-600 leading-relaxed">{paverkan}</p>
      </div>
      {beraknatIDrift && (
        <div className="bg-blue-50 border-t border-blue-200 px-4 py-3 flex gap-3">
          <span className="text-base shrink-0 mt-0.5">🕐</span>
          <div>
            <p className="text-xs font-semibold text-blue-700 mb-0.5">Beräknat i drift</p>
            <p className="text-xs text-blue-600">{beraknatIDrift}</p>
          </div>
        </div>
      )}
      {nastaSteg && (
        <div className={`px-4 py-3 flex gap-3 border-t ${nastaSteg.typ === 'ersattare' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <span className="text-base shrink-0 mt-0.5">{nastaSteg.typ === 'ersattare' ? '🔄' : '🗑️'}</span>
          <div>
            <p className={`text-xs font-semibold mb-0.5 ${nastaSteg.typ === 'ersattare' ? 'text-green-700' : 'text-red-700'}`}>
              {nastaSteg.typ === 'ersattare' ? 'Ny källa aktiveras' : 'Källan tas bort'}{' '}
              <span className="font-bold">{nastaSteg.datum}</span>
            </p>
            <p className={`text-xs leading-relaxed ${nastaSteg.typ === 'ersattare' ? 'text-green-600' : 'text-red-500'}`}>
              {nastaSteg.typ === 'ersattare'
                ? 'Du behöver inte göra någon åtgärd för att fortsatt få information.'
                : 'Källan planeras inte få en ersättare och kommer att tas bort automatiskt.'}
            </p>
          </div>
        </div>
      )}
      {kanalPaverkan && kanalPaverkan.length > 0 && (
        <div className="bg-amber-50 border-t border-amber-200 px-4 py-3 flex gap-3">
          <span className="text-base shrink-0 mt-0.5">🔔</span>
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-1.5">Påverkade notifieringskanaler</p>
            <div className="flex flex-wrap gap-1.5">
              {kanalPaverkan.map(k => (
                <span key={k} className="text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full">
                  {k} fungerar inte
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SystemstatusKort() {
  const [expandedTjanst, setExpandedTjanst] = useState<string | null>(null)
  const [expandedKalla,  setExpandedKalla]  = useState<string | null>(null)
  const [highlighted,    setHighlighted]    = useState<string | null>(null)
  const location   = useLocation()
  const highlightRef = useRef<HTMLDivElement>(null)
  const getPingDelay = () => `-${performance.now() % 1000}ms`

  useEffect(() => {
    const namn = location.state?.highlightNamn
    if (!namn) return
    setHighlighted(namn)
    setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    const t = setTimeout(() => setHighlighted(null), 4200)
    return () => clearTimeout(t)
  }, [location.state?.highlightNamn])

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden self-start">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900 text-center">Systemstatus</h2>
        <p className="text-sm text-slate-400 mt-0.5 text-center">Aktuell driftstatus för alla tjänster</p>
      </div>

      {/* Tjänsterader */}
      <div className="flex flex-col divide-y divide-slate-100">
        {TJANSTER.map(tj => {
          const problematiska = tj.subkallor?.filter(s => s.status !== 'I drift') ?? []
          const harSubproblem = problematiska.length > 0
          const harEgenInfo = !harSubproblem && !!tj.paverkan
          const kanExpandera = harSubproblem || harEgenInfo
          const isExpanded = expandedTjanst === tj.namn

          return (
            <div key={tj.namn}>
              <button
                onClick={() => kanExpandera ? setExpandedTjanst(isExpanded ? null : tj.namn) : undefined}
                className={`w-full py-3 text-left transition-colors ${kanExpandera ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}
                style={{ display: 'grid', gridTemplateColumns: '160px 1fr 150px', alignItems: 'center', paddingLeft: '16px', paddingRight: '16px' }}
              >
                <span className="text-sm text-slate-700 font-medium whitespace-nowrap">{tj.namn}</span>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-400 whitespace-nowrap">Senast kontrollerad {tj.kollad}</span>
                  {tj.nastaKontroll && (
                    <span className="text-xs text-slate-600 font-medium whitespace-nowrap">Ny kontroll sker: {tj.nastaKontroll}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="relative flex w-2.5 h-2.5 shrink-0">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${tj.dotColor} opacity-60`} style={{ animationDelay: getPingDelay() }} />
                    <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${tj.dotColor}`} />
                  </span>
                  <span className="text-xs text-slate-600">{tj.status}</span>
                  {kanExpandera && (
                    <span className="text-slate-300 text-xs ml-1">{isExpanded ? '▴' : '▾'}</span>
                  )}
                </div>
              </button>

              {/* Eget infopanel (Notifieringar, Autentisering etc.) */}
              {isExpanded && harEgenInfo && (
                <div className="px-4 pb-3">
                  <InfoPanel
                    paverkan={tj.paverkan!}
                    kanalPaverkan={tj.kanalPaverkan}
                    beraknatIDrift={tj.beraknatIDrift}
                  />
                </div>
              )}

              {/* Subrader — externa källor med problem */}
              {isExpanded && harSubproblem && problematiska.map(s => (
                <div key={s.namn} className="border-t border-slate-100 bg-slate-50">
                  <button
                    onClick={() => setExpandedKalla(expandedKalla === s.namn ? null : s.namn)}
                    className="w-full py-2.5 text-left hover:bg-slate-100 transition-colors"
                    style={{ display: 'grid', gridTemplateColumns: '160px 1fr 150px', alignItems: 'center', paddingLeft: '28px', paddingRight: '16px' }}
                  >
                    <span className="text-sm text-slate-600 whitespace-nowrap">{s.namn}</span>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-slate-400 whitespace-nowrap">Senast kontrollerad {s.kollad}</span>
                      {s.nastaKontroll && (
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Ny kontroll sker: {s.nastaKontroll}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="relative flex w-2.5 h-2.5 shrink-0">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${s.dotColor} opacity-60`} style={{ animationDelay: getPingDelay() }} />
                        <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${s.dotColor}`} />
                      </span>
                      <span className="text-xs text-slate-500">{s.status}</span>
                      <span className="text-slate-300 text-xs ml-1">{expandedKalla === s.namn ? '▴' : '▾'}</span>
                    </div>
                  </button>
                  {expandedKalla === s.namn && (
                    <div className="px-4 pb-3">
                      <InfoPanel
                        paverkan={s.paverkan}
                        nastaSteg={s.nastaSteg}
                        kanalPaverkan={s.kanalPaverkan}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Planerat underhåll */}
      <div className="border-t border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 text-center">Planerat underhåll</h2>
          <p className="text-sm text-slate-400 mt-0.5 text-center">Kommande schemalagda underhållsfönster</p>
        </div>
        {PLANERAT_UNDERHALL.length === 0 ? (
          <div className="px-6 py-6 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm font-medium text-slate-600">Inga planerade underhåll</p>
            <p className="text-xs text-slate-400 mt-1">Vi meddelar här i god tid innan schemalagt underhåll.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {PLANERAT_UNDERHALL.map(u => (
              <div
                key={u.namn}
                ref={highlighted === u.namn ? highlightRef : null}
                className={`px-6 py-4 flex flex-col gap-1.5 transition-colors duration-300 ${highlighted === u.namn ? 'bg-amber-50' : ''}`}
              >
                <div className="flex items-center">
                  <span className="text-sm font-semibold text-slate-800">{u.namn}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{u.beskrivning}</p>
                <div className="flex items-center gap-4 mt-0.5">
                  <span className="text-xs text-slate-400">Start: <span className="font-medium text-slate-600">{u.start}</span></span>
                  <span className="text-xs text-slate-400">Beräknat klart: <span className="font-medium text-slate-600">{u.beraknatSlut}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
