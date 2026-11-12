import { useTheme, type Theme } from '../../../context/ThemeContext'

const THEMES: { id: Theme; label: string; color: string; textColor: string }[] = [
  { id: 'true-black', label: 'True Black', color: '#000000', textColor: '#f8fafc' },
  { id: 'dark', label: 'Dark', color: '#1e293b', textColor: '#f1f5f9' },
  { id: 'tan', label: 'Dune', color: '#f0e4c8', textColor: '#2c1a0e' },
  { id: 'light', label: 'Light', color: '#f8fafc', textColor: '#0f172a' },
]

export default function ThemeKort() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">
            🎨
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Utseende</h2>
            <p className="text-sm text-slate-500 mt-0.5">Välj ett tema</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 grid grid-cols-2 gap-3">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            style={{ backgroundColor: t.color, color: t.textColor }}
            className={`relative h-16 rounded-xl border-2 text-xs font-semibold transition-all duration-150 ${
              theme === t.id
                ? 'border-violet-500 scale-[1.03] shadow-md'
                : 'border-slate-200 hover:border-slate-300 hover:scale-[1.02]'
            }`}
          >
            {t.label}
            {theme === t.id && (
              <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-violet-500 flex items-center justify-center">
                <svg
                  className="w-2 h-2 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
