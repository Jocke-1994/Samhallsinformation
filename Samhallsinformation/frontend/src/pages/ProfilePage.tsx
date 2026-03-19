import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar/Sidebar'
import { type ProfileSection } from '../components/Profile/ProfileNav'
import MinaKallor from '../components/Profile/MinaKallor'
import Konto from '../components/Profile/Konto'
import Notifieringar from '../components/Profile/Notifieringar'
import Uppdateringar from '../components/Profile/Uppdateringar'
import Support from '../components/Profile/Support'

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

function ProfileLanding({ onSelect }: { onSelect: (s: ProfileSection) => void }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-10 py-14">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Min profil</h1>
          <p className="text-slate-400 mt-2 text-lg">Vad vill du göra?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {NAV_CARDS.map(card => (
            <button
              key={card.id}
              onClick={() => onSelect(card.id)}
              className={`group text-left bg-gradient-to-br ${card.gradient} border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5 ${card.iconColor}`}>
                {card.icon}
              </div>
              <p className="text-base font-semibold text-slate-900 mb-1">{card.label}</p>
              <p className="text-sm text-slate-500 leading-snug">{card.description}</p>
              <p className="mt-4 text-xs font-medium text-slate-400 group-hover:text-violet-600 transition-colors">
                Öppna →
              </p>
            </button>
          ))}
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
