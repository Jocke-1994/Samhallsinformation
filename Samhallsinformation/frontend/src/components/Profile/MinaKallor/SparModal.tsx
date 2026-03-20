import type { Kalla } from '../../../types'
import { DOT } from './kallorUtils'

export default function SparModal({ nationella, regionala, selected, onToggle, onConfirm, onClose }: {
  nationella: Kalla[]
  regionala:  Kalla[]
  selected:   Set<number>
  onToggle:   (id: number) => void
  onConfirm:  () => void
  onClose:    () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Källor hittade via SPAR</h3>
            <p className="text-xs text-slate-400 mt-0.5">Välj vilka du vill lägga till</p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 text-xl leading-none transition-colors">×</button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-6 max-h-80 overflow-y-auto">
          {nationella.length > 0 && (
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Nationella</p>
              <div className="flex flex-col gap-2.5">
                {nationella.map(k => (
                  <label key={k.id} className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" checked={selected.has(k.id)} onChange={() => onToggle(k.id)} className="accent-violet-600 w-4 h-4 shrink-0" />
                    <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[k.typ]}`} />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">{k.namn}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {regionala.length > 0 && (
            <div>
              <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-3">Regionala</p>
              <div className="flex flex-col gap-2.5">
                {regionala.map(k => (
                  <label key={k.id} className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" checked={selected.has(k.id)} onChange={() => onToggle(k.id)} className="accent-violet-600 w-4 h-4 shrink-0" />
                    <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[k.typ]}`} />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900">{k.namn}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onConfirm}
            disabled={selected.size === 0}
            className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all"
          >
            Lägg till ({selected.size})
          </button>
          <button onClick={onClose} className="px-5 py-2.5 text-sm text-slate-500 hover:text-slate-800 rounded-xl transition-colors">
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}
