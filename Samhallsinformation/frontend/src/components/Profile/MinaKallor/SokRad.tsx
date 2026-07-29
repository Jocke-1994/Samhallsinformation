import type { Source } from '../../../types'

export default function SokRad({ k, active, onAdd }: { k: Source; active: boolean; onAdd: (id: number) => void }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2 gap-3 transition-colors ${active ? 'opacity-50' : 'hover:bg-slate-50'}`}>
      <span className="text-sm text-slate-700 truncate">{k.name}</span>
      {active
        ? <span className="text-xs text-green-600 font-medium shrink-0">Tillagd</span>
        : <button onClick={() => onAdd(k.id)} className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors shrink-0">+ Lägg till</button>
      }
    </div>
  )
}
