import { useState } from 'react'
import type { AllaFlik, KallTyp } from '../../../types'
import { KALLOR, DOT, TYPNAMN, arNy } from './kallorUtils'

export default function AllaKallorKort({ activeIds, onAdd }: { activeIds: Set<number>; onAdd: (ids: number[]) => void }) {
  const [aktivFlik, setAktivFlik] = useState<AllaFlik>('Alla')
  const [query,     setQuery]     = useState('')

  const nya    = KALLOR.filter(arNy)
  const FLIKAR: AllaFlik[] = ['Alla', 'Nya', 'Nationell', 'Regional', 'Kommunal']

  function basLista() {
    if (aktivFlik === 'Alla') return KALLOR
    if (aktivFlik === 'Nya')  return nya
    return KALLOR.filter(k => k.typ === aktivFlik)
  }

  const trimmed = query.trim().toLowerCase()
  const visade  = trimmed ? basLista().filter(k => k.namn.toLowerCase().includes(trimmed)) : basLista()

  function flikCount(f: AllaFlik) {
    if (f === 'Alla') return KALLOR.length
    if (f === 'Nya')  return nya.length
    return KALLOR.filter(k => k.typ === f).length
  }

  const activeStyles: Record<AllaFlik, string> = {
    'Alla':      'bg-violet-600 text-white',
    'Nya':       'bg-rose-500 text-white',
    'Nationell': 'bg-blue-500 text-white',
    'Regional':  'bg-emerald-500 text-white',
    'Kommunal':  'bg-yellow-400 text-white',
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[523px]">
      <div style={{ padding: '1.5rem 2.5rem 1.25rem' }} className="border-b border-slate-100">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">🏛️</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Alla källor</h2>
            <p className="text-sm text-slate-500 mt-0.5">Samtliga tillgängliga myndigheter i systemet</p>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-100">
        {FLIKAR.map(f => {
          const isActive = aktivFlik === f
          const label = f === 'Alla' ? 'Alla' : f === 'Nya' ? 'Nya' : TYPNAMN[f as KallTyp]
          return (
            <button
              key={f}
              onClick={() => { setAktivFlik(f); setQuery('') }}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                isActive ? activeStyles[f] : 'bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="block">{label}</span>
              <span className="block text-[11px] mt-0.5 opacity-80">{flikCount(f)}</span>
            </button>
          )
        })}
      </div>

      <div className="px-4 py-3 border-b border-slate-100">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Sök källa..."
          className="w-full bg-slate-50 text-slate-900 text-sm px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-violet-400 focus:bg-white placeholder-slate-400 transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {visade.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-400 text-center">Ingen källa hittades.</p>
        ) : visade.map(k => {
          const active = activeIds.has(k.id)
          return (
            <div key={k.id} className={`flex items-center justify-between px-6 py-3 gap-4 transition-colors ${active ? '' : 'hover:bg-slate-50'}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[k.typ]}`} />
                <span className={`text-sm font-medium truncate ${active ? 'text-slate-400' : 'text-slate-700'}`}>{k.namn}</span>
              </div>
              {active
                ? <span className="text-xs text-green-600 font-medium shrink-0">Tillagd</span>
                : <button
                    onClick={() => onAdd([k.id])}
                    className="shrink-0 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    + Lägg till
                  </button>
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}
