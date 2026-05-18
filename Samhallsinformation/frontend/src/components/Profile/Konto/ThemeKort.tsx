import { useTheme } from '../../../context/ThemeContext'

export default function ThemeKort() {
  const { dark, toggle } = useTheme()

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">
            {dark ? '🌙' : '☀️'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Utseende</h2>
            <p className="text-sm text-slate-500 mt-0.5">Ljust eller mörkt läge</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700">{dark ? 'Mörkt läge' : 'Ljust läge'}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {dark ? 'Appen visas med mörk bakgrund.' : 'Appen visas med ljus bakgrund.'}
          </p>
        </div>
        <button
          onClick={toggle}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${dark ? 'bg-violet-600' : 'bg-slate-200'}`}
          role="switch"
          aria-checked={dark}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform duration-200 ${dark ? 'translate-x-6' : 'translate-x-0'}`} style={{ backgroundColor: 'white' }} />
        </button>
      </div>
    </div>
  )
}
