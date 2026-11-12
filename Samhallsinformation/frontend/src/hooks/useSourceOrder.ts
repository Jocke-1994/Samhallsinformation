import { useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchUserSources,
  saveUserSources,
  type SourcePrefUpdate,
  type UserSourcePref,
} from '../api/userSources'
import { useAuth } from '../context/AuthContext'
import { useAnvandare } from './useAnvandare'
import { visaBevakningsToast } from '../components/NewsFeed/bevakningsToastStore'
import { visaFel } from '../lib/felmeddelande'
import { anvandarKallorNyckel } from '../lib/queryNycklar'
import type { Source } from '../types'

// Vad som behöver skickas för att servern ska få ordningen `nyOrdning`, givet
// att den redan har `prefs`. Bara ändrade rader tas med.
export function beraknaOrdningsuppdateringar(
  nyOrdning: string[],
  sourceGroups: Map<string, Source[]>,
  prefs: UserSourcePref[],
): SourcePrefUpdate[] {
  const prefById = new Map(prefs.map((p) => [p.sourceId, p]))
  const uppdateringar: SourcePrefUpdate[] = []
  let löpnummer = 0

  for (const shortName of nyOrdning) {
    for (const source of sourceGroups.get(shortName) ?? []) {
      const nyttSortOrder = löpnummer++
      const befintlig = prefById.get(source.id)
      if (befintlig && befintlig.sortOrder === nyttSortOrder) continue
      // Ny rad för en källa användaren aldrig aktivt lagt till: bara
      // sorteringen sparas, isActive förblir false — en drag-and-drop i
      // sidomenyn ska aldrig räknas som samtycke till notisvolym.
      uppdateringar.push({
        sourceId: source.id,
        isActive: befintlig?.isActive ?? false,
        sortOrder: nyttSortOrder,
      })
    }
  }
  return uppdateringar
}

function tillampaUppdateringar(
  prefs: UserSourcePref[],
  uppdateringar: SourcePrefUpdate[],
  shortNamePerId: Map<number, string>,
): UserSourcePref[] {
  const perId = new Map(prefs.map((p) => [p.sourceId, p]))
  for (const u of uppdateringar) {
    const befintlig = perId.get(u.sourceId)
    perId.set(
      u.sourceId,
      befintlig
        ? { ...befintlig, sortOrder: u.sortOrder }
        : {
            sourceId: u.sourceId,
            shortName: shortNamePerId.get(u.sourceId) ?? '',
            isActive: u.isActive,
            sortOrder: u.sortOrder,
          },
    )
  }
  // Behåll befintlig radordning; nya rader läggs sist.
  const resultat = prefs.map((p) => perId.get(p.sourceId)!)
  for (const [id, pref] of perId) if (!prefs.some((p) => p.sourceId === id)) resultat.push(pref)
  return resultat
}

