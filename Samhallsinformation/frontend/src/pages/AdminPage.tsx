import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import AdminSidebar from '../components/Admin/AdminSidebar'
import { effektivAdminRoll, startSektion, tillåtnaSektioner, type AdminSection, type AdminRoll } from '../lib/adminNavigering'
import Oversikt from '../components/Admin/Oversikt'
import Kallhantering from '../components/Admin/Kallhantering'
import Felsökning from '../components/Admin/Felsökning'
import Anvandare from '../components/Admin/Anvandare'
import SupportInbox, { type PendingNotis } from '../components/Admin/SupportInbox'
import Rapporter from '../components/Admin/Rapporter'
import Aktivitetslogg from '../components/Admin/Aktivitetslogg'
import Impersonation from '../components/Admin/Impersonation'
import AdminUppdateringar from '../components/Admin/AdminUppdateringar'
import AdminFaq from '../components/Admin/AdminFaq'
import FeatureFlagsAdmin from '../components/Admin/FeatureFlagsAdmin'
import SiteSettingsAdmin from '../components/Admin/SiteSettingsAdmin'
import MaintenanceBannerAdmin from '../components/Admin/MaintenanceBannerAdmin'
import FunktionsIdePipeline from '../components/Admin/FunktionsIdePipeline'
import Sandlada from '../components/Admin/Sandlada'
import Handelsesok from '../components/Admin/Handelsesok'
import { useAuth, type SystemRoll } from '../context/AuthContext'
import { useFeatureFlagsAdmin } from '../context/FeatureFlagsContext'
import { useAdminDjuplank } from '../hooks/useAdminDjuplank'
import { useAdminNotiser } from '../hooks/useAdminNotiser'
import { usePwaIdentity, ADMIN_PWA_IDENTITET } from '../hooks/usePwaIdentity'
import { usePushSubscription, isPushSupported } from '../hooks/usePushSubscription'
import { fetchPushSettings, savePushSettings } from '../api/push'
import { fetchAdminTickets } from '../api/support'

const SECTION_LABELS: Record<AdminSection, string> = {
  'oversikt':       'Översikt',
  'kallor':         'Källhantering',
  'sandlada':       'Sandlåda',
  'uppdateringar':  'Uppdateringar',
  'faq':            'FAQ-hantering',
  'anvandare':      'Användarhantering',
  'support-inbox':  'Support-inbox',
  'handelsesok':    'Händelsesök',
  'aktivitetslogg': 'Aktivitetslogg',
  'rapporter':      'Rapporter',
  'felsökning':     'Felsökning',
  'impersonation':  'Impersonation',
  'feature-flags':  'Feature flags',
  'funktionsideer': 'Funktionsidéer',
}

const NOTIS_LABELS: Record<PendingNotis['typ'], string> = {
  'påminnelse':     'Påminnelse',
  'tilldelad':      'Tilldelad till dig',
  'kontospärrning': 'Kontospärrning',
}

const ROLL_FÄRG: Record<AdminRoll, string> = {
  'Admin':   'bg-red-100 text-red-700',
  'Support': 'bg-blue-100 text-blue-700',
}

