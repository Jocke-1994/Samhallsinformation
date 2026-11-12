import { useState } from 'react'
import type { Source } from '../../../types'
import { grupperaKallor, representant } from './kallGrupper'

export default function AllaKallorKort({
  sources,
  activeIds,
  onAdd,
  onRemove,
}: {
  sources: Source[]
  activeIds: Set<number>
  onAdd: (ids: number[]) => void
  onRemove?: (ids: number[]) => void
}) {
  const [query, setQuery] = useState('')

  const trimmed = query.trim().toLowerCase()
  // Källor som delar shortName (t.ex. Polisen + Polisen Efterlysningar) visas
  // som EN rad — samma gruppering som Sidebar/AktivaKallorKort.
  const grupper = [...grupperaKallor(sources).values()]
    .map((gruppkallor) => ({
      visningsKalla: representant(gruppkallor),
      gruppIds: gruppkallor.map((k) => k.id),
    }))
    .sort((a, b) => a.visningsKalla.name.localeCompare(b.visningsKalla.name, 'sv'))
  const visade = trimmed
    ? grupper.filter((g) => g.visningsKalla.name.toLowerCase().includes(trimmed))
    : grupper

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-auto sm:h-[523px]">
      <div style={{ padding: '1.5rem 2.5rem 1.25rem' }} className="border-b border-slate-100">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
            🏛️
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Alla källor</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Samtliga tillgängliga myndigheter i systemet
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-slate-100">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Sök källa..."
          className="w-full bg-slate-50 text-slate-900 text-sm px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-violet-400 focus:bg-white placeholder-slate-400 transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {visade.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-400 text-center">Ingen källa hittades.</p>
        ) : (
          visade.map(({ visningsKalla, gruppIds }) => {
            const active = gruppIds.some((id) => activeIds.has(id))
            return (
              <div
                key={visningsKalla.shortName}
                className={`flex items-center justify-between px-6 py-3 gap-4 transition-colors ${active ? '' : 'hover:bg-slate-50'}`}
              >
                <span
                  className={`text-sm font-medium truncate ${active ? 'text-slate-400' : 'text-slate-700'}`}
                >
                  {visningsKalla.name}
                </span>
                {active ? (
                  onRemove ? (
                    <button
                      onClick={() => onRemove(gruppIds)}
                      className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Ta bort
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 font-medium shrink-0">Tillagd</span>
                  )
                ) : (
                  <button
                    onClick={() => onAdd(gruppIds)}
                    className="shrink-0 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    + Lägg till
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