// Utloggade kan inte sortera (Sidebar visar ingen drag-and-drop-UI för dem
// och renderar källorna i rå API-ordning) — ingen lokal lagring behövs här.
//
// Sparandet (E5#13) är optimistiskt: den nya ordningen skrivs direkt i den
// delade query-cachen så listan inte snäpper tillbaka i väntan på servern.
// Sparanrop går ett i taget; hinner användaren sortera om igen innan svaret
// kommit vinner den SENASTE ordningen (mellanliggande hoppas över) och skickas
// när det pågående anropet är klart. Vad som skickas beräknas mot serverns
// senast BEKRÄFTADE läge — inte mot cachen, som redan bär de optimistiska
// värdena — så att servern alltid får allt som skiljer den från slutordningen.
// Misslyckas det sista anropet rullas cachen tillbaka och ett fel visas.
export function useSourceOrder(
  shortNames: string[],
  sourceGroups: Map<string, Source[]>,
): [string[], (order: string[]) => void] {
  const { isLoggedIn } = useAuth()
  const queryClient = useQueryClient()
  const anvandare = useAnvandare()
  const nyckel = anvandarKallorNyckel(anvandare)

  // Delar query-cache med Mina källor (samma nyckel) — ingen extra fetch.
  const { data: prefs = [] } = useQuery({
    queryKey: nyckel,
    queryFn: fetchUserSources,
    enabled: isLoggedIn,
  })

  const mutation = useMutation({ mutationFn: saveUserSources })

  // Sparkön: senaste önskade ordningen som ännu inte skickats, serverns
  // bekräftade läge medan något pågår, och om ett anrop är på väg.
  const vantandeRef = useRef<{
    ordning: string[]
    sourceGroups: Map<string, Source[]>
    nyckel: readonly unknown[]
  } | null>(null)
  const bekraftadRef = useRef<UserSourcePref[] | null>(null)
  const skickarRef = useRef(false)

  const backendOrder = useMemo(() => {
    const prefById = new Map(prefs.map((p) => [p.sourceId, p]))
    const medOrdning: string[] = []
    const utanOrdning: string[] = []

    for (const shortName of shortNames) {
      const group = sourceGroups.get(shortName) ?? []
      const harKäntSortOrder = group.some((s) => prefById.has(s.id))
      if (harKäntSortOrder) medOrdning.push(shortName)
      else utanOrdning.push(shortName)
    }

    medOrdning.sort((a, b) => {
      const minA = Math.min(
        ...(sourceGroups.get(a) ?? []).map((s) => prefById.get(s.id)?.sortOrder ?? Infinity),
      )
      const minB = Math.min(
        ...(sourceGroups.get(b) ?? []).map((s) => prefById.get(s.id)?.sortOrder ?? Infinity),
      )
      return minA - minB
    })

    return [...medOrdning, ...utanOrdning]
  }, [prefs, shortNames, sourceGroups])

  const order = isLoggedIn ? backendOrder : shortNames

  async function skickaVantande() {
    if (skickarRef.current) return
    skickarRef.current = true
    try {
      while (vantandeRef.current) {
        const { ordning, sourceGroups: grupper, nyckel: k } = vantandeRef.current
        vantandeRef.current = null
        const bas = bekraftadRef.current ?? []
        const uppdateringar = beraknaOrdningsuppdateringar(ordning, grupper, bas)
        if (uppdateringar.length === 0) continue
        try {
          await mutation.mutateAsync(uppdateringar)
          const shortNamePerId = new Map<number, string>()
          for (const [sn, grupp] of grupper) for (const s of grupp) shortNamePerId.set(s.id, sn)
          bekraftadRef.current = tillampaUppdateringar(bas, uppdateringar, shortNamePerId)
        } catch (fel) {
          // En nyare ordning väntar: den skickas mot samma bekräftade läge
          // och täcker det som just misslyckades.
          if (vantandeRef.current) continue
          queryClient.setQueryData(k, bas)
          visaBevakningsToast({
            typ: 'fel',
            text: visaFel(fel, 'Kunde inte spara källordningen. Försök igen.'),
          })
          break
        }
      }
    } finally {
      skickarRef.current = false
      bekraftadRef.current = null
      // Hämta serverns faktiska läge (inte om något nytt hann köas under tiden).
      if (!vantandeRef.current) void queryClient.invalidateQueries({ queryKey: ['user-sources'] })
    }
  }

  function sparaOrdning(nyOrdning: string[]) {
    if (!isLoggedIn) return

    // Optimistiskt: skriv den nya ordningen i cachen direkt. En pågående
    // hämtning avbryts så att gammal serverdata inte skriver över den.
    const lokalt = queryClient.getQueryData<UserSourcePref[]>(nyckel) ?? []
    const uppdateringar = beraknaOrdningsuppdateringar(nyOrdning, sourceGroups, lokalt)
    // Redan den ordning som visas (och som antingen är sparad eller köad): inget att göra.
    if (uppdateringar.length === 0) return

    if (bekraftadRef.current === null) bekraftadRef.current = lokalt
    const shortNamePerId = new Map<number, string>()
    for (const [sn, grupp] of sourceGroups) for (const s of grupp) shortNamePerId.set(s.id, sn)
    void queryClient.cancelQueries({ queryKey: nyckel })
    queryClient.setQueryData(nyckel, tillampaUppdateringar(lokalt, uppdateringar, shortNamePerId))

    vantandeRef.current = { ordning: nyOrdning, sourceGroups, nyckel }
    void skickaVantande()
  }

  return [order, sparaOrdning]
}
