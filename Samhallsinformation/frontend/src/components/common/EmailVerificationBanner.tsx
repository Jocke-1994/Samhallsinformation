import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useFlags } from '../../context/FeatureFlagsContext'
import { resendVerification } from '../../api/auth'
import { useNu } from '../../hooks/useNu'

const VERIFY_BANNER_SNOOZE_KEY = 'si_verify_banner_snoozed_until'
const VERIFY_BANNER_SNOOZE_MS  = 24 * 60 * 60 * 1000

export default function EmailVerificationBanner() {
  const { isLoggedIn, emailVerified, email } = useAuth()
  const flaggor = useFlags()
  const nu = useNu()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'fel'>('idle')
  // Nyckeln måste vara kontospecifik (inte en enda global nyckel) — annars
  // slår ett snooze-klick på ETT konto igenom på VILKET konto som helst som
  // loggar in på samma enhet inom 24h, även ett som aldrig klickat knappen.
  const [snoozedUntil, setSnoozedUntil] = useState(0)

  useEffect(() => {
    if (!email) { setSnoozedUntil(0); return }
    setSnoozedUntil(Number(localStorage.getItem(`${VERIFY_BANNER_SNOOZE_KEY}:${email}`) ?? 0))
  }, [email])

  if (!isLoggedIn || emailVerified || !flaggor.konto_epost_paminnelse || nu < snoozedUntil) return null

  async function handleResend() {
    if (status === 'sending') return
    setStatus('sending')
    try {
      await resendVerification()
      setStatus('sent')
    } catch {
      // Knappen är aktiv igen (så det går att försöka om), men användaren ska
      // få veta att inget mejl skickades — inte tro att det bara tog tid.
      setStatus('fel')
    }
  }

  function handleSnooze() {
    if (!email) return
    const until = Date.now() + VERIFY_BANNER_SNOOZE_MS
    localStorage.setItem(`${VERIFY_BANNER_SNOOZE_KEY}:${email}`, String(until))
    setSnoozedUntil(until)
  }

  return (
    <div className="bg-violet-600 px-6 py-2.5 flex items-center justify-between gap-3 shadow-md flex-wrap">
      <span className="text-sm text-white">
        Bekräfta din e-postadress{email ? ` — vi har skickat en länk till ${email}` : ''}.
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={handleSnooze}
          className="text-xs font-medium text-white/80 hover:text-white underline underline-offset-2 transition-colors"
        >
          Påminn senare
        </button>
        <button
          onClick={handleResend}
          disabled={status === 'sending' || status === 'sent'}
          className="text-xs font-semibold bg-white/20 hover:bg-white/30 disabled:opacity-70 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          {status === 'sent' ? 'Skickat!' : status === 'sending' ? 'Skickar…' : 'Skicka igen'}
        </button>
      </div>
      {status === 'fel' && (
        <span role="alert" className="text-sm font-semibold text-white w-full">
          Mejlet kunde inte skickas just nu. Försök igen om en stund.
        </span>
      )}
    </div>
  )
}
