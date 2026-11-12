import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Toggle from '../../common/Toggle'
import { fetchPushSettings, savePushSettings, type PushSettingsDto } from '../../../api/push'
import { useAuth } from '../../../context/AuthContext'
import { isPushSupported, usePushSubscription } from '../../../hooks/usePushSubscription'
import { visaFel } from '../../../lib/felmeddelande'
import { pushInstallningarNyckel } from '../../../lib/queryNycklar'

// "Nytt ärende" är medvetet inte med här — kategorin finns i tanken men
// hålls dold tills vidare. Ingen separat "Aktivera push"-knapp för kategorierna —
// att slå på en kategori på en enhet som inte är registrerad triggar
// webbläsarens prenumeration i bakgrunden.
const NOTISTYPER = [
  {
    key: 'pushNyaHandelser',
    label: 'Ny händelse',
    beskrivning: 'När dina källor i Mitt flöde publicerar något nytt',
  },
  { key: 'pushNyVersion', label: 'Ny version', beskrivning: 'När en ny version av appen släpps' },
] as const satisfies readonly { key: NotisKategori; label: string; beskrivning: string }[]

type NotisKategori = 'pushNyaHandelser' | 'pushNyVersion'

// Två skilda saker visas här och får aldrig blandas ihop:
//  - KONTOTS inställningar (kategorierna): lagras på servern, per konto, delas
//    av alla användarens enheter. Hämtas alltid, oavsett den här enhetens status.
//  - DEN HÄR ENHETENS registrering: webbläsarens prenumeration (per enhet).
// En växling skickar bara det fält användaren själv ändrade — aldrig ett
// helt "nästa tillstånd" byggt på lokala utgångsvärden, som kunde nollställa
// kategorier satta från andra enheter.
export default function PushKort() {
  const { email } = useAuth()
  const queryClient = useQueryClient()
  const { isSubscribed, loading, subscribe, unsubscribe } = usePushSubscription()
  const [fel, setFel] = useState('')
  const [sparar, setSparar] = useState(false)

  const nyckel = pushInstallningarNyckel(email)
  const installningar = useQuery({ queryKey: nyckel, queryFn: fetchPushSettings })

  const sparaInstallning = useMutation({
    mutationFn: (andring: Partial<PushSettingsDto>) => savePushSettings(andring),
    // Cachen (och därmed reglaget) byter först när servern bekräftat.
    onSuccess: (_data, andring) => {
      queryClient.setQueryData<PushSettingsDto>(nyckel, (gammal) =>
        gammal ? { ...gammal, ...andring } : gammal,
      )
    },
  })

  async function toggleKategori(key: NotisKategori, next: boolean) {
    // En växling i taget: en andra under pågående anrop räknas mot ett ännu
    // obekräftat läge. Reglaget visar hela tiden det SPARADE läget och byter
    // först när servern svarat, så ett misslyckande lämnar det som det var.
    const aktuella = installningar.data
    if (sparar || !aktuella) return
    setSparar(true)
    setFel('')
    const efter = { ...aktuella, [key]: next }
    const nagonAktiv = efter.pushNyaHandelser || efter.pushNyVersion

    try {
      // Slås en kategori på från en enhet som inte är registrerad registreras
      // enheten först; nekas tillstånd ändras inget alls på kontot.
      if (next && !isSubscribed) await subscribe()
      await sparaInstallning.mutateAsync({ [key]: next })
    } catch (err) {
      setFel(visaFel(err, 'Notisinställningen kunde inte sparas. Försök igen.'))
      setSparar(false)
      return
    }

    // Kontoinställningen är sparad. Är ingen kategori kvar avregistreras bara
    // den här enheten; misslyckas det påverkar det inte det sparade läget.
    if (!nagonAktiv && isSubscribed) {
      try {
        await unsubscribe()
      } catch (err) {
        setFel(
          visaFel(err, 'Inställningen sparades, men den här enheten kunde inte avregistreras.'),
        )
      }
    }
    setSparar(false)
  }

  async function aktiveraEnhet() {
    if (sparar) return
    setSparar(true)
    setFel('')
    try {
      await subscribe()
    } catch (err) {
      setFel(visaFel(err, 'Den här enheten kunde inte registreras för notiser. Försök igen.'))
    } finally {
      setSparar(false)
    }
  }

  const stodjs = isPushSupported()

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">
            🔔
          </div>
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

        {stodjs &&
          installningar.data &&
          NOTISTYPER.map((n) => (
            <div
              key={n.key}
              className="flex items-center justify-between gap-4 py-4 border-b border-slate-100 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-slate-700">{n.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{n.beskrivning}</p>
              </div>
              <Toggle
                on={installningar.data[n.key]}
                onChange={(next) => toggleKategori(n.key, next)}
                disabled={sparar}
              />
            </div>
          ))}

        {stodjs && installningar.isError && (
          <p role="alert" className="text-xs text-red-500 py-4">
            Dina notisinställningar kunde inte hämtas. Ladda om sidan och försök igen.
          </p>
        )}

        {stodjs && !loading && (
          <div className="flex items-center justify-between gap-4 py-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              {isSubscribed
                ? 'Den här enheten är registrerad för notiser.'
                : 'Den här enheten är inte registrerad för notiser.'}
            </p>
            {!isSubscribed && (
              <button
                type="button"
                onClick={aktiveraEnhet}
                disabled={sparar}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all shadow-sm hover:shadow shrink-0"
              >
                Aktivera på den här enheten
              </button>
            )}
          </div>
        )}

        {fel && (
          <p role="alert" className="text-xs text-red-500 pb-4">
            {fel}
          </p>
        )}
      </div>
    </div>
  )
}
