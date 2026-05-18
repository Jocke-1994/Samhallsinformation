import { useNavigate } from 'react-router-dom'

export type AdminSection =
  | 'oversikt'
  | 'kallor'
  | 'uppdateringar'
  | 'anvandare'
  | 'support-inbox'
  | 'aktivitetslogg'
  | 'rapporter'
  | 'felsökning'
  | 'impersonation'

const NAV: { key: AdminSection; label: string; ikon: string }[] = [
  { key: 'oversikt',       label: 'Översikt',         ikon: '🏠' },
  { key: 'kallor',         label: 'Källhantering',     ikon: '📡' },
  { key: 'uppdateringar',  label: 'Uppdateringar',     ikon: '📝' },
  { key: 'anvandare',      label: 'Användare',         ikon: '👥' },
  { key: 'support-inbox',  label: 'Support-inbox',     ikon: '🎫' },
  { key: 'aktivitetslogg', label: 'Aktivitetslogg',    ikon: '📋' },
  { key: 'rapporter',      label: 'Rapporter',         ikon: '📊' },
  { key: 'felsökning',     label: 'Felsökning',        ikon: '🔧' },
  { key: 'impersonation',  label: 'Impersonation',     ikon: '🎭' },
]

export default function AdminSidebar({
  active,
  onSelect,
}: {
  active: AdminSection
  onSelect: (s: AdminSection) => void
}) {
  const navigate = useNavigate()

  return (
    <div className="w-64 h-screen bg-slate-900 flex flex-col shrink-0">

      {/* Logo / titel */}
      <div className="px-6 py-6 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0">A</div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Admin</p>
            <p className="text-xs text-slate-400 leading-tight">Samhällsinformation</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map(item => (
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
