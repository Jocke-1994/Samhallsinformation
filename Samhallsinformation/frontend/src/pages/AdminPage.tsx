import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar, { type AdminSection, type AdminRoll } from '../components/Admin/AdminSidebar'
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
import Sandlada from '../components/Admin/Sandlada'
import { useAuth, type SystemRoll } from '../context/AuthContext'
import { useFeatureFlagsAdmin } from '../context/FeatureFlagsContext'

const SECTION_LABELS: Record<AdminSection, string> = {
  'oversikt':       'Översikt',
  'kallor':         'Källhantering',
  'sandlada':       'Sandlåda',
  'uppdateringar':  'Uppdateringar',
  'faq':            'FAQ-hantering',
  'anvandare':      'Användarhantering',
  'support-inbox':  'Support-inbox',
  'aktivitetslogg': 'Aktivitetslogg',
  'rapporter':      'Rapporter',
  'felsökning':     'Felsökning',
  'impersonation':  'Impersonation',
  'feature-flags':  'Feature flags',
}

const NOTIS_LABELS: Record<PendingNotis['typ'], string> = {
  'påminnelse': 'Påminnelse',
  'tilldelad':  'Tilldelad till dig',
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

const SUPPORT_SEKTIONER: AdminSection[] = ['anvandare', 'support-inbox']

export default function AdminPage() {
  const navigate = useNavigate()
  const { isLoggedIn, roll, aktivVy, byttVy } = useAuth()

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login?redirect=/admin', { replace: true })
    } else if (roll !== 'Admin' && roll !== 'Support') {
      navigate('/', { replace: true })
    }
  }, [isLoggedIn, roll, navigate])

  if (!isLoggedIn || (roll !== 'Admin' && roll !== 'Support')) return null

  const adminRoll: AdminRoll = aktivVy === 'Support' ? 'Support' : 'Admin'

  const { flaggor, växlaFlagg, återställ } = useFeatureFlagsAdmin()

  const [section, setSection]             = useState<AdminSection>(
    aktivVy === 'Support' ? 'support-inbox' : 'oversikt'
  )
  const [notiser, setNotiser]             = useState<PendingNotis[]>([])
  const [notisDropdown, setNotisDropdown] = useState(false)
  const [avatarDropdown, setAvatarDropdown] = useState(false)
  const [inboxOpenId, setInboxOpenId]     = useState<string | undefined>(undefined)
  const [öppnaAnvEpost, setÖppnaAnvEpost] = useState<string | undefined>(undefined)
  const [lästaNyckar, setLästaNyckar]     = useState<Set<string>>(new Set())
  const [borttagnaNyckar, setBorttagnaNyckar] = useState<Set<string>>(new Set())

  // Falla tillbaka till support-inbox om man byter till Support-vy på en admin-only sektion
  useEffect(() => {
    if (aktivVy === 'Support' && !SUPPORT_SEKTIONER.includes(section)) {
      setSection('support-inbox')
    }
  }, [aktivVy, section])

  function notisNyckel(n: PendingNotis) { return `${n.arendeId}-${n.typ}` }
  function markeraLäst(n: PendingNotis) { setLästaNyckar(prev => new Set([...prev, notisNyckel(n)])) }
  function taBortNotis(n: PendingNotis) { setBorttagnaNyckar(prev => new Set([...prev, notisNyckel(n)])) }
  function markeraAllaLästa() { setLästaNyckar(new Set(unikaNotiser.map(notisNyckel))) }

  const handlePendingNotiser = useCallback((items: PendingNotis[]) => {
    setNotiser(items)
  }, [])

  function öppnaÄrende(arendeId: string) {
    setInboxOpenId(arendeId)
    setSection('support-inbox')
    setNotisDropdown(false)
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
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      <AdminSidebar active={section} onSelect={setSection} roll={adminRoll} />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Topbar */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-semibold text-slate-900">{SECTION_LABELS[section]}</h1>
          <div className="flex items-center gap-3">

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
                                onClick={() => { markeraLäst(n); öppnaÄrende(n.arendeId) }}
                                className="flex-1 text-left flex flex-col gap-0.5 hover:opacity-80 transition-opacity"
                              >
                                <div className="flex items-center gap-2">
                                  <span>{n.typ === 'påminnelse' ? '⏰' : '👤'}</span>
                                  <span className={`text-xs font-medium ${läst ? 'text-slate-400' : n.typ === 'påminnelse' ? 'text-red-600' : 'text-violet-600'}`}>
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
                      <p className="text-sm font-semibold text-slate-900">Joakim Rehn</p>
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

            {section === 'oversikt'    && <Oversikt onNavigate={setSection} />}
            {section === 'kallor'      && <Kallhantering />}
            {section === 'sandlada'    && <Sandlada />}
            {section === 'felsökning'  && <Felsökning />}
            {section === 'anvandare' && (
              <Anvandare
                onÖppnaÄrende={id => {
                  setInboxOpenId(id)
                  setSection('support-inbox')
                }}
                defaultÖppnaEpost={öppnaAnvEpost}
                defaultFlik="notifinstallningar"
                key={öppnaAnvEpost}
              />
            )}
            {section === 'support-inbox' && (
              <SupportInbox
                onPendingNotiser={handlePendingNotiser}
                defaultOpenId={inboxOpenId}
                onÖppnaAnvändare={epost => {
                  setÖppnaAnvEpost(epost)
                  setSection('anvandare')
                }}
                key={inboxOpenId}
              />
            )}

            {section === 'uppdateringar'  && <AdminUppdateringar />}
            {section === 'faq'            && <AdminFaq />}
            {section === 'rapporter'      && <Rapporter onNavigate={setSection} />}
            {section === 'aktivitetslogg' && <Aktivitetslogg />}
            {section === 'impersonation'  && <Impersonation onNavigate={setSection} />}
            {section === 'feature-flags'  && (
              <FeatureFlagsAdmin
                flaggor={flaggor}
                onVäxla={växlaFlagg}
                onÅterställ={återställ}
              />
            )}

            {section !== 'oversikt' && section !== 'kallor' && section !== 'sandlada' && section !== 'uppdateringar' && section !== 'faq' && section !== 'felsökning' && section !== 'anvandare' && section !== 'support-inbox' && section !== 'rapporter' && section !== 'aktivitetslogg' && section !== 'impersonation' && section !== 'feature-flags' && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <p className="text-4xl mb-4">🚧</p>
                <p className="text-lg font-semibold text-slate-700">{SECTION_LABELS[section]}</p>
                <p className="text-sm text-slate-400 mt-1">Kommer byggas ut i nästa steg.</p>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  )
}
