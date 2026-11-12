import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'

// Delad hämtning för användarspecifika listor som hålls i en kontext
// (Polisen-bevakningar, sparade händelser). Ett tydligt läge i stället för ett
// "laddat"-flagga som även ett misslyckande sätter:
//   laddar = ingen lista känd än (första hämtningen pågår eller omförsöks)
//   klar   = en lista har hämtats (och behålls som "senast kända" om en senare
//            hämtning skulle misslyckas)
//   fel    = ingen lista känd och alla omförsök har misslyckats
// Ett misslyckat anrop får ALDRIG tolkas som en tom lista.
export type HamtLage = 'laddar' | 'klar' | 'fel'

// Omförsök vid fel (utöver adminFetchs egen 401-hantering): 3 stycken med
// exponentiell backoff 1 s, 2 s, 4 s.
export const MAX_OMFORSOK = 3
export const OMFORSOK_BAS_MS = 1000
export const OMFORSOK_TAK_MS = 15_000

export function beraknaOmforsokFordrojning(misslyckade: number): number {
  return Math.min(OMFORSOK_BAS_MS * 2 ** Math.max(0, misslyckade), OMFORSOK_TAK_MS)
}

export interface InloggadHamtning<T> {
  data: T | undefined
  lage: HamtLage
  // Hämtar om (t.ex. från en "Försök igen"-knapp).
  forsokIgen: () => void
  // Uppdaterar den lokala kopian (optimistiska/lyckade mutationer). Gör
  // ingenting om ingen lista är känd — en delmängd får aldrig se ut som hela listan.
  uppdatera: (fn: (prev: T) => T) => void
}

export function useInloggadHamtning<T>(
  nyckel: string,
  hamta: () => Promise<T>,
): InloggadHamtning<T> {
  const { isLoggedIn, email, accessToken } = useAuth()
  const queryClient = useQueryClient()
  const anvandare = email ?? null

  const query = useQuery({
    queryKey: [nyckel, anvandare],
    queryFn: hamta,
    enabled: isLoggedIn,
    retry: MAX_OMFORSOK,
    retryDelay: beraknaOmforsokFordrojning,
    // En hämtning per session/användare: fönsterfokus och liknande ska inte
    // skriva över optimistiska ändringar mitt i en toggle.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Utloggning: släpp den gamla användarens lista (ny hämtning vid nästa inloggning).
  useEffect(() => {
    if (!isLoggedIn) queryClient.removeQueries({ queryKey: [nyckel] })
  }, [isLoggedIn, nyckel, queryClient])

  // Ny/förnyad token efter ett misslyckande (lyckad refresh eller ny inloggning):
  // hämta om direkt i stället för att vänta ut backoffen. Läser läget ur
  // cachen i själva effekten så att den bara styrs av token-bytet.
  useEffect(() => {
    const tillstand = queryClient.getQueryState([nyckel, anvandare])
    if (tillstand?.status === 'error' && tillstand.fetchStatus !== 'fetching') {
      void queryClient.refetchQueries({ queryKey: [nyckel, anvandare] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  const arFel = query.status === 'error' && query.fetchStatus !== 'fetching'
  const lage: HamtLage = query.data !== undefined ? 'klar' : arFel ? 'fel' : 'laddar'

  const uppdatera = useCallback(
    (fn: (prev: T) => T) => {
      queryClient.setQueryData<T>([nyckel, anvandare], (prev) =>
        prev === undefined ? prev : fn(prev),
      )
    },
    [queryClient, nyckel, anvandare],
  )

  const refetch = query.refetch
  const forsokIgen = useCallback(() => {
    void refetch()
  }, [refetch])

  return { data: query.data, lage, forsokIgen, uppdatera }
}
