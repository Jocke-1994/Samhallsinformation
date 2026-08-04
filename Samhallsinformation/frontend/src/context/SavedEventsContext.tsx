import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { fetchSavedEventIds, saveEvent, unsaveEvent } from '../api/savedEvents'
import { useAuth } from './AuthContext'

// "Sparat" (session 24) — bokmärk enskilda händelser oavsett källa. Ett
// unikt index i backend (UserId, EventId) gör att samma händelse aldrig kan
// sparas två gånger, så toggle här är bara en spegling av det.
interface SavedEventsContextValue {
  sparade: Set<string>
  toggleSparad: (eventId: string) => void
}

const SavedEventsContext = createContext<SavedEventsContextValue | null>(null)

export function SavedEventsProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth()
  const [sparade, setSparade] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isLoggedIn) { setSparade(new Set()); return }
    let avbruten = false
    fetchSavedEventIds().then(ids => { if (!avbruten) setSparade(new Set(ids)) }).catch(() => {})
    return () => { avbruten = true }
  }, [isLoggedIn])

  function toggleSparad(eventId: string) {
    const tarBort = sparade.has(eventId)

    setSparade(prev => {
      const n = new Set(prev)
      tarBort ? n.delete(eventId) : n.add(eventId)
      return n
    })

    const anrop = tarBort ? unsaveEvent(eventId) : saveEvent(eventId)
    anrop.catch(() => {
      // Misslyckades på riktigt (t.ex. nätverksfel) — rulla tillbaka den
      // optimistiska uppdateringen så ikonen inte ljuger om vad som faktiskt
      // sparats i backend.
      setSparade(prev => {
        const n = new Set(prev)
        tarBort ? n.add(eventId) : n.delete(eventId)
        return n
      })
    })
  }

  return (
    <SavedEventsContext.Provider value={{ sparade, toggleSparad }}>
      {children}
    </SavedEventsContext.Provider>
  )
}

export function useSavedEvents() {
  const ctx = useContext(SavedEventsContext)
  if (!ctx) throw new Error('useSavedEvents måste användas inom SavedEventsProvider')
  return ctx
}
