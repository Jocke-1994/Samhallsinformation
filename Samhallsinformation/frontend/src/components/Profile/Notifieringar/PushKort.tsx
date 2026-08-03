import { useEffect, useState } from 'react'
import Toggle from '../../common/Toggle'
import { fetchPushSettings, savePushSettings } from '../../../api/push'
import { isPushSupported, usePushSubscription } from '../../../hooks/usePushSubscription'

export default function PushKort() {
  const { isSubscribed, loading, subscribe, unsubscribe } = usePushSubscription()
  const [pushEnabled, setPushEnabled] = useState(true)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fel, setFel] = useState('')

  useEffect(() => {
    fetchPushSettings()
      .then(s => setPushEnabled(s.pushEnabled))
      .catch(() => {})
      .finally(() => setSettingsLoaded(true))
  }, [])

  async function handleAktivera() {
    setBusy(true)
    setFel('')
    try {
      await subscribe()
    } catch (err) {
      setFel(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setBusy(false)
    }
  }

  async function handleInaktivera() {
    setBusy(true)
    try {
      await unsubscribe()
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleMute(next: boolean) {
    setPushEnabled(next)
    try {
      await savePushSettings({ pushEnabled: next })
    } catch {
      setPushEnabled(!next)
    }
  }

  const stodjs = isPushSupported()

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">🔔</div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Push-notiser</h2>
              <p className="text-sm text-slate-500 mt-0.5">Få en notis när dina källor har något nytt</p>
            </div>
          </div>
          {isSubscribed && settingsLoaded && (
            <Toggle on={pushEnabled} onChange={handleToggleMute} />
          )}
        </div>
      </div>

      <div className="px-6 py-5">
        {!stodjs && (
          <p className="text-sm text-slate-400">Push stöds inte i den här webbläsaren.</p>
        )}

        {stodjs && !loading && !isSubscribed && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              Aktivera push för att få en notis direkt i webbläsaren när dina källor i Mitt flöde publicerar något nytt.
            </p>
            <button
              onClick={handleAktivera}
              disabled={busy}
              className="self-start px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {busy ? 'Aktiverar…' : 'Aktivera push-notiser'}
            </button>
            {fel && <p className="text-xs text-red-500">{fel}</p>}
          </div>
        )}

        {stodjs && isSubscribed && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              {pushEnabled
                ? 'Push aktiverat på den här enheten.'
                : 'Push är pausat — du prenumererar fortfarande på dina källor, men får inga notiser förrän du slår på igen.'}
            </p>
            <button
              onClick={handleInaktivera}
              disabled={busy}
              className="self-start px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
            >
              {busy ? 'Inaktiverar…' : 'Inaktivera på den här enheten'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
