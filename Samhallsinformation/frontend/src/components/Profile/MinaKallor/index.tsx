import { useState, useEffect } from 'react'
import { useLocation } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSources } from '../../../api/sources'
import { fetchUserSources, saveUserSources, type SourcePrefUpdate } from '../../../api/userSources'
import LaggTillKort from './LaggTillKort'
import AktivaKallorKort from './AktivaKallorKort'
import RekommenderadeKallorKort from './RekommenderadeKallorKort'
import AllaKallorKort from './AllaKallorKort'
import { useFlags } from '../../../context/FeatureFlagsContext'
import type { Source } from '../../../types'

export default function MinaKallor() {
  const location    = useLocation()
  const [highlightId, setHighlightId] = useState<string | null>(location.state?.highlightId ?? null)
  const flaggor = useFlags()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), 4200)
    return () => clearTimeout(t)
  }, [highlightId])

  const { data: sources = [] } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn:  fetchSources,
  })

  const { data: prefs = [] } = useQuery({
    queryKey: ['user-sources'],
    queryFn:  fetchUserSources,
  })

  const mutation = useMutation({
    mutationFn: saveUserSources,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['user-sources'] }),
  })

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

  function handleRemove(id: number) {
    const befintlig = prefs.find(p => p.sourceId === id)
    mutation.mutate([{ sourceId: id, isActive: false, sortOrder: befintlig?.sortOrder ?? 0 }])
  }

  function handleDeleteAll() {
    mutation.mutate(prefs.filter(p => p.isActive).map(p => ({ ...p, isActive: false })))
  }

  return (
    <div className="flex flex-col gap-6 mt-6">

      {/* En rad: alla aktiverade kort bredvid varandra. kallor_lagg_till är av
          live just nu (för smalt kort, lämnade ett tomt hål bredvid Aktiva
          källor) — Aktiva källor och Alla källor flyter då ihop till en rad
          istället. kallor_rekommenderade är av som standard (se
          lib/featureFlags.ts): RekommenderadeKallorKort använder fortfarande
          mock-KALLOR-ID:n som inte finns som riktiga Source-rader, så "+ Lägg
          till" där skulle ge ett backend-fel (FK-brott) om flaggan slås på.
          Rörs inte förrän kortet antingen kopplas mot riktig data eller byggs
          om i grunden. */}
      {(flaggor.kallor_lagg_till || flaggor.kallor_aktiva || flaggor.kallor_rekommenderade || flaggor.kallor_alla) && (
        <div className="flex flex-col lg:flex-row gap-6 items-stretch lg:items-start">
          {flaggor.kallor_lagg_till && (
            <div className="w-full lg:w-80 lg:shrink-0">
              <LaggTillKort sources={sources} activeIds={activeIds} onAdd={handleAdd} />
            </div>
          )}
          {flaggor.kallor_aktiva && (
            <div className="flex-1 min-w-0">
              <AktivaKallorKort
                sources={activeSources}
                onRemove={handleRemove}
                onDeleteAll={handleDeleteAll}
                highlightId={highlightId}
                harLaggTillKort={flaggor.kallor_lagg_till}
              />
            </div>
          )}
          {flaggor.kallor_rekommenderade && (
            <div className="flex-1 min-w-0">
              <RekommenderadeKallorKort activeIds={activeIds} onAdd={handleAdd} />
            </div>
          )}
          {flaggor.kallor_alla && (
            <div className="flex-1 min-w-0">
              <AllaKallorKort sources={sources} activeIds={activeIds} onAdd={handleAdd} />
            </div>
          )}
        </div>
      )}

    </div>
  )
}
