import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { KallTyp, Kalla } from '../../../types'
import { RUBRIK, TYPNAMN, nyhetFarg, fmt, groupBy } from './kallorUtils'

function KallaRad({ k, onRemove }: { k: Kalla; onRemove: (id: number) => void }) {
  const navigate = useNavigate()

  function gaTillSystemstatus() {
    navigate('?section=support', { state: { highlightNamn: k.deprecatedAnledning } })
  }

  return (
    <div className="flex items-center justify-between py-2 group">
      <div className="min-w-0">
        <a href={k.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-800 hover:text-violet-600 hover:underline leading-snug transition-colors">{k.namn}</a>
        {k.deprecated ? (
          <button
            onClick={gaTillSystemstatus}
            className="flex items-center gap-1 text-xs mt-0.5 text-amber-500 hover:text-amber-700 transition-colors"
          >
            ⚠️ Planerat underhåll — se systemstatus
          </button>
        ) : (
          <p className={`text-xs mt-0.5 whitespace-nowrap ${nyhetFarg(k.senasteNyhet)}`}>
            Senaste nyhet: {fmt(k.senasteNyhet)}
          </p>
        )}
      </div>
      <button
        onClick={() => onRemove(k.id)}
        className="opacity-0 group-hover:opacity-100 ml-3 shrink-0 px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-all"
      >- Ta bort</button>
    </div>
  )
}

function Kolumn({ typ, sources, children }: { typ: KallTyp; sources: Kalla[]; children: ReactNode }) {
  const active  = sources.filter(k => !k.deprecated)
  const gron    = active.filter(k => nyhetFarg(k.senasteNyhet) === 'text-green-600').length
  const orange  = active.filter(k => nyhetFarg(k.senasteNyhet) === 'text-orange-500').length
  const rod     = active.filter(k => nyhetFarg(k.senasteNyhet) === 'text-red-500').length
  const gra     = sources.filter(k => k.deprecated).length

  return (
    <div className="flex flex-col">
      <div className={`flex items-center justify-between pb-2.5 mb-1 border-b border-slate-100`}>
        <p className={`text-xs font-bold uppercase tracking-wider ${RUBRIK[typ]}`}>{TYPNAMN[typ]}</p>
        {/* DISABLED: källstatistik (totalt, grön/orange/röd/grå) — aktivera vid behov
        <div className="flex items-center gap-2 text-xs font-semibold">
          {([
            { value: sources.length, color: 'text-slate-900',  label: 'Totalt antal aktiva källor' },
            { value: gron,           color: 'text-green-600',  label: 'Uppdaterade senaste 24 timmarna' },
            { value: orange,         color: 'text-orange-500', label: 'Uppdaterade de senaste 7 dagarna' },
            { value: rod,            color: 'text-red-500',    label: 'Inte uppdaterade på mer än 7 dagar' },
            ...(gra > 0 ? [{ value: gra, color: 'text-slate-400', label: 'Källor planerade att tas bort' }] : []),
          ] as { value: number; color: string; label: string }[]).map(({ value, color, label }) => (
            <div key={label} className="relative group/tip cursor-default">
              <span className={color}>{value}</span>
              <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover/tip:block z-50">
                <div className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>
        */}
      </div>
      {children}
    </div>
  )
}

export default function AktivaKallorKort({ sources, onRemove, onDeleteAll, highlightId }: {
  sources:     Kalla[]
  onRemove:    (id: number) => void
  onDeleteAll: () => void
  highlightId: string | null
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const nationella        = sources.filter(k => k.typ === 'Nationell')
  const regionala         = sources.filter(k => k.typ === 'Regional')
  const kommunala         = sources.filter(k => k.typ === 'Kommunal')
  const regionalaByRegion = groupBy(regionala, k => k.region ?? 'Övrigt')

  return (
    <div
      id="aktiva-kallor"
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm h-[523px] flex flex-col ${highlightId === 'aktiva-kallor' ? 'card-highlight' : ''}`}
    >
      <div style={{ padding: '1.5rem 2.5rem 1.25rem' }} className="border-b border-slate-100">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl shrink-0">🗂️</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Aktiva källor</h2>
            <p className="text-sm text-slate-500 mt-0.5">Dessa myndigheter visas i ditt nyhetsflöde</p>
          </div>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-sm font-medium text-slate-700">Inga aktiva källor</p>
          <p className="text-xs text-slate-400 mt-1">Lägg till källor via kortet till vänster</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-3 gap-8">
            <Kolumn typ="Nationell" sources={nationella}>
              {nationella.length === 0
                ? <p className="text-xs text-slate-300 pt-2">Inga nationella källor</p>
                : nationella.map(k => <KallaRad key={k.id} k={k} onRemove={onRemove} />)
              }
            </Kolumn>

            <Kolumn typ="Regional" sources={regionala}>
              {regionala.length === 0
                ? <p className="text-xs text-slate-300 pt-2">Inga regionala källor</p>
                : Object.entries(regionalaByRegion).map(([reg, kallor]) => (
                    <div key={reg} className="mb-3 last:mb-0">
                      <p className="text-xs text-slate-400 font-medium mb-1">{reg}</p>
                      {kallor.map(k => <KallaRad key={k.id} k={k} onRemove={onRemove} />)}
                    </div>
                  ))
              }
            </Kolumn>

            <Kolumn typ="Kommunal" sources={kommunala}>
              {kommunala.length === 0
                ? <p className="text-xs text-slate-300 pt-2">Inga kommunala källor</p>
                : kommunala.map(k => <KallaRad key={k.id} k={k} onRemove={onRemove} />)
              }
            </Kolumn>
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium"
            >
              Radera alla källor
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <p className="text-xs text-slate-600">Är du säker? Detta kan inte ångras.</p>
              <button
                onClick={() => { onDeleteAll(); setShowDeleteConfirm(false) }}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Ja, radera
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
              >
                Avbryt
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
