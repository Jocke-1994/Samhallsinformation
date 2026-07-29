import { useState, useRef, useEffect } from 'react'
import type { Source } from '../../../types'
import SokRad from './SokRad'

export default function LaggTillKort({ sources, activeIds, onAdd }: {
  sources:   Source[]
  activeIds: Set<number>
  onAdd:     (ids: number[]) => void
}) {
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

  function handleAdd(id: number) {
    onAdd([id])
  }

  const trimmed = query.trim().toLowerCase()
  const toShow  = trimmed ? sources.filter(k => k.name.toLowerCase().includes(trimmed)) : []

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div style={{ padding: '1.5rem 2.5rem 1.25rem' }} className="border-b border-slate-100">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">➕</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Lägg till källa</h2>
            <p className="text-sm text-slate-500 mt-0.5">Sök efter en myndighet</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '1.25rem 2rem' }} className="flex flex-col gap-2">
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
                  {toShow.map(k => <SokRad key={k.id} k={k} active={activeIds.has(k.id)} onAdd={handleAdd} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
