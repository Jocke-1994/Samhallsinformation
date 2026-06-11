import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { fetchSources } from '../../api/sources'
import SourceButton from './SourceButton'
import type { Source } from '../../types'
import { useAuth, type SystemRoll } from '../../context/AuthContext'

interface Props {
  selectedSourceId: number | null
  onSelectSource: (id: number | null) => void
  unreadSourceIds: Set<number>
  isOpen: boolean
  onClose: () => void
}

const PROFILE_SECTIONS = [
  { id: 'mina-kallor',   label: 'Mina källor',   icon: '🗂️' },
  { id: 'notifieringar', label: 'Notifieringar',  icon: '🔔' },
  { id: 'konto',         label: 'Konto',          icon: '👤' },
  { id: 'uppdateringar', label: 'Uppdateringar',  icon: '🔄' },
  { id: 'support',       label: 'Support',        icon: '💬' },
]

const ROLL_CONFIG: Record<SystemRoll, { label: string; färg: string; initial: string }> = {
  'Admin':     { label: 'Admin',    färg: 'bg-red-100 text-red-700',    initial: 'A' },
  'Support':   { label: 'Support',  färg: 'bg-blue-100 text-blue-700',  initial: 'S' },
  'Användare': { label: 'Användare', färg: 'bg-violet-100 text-violet-700', initial: 'JO' },
}

const TILLÅTNA_VYN: Record<SystemRoll, SystemRoll[]> = {
  'Admin':     ['Admin', 'Support', 'Användare'],
  'Support':   ['Support', 'Användare'],
  'Användare': ['Användare'],
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center py-3">
      {children}
    </p>
  )
}

export default function Sidebar({ selectedSourceId, onSelectSource, unreadSourceIds, isOpen, onClose }: Props) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { isLoggedIn, roll, aktivVy, logout, byttVy } = useAuth()
  const [dropdownÖppen, setDropdownÖppen] = useState(false)

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: fetchSources,
  })

  const isProfilePage = location.pathname === '/profil'
  const activeSection = isProfilePage
    ? new URLSearchParams(location.search).get('section') ?? ''
    : ''

  const vynAttVälja = TILLÅTNA_VYN[roll].filter(v => v !== aktivVy)

  function välj(vy: SystemRoll) {
    byttVy(vy)
    setDropdownÖppen(false)
    if (vy === 'Admin' || vy === 'Support') {
      navigate('/admin')
    } else {
      navigate('/')
    }
  }

  function hanteraLogout() {
    logout()
    setDropdownÖppen(false)
    navigate('/')
    onClose()
  }

  const aktivConfig = ROLL_CONFIG[aktivVy]

  return (
    <>
    {/* Backdrop — mobil */}
    <div
      className={`fixed inset-0 bg-black/30 z-40 md:hidden transition-opacity duration-200 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
    />
    <nav className={`
      flex flex-col w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 px-3 py-5 shrink-0
      fixed inset-y-0 left-0 z-50 transition-transform duration-200
      md:static md:translate-x-0 md:z-auto
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>

      {/* App-namn */}
      <div className="mb-4 pb-4 border-b border-slate-100 text-center">
        <button
          onClick={() => { onSelectSource(null); navigate('/'); onClose() }}
          className={`text-lg font-extrabold tracking-tight transition-colors ${
            selectedSourceId === null && !isProfilePage
              ? 'text-violet-700'
              : 'text-slate-900 hover:text-violet-600'
          }`}
        >
          Samhällsinfo
        </button>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Inställningar — endast för inloggade */}
        {isLoggedIn && (
          <>
            <SectionLabel>Inställningar</SectionLabel>
            <div className="flex flex-col gap-0.5">
              {PROFILE_SECTIONS.map(s => {
                const isActive = activeSection === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => { navigate(`/profil?section=${s.id}`); onClose() }}
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
            <div className="border-t border-slate-200 my-3" />
          </>
        )}

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
                onClose()
              }}
            />
          ))}
        </div>
      </div>

      {/* Profilknapp med dropdown — endast för inloggade */}
      {isLoggedIn && <div className="border-t border-slate-200 pt-3 mt-3 relative">

        {dropdownÖppen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setDropdownÖppen(false)} />
            <div className="absolute bottom-full left-0 right-0 mb-2 z-40 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">

              {/* Användarprofil */}
              <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  JO
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">Joakim Rehn</p>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${aktivConfig.färg}`}>
                    {aktivConfig.label}
                  </span>
                </div>
              </div>

              {/* Rollväljare — visas bara om man har fler alternativ */}
              {vynAttVälja.length > 0 && (
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">Byt vy</p>
                  <div className="flex flex-col gap-0.5">
                    {TILLÅTNA_VYN[roll].map(vy => (
                      <button
                        key={vy}
                        onClick={() => välj(vy)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                          vy === aktivVy
                            ? 'bg-violet-50 text-violet-700'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>{ROLL_CONFIG[vy].label}</span>
                        {vy === aktivVy && <span className="text-violet-400 text-xs">●</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Logga ut */}
              {isLoggedIn && (
                <button
                  onClick={hanteraLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  Logga ut
                </button>
              )}
            </div>
          </>
        )}

        <button
          onClick={() => setDropdownÖppen(v => !v)}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150
            ${dropdownÖppen ? 'bg-slate-100' : 'hover:bg-slate-100 text-slate-700'}
          `}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
            {isLoggedIn ? 'JO' : '?'}
          </div>
          <div className="text-left min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">Min profil</p>
            <p className="text-xs text-slate-400 truncate">
              {isLoggedIn ? 'Inställningar & konto' : 'Logga in för att fortsätta'}
            </p>
          </div>
          {isLoggedIn && roll !== 'Användare' && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${aktivConfig.färg}`}>
              {aktivConfig.initial !== 'JO' ? aktivConfig.initial : aktivVy.substring(0, 1)}
            </span>
          )}
        </button>
      </div>}

    </nav>
    </>
  )
}