const TILLÅTNA_VYN: Record<SystemRoll, SystemRoll[]> = {
  'Admin':     ['Admin', 'Support', 'Användare'],
  'Support':   ['Support', 'Användare'],
  'Användare': ['Användare'],
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { isLoggedIn, roll, aktivVy, name, byttVy } = useAuth()
  // Ett riktigt Support-konto är alltid Support (även med en gammal si_aktiv_vy i
  // localStorage); en Admin i Support-vyn förhandsvisar Support-rollen.
  const adminRoll: AdminRoll = effektivAdminRoll(roll, aktivVy)

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login?redirect=/admin', { replace: true })
    } else if (roll !== 'Admin' && roll !== 'Support') {
      navigate('/', { replace: true })
    }
  }, [isLoggedIn, roll, navigate])

  usePwaIdentity(ADMIN_PWA_IDENTITET)

  const { inställda: flaggor, växlaFlagg, återställ, läge: flaggLäge, ändringsFel, ändringPågår } = useFeatureFlagsAdmin()
  const { isSubscribed, loading: pushLoading, subscribe, unsubscribe } = usePushSubscription()
  const [pushBusy, setPushBusy] = useState(false)
  const [pushFel, setPushFel]   = useState('')

  // Enhets-prenumerationen (ovan) och det globala push-muteläget är två
  // separata fält i backend — utan den här synkroniseringen kan en admin
  // ha "aktiverad" enhet men ändå aldrig få notiser om muten råkat stå av
  // (hände på riktigt, session 2026-08-14: dold bakom en avstängd
  // feature-flagga utan något UI att se eller ändra den).
  const [pushEnabled, setPushEnabled] = useState(true)
  useEffect(() => {
    fetchPushSettings().then(s => setPushEnabled(s.pushEnabled)).catch(() => {})
  }, [])
  const pushAktiv = isSubscribed && pushEnabled

  // Samma queryKey som SupportInbox.tsx — delar cache/nätverksanrop, ingen
  // extra request bara för att räkna olästa i sidomenyns bubbla.
  const { data: ärendenFörBadge = [] } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: () => fetchAdminTickets(),
    refetchInterval: 30_000,
  })
  // Oläst = aldrig öppnat, eller ett medborgar-svar kom in efter senaste
  // öppningen — matchar samma logik som SupportInbox.tsx.
  const olästaTotalt = ärendenFörBadge.filter(a =>
    !a.isArchived && !!a.lastUserMessageAt &&
    (!a.lastViewedAt || new Date(a.lastUserMessageAt) > new Date(a.lastViewedAt))
  ).length

  const [section, setSection]             = useState<AdminSection>(startSektion(adminRoll))
  // Sektionsvakt (härledd, ingen effekt): en sektion rollen inte får se renderas
  // aldrig, inte ens en frame — byter en Admin till Support-vyn på t.ex. Källhantering
  // hamnar den direkt i Support-inbox i stället för att ge 403-anrop. Byter man tillbaka
  // till Admin-vyn är man på den sektionen igen.
  const aktivSektion: AdminSection = tillåtnaSektioner(adminRoll).includes(section) ? section : startSektion(adminRoll)
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  // Klockans lista har EN källa (V3-20, E6#11): båda notisfrågorna ägs här, inte av
  // sektionerna, så listan är komplett oavsett vilken flik som är öppen.
  const notiser = useAdminNotiser(isLoggedIn && (roll === 'Admin' || roll === 'Support'), adminRoll)
  const [notisDropdown, setNotisDropdown] = useState(false)
  const [avatarDropdown, setAvatarDropdown] = useState(false)
  const {
    användarMål, inboxÄrendeId,
    öppnaAnvändare, öppnaInboxÄrende, konsumeraAnvändare, konsumeraInboxÄrende,
  } = useAdminDjuplank(aktivSektion)
  const [lästaNyckar, setLästaNyckar]     = useState<Set<string>>(new Set())
  const [borttagnaNyckar, setBorttagnaNyckar] = useState<Set<string>>(new Set())

  // Alla hooks ovan måste köras oavsett inloggningsläge (Rules of Hooks) —
  // därför kommer det villkorliga returnet först här, efter samtliga.
  if (!isLoggedIn || (roll !== 'Admin' && roll !== 'Support')) return null

  function notisNyckel(n: PendingNotis) { return `${n.arendeId}-${n.typ}` }
  function markeraLäst(n: PendingNotis) { setLästaNyckar(prev => new Set([...prev, notisNyckel(n)])) }
  function taBortNotis(n: PendingNotis) { setBorttagnaNyckar(prev => new Set([...prev, notisNyckel(n)])) }
  function markeraAllaLästa() { setLästaNyckar(new Set(unikaNotiser.map(notisNyckel))) }

  async function växlaPush() {
    setPushBusy(true)
    setPushFel('')
    try {
      if (pushAktiv) {
        await unsubscribe()
      } else {
        if (!isSubscribed) await subscribe()
        if (!pushEnabled) {
          await savePushSettings({ pushEnabled: true })
          setPushEnabled(true)
        }
      }
    } catch (err) {
      setPushFel(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setPushBusy(false)
    }
  }

  function öppnaÄrende(arendeId: string) {
    öppnaInboxÄrende(arendeId)
    setSection('support-inbox')
    setNotisDropdown(false)
  }

  function öppnaNotis(n: PendingNotis) {
    markeraLäst(n)
    if (n.typ === 'kontospärrning' && n.epost) {
      öppnaAnvändare(n.epost, 'oversikt')
      setSection('anvandare')
      setNotisDropdown(false)
    } else {
      öppnaÄrende(n.arendeId)
    }
  }

  function välj(vy: SystemRoll) {
    byttVy(vy)
    setAvatarDropdown(false)
    if (vy === 'Användare') navigate('/')
  }

  const unikaNotiser = notiser.filter(
    (n, i, arr) => arr.findIndex(x => x.arendeId === n.arendeId && x.typ === n.typ) === i
  ).filter(n => !borttagnaNyckar.has(notisNyckel(n)))

  const olästaNotiser = unikaNotiser.filter(n => !lästaNyckar.has(notisNyckel(n)))
  const totalCount    = olästaNotiser.length

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden">

      <AdminSidebar
        active={aktivSektion}
        onSelect={setSection}
        roll={adminRoll}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        badges={{ 'support-inbox': olästaTotalt }}
      />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden w-9 h-9 shrink-0 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600"
              aria-label="Öppna meny"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-slate-900 truncate">{SECTION_LABELS[aktivSektion]}</h1>
          </div>
          <div className="flex items-center gap-3">

            {/* Push-notiser för nya ärenden/användare — av som standard tills
                den här enheten prenumererar. isPushSupported() är false på
                t.ex. iOS Safari om PWA:n inte är hemskärmsinstallerad. */}
            {isPushSupported() && (
              <div className="relative">
                <button
                  onClick={växlaPush}
                  disabled={pushLoading || pushBusy}
                  title={pushAktiv ? 'Push-notiser aktiverade på den här enheten — klicka för att stänga av' : 'Aktivera push-notiser för nya ärenden och nya användare på den här enheten'}
                  className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                    pushAktiv ? 'bg-violet-100 hover:bg-violet-200' : 'hover:bg-slate-100'
                  }`}
                >
                  <span className="text-base">{pushAktiv ? '📳' : '🔕'}</span>
                </button>
                {pushFel && (
                  <p className="absolute right-0 top-11 z-40 w-56 bg-white border border-red-200 rounded-lg shadow-lg px-3 py-2 text-xs text-red-600">
                    {pushFel}
                  </p>
                )}
              </div>
            )}

            {/* Notis-klocka */}
            <div className="relative">
              <button
                onClick={() => setNotisDropdown(v => !v)}
                className="relative w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
                title="Notiser"
              >
                <span className="text-lg">🔔</span>
                {totalCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {totalCount}
                  </span>
                )}
              </button>

              {notisDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotisDropdown(false)} />
                  <div className="absolute right-0 top-11 z-40 w-80 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">Notiser</p>
                      {olästaNotiser.length > 0 && (
                        <button onClick={markeraAllaLästa} className="text-xs text-violet-600 hover:text-violet-500">Markera alla lästa</button>
                      )}
                    </div>
                    {unikaNotiser.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">Inga aktiva notiser.</div>
                    ) : (
                      <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                        {unikaNotiser.map((n, i) => {
                          const läst = lästaNyckar.has(notisNyckel(n))
                          return (
                            <li key={i} className={`flex items-start gap-2 px-4 py-3 ${läst ? 'opacity-50' : 'bg-slate-50/60'}`}>
                              <button
                                onClick={() => öppnaNotis(n)}
                                className="flex-1 text-left flex flex-col gap-0.5 hover:opacity-80 transition-opacity"
                              >
                                <div className="flex items-center gap-2">
                                  <span>{n.typ === 'påminnelse' || n.typ === 'kontospärrning' ? '⏰' : '👤'}</span>
                                  <span className={`text-xs font-medium ${läst ? 'text-slate-400' : n.typ === 'påminnelse' || n.typ === 'kontospärrning' ? 'text-red-600' : 'text-violet-600'}`}>
                                    {NOTIS_LABELS[n.typ]}
                                  </span>
                                  <span className="font-mono text-xs text-slate-400 ml-auto">{n.arendeId}</span>
                                </div>
                                <p className="text-xs text-slate-600 truncate pl-6">{n.amne}</p>
                                {n.notering && <p className="text-xs text-slate-400 truncate pl-6 italic">{n.notering}</p>}
                              </button>
                              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                {!läst && (
                                  <button onClick={() => markeraLäst(n)} title="Markera läst" className="text-slate-300 hover:text-slate-500 text-sm transition-colors">👁</button>
                                )}
                                <button onClick={() => taBortNotis(n)} title="Ta bort" className="text-slate-300 hover:text-red-400 text-sm transition-colors">✕</button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Avatar-dropdown med rollväljare */}
            <div className="relative">
              <button
                onClick={() => setAvatarDropdown(v => !v)}
                className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl transition-colors ${avatarDropdown ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${ROLL_FÄRG[adminRoll]}`}>
                  {adminRoll === 'Admin' ? 'A' : 'S'}
                </div>
                <span className={`text-xs font-medium ${ROLL_FÄRG[adminRoll].split(' ')[1]}`}>
                  {adminRoll}-läge
                </span>
              </button>

              {avatarDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setAvatarDropdown(false)} />
                  <div className="absolute right-0 top-11 z-40 w-52 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-900">{name ?? 'Ditt namn'}</p>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ROLL_FÄRG[adminRoll]}`}>
                        {adminRoll}
                      </span>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">Byt vy</p>
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
                          <span>{vy === 'Användare' ? 'Användarvy' : `${vy}-vy`}</span>
                          {vy === aktivVy && <span className="text-violet-400 text-xs">●</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>

        {/* Innehåll */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '2rem 3rem' }}>
          <div style={{ maxWidth: '1100px' }}>

            {aktivSektion === 'oversikt'    && <Oversikt onNavigate={setSection} onÖppnaÄrende={öppnaÄrende} />}
            {aktivSektion === 'kallor'      && <Kallhantering />}
            {aktivSektion === 'sandlada'    && <Sandlada />}
            {aktivSektion === 'felsökning'  && <Felsökning />}
            {aktivSektion === 'anvandare' && (
              <Anvandare
                onÖppnaÄrende={id => {
                  öppnaInboxÄrende(id)
                  setSection('support-inbox')
                }}
                defaultÖppnaEpost={användarMål?.epost}
                defaultFlik={användarMål?.flik ?? 'oversikt'}
                onDjuplänkKonsumerad={konsumeraAnvändare}
              />
            )}
            {aktivSektion === 'support-inbox' && (
              <SupportInbox
                defaultOpenId={inboxÄrendeId}
                onDjuplänkKonsumerad={konsumeraInboxÄrende}
                onÖppnaAnvändare={epost => {
                  öppnaAnvändare(epost, 'oversikt')
                  setSection('anvandare')
                }}
              />
            )}

            {aktivSektion === 'handelsesok' && (
              <Handelsesok
                onÖppnaAnvändare={epost => {
                  öppnaAnvändare(epost, 'oversikt')
                  setSection('anvandare')
                }}
              />
            )}

            {aktivSektion === 'uppdateringar'  && <AdminUppdateringar />}
            {aktivSektion === 'faq'            && <AdminFaq />}
            {aktivSektion === 'rapporter'      && <Rapporter onNavigate={setSection} />}
            {aktivSektion === 'aktivitetslogg' && <Aktivitetslogg onÖppnaÄrende={öppnaÄrende} />}
            {aktivSektion === 'impersonation'  && <Impersonation onNavigate={setSection} />}
            {aktivSektion === 'feature-flags'  && (
              <div className="flex flex-col gap-6">
                <SiteSettingsAdmin />
                <MaintenanceBannerAdmin />
                <FeatureFlagsAdmin
                  flaggor={flaggor}
                  onVäxla={växlaFlagg}
                  onÅterställ={återställ}
                  läge={flaggLäge}
                  ändringsFel={ändringsFel}
                  ändringPågår={ändringPågår}
                />
              </div>
            )}
            {aktivSektion === 'funktionsideer' && <FunktionsIdePipeline onÖppnaÄrende={öppnaÄrende} />}

            {aktivSektion !== 'oversikt' && aktivSektion !== 'kallor' && aktivSektion !== 'sandlada' && aktivSektion !== 'uppdateringar' && aktivSektion !== 'faq' && aktivSektion !== 'felsökning' && aktivSektion !== 'anvandare' && aktivSektion !== 'support-inbox' && aktivSektion !== 'handelsesok' && aktivSektion !== 'rapporter' && aktivSektion !== 'aktivitetslogg' && aktivSektion !== 'impersonation' && aktivSektion !== 'feature-flags' && aktivSektion !== 'funktionsideer' && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <p className="text-4xl mb-4">🚧</p>
                <p className="text-lg font-semibold text-slate-700">{SECTION_LABELS[aktivSektion]}</p>
                <p className="text-sm text-slate-400 mt-1">Kommer byggas ut i nästa steg.</p>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
