import Toggle from '../../common/Toggle'

type Frekvens = 'direkt' | 'daglig' | 'veckovis'

export interface SourceSettings {
  mail: boolean
  sms: boolean
  frekvens: Frekvens
}

export interface Source {
  id: number
  name: string
}

export default function SourceRow({ source, settings, onChange }: {
  source: Source
  settings: SourceSettings
  onChange: (s: SourceSettings) => void
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group">
      <p className="text-sm font-medium text-slate-800 min-w-[160px]">{source.name}</p>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <Toggle small on={settings.mail} onChange={v => onChange({ ...settings, mail: v })} />
          <span className="text-xs text-slate-400 w-7">Mail</span>
        </div>
        <div className="flex items-center gap-2">
          <Toggle small on={settings.sms} onChange={v => onChange({ ...settings, sms: v })} />
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
