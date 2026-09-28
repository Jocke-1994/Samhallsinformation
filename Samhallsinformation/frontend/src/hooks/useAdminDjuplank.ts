import { useCallback, useEffect, useState } from 'react'
import type { DetaljFlik } from '../components/Admin/Anvandare'

// Djuplänkar i adminpanelen (notisklockan, Händelsesök, "Öppna ärende" m.fl.)
// ska KONSUMERAS EN GÅNG: mottagande komponent öppnar sitt mål och anropar
// sedan `konsumera…`, som nollställer värdet. Annars ligger målet kvar och
// öppnas igen vid varje refetch/besök — fel mål för en åtgärd (V2-16, E6#3).
// Eftersom värdet nollställs mellan länkarna fungerar samma mål två gånger i
// rad. En obekräftad djuplänk (t.ex. användaren hittas inte) rensas också när
// man lämnar målsektionen, så den inte ligger och väntar till nästa besök.

export interface AnvändarDjuplänk {
  epost: string
  flik:  DetaljFlik
}

export function useAdminDjuplank(section: string) {
  const [användarMål, setAnvändarMål] = useState<AnvändarDjuplänk | undefined>(undefined)
  const [inboxÄrendeId, setInboxÄrendeId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (section !== 'anvandare') setAnvändarMål(undefined)
    if (section !== 'support-inbox') setInboxÄrendeId(undefined)
  }, [section])

  const öppnaAnvändare = useCallback((epost: string, flik: DetaljFlik) => {
    setAnvändarMål({ epost, flik })
  }, [])
  const öppnaInboxÄrende = useCallback((id: string) => setInboxÄrendeId(id), [])
  const konsumeraAnvändare = useCallback(() => setAnvändarMål(undefined), [])
  const konsumeraInboxÄrende = useCallback(() => setInboxÄrendeId(undefined), [])

  return {
    användarMål, inboxÄrendeId,
    öppnaAnvändare, öppnaInboxÄrende, konsumeraAnvändare, konsumeraInboxÄrende,
  }
}
