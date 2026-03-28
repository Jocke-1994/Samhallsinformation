import { useState } from 'react'
import type { RekFlik } from '../../../types'
import { KALLOR, ORSAK, DOT, TYPNAMN } from './kallorUtils'

export default function RekommenderadeKallorKort({ activeIds, onAdd }: { activeIds: Set<number>; onAdd: (ids: number[]) => void }) {
  const [expanded,   setExpanded]   = useState<number | null>(null)
  const [aktivFlik,  setAktivFlik]  = useState<RekFlik>('Alla')

  const rekommenderade = KALLOR.filter(k => ORSAK[k.id] && !activeIds.has(k.id))

  if (rekommenderade.length === 0) return null

  const FLIKAR: RekFlik[] = ['Alla', 'Nationell', 'Regional', 'Kommunal']
  const visade = aktivFlik === 'Alla' ? rekommenderade : rekommenderade.filter(k => k.typ === aktivFlik)

  function flikLabel(f: RekFlik) {
    if (f === 'Alla') return 'Alla'
    return TYPNAMN[f]
  }

  function flikCount(f: RekFlik) {
    return f === 'Alla' ? rekommenderade.length : rekommenderade.filter(k => k.typ === f).length
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div style={{ padding: '1.5rem 2.5rem 1.25rem' }} className="border-b border-slate-100">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl shrink-0">⭐</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Rekommenderade källor</h2>
            <p className="text-sm text-slate-500 mt-0.5">Baserat på dina nuvarande aktiva källor</p>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-100">
        {FLIKAR.filter(f => f === 'Alla' || flikCount(f) > 0).map(f => {
          const isActive = aktivFlik === f
          const activeStyles: Record<RekFlik, string> = {
            'Alla':       'bg-violet-600 text-white',
            'Nationell':  'bg-blue-500 text-white',
            'Regional':   'bg-emerald-500 text-white',
            'Kommunal':   'bg-yellow-400 text-white',
          }
          return (
            <button
              key={f}
              onClick={() => { setAktivFlik(f); setExpanded(null) }}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                isActive
                  ? activeStyles[f]
                  : 'bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="block">{flikLabel(f)}</span>
              <span className="block text-[11px] mt-0.5 opacity-80">{flikCount(f)}</span>
            </button>
          )
        })}
      </div>

      <div className="divide-y divide-slate-100">
        {visade.map(k => (
          <div key={k.id}>
            <div className="flex items-center justify-between px-6 py-5 hover:bg-slate-50 transition-colors gap-4">
              <button
                onClick={() => setExpanded(expanded === k.id ? null : k.id)}
                className="flex items-center gap-2.5 min-w-0 text-left flex-1"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[k.typ]}`} />
                <span className="text-sm font-medium text-slate-700">{k.namn}</span>
                <span className="text-slate-300 text-xs ml-1">{expanded === k.id ? '▴' : '▾'}</span>
              </button>
              <button
                onClick={() => { onAdd([k.id]); setExpanded(null) }}
                className="shrink-0 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                + Lägg till
              </button>
            </div>
            {expanded === k.id && (
              <div className="px-6 pb-4 pt-2 bg-slate-50 border-t border-slate-100">
                <p className="text-xs text-slate-500 leading-relaxed">{ORSAK[k.id]}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
