import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { KALLOR } from './kallorUtils'
import LaggTillKort from './LaggTillKort'
import AktivaKallorKort from './AktivaKallorKort'
import RekommenderadeKallorKort from './RekommenderadeKallorKort'
import AllaKallorKort from './AllaKallorKort'

export default function MinaKallor() {
  const [activeIds, setActiveIds] = useState<Set<number>>(new Set([1, 2, 3, 6]))
  const location    = useLocation()
  const [highlightId, setHighlightId] = useState<string | null>(location.state?.highlightId ?? null)

  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), 4200)
    return () => clearTimeout(t)
  }, [highlightId])

  function handleAdd(ids: number[]) {
    setActiveIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n })
  }

  function handleRemove(id: number) {
    setActiveIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const activeSources = KALLOR.filter(k => activeIds.has(k.id))

  return (
    <div className="flex flex-col gap-6 mt-6">

      {/* Övre rad: Lägg till + Aktiva */}
      <div className="flex gap-6 items-start">
        <div className="w-80 shrink-0">
          <LaggTillKort activeIds={activeIds} onAdd={handleAdd} />
        </div>
        <div className="flex-1 min-w-0">
          <AktivaKallorKort
            sources={activeSources}
            onRemove={handleRemove}
            onDeleteAll={() => setActiveIds(new Set())}
            highlightId={highlightId}
          />
        </div>
      </div>

      {/* Nedre rad: Rekommenderade + Alla */}
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          <RekommenderadeKallorKort activeIds={activeIds} onAdd={handleAdd} />
        </div>
        <div className="flex-1 min-w-0">
          <AllaKallorKort activeIds={activeIds} onAdd={handleAdd} />
        </div>
      </div>

      {/* ── Experimentkort ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Experimentkort</h2>
        <p className="text-sm text-slate-400 mb-6">Testyta för knappar, badges och layouter.</p>

        <div className="flex flex-col gap-8">

          {/* Knappar */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Knappar</p>
            <div className="flex flex-wrap gap-3 items-center">
              <button className="px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg">Liten</button>
              <button className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg">Medium</button>
              <button className="px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-lg">Stor</button>
              <button className="px-4 py-2 border border-violet-600 text-violet-600 text-sm font-semibold rounded-lg">Outline</button>
              <button className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg">Neutral</button>
              <button className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg">Destructive</button>
            </div>
          </div>

          {/* Badges */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Badges</p>
            <div className="flex flex-wrap gap-3 items-center">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Nationell</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">Regional</span>
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">Kommunal</span>
              <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full">Aktiv</span>
              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold rounded-full">Hög prioritet</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full">Inaktiv</span>
            </div>
          </div>

          {/* Källrader */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Källrad — varianter</p>
            <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
              {/* Variant A — enkel */}
              <div className="flex items-center justify-between px-5 py-4 gap-4 hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-700">SMHI</span>
                <button className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg">+ Lägg till</button>
              </div>
              {/* Variant B — med underkategori */}
              <div className="flex items-center justify-between px-5 py-4 gap-4 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-700">MSB</p>
                  <p className="text-xs text-slate-400 mt-0.5">Nationell</p>
                </div>
                <button className="px-[16px] py-[6px] mr-[6px] bg-violet-600 text-white text-base font-semibold rounded-full">+ Lägg till</button>
              </div>
              {/* Variant C — med badge */}
              <div className="flex items-center justify-between px-5 py-4 gap-4 hover:bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-medium text-slate-700">Polisen</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Nationell</span>
                </div>
                <button className="px-4 py-2 bg-white text-slate-900 text-sm font-semibold rounded-full border border-slate-300 shadow-sm">+ Lägg till</button>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
