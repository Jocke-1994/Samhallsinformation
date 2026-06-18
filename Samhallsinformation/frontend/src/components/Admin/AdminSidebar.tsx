import { useNavigate } from 'react-router-dom'

export type AdminSection =
  | 'oversikt'
  | 'kallor'
  | 'sandlada'
  | 'uppdateringar'
  | 'faq'
  | 'anvandare'
  | 'support-inbox'
  | 'aktivitetslogg'
  | 'rapporter'
  | 'felsökning'
  | 'impersonation'
  | 'feature-flags'

export type AdminRoll = 'Admin' | 'Support'

const NAV: { key: AdminSection; label: string; ikon: string; roller: AdminRoll[] }[] = [
  { key: 'oversikt',       label: 'Översikt',         ikon: '🏠', roller: ['Admin'] },
  { key: 'kallor',         label: 'Källhantering',     ikon: '📡', roller: ['Admin'] },
  { key: 'sandlada',       label: 'Sandlåda',          ikon: '🧪', roller: ['Admin'] },
  { key: 'uppdateringar',  label: 'Uppdateringar',     ikon: '📝', roller: ['Admin'] },
  { key: 'faq',            label: 'FAQ-hantering',     ikon: '❓', roller: ['Admin'] },
  { key: 'anvandare',      label: 'Användare',         ikon: '👥', roller: ['Admin', 'Support'] },
  { key: 'support-inbox',  label: 'Support-inbox',     ikon: '🎫', roller: ['Admin', 'Support'] },
  { key: 'aktivitetslogg', label: 'Aktivitetslogg',    ikon: '📋', roller: ['Admin'] },
  { key: 'rapporter',      label: 'Rapporter',         ikon: '📊', roller: ['Admin'] },
  { key: 'felsökning',     label: 'Felsökning',        ikon: '🔧', roller: ['Admin'] },
  { key: 'impersonation',  label: 'Impersonation',  ikon: '🎭', roller: ['Admin'] },
  { key: 'feature-flags',  label: 'Feature flags',  ikon: '🚩', roller: ['Admin'] },
]

export default function AdminSidebar({
  active,
  onSelect,
  roll,
}: {
  active: AdminSection
  onSelect: (s: AdminSection) => void
  roll: AdminRoll
}) {
  const navigate = useNavigate()
  const synliga = NAV.filter(item => item.roller.includes(roll))

  return (
    <div className="w-64 h-screen bg-slate-900 flex flex-col shrink-0">

      {/* Logo / titel */}
      <div className="px-6 py-6 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {roll === 'Support' ? 'S' : 'A'}
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{roll}</p>
            <p className="text-xs text-slate-400 leading-tight">Samhällsinformation</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {synliga.map(item => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left w-full ${
              active === item.key
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-base">{item.ikon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-700">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors w-full"
        >
          <span>←</span>
          Tillbaka till sajten
        </button>
      </div>

    </div>
  )
}
