import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Sidebar from '../components/Sidebar/Sidebar'
import { type ProfileSection } from '../components/Profile/ProfileNav'
import MinaKallor from '../components/Profile/MinaKallor'
import Konto from '../components/Profile/Konto'
import Notifieringar from '../components/Profile/Notifieringar'
import Uppdateringar from '../components/Profile/Uppdateringar'
import Support from '../components/Profile/Support'
import { fetchSources } from '../api/sources'
import { useUnreadSourceIds } from '../hooks/useUnreadSourceIds'
import type { Source } from '../types'

const VALID_SECTIONS: ProfileSection[] = ['mina-kallor', 'notifieringar', 'konto', 'uppdateringar', 'support']

const SECTION_LABELS: Record<ProfileSection, string> = {
  'mina-kallor': 'Mina källor',
  'notifieringar': 'Notifieringar',
  'konto': 'Konto',
  'uppdateringar': 'Uppdateringar',
  'support': 'Support',
}

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

interface SearchItem {
  section: ProfileSection
  sectionLabel: string
  label: string
  keywords: string[]
}

const SEARCH_INDEX: SearchItem[] = [
  // Mina källor
  { section: 'mina-kallor', sectionLabel: 'Mina källor', label: 'Hämta källor via SPAR', keywords: ['spar', 'adress', 'folkbokföring', 'automatisk', 'förslag'] },
  { section: 'mina-kallor', sectionLabel: 'Mina källor', label: 'Lägg till källa manuellt', keywords: ['sök', 'källa', 'lägg till', 'myndighet', 'organisation'] },
  { section: 'mina-kallor', sectionLabel: 'Mina källor', label: 'Aktiva källor', keywords: ['aktiv', 'källa', 'ta bort', 'radera'] },
  // Notifieringar
  { section: 'notifieringar', sectionLabel: 'Notifieringar', label: 'Obligatoriska källor', keywords: ['msb', 'polisen', 'obligatorisk', 'alltid', 'kris'] },
  { section: 'notifieringar', sectionLabel: 'Notifieringar', label: 'Globala inställningar', keywords: ['sms', 'e-post', 'mail', 'frekvens', 'kanal', 'tyst läge', 'push', 'notis'] },
  { section: 'notifieringar', sectionLabel: 'Notifieringar', label: 'Per källa-inställningar', keywords: ['källa', 'notis', 'toggle', 'aktivera', 'inaktivera'] },
  { section: 'notifieringar', sectionLabel: 'Notifieringar', label: 'Geografifilter', keywords: ['geo', 'geografi', 'stad', 'län', 'lokal', 'region', 'plats'] },
  // Konto
  { section: 'konto', sectionLabel: 'Konto', label: 'Kontouppgifter', keywords: ['namn', 'e-post', 'mail', 'uppgifter', 'profil', 'användare'] },
  { section: 'konto', sectionLabel: 'Konto', label: 'Byt lösenord', keywords: ['lösenord', 'password', 'byt', 'säkerhet', 'ändra'] },
  { section: 'konto', sectionLabel: 'Konto', label: 'Exportera persondata', keywords: ['gdpr', 'export', 'data', 'ladda ner', 'personuppgifter'] },
  { section: 'konto', sectionLabel: 'Konto', label: 'Radera konto', keywords: ['radera', 'ta bort', 'konto', 'gdpr', 'permanent'] },
  // Uppdateringar
  { section: 'uppdateringar', sectionLabel: 'Uppdateringar', label: 'Senaste version', keywords: ['version', 'release', 'ny', 'senaste', 'uppdatering'] },
  { section: 'uppdateringar', sectionLabel: 'Uppdateringar', label: 'Kända buggar', keywords: ['bugg', 'fel', 'problem', 'issue', 'känd'] },
  { section: 'uppdateringar', sectionLabel: 'Uppdateringar', label: 'Versionshistorik', keywords: ['historik', 'changelog', 'tidigare', 'version'] },
  // Support
  { section: 'support', sectionLabel: 'Support', label: 'Mina ärenden', keywords: ['ärende', 'ticket', 'support', 'hjälp', 'kontakt'] },
  { section: 'support', sectionLabel: 'Support', label: 'Systemstatus', keywords: ['status', 'drift', 'nere', 'system', 'driftstatus'] },
  { section: 'support', sectionLabel: 'Support', label: 'FAQ', keywords: ['faq', 'frågor', 'vanliga', 'svar', 'hjälp'] },
  { section: 'support', sectionLabel: 'Support', label: 'Skapa nytt ärende', keywords: ['nytt ärende', 'skicka', 'kontakta', 'meddelande', 'formulär'] },
]

