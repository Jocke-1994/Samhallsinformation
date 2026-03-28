import { useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar/Sidebar'
import { type ProfileSection } from '../types'
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
              <div className="max-w-5xl mx-auto">
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
