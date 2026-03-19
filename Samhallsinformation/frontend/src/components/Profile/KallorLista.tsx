import { useState } from 'react'

type Frekvens = 'direkt' | 'daglig' | 'veckovis'

interface SourceSettings {
  mail: boolean
  sms: boolean
  frekvens: Frekvens
}

interface Source {
  id: number
  name: string
}

const STADER = ['Göteborg', 'Stockholm', 'Malmö', 'Uppsala']
const LAN = ['Västra Götaland', 'Stockholms län', 'Skåne', 'Uppsala län']

const NATIONAL_SOURCES: Source[] = [
  { id: 1, name: 'Polisen' },
  { id: 2, name: 'SMHI' },
  { id: 3, name: 'MSB' },
  { id: 4, name: 'Trafikverket' },
]

const STAD_SOURCES: Record<string, Source[]> = {
  Göteborg:  [{ id: 10, name: 'Polisen Göteborg' }, { id: 11, name: 'Trafikverket Göteborg' }, { id: 12, name: 'Göteborgs Stad' }, { id: 13, name: 'Västtrafik' }],
  Stockholm: [{ id: 20, name: 'Polisen Stockholm' }, { id: 21, name: 'SL' }, { id: 22, name: 'Stockholms stad' }],
  Malmö:     [{ id: 30, name: 'Polisen Malmö' }, { id: 31, name: 'Malmö stad' }],
  Uppsala:   [{ id: 40, name: 'Polisen Uppsala' }, { id: 41, name: 'Uppsala kommun' }],
}

const LAN_SOURCES: Record<string, Source[]> = {
  'Västra Götaland': [{ id: 50, name: 'Länsstyrelsen Västra Götaland' }, { id: 51, name: 'Västra Götalandsregionen' }],
  'Stockholms län':  [{ id: 60, name: 'Länsstyrelsen Stockholm' }, { id: 61, name: 'Region Stockholm' }],
  'Skåne':           [{ id: 70, name: 'Länsstyrelsen Skåne' }, { id: 71, name: 'Region Skåne' }],
  'Uppsala län':     [{ id: 80, name: 'Länsstyrelsen Uppsala' }, { id: 81, name: 'Region Uppsala' }],
}

const DEFAULT: SourceSettings = { mail: true, sms: false, frekvens: 'direkt' }
const ALL: Source[] = [...NATIONAL_SOURCES, ...Object.values(STAD_SOURCES).flat(), ...Object.values(LAN_SOURCES).flat()]

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-8 h-4 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ${on ? 'bg-violet-600' : 'bg-slate-200'}`}
    >
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

function SourceRow({ source, settings, onChange }: {
  source: Source
  settings: SourceSettings
  onChange: (s: SourceSettings) => void
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group">
      <p className="text-sm font-medium text-slate-800 min-w-[160px]">{source.name}</p>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <Toggle on={settings.mail} onChange={v => onChange({ ...settings, mail: v })} />
          <span className="text-xs text-slate-400 w-7">Mail</span>
        </div>
        <div className="flex items-center gap-2">
          <Toggle on={settings.sms} onChange={v => onChange({ ...settings, sms: v })} />
          <span className="text-xs text-slate-400 w-7">SMS</span>
        </div>
        <select
          value={settings.frekvens}
          onChange={e => onChange({ ...settings, frekvens: e.target.value as Frekvens })}
          className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1.5 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer"
        >
          <option value="direkt">Direkt</option>
          <option value="daglig">Daglig</option>
          <option value="veckovis">Veckovis</option>
        </select>
      </div>
    </div>
  )
}

function SourceGroup({ label, sources, settings, onChangeSingle, onBulkSelect, undoSnapshot, onUndo }: {
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

export default function KallorLista() {
  const [selectedStad, setSelectedStad] = useState('')
  const [selectedLan, setSelectedLan] = useState('')
  const [settings, setSettings] = useState<Record<number, SourceSettings>>(() =>
    Object.fromEntries(ALL.map(s => [s.id, { ...DEFAULT }]))
  )
  const [undoSnapshots, setUndoSnapshots] = useState<Record<string, Record<number, SourceSettings>>>({})

  function updateSingle(id: number, s: SourceSettings, groupLabel: string) {
    setSettings(prev => ({ ...prev, [id]: s }))
    setUndoSnapshots(prev => { const n = { ...prev }; delete n[groupLabel]; return n })
  }

  function bulkSelect(groupLabel: string, sources: Source[]) {
    const allSelected = sources.every(s => settings[s.id]?.mail && settings[s.id]?.sms)
    const snapshot = Object.fromEntries(sources.map(s => [s.id, { ...settings[s.id] }]))
    setUndoSnapshots(prev => ({ ...prev, [groupLabel]: snapshot }))
    setSettings(prev => {
      const next = { ...prev }
      sources.forEach(s => { next[s.id] = { ...prev[s.id], mail: !allSelected, sms: !allSelected } })
      return next
    })
  }

  function undo(groupLabel: string) {
    const snapshot = undoSnapshots[groupLabel]
    if (!snapshot) return
    setSettings(prev => ({ ...prev, ...snapshot }))
    setUndoSnapshots(prev => { const n = { ...prev }; delete n[groupLabel]; return n })
  }

  const groups = [
    { label: 'Nationellt', sources: NATIONAL_SOURCES },
    ...(selectedStad && STAD_SOURCES[selectedStad] ? [{ label: selectedStad, sources: STAD_SOURCES[selectedStad] }] : []),
    ...(selectedLan && LAN_SOURCES[selectedLan] ? [{ label: selectedLan, sources: LAN_SOURCES[selectedLan] }] : []),
  ]

  const selectClass = "bg-slate-100 text-slate-700 text-sm px-3 py-2 rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-violet-400 cursor-pointer"

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">🔔</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Källinställningar</h2>
            <p className="text-sm text-slate-500 mt-0.5">Styr mail, SMS och frekvens per källa</p>
          </div>
        </div>
      </div>

      {/* Geo-filter */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stad</label>
          <select value={selectedStad} onChange={e => setSelectedStad(e.target.value)} className={selectClass}>
            <option value="">Alla städer</option>
            {STADER.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Län</label>
          <select value={selectedLan} onChange={e => setSelectedLan(e.target.value)} className={selectClass}>
            <option value="">Alla län</option>
            {LAN.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Kolumnrubriker */}
      <div className="flex items-center justify-between px-5 py-2 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Källa</span>
        <div className="flex items-center gap-5 pr-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest w-16 text-center">Mail</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest w-16 text-center">SMS</span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest w-16 text-center">Frekvens</span>
        </div>
      </div>

      {/* Källista */}
      <div className="divide-y divide-slate-50">
        {groups.map(group => (
          <SourceGroup
            key={group.label}
            label={group.label}
            sources={group.sources}
            settings={settings}
            onChangeSingle={(id, s) => updateSingle(id, s, group.label)}
            onBulkSelect={() => bulkSelect(group.label, group.sources)}
            undoSnapshot={undoSnapshots[group.label] ?? null}
            onUndo={() => undo(group.label)}
          />
        ))}
      </div>

    </div>
  )
}
