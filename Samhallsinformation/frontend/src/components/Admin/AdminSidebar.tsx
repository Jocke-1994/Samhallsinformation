import { useNavigate } from 'react-router'

export type AdminSection =
  | 'oversikt'
  | 'kallor'
  | 'sandlada'
  | 'uppdateringar'
  | 'faq'
  | 'anvandare'
  | 'support-inbox'
  | 'handelsesok'
  | 'aktivitetslogg'
  | 'rapporter'
  | 'felsökning'
  | 'impersonation'
  | 'feature-flags'
  | 'funktionsideer'

export type AdminRoll = 'Admin' | 'Support'

const NAV: { key: AdminSection; label: string; ikon: string; roller: AdminRoll[] }[] = [
  { key: 'oversikt',       label: 'Översikt',         ikon: '🏠', roller: ['Admin'] },
  { key: 'kallor',         label: 'Källhantering',     ikon: '📡', roller: ['Admin'] },
  { key: 'sandlada',       label: 'Sandlåda',          ikon: '🧪', roller: ['Admin'] },
  { key: 'uppdateringar',  label: 'Uppdateringar',     ikon: '📝', roller: ['Admin'] },
  { key: 'faq',            label: 'FAQ-hantering',     ikon: '❓', roller: ['Admin'] },
  { key: 'anvandare',      label: 'Användare',         ikon: '👥', roller: ['Admin', 'Support'] },
  { key: 'support-inbox',  label: 'Support-inbox',     ikon: '🎫', roller: ['Admin', 'Support'] },
  { key: 'handelsesok',    label: 'Händelsesök',       ikon: '🔍', roller: ['Admin', 'Support'] },
  { key: 'aktivitetslogg', label: 'Aktivitetslogg',    ikon: '📋', roller: ['Admin'] },
  { key: 'rapporter',      label: 'Rapporter',         ikon: '📊', roller: ['Admin'] },
  { key: 'felsökning',     label: 'Felsökning',        ikon: '🔧', roller: ['Admin'] },
  { key: 'impersonation',  label: 'Impersonation',  ikon: '🎭', roller: ['Admin'] },
  { key: 'feature-flags',  label: 'Feature flags',  ikon: '🚩', roller: ['Admin'] },
  { key: 'funktionsideer', label: 'Funktionsidéer', ikon: '💡', roller: ['Admin'] },
]

export default function AdminSidebar({
  active,
  onSelect,
  roll,
  isOpen,
  onClose,
}: {
  active: AdminSection
  onSelect: (s: AdminSection) => void
  roll: AdminRoll
  isOpen: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const synliga = NAV.filter(item => item.roller.includes(roll))

  return (
    <>
      {/* Backdrop — mobil, samma mönster som huvudappens Sidebar */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 md:hidden transition-opacity duration-200 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`
        w-64 h-screen bg-slate-900 flex flex-col shrink-0
        fixed inset-y-0 left-0 z-50 transition-transform duration-200
        md:static md:translate-x-0 md:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

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
              onClick={() => { onSelect(item.key); onClose() }}
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
    </>
  )
}
