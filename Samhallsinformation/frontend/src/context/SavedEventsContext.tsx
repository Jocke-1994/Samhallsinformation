import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { fetchSavedEventIds, saveEvent, unsaveEvent } from '../api/savedEvents'
import { useInloggadHamtning, type HamtLage } from '../hooks/useInloggadHamtning'

// "Sparat" (session 24) — bokmärk enskilda händelser oavsett källa. Ett
// unikt index i backend (UserId, EventId) gör att samma händelse aldrig kan
// sparas två gånger, så toggle här är bara en spegling av det.
interface SavedEventsContextValue {
  sparade: Set<string>
  // laddar = listan inte hämtad än, klar = hämtad, fel = hämtningen misslyckades
  // (efter omförsök). Vid laddar/fel är `sparade` OKÄNT (tom mängd betyder då
  // inte "inget sparat") och toggleSparad gör ingenting.
  lage: HamtLage
  forsokIgen: () => void
  toggleSparad: (eventId: string) => void
}

const SavedEventsContext = createContext<SavedEventsContextValue | null>(null)

export function SavedEventsProvider({ children }: { children: ReactNode }) {
  const { data: ids, lage, forsokIgen, uppdatera } =
    useInloggadHamtning<string[]>('saved-events', fetchSavedEventIds)
  const sparade = useMemo(() => new Set(ids ?? []), [ids])

  function toggleSparad(eventId: string) {
    // Okänd lista: en toggle vore en gissning (och ett "spara" av något som
    // redan är sparat ger 500 mot backendens unika index).
    if (lage !== 'klar') return
    const tarBort = sparade.has(eventId)

    const laggTill = (l: string[]) => (l.includes(eventId) ? l : [...l, eventId])
    const taBortUr = (l: string[]) => l.filter(id => id !== eventId)
    uppdatera(tarBort ? taBortUr : laggTill)

    const anrop = tarBort ? unsaveEvent(eventId) : saveEvent(eventId)
    anrop.catch(() => {
      // Misslyckades på riktigt (t.ex. nätverksfel) — rulla tillbaka den
      // optimistiska uppdateringen så ikonen inte ljuger om vad som faktiskt
      // sparats i backend.
      uppdatera(tarBort ? laggTill : taBortUr)
    })
  }

  return (
    <SavedEventsContext.Provider value={{ sparade, lage, forsokIgen, toggleSparad }}>
      {children}
    </SavedEventsContext.Provider>
  )
}

export function useSavedEvents() {
  const ctx = useContext(SavedEventsContext)
  if (!ctx) throw new Error('useSavedEvents måste användas inom SavedEventsProvider')
  return ctx
}
