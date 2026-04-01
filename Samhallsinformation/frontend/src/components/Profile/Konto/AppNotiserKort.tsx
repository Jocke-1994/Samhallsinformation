import { useState } from 'react'
import Toggle from '../../common/Toggle'

const STORAGE_KEY = 'app_notiser'

interface Kanal {
  mail: boolean
  sms: boolean
}

interface AppNotiser {
  nyVersionLive: Kanal
  nyVersionPavag: Kanal
}

const DEFAULT: AppNotiser = {
  nyVersionLive: { mail: true, sms: false },
  nyVersionPavag: { mail: true, sms: false },
}

function load(): AppNotiser {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT
}

function save(state: AppNotiser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const RADER: { key: keyof AppNotiser; label: string; beskrivning: string }[] = [
  {
    key: 'nyVersionLive',
    label: 'Ny version är live',
    beskrivning: 'När en ny version av appen har landat.',
  },
  {
    key: 'nyVersionPavag',
    label: 'Ny version är på väg',
    beskrivning: 'När en kommande version är annonserad.',
  },
]

export default function AppNotiserKort() {
  const [state, setState] = useState<AppNotiser>(load)

  function toggle(key: keyof AppNotiser, kanal: keyof Kanal) {
    const next = { ...state, [key]: { ...state[key], [kanal]: !state[key][kanal] } }
    setState(next)
    save(next)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">🔔</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">App-notiser</h2>
            <p className="text-sm text-slate-500 mt-0.5">Notiser om versioner och uppdateringar</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-2">
        {/* Kolumnrubriker */}
        <div className="flex items-center py-3 border-b border-slate-100">
          <div className="flex-1" />
          <div className="flex gap-6 shrink-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest w-10 text-center">Mail</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest w-10 text-center">SMS</span>
          </div>
        </div>

        {RADER.map(({ key, label, beskrivning }) => (
          <div key={key} className="flex items-center gap-4 py-4 border-b border-slate-100 last:border-0">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{beskrivning}</p>
            </div>
            <div className="flex gap-6 shrink-0">
              <div className="w-10 flex justify-center">
                <Toggle on={state[key].mail} onChange={() => toggle(key, 'mail')} />
              </div>
              <div className="w-10 flex justify-center">
                <Toggle on={state[key].sms} onChange={() => toggle(key, 'sms')} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
