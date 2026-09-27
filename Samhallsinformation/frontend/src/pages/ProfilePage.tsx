import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useSwipeable } from 'react-swipeable'
import Sidebar from '../components/Sidebar/Sidebar'
import MobilTopBar from '../components/common/MobilTopBar'
import { type ProfileSection } from '../types'
import { useAuth } from '../context/AuthContext'
import { useFlags } from '../context/FeatureFlagsContext'
import { isSektionSynlig } from '../lib/featureFlags'
import GästProfil from './GästProfil'
import MinaKallor from '../components/Profile/MinaKallor'
import Konto from '../components/Profile/Konto'
import Notifieringar from '../components/Profile/Notifieringar'
import Uppdateringar from '../components/Profile/Uppdateringar'
import Support from '../components/Profile/Support'
import ProfileLanding from './ProfileLanding'

const VALID_SECTIONS: ProfileSection[] = ['mina-kallor', 'notifieringar', 'konto', 'uppdateringar', 'support']

const SECTION_LABELS: Record<ProfileSection, string> = {
  'mina-kallor': 'Mina källor',
  'notifieringar': 'Notifieringar',
  'konto': 'Konto',
  'uppdateringar': 'Uppdateringar',
  'support': 'Support',
}

export default function ProfilePage() {
  const { isLoggedIn } = useAuth()
  const flaggor = useFlags()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sectionParam = searchParams.get('section')
  const requestedSection = VALID_SECTIONS.includes(sectionParam as ProfileSection)
    ? (sectionParam as ProfileSection)
    : null
  // En direktlänk (t.ex. Ny version-pushens /profil?section=uppdateringar) mot
  // en sektion vars samtliga flaggor är avstängda ska inte rendera sektionen —
  // samma spärr som redan gäller landningssidans kort och sökindexet
  // (isSektionSynlig). Fallback: landningssidan (bara synliga kort).
  const section = requestedSection && isSektionSynlig(requestedSection, flaggor)
    ? requestedSection
    : null

  function setSection(s: ProfileSection | null) {
    if (s === null) setSearchParams({})
    else setSearchParams({ section: s })
  }

  const swipeHandlers = useSwipeable({
    onSwipedRight: (e) => { if (e.initial[0] < 30) setSidebarOpen(true) },
    onSwipedLeft:  ()  => setSidebarOpen(false),
    preventScrollOnSwipe: true,
    touchEventOptions: { passive: false },
  })

  if (!isLoggedIn) {
    return (
      <div className="flex h-full bg-slate-50">
        <Sidebar selectedShortName={null} onSelectSource={() => {}} viewMode="Allt" onSelectViewMode={() => {}} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 overflow-hidden" {...swipeHandlers}>
          <div className="flex-1 overflow-y-auto">
            <MobilTopBar onOpenSidebar={() => setSidebarOpen(true)} />
            <GästProfil />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-slate-50">
      <Sidebar
        selectedShortName={null}
        onSelectSource={() => {}}
        viewMode="Allt"
        onSelectViewMode={() => {}}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 overflow-hidden" {...swipeHandlers}>

        {section === null ? (
          <div className="flex-1 overflow-y-auto">
            <MobilTopBar onOpenSidebar={() => setSidebarOpen(true)} />
            <ProfileLanding onSelect={setSection} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <MobilTopBar onOpenSidebar={() => setSidebarOpen(true)} />
            <div className="bg-white border-b border-slate-200 px-4 md:px-10 py-5 md:py-10">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 text-center">
                {SECTION_LABELS[section]}
              </h1>
            </div>
            <div className="px-4 md:px-12 py-6 md:py-10">
              <div className="max-w-7xl mx-auto">
                {section === 'mina-kallor' && <MinaKallor />}
                {section === 'notifieringar' && <Notifieringar />}
                {section === 'konto' && <Konto />}
                {section === 'uppdateringar' && <Uppdateringar />}
                {section === 'support' && <Support />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
