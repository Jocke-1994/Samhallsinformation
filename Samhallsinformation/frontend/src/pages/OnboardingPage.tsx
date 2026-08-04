import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { fetchSources } from '../api/sources'
import { fetchUserSources, saveUserSources, type SourcePrefUpdate } from '../api/userSources'
import AllaKallorKort from '../components/Profile/MinaKallor/AllaKallorKort'
import type { Source } from '../types'

type Steg = 'konto' | 'kallor' | 'klart'
const STEG_ORDNING: Steg[] = ['konto', 'kallor', 'klart']
const STEG_LABEL: Record<Steg, string> = { konto: 'Konto', kallor: 'Källor', klart: 'Klart' }

export default function OnboardingPage() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') ?? '/'
  const { name, email } = (location.state ?? {}) as { name?: string; email?: string }

  const [steg, setSteg] = useState<Steg>('konto')

  useEffect(() => {
    if (!isLoggedIn) navigate('/login?redirect=/onboarding', { replace: true })
  }, [isLoggedIn, navigate])

  const queryClient = useQueryClient()
  const { data: sources = [] } = useQuery<Source[]>({ queryKey: ['sources'], queryFn: fetchSources, enabled: isLoggedIn })
  const { data: prefs = [] } = useQuery({ queryKey: ['user-sources'], queryFn: fetchUserSources, enabled: isLoggedIn })

  const mutation = useMutation({
    mutationFn: saveUserSources,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-sources'] }),
  })

  if (!isLoggedIn) return null

  const activeIds     = new Set(prefs.filter(p => p.isActive).map(p => p.sourceId))
  const activeSources = sources.filter(s => activeIds.has(s.id))

  function handleAdd(ids: number[]) {
    let nastaOrdning = prefs.filter(p => p.isActive).length
    const uppdateringar: SourcePrefUpdate[] = ids.map(sourceId => {
      const befintlig = prefs.find(p => p.sourceId === sourceId)
      return { sourceId, isActive: true, sortOrder: befintlig?.sortOrder ?? nastaOrdning++ }
    })
    mutation.mutate(uppdateringar)
  }

  function avsluta() { navigate(redirect, { replace: true }) }

  const stegIndex = STEG_ORDNING.indexOf(steg)

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">

        {/* Header: stegindikator + hoppa över */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
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
          <button onClick={avsluta} className="text-xs text-slate-400 hover:text-slate-600 font-medium">
            Hoppa över introduktionen
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">

          {steg === 'konto' && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-2xl">👋</div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Välkommen{name ? `, ${name}` : ''}!</h1>
                {email && <p className="text-sm text-slate-500 mt-1">{email}</p>}
              </div>
              <p className="text-sm text-slate-500 max-w-sm">
                Ditt konto är klart. Nästa steg: välj vilka myndigheter du vill följa,
                så anpassar vi ditt flöde direkt.
              </p>
              <button
                onClick={() => setSteg('kallor')}
                className="mt-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Nästa
              </button>
            </div>
          )}

          {steg === 'kallor' && (
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <h1 className="text-lg font-bold text-slate-900">Vilka källor vill du följa?</h1>
                <p className="text-sm text-slate-500 mt-1">Du kan alltid ändra det här senare under Mina källor.</p>
              </div>
              <AllaKallorKort sources={sources} activeIds={activeIds} onAdd={handleAdd} />
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
              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center text-2xl">✓</div>
              <h1 className="text-xl font-bold text-slate-900">Klart!</h1>
              <div className="text-sm text-slate-600 bg-slate-50 rounded-xl px-5 py-4 w-full text-left flex flex-col gap-1.5">
                {name && <p><span className="font-medium">Namn:</span> {name}</p>}
                {email && <p><span className="font-medium">E-post:</span> {email}</p>}
                <p>
                  <span className="font-medium">Källor:</span>{' '}
                  {activeSources.length > 0
                    ? activeSources.map(s => s.name).join(', ')
                    : 'Inga valda än — lägg till närhelst under Mina källor.'}
                </p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => setSteg('kallor')}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors"
                >
                  Tillbaka
                </button>
                <button
                  onClick={avsluta}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Gå till mitt flöde
                </button>
              </div>
              <Link to="/profil?section=support" className="text-xs text-violet-600 hover:text-violet-500 font-medium">
                Har du frågor? Läs vanliga frågor och svar
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
