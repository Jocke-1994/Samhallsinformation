import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { fetchSources } from '../../api/sources'
import SourceButton from './SourceButton'
import type { Source } from '../../types'
import { useAuth } from '../../context/AuthContext'

interface Props {
  selectedSourceId: number | null
  onSelectSource: (id: number | null) => void
  unreadSourceIds: Set<number>
}

const PROFILE_SECTIONS = [
  { id: 'mina-kallor',   label: 'Mina källor',   icon: '🗂️' },
  { id: 'notifieringar', label: 'Notifieringar',  icon: '🔔' },
  { id: 'konto',         label: 'Konto',          icon: '👤' },
  { id: 'uppdateringar', label: 'Uppdateringar',  icon: '🔄' },
  { id: 'support',       label: 'Support',        icon: '💬' },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center py-3">
      {children}
    </p>
  )
}

export default function Sidebar({ selectedSourceId, onSelectSource, unreadSourceIds }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn, logout } = useAuth()

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: fetchSources,
  })

  const isProfilePage = location.pathname === '/profil'
  const activeSection = isProfilePage
    ? new URLSearchParams(location.search).get('section') ?? ''
    : ''

  return (
    <nav className="flex flex-col h-full w-56 bg-white border-r border-slate-200 px-3 py-5">

      {/* App-namn */}
      <div className="px-2 mb-4">
        <span className="text-lg font-extrabold text-slate-900 tracking-tight">Samhällsinfo</span>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Inställningar */}
        <SectionLabel>Inställningar</SectionLabel>
        <div className="flex flex-col gap-0.5">
          {PROFILE_SECTIONS.map(s => {
            const isActive = activeSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/profil?section=${s.id}`)}
                className={`
                  w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 flex items-center gap-2.5
                  ${isActive
                    ? 'bg-violet-100 text-violet-700 font-semibold'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}
                `}
              >
                <span className="text-sm leading-none">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 my-3" />

        {/* Källor */}
        <SectionLabel>Källor</SectionLabel>
        <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto min-h-0">
          {sources.filter(s => s.isActive).map(source => (
            <SourceButton
              key={source.id}
              label={source.shortName}
              active={selectedSourceId === source.id && !isProfilePage}
              hasUnread={unreadSourceIds.has(source.id)}
              onClick={() => {
                navigate('/')
                onSelectSource(source.id)
              }}
            />
          ))}
        </div>
      </div>

      {/* Profilknapp längst ner */}
      <div className="border-t border-slate-200 pt-3 mt-3">
        <button
          onClick={() => navigate('/profil')}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150
            ${isProfilePage && !activeSection
              ? 'bg-violet-100 text-violet-700'
              : 'hover:bg-slate-100 text-slate-700'}
          `}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
            {isLoggedIn ? 'JO' : '?'}
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">Min profil</p>
            <p className="text-xs text-slate-400 truncate">
              {isLoggedIn ? 'Inställningar & konto' : 'Logga in för att fortsätta'}
            </p>
          </div>
        </button>
        {isLoggedIn && (
          <button
            onClick={() => { logout(); navigate('/') }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors mt-0.5"
          >
            Logga ut
          </button>
        )}
      </div>

    </nav>
  )
}
