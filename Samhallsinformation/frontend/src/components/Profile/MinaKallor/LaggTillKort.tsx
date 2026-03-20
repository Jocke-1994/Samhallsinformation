import { useState, useRef, useEffect } from 'react'
import type { SparFilter, Kalla } from '../../../types'
import { KALLOR, SPAR_FORSLAG, groupBy } from './kallorUtils'
import SparModal from './SparModal'
import SokRad from './SokRad'

export default function LaggTillKort({ activeIds, onAdd }: { activeIds: Set<number>; onAdd: (ids: number[]) => void }) {
  const [sparLoading,  setSparLoading]  = useState<SparFilter | null>(null)
  const [sparErrors,   setSparErrors]   = useState<Partial<Record<SparFilter, string>>>({})
  const [sparModal,    setSparModal]    = useState<{ nationella: Kalla[]; regionala: Kalla[] } | null>(null)
  const [sparSelected, setSparSelected] = useState<Set<number>>(new Set())
  const [query,        setQuery]        = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowDropdown(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function handleSpar(filter: SparFilter) {
    setSparLoading(filter)
    setSparErrors({})
    setTimeout(() => {
      setSparLoading(null)
      const ids = SPAR_FORSLAG[filter].filter(id => !activeIds.has(id))
      if (ids.length === 0) {
        const msg =
          filter === 'Regionalt'  ? 'Inga nya regionala källor hittades.' :
          filter === 'Nationellt' ? 'Inga nya nationella källor hittades.' :
                                    'Inga nya källor hittades via SPAR.'
        setSparErrors({ [filter]: msg })
        return
      }
      const sources    = KALLOR.filter(k => ids.includes(k.id))
      const nationella = sources.filter(k => k.typ === 'Nationell')
      const regionala  = sources.filter(k => k.typ !== 'Nationell')
      setSparModal({ nationella, regionala })
      setSparSelected(new Set(ids))
    }, 1200)
  }

  function handleSparConfirm() {
    onAdd([...sparSelected])
    setSparModal(null)
    setSparSelected(new Set())
  }

  function handleAdd(id: number) {
    onAdd([id])
  }

  const trimmed          = query.trim().toLowerCase()
  const matched          = trimmed ? KALLOR.filter(k => k.namn.toLowerCase().includes(trimmed)) : []
  const toShow           = matched
  const nationellaSearch = toShow.filter(k => k.typ === 'Nationell')
  const regionalaSearch  = toShow.filter(k => k.typ === 'Regional')
  const kommunalaSearch  = toShow.filter(k => k.typ === 'Kommunal')
  const regionalaByOrt   = groupBy(regionalaSearch, k => k.ort ?? k.region ?? 'Övrigt')
  const kommunalaByOrt   = groupBy(kommunalaSearch, k => k.ort ?? k.region ?? 'Övrigt')

  const FILTER_KNAPPAR: SparFilter[] = ['Allt', 'Nationellt', 'Regionalt']

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div style={{ padding: '1.5rem 2.5rem 1.25rem' }} className="border-b border-slate-100">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">➕</div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Lägg till källa</h2>
              <p className="text-sm text-slate-500 mt-0.5">Hämta via SPAR eller sök manuellt</p>
            </div>
          </div>
        </div>

        <div style={{ padding: '1.25rem 2rem' }} className="flex flex-col gap-6">
          {/* ── Automatisk hämtning ── */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-slate-700">Automatisk hämtning</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Hämtar källor baserat på din folkbokföringsadress. Välj vilken typ av källor du vill hämta.
            </p>
            <div className="flex flex-col gap-2">
              {FILTER_KNAPPAR.map(f => (
                <div key={f} className="flex flex-col gap-1">
                  <button
                    onClick={() => handleSpar(f)}
                    disabled={sparLoading !== null}
                    className="w-full px-4 py-2 bg-violet-50 hover:bg-violet-100 disabled:opacity-50 text-violet-700 text-sm font-semibold rounded-xl border border-violet-100 transition-all flex items-center justify-center gap-1.5"
                  >
                    {sparLoading === f ? (
                      <>
                        <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                        Hämtar...
                      </>
                    ) : f}
                  </button>
                  {sparErrors[f] && (
                    <p className="text-xs text-red-500">{sparErrors[f]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-300 font-medium">eller</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* ── Manuell sökning ── */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-slate-700">Sök manuellt</p>
            <div className="relative" ref={searchRef}>
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Sök efter källa..."
                className="w-full bg-slate-50 text-slate-900 text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-violet-400 focus:bg-white placeholder-slate-400 transition-colors"
              />
              {showDropdown && trimmed.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                  {toShow.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">Ingen källa hittades.</p>
                  ) : (
                    <div className="py-1">
                      {([
                        { label: 'Nationellt', color: 'text-blue-600',   items: nationellaSearch, byOrt: null },
                        { label: 'Regionalt',  color: 'text-green-600',  items: regionalaSearch,  byOrt: regionalaByOrt },
                        { label: 'Kommunalt',  color: 'text-yellow-500', items: kommunalaSearch,  byOrt: kommunalaByOrt },
                      ] as { label: string; color: string; items: Kalla[]; byOrt: Record<string, Kalla[]> | null }[])
                        .filter(s => s.items.length > 0)
                        .map(s => (
                          <div key={s.label}>
                            <p className={`px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-wider ${s.color}`}>{s.label}</p>
                            {s.byOrt
                              ? Object.entries(s.byOrt).map(([ort, kallor]) => (
                                  <div key={ort}>
                                    <p className="px-4 py-1 text-xs text-slate-400">{ort}</p>
                                    {kallor.map(k => <SokRad key={k.id} k={k} active={activeIds.has(k.id)} onAdd={handleAdd} />)}
                                  </div>
                                ))
                              : s.items.map(k => <SokRad key={k.id} k={k} active={activeIds.has(k.id)} onAdd={handleAdd} />)
                            }
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {sparModal && (
        <SparModal
          nationella={sparModal.nationella}
          regionala={sparModal.regionala}
          selected={sparSelected}
          onToggle={id => setSparSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })}
          onConfirm={handleSparConfirm}
          onClose={() => { setSparModal(null); setSparSelected(new Set()) }}
        />
      )}
    </>
  )
}
