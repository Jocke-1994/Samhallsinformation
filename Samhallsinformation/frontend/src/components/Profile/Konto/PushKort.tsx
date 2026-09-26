import { useEffect, useState } from 'react'
import Toggle from '../../common/Toggle'
import { fetchPushSettings, savePushSettings } from '../../../api/push'
import { isPushSupported, usePushSubscription } from '../../../hooks/usePushSubscription'
import { visaFel } from '../../../lib/felmeddelande'

// "Nytt ärende" är medvetet inte med här — kategorin finns i tanken men
// hålls dold tills vidare. Ingen separat "Aktivera push"-knapp — att slå på
// en kategori första gången triggar webbläsarens prenumeration i bakgrunden.
const NOTISTYPER = [
  { key: 'pushNyaHandelser', label: 'Ny händelse', beskrivning: 'När dina källor i Mitt flöde publicerar något nytt' },
  { key: 'pushNyVersion',    label: 'Ny version',   beskrivning: 'När en ny version av appen släpps' },
] as const satisfies readonly { key: NotisKategori; label: string; beskrivning: string }[]

type NotisKategori = 'pushNyaHandelser' | 'pushNyVersion'

export default function PushKort() {
  const { isSubscribed, loading, subscribe, unsubscribe } = usePushSubscription()
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [fel, setFel] = useState('')
  const [sparar, setSparar] = useState(false)
  const [notistyper, setNotistyper] = useState<Record<NotisKategori, boolean>>({ pushNyaHandelser: false, pushNyVersion: false })

  useEffect(() => {
    if (loading) return
    if (!isSubscribed) { setSettingsLoaded(true); return }
    fetchPushSettings()
      .then(s => setNotistyper({ pushNyaHandelser: s.pushNyaHandelser, pushNyVersion: s.pushNyVersion }))
      .catch(() => {})
      .finally(() => setSettingsLoaded(true))
  }, [loading, isSubscribed])

  async function toggleKategori(key: NotisKategori, next: boolean) {
    // En växling i taget: en andra under pågående anrop räknas mot ett ännu
    // obekräftat läge. Reglaget visar hela tiden det SPARADE läget och byter
    // först när servern svarat, så ett misslyckande lämnar det som det var.
    if (sparar) return
    setSparar(true)
    setFel('')
    const nextState = { ...notistyper, [key]: next }
    const någonAktiv = nextState.pushNyaHandelser || nextState.pushNyVersion

    try {
      if (next && !isSubscribed) {
        await subscribe()
      } else if (!någonAktiv && isSubscribed) {
        await unsubscribe()
      }
      await savePushSettings(nextState)
      setNotistyper(nextState)
    } catch (err) {
      setFel(visaFel(err, 'Notisinställningen kunde inte sparas. Försök igen.'))
    } finally {
      setSparar(false)
    }
  }

  const stodjs = isPushSupported()

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">🔔</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Push-notiser</h2>
            <p className="text-sm text-slate-500 mt-0.5">Välj vad du vill bli notifierad om</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-2">
        {!stodjs && (
          <p className="text-sm text-slate-400 py-4">Push stöds inte i den här webbläsaren.</p>
        )}

        {stodjs && !loading && settingsLoaded && NOTISTYPER.map(n => (
          <div key={n.key} className="flex items-center justify-between gap-4 py-4 border-b border-slate-100 last:border-0">
            <div>
              <p className="text-sm font-medium text-slate-700">{n.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{n.beskrivning}</p>
            </div>
            <Toggle on={notistyper[n.key]} onChange={next => toggleKategori(n.key, next)} disabled={sparar} />
          </div>
        ))}

        {fel && <p role="alert" className="text-xs text-red-500 pb-4">{fel}</p>}
      </div>
    </div>
  )
}
