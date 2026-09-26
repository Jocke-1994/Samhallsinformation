import { useMemo } from 'react'
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { fetchMittFlode } from '../api/events'
import { fetchSparadeHandelser } from '../api/savedEvents'
import { mittFlodeNyckel, sparatFlodeNyckel } from '../lib/queryNycklar'
import { useAnvandare } from './useAnvandare'
import type { HamtLage } from './useInloggadHamtning'
import type { CanonicalEvent, EventsResponse } from '../types'

// Mitt flöde och Sparat filtreras på servern (V3-11, beslut D2): klienten
// filtrerar inte längre över de 50 senaste händelserna från alla källor utan
// ber servern om användarens egna flöde, en sida i taget ("Ladda fler").
export const FLODE_SIDSTORLEK = 50

export interface ServerFlode {
  events: CanonicalEvent[]
  // laddar = första sidan hämtas, klar = servern har svarat (en TOM lista är då
  // ett verkligt "inget matchar"), fel = första hämtningen misslyckades. Ett fel
  // är aldrig en tom lista. Har sidor redan hämtats behålls de vid ett senare fel.
  lage: HamtLage
  forsokIgen: () => void
  harFler: boolean
  hamtaFler: () => void
  hamtarFler: boolean
  // Att hämta NÄSTA sida misslyckades (första sidan visas fortfarande).
  merFel: boolean
}

// Slår ihop sidorna och tar bort dubbletter: kommer nya händelser in mellan två
// sidhämtningar förskjuts sidgränsen och samma händelse kan annars visas två gånger.
export function slaIhopSidor(data: InfiniteData<EventsResponse> | undefined): CanonicalEvent[] {
  if (!data) return []
  const sedda = new Set<string>()
  const ut: CanonicalEvent[] = []
  for (const sida of data.pages) {
    for (const e of sida.events) {
      if (sedda.has(e.id)) continue
      sedda.add(e.id)
      ut.push(e)
    }
  }
  return ut
}

function useServerFlode(
  nyckel: readonly unknown[],
  hamta: (page: number, pageSize: number) => Promise<EventsResponse>,
  aktiv: boolean,
  farskHetsKrav?: { staleTime: number },
): ServerFlode {
  const query = useInfiniteQuery({
    queryKey: nyckel,
    queryFn: ({ pageParam }) => hamta(pageParam, FLODE_SIDSTORLEK),
    initialPageParam: 1,
    getNextPageParam: (senaste) => (senaste.hasMore ? senaste.page + 1 : undefined),
    enabled: aktiv,
    ...farskHetsKrav,
  })

  const events = useMemo(() => slaIhopSidor(query.data), [query.data])
  const lage: HamtLage = query.data !== undefined ? 'klar' : query.isError ? 'fel' : 'laddar'

  return {
    events,
    lage,
    forsokIgen: () => { void query.refetch() },
    harFler: query.hasNextPage,
    hamtaFler: () => { void query.fetchNextPage() },
    hamtarFler: query.isFetchingNextPage,
    merFel: query.isFetchNextPageError,
  }
}

export function useMittFlode(aktiv: boolean): ServerFlode {
  const anvandare = useAnvandare()
  return useServerFlode(mittFlodeNyckel(anvandare), fetchMittFlode, aktiv)
}

// Sparat hämtas om varje gång fliken öppnas: en händelse som sparats på annat
// håll (Alla/Mitt flöde) ska finnas med utan att man laddar om sidan.
export function useSparatFlode(aktiv: boolean): ServerFlode {
  const anvandare = useAnvandare()
  return useServerFlode(sparatFlodeNyckel(anvandare), fetchSparadeHandelser, aktiv, { staleTime: 0 })
}
