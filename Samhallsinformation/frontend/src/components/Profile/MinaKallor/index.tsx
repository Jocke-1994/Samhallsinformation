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
    <div className="flex gap-6 mt-6 items-start">
      <div className="w-80 shrink-0">
        <LaggTillKort activeIds={activeIds} onAdd={handleAdd} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        <AktivaKallorKort
          sources={activeSources}
          onRemove={handleRemove}
          onDeleteAll={() => setActiveIds(new Set())}
          highlightId={highlightId}
        />
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <RekommenderadeKallorKort activeIds={activeIds} onAdd={handleAdd} />
          </div>
          <div className="flex-1 min-w-0">
            <AllaKallorKort activeIds={activeIds} onAdd={handleAdd} />
          </div>
        </div>
      </div>
    </div>
  )
}
