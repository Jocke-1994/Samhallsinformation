import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPushSettings, savePushSettings, type PushSettingsDto } from '../../api/push'
import { useAuth } from '../../context/AuthContext'
import { isPushSupported, usePushSubscription } from '../../hooks/usePushSubscription'
import { visaFel } from '../../lib/felmeddelande'
import { pushInstallningarNyckel } from '../../lib/queryNycklar'

// Prova själv-målet "aktivera-push" (beslut 2026-11-03): i stället för en länk
// till Konto → Push-notiser frågar nyheten direkt och har en Aktivera-knapp.
// Knappen slår på BÅDA kategorierna (Ny händelse + Ny version), och rutan
// säger det rakt ut, så ingen får notiser den inte visste om.

const RUTA = 'mt-2 flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3'
const VAD = 'Du får en notis när det kommer något nytt från dina källor och när appen får nya funktioner.'
const KNAPP = 'self-end px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors'

function KontoLänk({ onKlick }: { onKlick?: () => void }) {
  return (
    <Link to="/profil?section=konto" onClick={onKlick} className="font-semibold text-violet-700 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200">
      Konto → Push-notiser
    </Link>
  )
}

/** Utseendet utan funktion — för adminens förhandsvisning, där inget får hända på riktigt. */
export function AktiveraPushRutaForhandsvisning() {
  return (
    <div className={RUTA}>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">🔔 Vill du aktivera push-notiser?</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{VAD}</p>
      <span className={KNAPP}>Aktivera</span>
    </div>
  )
}

export default function AktiveraPushRuta({ onKlick }: { onKlick?: () => void }) {
  const { email } = useAuth()
  const queryClient = useQueryClient()
  const { isSubscribed, loading, subscribe } = usePushSubscription()
  const nyckel = pushInstallningarNyckel(email)
  const installningar = useQuery({ queryKey: nyckel, queryFn: fetchPushSettings })
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState('')

  if (!isPushSupported()) {
    return (
      <div className={RUTA}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Push stöds inte i den här webbläsaren. På iPhone behöver appen vara installerad på hemskärmen.
        </p>
      </div>
    )
  }

  if (loading || installningar.isLoading) return null

  const påslaget = isSubscribed && !!installningar.data?.pushNyaHandelser && !!installningar.data?.pushNyVersion
  if (påslaget) {
    return (
      <div className={RUTA} role="status">
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✓ Push-notiser är på</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {VAD} Ändra under <KontoLänk onKlick={onKlick} />.
        </p>
      </div>
    )
  }

  const blockerat = typeof Notification !== 'undefined' && Notification.permission === 'denied'

  async function aktivera() {
    if (sparar) return
    setSparar(true)
    setFel('')
    try {
      // Enheten först — nekas tillståndet ändras inget på kontot.
      if (!isSubscribed) await subscribe()
      const ändring: Partial<PushSettingsDto> = { pushNyaHandelser: true, pushNyVersion: true }
      await savePushSettings(ändring)
      queryClient.setQueryData<PushSettingsDto>(nyckel, gammal => (gammal ? { ...gammal, ...ändring } : gammal))
    } catch (err) {
      setFel(visaFel(err, 'Push-notiserna kunde inte aktiveras. Försök igen.'))
    } finally {
      setSparar(false)
    }
  }

  return (
    <div className={RUTA}>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">🔔 Vill du aktivera push-notiser?</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{VAD}</p>
      {blockerat ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Notiser är blockerade för den här sidan. Tillåt dem i webbläsarens inställningar och försök igen.
        </p>
      ) : (
        <button type="button" onClick={aktivera} disabled={sparar} className={KNAPP}>
          {sparar ? 'Aktiverar...' : 'Aktivera'}
        </button>
      )}
      {fel && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{fel}</p>}
    </div>
  )
}
