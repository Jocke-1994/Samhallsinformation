import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSupportNotifications } from '../api/support'
import { fetchUserNotifications } from '../api/adminUsers'
import { kontoNotiserNyckel, supportNotiserNyckel } from '../lib/queryNycklar'
import { useAnvandare } from './useAnvandare'
import type { PendingNotis } from '../types/adminNotis'
import type { AdminRoll } from '../lib/adminNavigering'

// EN källa till adminpanelens notisklocka (V3-20, E6#11). Tidigare bodde de två
// queryerna inuti Support-inbox och Användare och bubblade upp var sin lista via
// `onPendingNotiser`, som ERSATTE klockans lista — så klockan var tom tills Support-inbox
// hade öppnats och flippade mellan ärende- och kontonotiser beroende på vilken flik
// som var monterad. Nu läser klockan (AdminPage) båda härifrån, oberoende av vilken
// sektion som visas; sektionerna delar samma query-nycklar och därmed samma cache.

const NOTIS_INTERVALL = 30_000

/** Ärendenotiser (förfallna påminnelser, tilldelningar) — Admin och Support. */
export function useSupportNotiser(aktiv = true) {
  const anvandare = useAnvandare()
  return useQuery({
    queryKey: supportNotiserNyckel(anvandare),
    queryFn: fetchSupportNotifications,
    refetchInterval: NOTIS_INTERVALL,
    enabled: aktiv,
  })
}

/** Kontospärr-påminnelser — Admin-only i backend (Support får 403), så bara för Admin. */
export function useKontoNotiser(aktiv = true) {
  const anvandare = useAnvandare()
  return useQuery({
    queryKey: kontoNotiserNyckel(anvandare),
    queryFn: fetchUserNotifications,
    refetchInterval: NOTIS_INTERVALL,
    enabled: aktiv,
  })
}

/**
 * Den sammanslagna listan för klockan. `aktiv` = inloggad admin/support (hooken
 * måste anropas ovillkorligt, så den stängs av här i stället för att inte köras).
 */
export function useAdminNotiser(aktiv: boolean, adminRoll: AdminRoll): PendingNotis[] {
  const { data: ärendeNotiser = [] } = useSupportNotiser(aktiv)
  const { data: kontoNotiser = [] } = useKontoNotiser(aktiv && adminRoll === 'Admin')

  return useMemo(() => [
    ...ärendeNotiser.map(n => ({ arendeId: n.ticketId, amne: n.amne, typ: n.typ, notering: n.notering })),
    ...kontoNotiser.map(n => ({
      arendeId: n.userId, amne: n.namn, typ: 'kontospärrning' as const, notering: n.notering, epost: n.epost,
    })),
  ], [ärendeNotiser, kontoNotiser])
}
