import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { fetchSources } from '../api/sources'
import { saveUserSources, type SourcePrefUpdate } from '../api/userSources'
import AllaKallorKort from '../components/Profile/MinaKallor/AllaKallorKort'
import GoogleSignInButton from '../components/Auth/GoogleSignInButton'
import BetaBadge from '../components/common/BetaBadge'
import type { Source } from '../types'
import { visaFel } from '../lib/felmeddelande'

type Steg = 'konto' | 'kallor' | 'klart'
const STEG_ORDNING: Steg[] = ['konto', 'kallor', 'klart']
const STEG_LABEL: Record<Steg, string> = { konto: 'Konto', kallor: 'Källor', klart: 'Klart' }

export default function OnboardingPage() {
  const { isLoggedIn, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') ?? '/'

  const [steg, setSteg] = useState<Steg>('konto')
  // Google-inloggning loggar in direkt vid klick i steg 1, och lösenordsvägen
  // loggar in så fort register() lyckas i steg 3 — i båda fallen finns ett
  // konto innan sidan är klar med sin egen guide, så redirect-bevakningen
  // nedan ska inte kicka ut användaren mitt i flödet.
  const [kontoSkapat, setKontoSkapat] = useState(false)

  // Sidan är till för utloggade besökare som ska skapa konto — inget
  // konto finns förrän sista steget, så en redan inloggad användare har
  // inget att göra här.
  useEffect(() => {
    if (isLoggedIn && !kontoSkapat) navigate(redirect, { replace: true })
  }, [isLoggedIn, kontoSkapat, navigate, redirect])

  // Steg 1
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [kontoFel, setKontoFel] = useState<string | null>(null)
  const [epostFel, setEpostFel] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Tidig formatkontroll av e-post (på blur, inte varje tangenttryck) — ingen
  // billig "finns adressen redan"-endpoint finns i backend (se PR-texten),
  // så den riktiga upptagen-kontrollen sker fortfarande först i handleKontoNasta
  // (idag facto i sista steget via register()). Det här ger i alla fall
  // omedelbar feedback på ett felstavat format, i stället för att vänta till
  // "Nästa" eller sista steget.
  function hanteraEpostBlur() {
    if (!email) return setEpostFel(null)
    const giltigt = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    setEpostFel(giltigt ? null : 'Ange en giltig e-postadress')
  }

  // Steg 2 — bara lokalt state, inget konto finns att spara mot än
  const [valdaKällor, setValdaKällor] = useState<Set<number>>(new Set())
  const { data: sources = [] } = useQuery<Source[]>({ queryKey: ['sources'], queryFn: fetchSources })

  // Steg 3
  const [skapar, setSkapar]   = useState(false)
  const [slutFel, setSlutFel] = useState<string | null>(null)

  if (isLoggedIn && !kontoSkapat) return null

  const activeSources = sources.filter(s => valdaKällor.has(s.id))

  function handleKontoNasta(e: FormEvent) {
    e.preventDefault()
    setKontoFel(null)
    if (!name.trim()) return setKontoFel('Ange ditt namn')
    // Ett Google-skapat konto (kontoSkapat=true) har redan lösenord/villkor
    // hanterat av OAuth-flödet — ett "Tillbaka" hit (för att t.ex. rätta
    // namnet) ska inte plötsligt kräva att man hittar på ett lösenord som
    // ändå kastas (se steg='konto'-grenen nedan, som inte ens visar fälten).
    if (!kontoSkapat) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setKontoFel('Ange en giltig e-postadress')
      if (password !== confirm) return setKontoFel('Lösenorden matchar inte')
      if (password.length < 8) return setKontoFel('Lösenordet måste vara minst 8 tecken')
      if (!acceptedTerms) return setKontoFel('Du måste godkänna användarvillkoren')
    }
    setSteg('kallor')
  }

  function avbryt() {
    navigate('/', { replace: true })
  }

  function handleAdd(ids: number[]) {
    setValdaKällor(prev => new Set([...prev, ...ids]))
  }

  function handleRemove(ids: number[]) {
    setValdaKällor(prev => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }

  async function slutfor() {
    setSlutFel(null)
    setSkapar(true)
    if (!kontoSkapat) {
      try {
        await register(name, email, password, acceptedTerms)
        setKontoSkapat(true)
      } catch (err) {
        setSkapar(false)
        setSlutFel(visaFel(err, 'Kontot kunde inte skapas just nu. Kontrollera anslutningen och försök igen.'))
        return
      }
    }

    if (valdaKällor.size > 0) {
      const uppdateringar: SourcePrefUpdate[] = [...valdaKällor].map((sourceId, i) => ({
        sourceId, isActive: true, sortOrder: i,
      }))
      try {
        await saveUserSources(uppdateringar)
      } catch {
        setSkapar(false)
        setSlutFel('Kontot skapades, men dina valda källor kunde inte sparas. Försök igen, eller fortsätt och lägg till dem senare under Mina källor.')
        return
      }
    }

    navigate(redirect, { replace: true })
  }

  const stegIndex = STEG_ORDNING.indexOf(steg)

  return (
    <div className="min-h-full bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">

        {/* Stegindikator */}
        <div className="flex items-center gap-2 mb-6">
          {STEG_ORDNING.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                i === stegIndex ? 'bg-violet-600 text-white'
                  : i < stegIndex ? 'bg-violet-100 text-violet-700'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {STEG_LABEL[s]}
              </span>
              {i < STEG_ORDNING.length - 1 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8">

          {steg === 'konto' && (
            <div>
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">Skapa konto</h1>
                  <BetaBadge />
                </div>
                <p className="text-sm text-slate-500 mt-1">Kom igång på under en minut.</p>
              </div>
              <form onSubmit={handleKontoNasta} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Namn</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ditt namn" required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                {kontoSkapat ? (
                  // Kontot är redan skapat via Google (man klickade "Tillbaka" från
                  // Källor-steget) — inget lösenord/villkor att fylla i igen, bara
                  // ett bekräftande av vilket konto det gäller.
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">E-post</label>
                    <p className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-sm">
                      {email} · inloggad via Google
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">E-post</label>
                      <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                        onBlur={hanteraEpostBlur}
                        placeholder="din@epost.se" required
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                      {epostFel && <p className="text-xs text-red-600 mt-1">{epostFel}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Lösenord</label>
                      <input
                        type="password" value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Minst 8 tecken" required
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Bekräfta lösenord</label>
                      <input
                        type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                        placeholder="••••••••" required
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>
                    <label className="flex items-start gap-2.5 text-sm text-slate-600">
                      <input
                        type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-400 shrink-0"
                      />
                      <span>
                        Jag godkänner{' '}
                        <Link to="/villkor" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-500 font-medium">
                          användarvillkoren och integritetspolicyn
                        </Link>
                      </span>
                    </label>
                  </>
                )}
                {kontoFel && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3.5 py-2.5">{kontoFel}</p>
                )}
                <button
                  type="submit"
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg text-sm transition-colors mt-1"
                >
                  Nästa
                </button>
                <button
                  type="button"
                  onClick={avbryt}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg text-sm transition-colors"
                >
                  Avbryt
                </button>
              </form>

              {!kontoSkapat && (
                <div className="mt-5">
                  <GoogleSignInButton
                    onStart={() => { setKontoFel(null); setGoogleLoading(true) }}
                    onError={message => { setKontoFel(message); setGoogleLoading(false) }}
                    onSuccess={(profile, isNewUser) => {
                      if (!isNewUser) {
                        // Redan ett befintligt konto (lösenords- eller Google-
                        // baserat) — det här var i praktiken en inloggning, inte
                        // en registrering. Hoppa förbi hela guiden precis som
                        // /login redan gör, annars riskerar Källor-steget att
                        // skriva över redan sparade källval på ett riktigt konto.
                        navigate(redirect, { replace: true })
                        return
                      }
                      setName(profile.name)
                      setEmail(profile.email)
                      setKontoSkapat(true)
                      setGoogleLoading(false)
                      setSteg('kallor')
                    }}
                  />
                  {googleLoading && <p className="text-center text-xs text-slate-400 mt-2">Loggar in…</p>}
                </div>
              )}

              {!kontoSkapat && (
                <p className="text-center text-sm text-slate-500 mt-5">
                  Har du redan ett konto?{' '}
                  <Link to={`/login${redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-violet-600 hover:text-violet-500 font-medium">
                    Logga in här
                  </Link>
                </p>
              )}
            </div>
          )}

          {steg === 'kallor' && (
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <h1 className="text-lg font-bold text-slate-900">Vilka källor vill du följa?</h1>
                <p className="text-sm text-slate-500 mt-1">Du kan alltid ändra det här senare under Mina källor.</p>
              </div>
              <AllaKallorKort sources={sources} activeIds={valdaKällor} onAdd={handleAdd} onRemove={handleRemove} />
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={() => setSteg('konto')}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors"
                >
                  Tillbaka
                </button>
                <button
                  onClick={() => setSteg('klart')}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Nästa
                </button>
              </div>
            </div>
          )}

          {steg === 'klart' && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-2xl">👋</div>
              <h1 className="text-xl font-bold text-slate-900">Redo att skapa ditt konto?</h1>
              <div className="text-sm text-slate-600 bg-slate-50 rounded-xl px-5 py-4 w-full text-left flex flex-col gap-1.5">
                <p><span className="font-medium">Namn:</span> {name}</p>
                <p><span className="font-medium">E-post:</span> {email}</p>
                <p>
                  <span className="font-medium">Källor:</span>{' '}
                  {activeSources.length > 0
                    ? activeSources.map(s => s.name).join(', ')
                    : 'Inga valda än — lägg till närhelst under Mina källor.'}
                </p>
              </div>
              {slutFel && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3.5 py-2.5 w-full">{slutFel}</p>
              )}
              <div className="flex flex-col sm:flex-row items-center gap-3 mt-2 w-full">
                <button
                  onClick={() => setSteg('kallor')}
                  disabled={skapar}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 text-sm font-medium rounded-lg transition-colors"
                >
                  Tillbaka
                </button>
                <button
                  onClick={slutfor}
                  disabled={skapar}
                  className="w-full sm:w-auto px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {skapar ? 'Skapar konto…' : 'Gå till mitt flöde'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
