import { Link } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import { useFlags } from '../../context/FeatureFlagsContext'
import type { FlagState } from '../../lib/featureFlags'
import { provaSjalvLänk, type ProvaSjalvMål } from '../../lib/provaSjalv'

// "Prova själv →" under en rad i Uppdateringar (Nyheter-sidan, Profil →
// Uppdateringar, Vad är nytt-rutan och förhandsvisningen i admin). Textlänk,
// inte knapp, så kort med flera rader förblir lugna (skiss 2026-11-02).
export default function ProvaSjalvLank({ mål, härifrån, förhandsvisning, onKlick }: {
  mål: string | null | undefined
  /** Sidan raden visas på — en länk dit döljs (man står redan där). */
  härifrån?: ProvaSjalvMål
  /** I admins förhandsvisning: visa som besökare/inloggad med lanseringens flaggor, och navigera inte. */
  förhandsvisning?: { inloggad: boolean; flaggor: Partial<FlagState> }
  onKlick?: () => void
}) {
  const { isLoggedIn } = useAuth()
  const flaggor = useFlags()
  const länk = provaSjalvLänk(mål, {
    inloggad: förhandsvisning?.inloggad ?? isLoggedIn,
    flaggor:  förhandsvisning?.flaggor ?? flaggor,
    härifrån,
  })
  if (!länk) return null

  const innehåll = (
    <>
      {länk.kräverKonto && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      )}
      {länk.kräverKonto ? 'Prova själv · kräver konto →' : 'Prova själv →'}
    </>
  )
  const klass = 'inline-flex items-center gap-1.5 self-start py-1 text-sm font-semibold text-violet-700 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200'

  if (förhandsvisning) return <span className={klass}>{innehåll}</span>
  return <Link to={länk.href} onClick={onKlick} className={klass}>{innehåll}</Link>
}
