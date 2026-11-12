import { useState, useEffect } from 'react'
import { BETA } from '../betaConfig'
import { type ProfileSection } from '../types'
import { useFlags } from '../context/FeatureFlagsContext'
import { isSektionSynlig } from '../lib/featureFlags'
import { searchIndex } from '../lib/profilSok'

const NAV_CARDS: {
  id: ProfileSection
  label: string
  description: string
  icon: string
  gradient: string
  iconColor: string
}[] = [
  {
    id: 'mina-kallor',
    label: 'Mina källor',
    description: 'Hantera vilka myndigheter som visas i ditt flöde',
    icon: '🗂️',
    gradient: 'from-violet-50 to-white',
    iconColor: 'bg-violet-100 text-violet-600',
  },
  {
    id: 'notifieringar',
    label: 'Notifieringar',
    description: 'Ställ in hur och när du vill bli notifierad',
    icon: '🔔',
    gradient: 'from-blue-50 to-white',
    iconColor: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'konto',
    label: 'Konto',
    description: 'Uppdatera dina uppgifter och hantera din data',
    icon: '👤',
    gradient: 'from-indigo-50 to-white',
    iconColor: 'bg-indigo-100 text-indigo-600',
  },
  {
    id: 'uppdateringar',
    label: 'Uppdateringar',
    description: 'Se nyheter, förbättringar och kända buggar',
    icon: '🔄',
    gradient: 'from-emerald-50 to-white',
    iconColor: 'bg-emerald-100 text-emerald-600',
  },
  {
    id: 'support',
    label: 'Support',
    description: 'Skicka ett ärende eller läs vanliga frågor',
    icon: '💬',
    gradient: 'from-amber-50 to-white',
    iconColor: 'bg-amber-100 text-amber-600',
  },
]

function SearchResults({
  query,
  onSelect,
}: {
  query: string
  onSelect: (s: ProfileSection) => void
}) {
  const flaggor = useFlags()
  const results = searchIndex(query, flaggor)
  if (results.size === 0) {
    return <p className="text-sm text-slate-400 text-center mt-2">Inga resultat för "{query}"</p>
  }
  return (
    <div className="flex flex-col gap-2 w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
      {Array.from(results.entries()).map(([section, items]) => (
        <div key={section} className="flex flex-col">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 px-4 pt-3 pb-1">
            {items[0].sectionLabel}
          </p>
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => onSelect(section)}
              className="text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition-colors border-t border-slate-100 first:border-0"
            >
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function BetatestareModal({ onClose, onAnmal }: { onClose: () => void; onAnmal: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-violet-600 to-violet-800 px-6 py-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-violet-300 uppercase tracking-widest mb-1">
              Öppen betaperiod
            </p>
            <h2 className="text-xl font-bold text-white">Vi söker betatestare</h2>
          </div>
          <button
            onClick={onClose}
            className="text-violet-300 hover:text-white transition-colors text-lg leading-none mt-0.5"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Samhällsinformation är under aktiv utveckling och vi letar efter personer som vill
            hjälpa oss forma produkten.
          </p>
          {BETA.sokesFor && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                Vi söker testare för
              </p>
              <p className="text-sm font-semibold text-slate-800">{BETA.sokesFor}</p>
            </div>
          )}
          {BETA.beskrivning && (
            <p className="text-sm text-slate-600 leading-relaxed">{BETA.beskrivning}</p>
          )}
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
            <p className="text-xs text-violet-700 font-medium leading-relaxed">
              Anmälan sker via vår support — välj kategorin{' '}
              <span className="font-bold">Testare</span> och fyll i formuläret.
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={onAnmal}
              className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Anmäl mig
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProfileLanding({ onSelect }: { onSelect: (s: ProfileSection) => void }) {
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const flaggor = useFlags()
  const synligaKort = NAV_CARDS.filter((card) => isSektionSynlig(card.id, flaggor))

  function handleAnmal() {
    setModalOpen(false)
    onSelect('support')
  }

  return (
    <div>
      <div className="flex flex-col items-center pt-16 px-10">
        {/* Rubrik + sökfält i samma bredd */}
        <div className="flex flex-col items-stretch">
          <h1 className="text-8xl font-bold text-slate-900 tracking-tight text-center">
            Min profil
          </h1>
          <div className="relative mt-6">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök inställningar..."
              style={{ paddingLeft: '3rem' }}
              className="w-full pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
            />
            {query.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50">
                <SearchResults
                  query={query}
                  onSelect={(s) => {
                    setQuery('')
                    onSelect(s)
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Betatestare-banner */}
        {BETA.aktiv && (
          <div className="w-full max-w-3xl mt-8">
            <button
              onClick={() => setModalOpen(true)}
              className="banner-pulse w-full flex items-center justify-between gap-4 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white rounded-2xl px-6 py-4 shadow-md hover:shadow-lg transition-all duration-200 text-left"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl shrink-0">🧪</span>
                <div>
                  <p className="text-sm font-bold">Vi söker betatestare</p>
                  <p className="text-xs text-violet-200 mt-0.5">
                    Hjälp oss forma produkten — klicka för att läsa mer
                  </p>
                </div>
              </div>
              <span className="text-violet-300 shrink-0">→</span>
            </button>
          </div>
        )}

        {/* Inställningskort */}
        <div className="w-full max-w-3xl pb-16" style={{ marginTop: '48px' }}>
          <div
            className={`grid gap-6 grid-cols-1 ${synligaKort.length <= 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
          >
            {synligaKort.map((card) => (
              <button
                key={card.id}
                onClick={() => onSelect(card.id)}
                className={`group text-center bg-gradient-to-br ${card.gradient} border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col items-center`}
              >
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-5 ${card.iconColor}`}
                >
                  {card.icon}
                </div>
                <p className="text-base font-semibold text-slate-900 mb-2">{card.label}</p>
                <p className="text-sm text-slate-500 leading-snug">{card.description}</p>
                <p className="mt-5 text-xs font-medium text-slate-400 group-hover:text-violet-600 transition-colors">
                  Öppna →
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
      {modalOpen && <BetatestareModal onClose={() => setModalOpen(false)} onAnmal={handleAnmal} />}
    </div>
  )
}
