import SourceRow, { type Source, type SourceSettings } from './SourceRow'

const DEFAULT: SourceSettings = { mail: true, sms: false, frekvens: 'direkt' }

export default function SourceGroup({ label, sources, settings, onChangeSingle, onBulkSelect, undoSnapshot, onUndo }: {
  label: string
  sources: Source[]
  settings: Record<number, SourceSettings>
  onChangeSingle: (id: number, s: SourceSettings) => void
  onBulkSelect: () => void
  undoSnapshot: Record<number, SourceSettings> | null
  onUndo: () => void
}) {
  const allSelected = sources.every(s => settings[s.id]?.mail && settings[s.id]?.sms)

  return (
    <div>
      <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</p>
        <button
          onClick={onBulkSelect}
          className="text-xs font-medium text-violet-600 hover:text-violet-500 transition-colors"
        >
          {allSelected ? 'Avmarkera alla' : 'Välj alla'}
        </button>
        {undoSnapshot && (
          <button onClick={onUndo} className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
            ↩ Ångra
          </button>
        )}
      </div>
      {sources.map(source => (
        <SourceRow
          key={source.id}
          source={source}
          settings={settings[source.id] ?? DEFAULT}
          onChange={s => onChangeSingle(source.id, s)}
        />
      ))}
    </div>
  )
}
