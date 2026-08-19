import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchUserSources, saveUserSources, type SourcePrefUpdate } from '../api/userSources'
import { useAuth } from '../context/AuthContext'
import type { Source } from '../types'

// Utloggade kan inte sortera (Sidebar visar ingen drag-and-drop-UI för dem
// och renderar källorna i rå API-ordning) — ingen lokal lagring behövs här.
export function useSourceOrder(
  shortNames: string[],
  sourceGroups: Map<string, Source[]>,
): [string[], (order: string[]) => void] {
  const { isLoggedIn } = useAuth()
  const queryClient = useQueryClient()

  // Delar query-cache med Mina källor (samma nyckel) — ingen extra fetch.
  const { data: prefs = [] } = useQuery({
    queryKey: ['user-sources'],
    queryFn:  fetchUserSources,
    enabled:  isLoggedIn,
  })

  const mutation = useMutation({
    mutationFn: saveUserSources,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['user-sources'] }),
  })

  const backendOrder = useMemo(() => {
    const prefById = new Map(prefs.map(p => [p.sourceId, p]))
    const medOrdning: string[] = []
    const utanOrdning: string[] = []

    for (const shortName of shortNames) {
      const group = sourceGroups.get(shortName) ?? []
      const harKäntSortOrder = group.some(s => prefById.has(s.id))
      if (harKäntSortOrder) medOrdning.push(shortName)
      else utanOrdning.push(shortName)
    }

    medOrdning.sort((a, b) => {
      const minA = Math.min(...(sourceGroups.get(a) ?? []).map(s => prefById.get(s.id)?.sortOrder ?? Infinity))
      const minB = Math.min(...(sourceGroups.get(b) ?? []).map(s => prefById.get(s.id)?.sortOrder ?? Infinity))
      return minA - minB
    })

    return [...medOrdning, ...utanOrdning]
  }, [prefs, shortNames, sourceGroups])

  const order = isLoggedIn ? backendOrder : shortNames

  function sparaOrdning(nyOrdning: string[]) {
    if (!isLoggedIn) return

    const prefById = new Map(prefs.map(p => [p.sourceId, p]))
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
          sourceId:  source.id,
          isActive:  befintlig?.isActive ?? false,
          sortOrder: nyttSortOrder,
        })
      }
    }

    if (uppdateringar.length > 0) mutation.mutate(uppdateringar)
  }

  return [order, sparaOrdning]
}