function searchIndex(query: string): Map<ProfileSection, SearchItem[]> {
  const q = query.toLowerCase().trim()
  const results = SEARCH_INDEX.filter(item =>
    item.label.toLowerCase().includes(q) ||
    item.sectionLabel.toLowerCase().includes(q) ||
    item.keywords.some(k => k.includes(q))
  )
  const grouped = new Map<ProfileSection, SearchItem[]>()
  for (const item of results) {
    if (!grouped.has(item.section)) grouped.set(item.section, [])
    grouped.get(item.section)!.push(item)
  }
  return grouped
}

function SearchResults({ query, onSelect }: { query: string; onSelect: (s: ProfileSection) => void }) {
  const results = searchIndex(query)
  if (results.size === 0) {
    return (
      <p className="text-sm text-slate-400 text-center mt-2">Inga resultat för "{query}"</p>
    )
  }
  return (
    <div className="flex flex-col gap-2 w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
      {Array.from(results.entries()).map(([section, items]) => (
        <div key={section} className="flex flex-col">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 px-4 pt-3 pb-1">
            {items[0].sectionLabel}
          </p>
          {items.map(item => (
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

function UnreadSourcesSection({ onSelectSource }: { onSelectSource: (id: number) => void }) {
  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: fetchSources,
  })

  const unreadSourceIds = useUnreadSourceIds(sources)

  const unreadSources = sources.filter(s => unreadSourceIds.has(s.id))

  if (unreadSources.length === 0) return null

  const regional = unreadSources.filter(s => s.scope === 'regional')
  const national = unreadSources.filter(s => s.scope === 'nationell')

  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-5">Nytt sedan sist</h2>

      {regional.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Regionalt för dig
          </p>
          <div className="flex flex-wrap gap-3">
            {regional.map(source => (
              <button
                key={source.id}
                onClick={() => onSelectSource(source.id)}
                className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-sm font-medium text-slate-800 hover:text-violet-700"
              >
                <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                {source.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {national.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Nationellt
          </p>
          <div className="flex flex-wrap gap-3">
            {national.map(source => (
              <button
                key={source.id}
                onClick={() => onSelectSource(source.id)}
                className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-sm font-medium text-slate-800 hover:text-violet-700"
              >
                <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                {source.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileLanding({ onSelect }: { onSelect: (s: ProfileSection) => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  function handleSelectSource(sourceId: number) {
    navigate('/', { state: { sourceId } })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col items-center pt-16 px-10">

        {/* Rubrik + sökfält i samma bredd */}
        <div className="flex flex-col items-stretch">
          <h1 className="text-8xl font-bold text-slate-900 tracking-tight text-center">Min profil</h1>
          <div className="relative mt-6">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Sök inställningar..."
              style={{ paddingLeft: '3rem' }}
              className="w-full pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
            />
            {query.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50">
                <SearchResults query={query} onSelect={s => { setQuery(''); onSelect(s) }} />
              </div>
            )}
          </div>
        </div>

        {/* Inställningskort */}
        <div className="w-full max-w-3xl pb-16" style={{ marginTop: '128px' }}>
          <div className="grid grid-cols-3 gap-6">
            {NAV_CARDS.map(card => (
              <button
                key={card.id}
                onClick={() => onSelect(card.id)}
                className={`group text-center bg-gradient-to-br ${card.gradient} border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col items-center`}
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-5 ${card.iconColor}`}>
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
          <UnreadSourcesSection onSelectSource={handleSelectSource} />
        </div>

      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sectionParam = searchParams.get('section')
  const section = VALID_SECTIONS.includes(sectionParam as ProfileSection)
    ? (sectionParam as ProfileSection)
    : null

  function setSection(s: ProfileSection | null) {
    if (s === null) setSearchParams({})
    else setSearchParams({ section: s })
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        selectedSourceId={null}
        onSelectSource={() => {}}
        unreadSourceIds={new Set()}
      />

      <div className="flex flex-1 overflow-hidden">

        {section === null ? (
          <ProfileLanding onSelect={setSection} />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="bg-white border-b border-slate-200 px-10 py-10">
              <h1 className="text-3xl font-bold text-slate-900 text-center">
                {SECTION_LABELS[section]}
              </h1>
            </div>
            <div className="px-10 py-8">
              {section === 'mina-kallor' && <MinaKallor />}
              {section === 'notifieringar' && <Notifieringar />}
              {section === 'konto' && <Konto />}
              {section === 'uppdateringar' && <Uppdateringar />}
              {section === 'support' && <Support />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
