import { useState } from 'react'
import type { AdminSection } from './AdminSidebar'

const DAGAR = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

type NyckeltalAction =
  | { typ: 'navigera'; sektion: AdminSection; etikett: string }
  | { typ: 'modal' }
  | { typ: 'ingen' }

const NYCKELTAL: { label: string; value: string | number; sub: string; color: string; ikon: string; action: NyckeltalAction }[] = [
  { label: 'Registrerade användare', value: '1 284',  sub: '+23 denna vecka',     color: 'text-violet-600', ikon: '👥', action: { typ: 'navigera', sektion: 'anvandare',  etikett: 'Gå till Användarhantering →' } },
  { label: 'Händelser i databasen',  value: '94 284', sub: '847 senaste 24 h',    color: 'text-sky-600',    ikon: '📋', action: { typ: 'navigera', sektion: 'felsökning', etikett: 'Gå till Felsökning →'         } },
  { label: 'Notifieringar skickade', value: '42 180', sub: 'totalt sedan start',  color: 'text-green-600',  ikon: '🔔', action: { typ: 'ingen'                                                                      } },
  { label: 'Fel senaste 7 dagarna',  value: 3,        sub: '0 kritiska',          color: 'text-red-500',    ikon: '⚠️', action: { typ: 'modal'                                                                      } },
]

const ANVANDARE_PER_DAG = [
  { label: 'Mån', värde: 4 },
  { label: 'Tis', värde: 7 },
  { label: 'Ons', värde: 3 },
  { label: 'Tor', värde: 9 },
  { label: 'Fre', värde: 12 },
  { label: 'Lör', värde: 2 },
  { label: 'Sön', värde: 5 },
]

const HANDELSER_PER_DAG = [
  { label: 'Mån', värde: 720 },
  { label: 'Tis', värde: 890 },
  { label: 'Ons', värde: 640 },
  { label: 'Tor', värde: 1020 },
  { label: 'Fre', värde: 847 },
  { label: 'Lör', värde: 310 },
  { label: 'Sön', värde: 420 },
]

const ALLVARLIGHETSGRAD = [
  { label: 'Kritisk',      antal: 38,   färg: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50'    },
  { label: 'Hög',          antal: 142,  färg: 'bg-orange-400', text: 'text-orange-700', bg: 'bg-orange-50' },
  { label: 'Medium',       antal: 891,  färg: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50'  },
  { label: 'Bra att veta', antal: 3213, färg: 'bg-sky-400',    text: 'text-sky-700',    bg: 'bg-sky-50'    },
]

const NOTIS_PER_KANAL = [
  { kanal: 'E-post', antal: 35200, ikon: '📧', färg: 'bg-violet-500' },
  { kanal: 'Push',   antal: 6980,  ikon: '📱', färg: 'bg-sky-500'    },
  { kanal: 'SMS',    antal: 0,     ikon: '💬', färg: 'bg-green-500'  },
]

const NOTIS_PER_KALLA = [
  { namn: 'Polisen',         antal: 18420 },
  { namn: 'SMHI',            antal: 9310  },
  { namn: 'Trafikverket',    antal: 7840  },
  { namn: 'MSB',             antal: 4290  },
  { namn: 'Krisinformation', antal: 2320  },
]

const FEL_PER_DAG = [
  { label: 'Mån', värde: 0 },
  { label: 'Tis', värde: 1 },
  { label: 'Ons', värde: 0 },
  { label: 'Tor', värde: 2 },
  { label: 'Fre', värde: 0 },
  { label: 'Lör', värde: 0 },
  { label: 'Sön', värde: 0 },
]

const SENASTE_FEL = [
  { tid: 'Tor 08:12', källa: 'Krisinformation', fel: 'Timeout efter 30 s',        återförsök: 'OK vid retry' },
  { tid: 'Tor 02:00', källa: 'SMHI',            fel: 'HTTP 503 — tillfällig drift', återförsök: 'OK vid retry' },
  { tid: 'Tis 14:37', källa: 'Polisen',         fel: 'Parse-fel: ogiltig XML',     återförsök: 'Manuell åtgärd' },
]

function Stapeldiagram({
  data,
  stapelFärg,
  höjd = 80,
  formattera,
}: {
  data: { label: string; värde: number }[]
  stapelFärg: string
  höjd?: number
  formattera?: (v: number) => string
}) {
  const max = Math.max(...data.map(d => d.värde), 1)
  return (
    <div className="flex items-end gap-2" style={{ height: höjd }}>
      {data.map(d => (
        <div key={d.label} className="flex flex-col items-center gap-1 flex-1 h-full">
          <div className="flex-1 w-full flex items-end">
            <div
              className={`w-full rounded-t-sm ${stapelFärg} transition-all`}
              style={{ height: `${Math.max((d.värde / max) * 100, d.värde > 0 ? 6 : 0)}%` }}
              title={formattera ? formattera(d.värde) : String(d.värde)}
            />
          </div>
          <span className="text-[10px] text-slate-400 leading-none">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function Kort({ titel, sub, children }: { titel: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-900">{titel}</h3>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

export default function Rapporter({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const [felModalÖppen, setFelModalÖppen] = useState(false)

  const notisTotal = NOTIS_PER_KANAL.reduce((s, k) => s + k.antal, 0)
  const notisMax   = Math.max(...NOTIS_PER_KANAL.map(k => k.antal), 1)
  const kallaMax   = Math.max(...NOTIS_PER_KALLA.map(k => k.antal), 1)
  const allvMax    = Math.max(...ALLVARLIGHETSGRAD.map(a => a.antal), 1)

  function hanteraKlick(action: NyckeltalAction) {
    if (action.typ === 'navigera') onNavigate(action.sektion)
    if (action.typ === 'modal')    setFelModalÖppen(true)
  }

  return (
    <div className="flex flex-col gap-6">

      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          Rapporter
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">MOCK</span>
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">Systemstatistik och nyckeltal — uppdateras vid sidladdning.</p>
      </div>

      {/* Nyckeltal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {NYCKELTAL.map(k => {
          const klickbar = k.action.typ !== 'ingen'
          const Wrapper  = klickbar ? 'button' : 'div'
          return (
            <Wrapper
              key={k.label}
              {...(klickbar ? { onClick: () => hanteraKlick(k.action) } : {})}
              className={`relative bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-6 flex flex-col gap-2 items-center text-center ${klickbar ? 'hover:shadow-md hover:border-slate-300 transition-all cursor-pointer' : ''}`}
            >
              {k.action.typ === 'modal' && (
                <span className="absolute top-3 right-3 text-slate-300" title="Öppnar detaljvy">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </span>
              )}
              {k.action.typ === 'navigera' && (
                <span className="absolute top-3 right-3 text-slate-300" title="Navigerar till annan sektion">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                  </svg>
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="text-2xl">{k.ikon}</span>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{k.label}</span>
              </div>
              <p className={`text-4xl font-bold ${k.color}`}>{k.value}</p>
              {k.sub && <p className="text-xs text-slate-400">{k.sub}</p>}
              {k.action.typ === 'navigera' && <p className="text-xs text-violet-500 mt-1">{k.action.etikett}</p>}
              {k.action.typ === 'modal'    && <p className="text-xs text-violet-500 mt-1">Visa detaljer →</p>}
            </Wrapper>
          )
        })}
      </div>

      {/* Modal: fel senaste 7 dagarna */}
      {felModalÖppen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setFelModalÖppen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-xl pointer-events-auto">

              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Fel senaste 7 dagarna</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{SENASTE_FEL.length} felhändelser registrerade</p>
                </div>
                <button
                  onClick={() => setFelModalÖppen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors text-lg"
                >✕</button>
              </div>

              <div className="px-6 py-4 flex flex-col gap-3">
                {SENASTE_FEL.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">{f.källa}</span>
                        <span className="text-xs text-slate-400 font-mono">{f.tid}</span>
                      </div>
                      <p className="text-xs text-slate-600">{f.fel}</p>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${f.återförsök === 'OK vid retry' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {f.återförsök}
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center">
                <button
                  onClick={() => { setFelModalÖppen(false); onNavigate('felsökning') }}
                  className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
                >
                  Visa alla i Felsökning →
                </button>
                <button
                  onClick={() => setFelModalÖppen(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Stäng
                </button>
              </div>

            </div>
          </div>
        </>
      )}

      {/* Användare + Händelser */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Kort titel="Nya användare per dag" sub={`Senaste 7 dagarna — ${DAGAR[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]} denna vecka`}>
          <Stapeldiagram data={ANVANDARE_PER_DAG} stapelFärg="bg-violet-400" höjd={96} />
          <div className="mt-4 flex items-center justify-between text-sm">
            <div>
              <p className="font-semibold text-slate-900">1 284</p>
              <p className="text-xs text-slate-400">Totalt registrerade</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">847</p>
              <p className="text-xs text-slate-400">Aktiva senaste 30 d</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-red-500">3</p>
              <p className="text-xs text-slate-400">Inaktiverade</p>
            </div>
          </div>
        </Kort>

        <Kort titel="Hämtade nyheter från källor" sub="Senaste 7 dagarna">
          <Stapeldiagram
            data={HANDELSER_PER_DAG}
            stapelFärg="bg-sky-400"
            höjd={96}
            formattera={v => v.toLocaleString('sv-SE')}
          />
          <div className="mt-4 flex items-center justify-between text-sm">
            <div>
              <p className="font-semibold text-slate-900">4 827</p>
              <p className="text-xs text-slate-400">Denna vecka</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">847</p>
              <p className="text-xs text-slate-400">Senaste 24 h</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">94 284</p>
              <p className="text-xs text-slate-400">Totalt i databasen</p>
            </div>
          </div>
        </Kort>

      </div>

      {/* Allvarlighetsgrad + Notifieringar per kanal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Kort titel="Händelser per allvarlighetsgrad" sub="Senaste 30 dagarna">
          <div className="flex flex-col gap-3">
            {ALLVARLIGHETSGRAD.map(a => (
              <div key={a.label} className="flex items-center gap-3">
                <span className={`text-xs font-medium w-24 shrink-0 ${a.text}`}>{a.label}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${a.färg}`}
                    style={{ width: `${(a.antal / allvMax) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 w-12 text-right shrink-0">{a.antal.toLocaleString('sv-SE')}</span>
              </div>
            ))}
          </div>
        </Kort>

        <Kort titel="Notifieringar per kanal" sub="Totalt sedan start">
          <div className="flex flex-col gap-4">
            {NOTIS_PER_KANAL.map(k => (
              <div key={k.kanal} className="flex items-center gap-3">
                <span className="text-lg shrink-0">{k.ikon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{k.kanal}</span>
                    <span className="text-xs text-slate-500">
                      {k.antal > 0 ? k.antal.toLocaleString('sv-SE') : 'Ej aktiverat'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${k.färg}`}
                      style={{ width: `${(k.antal / notisMax) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-400 pt-1">
              Totalt: <span className="font-medium text-slate-600">{notisTotal.toLocaleString('sv-SE')}</span> skickade
            </p>
          </div>
        </Kort>

      </div>

      {/* Notifieringar per källa + Fel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Kort titel="Notifieringar per källa" sub="Topp 5 — senaste 30 dagarna">
          <div className="flex flex-col gap-3">
            {NOTIS_PER_KALLA.map((k, i) => (
              <div key={k.namn} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-4 shrink-0 text-center font-mono">{i + 1}</span>
                <span className="text-sm text-slate-700 w-36 shrink-0">{k.namn}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-400"
                    style={{ width: `${(k.antal / kallaMax) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 w-16 text-right shrink-0">{k.antal.toLocaleString('sv-SE')}</span>
              </div>
            ))}
          </div>
        </Kort>

        <Kort titel="Fel i datainsamling" sub="Senaste 7 dagarna">
          <Stapeldiagram data={FEL_PER_DAG} stapelFärg="bg-red-400" höjd={72} />
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Senaste felhändelser</p>
            <div className="flex flex-col gap-2">
              {SENASTE_FEL.map((f, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <span className="text-slate-400 shrink-0 font-mono w-20">{f.tid}</span>
                  <span className="font-medium text-slate-700 shrink-0 w-28">{f.källa}</span>
                  <span className="text-slate-500 flex-1">{f.fel}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full font-medium ${f.återförsök === 'OK vid retry' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {f.återförsök}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => onNavigate('felsökning')}
              className="mt-4 text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
            >
              Visa alla i Felsökning →
            </button>
          </div>
        </Kort>

      </div>

    </div>
  )
}
