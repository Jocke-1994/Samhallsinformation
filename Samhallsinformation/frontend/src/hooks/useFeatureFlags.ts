import { useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type FlagKey, type FlagState, FLAG_DEFINITIONER, effektivaFlaggor } from '../lib/featureFlags'
import { fetchFeatureFlagOverrides, setFeatureFlagOverride, resetFeatureFlagOverrides } from '../api/featureFlags'
import { FLAGG_QUERY_KEY, invalideraFlaggor, läsKändaOverrides, sparaKändaOverrides } from '../lib/flaggCache'

function standardvärden(): FlagState {
  return Object.fromEntries(FLAG_DEFINITIONER.map(f => [f.key, f.defaultAktiv])) as FlagState
}

export type FlaggLäge = 'laddar' | 'klar' | 'fel'

// Backoff mellan omförsök: 1 s, 2 s, 4 s (max 3 omförsök).
export const FLAGG_OMFORSOK = 3
export function flaggRetryDelay(försök: number) {
  return Math.min(1000 * 2 ** försök, 8000)
}

export function useFeatureFlags() {
  const queryClient = useQueryClient()

  // Globalt tillstånd, samma för alla besökare — inte en per-webbläsare-
  // inställning. Vid laddning och vid fel används SENAST KÄNDA overrides
  // (minne/sessionStorage) och först därefter kodens defaultAktiv — aldrig
  // ett tyst byte som slår på något en admin har stängt av.
  const { data, isPending, isError } = useQuery({
    queryKey: FLAGG_QUERY_KEY,
    queryFn:  async () => {
      try {
        return await fetchFeatureFlagOverrides()
      } catch (err) {
        console.warn('Feature flags kunde inte hämtas — behåller senast kända värden och försöker igen.', err)
        throw err
      }
    },
    retry:      FLAGG_OMFORSOK,
    retryDelay: flaggRetryDelay,
  })

  useEffect(() => {
    if (data) sparaKändaOverrides(data)
  }, [data])

  const läge: FlaggLäge = isError ? 'fel' : isPending ? 'laddar' : 'klar'
  const overrides = data ?? läsKändaOverrides() ?? {}

  // Det admin har ställt in (override eller kodens default) — visas i Feature flags-vyn
  // och är det växlingen utgår från.
  const inställda: FlagState = { ...standardvärden(), ...overrides } as FlagState
  // Det UI:t faktiskt läser: mock-flaggor tvingas av utan VITE_SHOW_MOCK_UI (V3-20).
  const flaggor: FlagState = effektivaFlaggor(inställda)

  const toggleMutation = useMutation({
    mutationFn: (vars: { key: FlagKey; value: boolean }) => setFeatureFlagOverride(vars.key, vars.value),
    onSuccess:  () => invalideraFlaggor(queryClient),
  })

  const resetMutation = useMutation({
    mutationFn: resetFeatureFlagOverrides,
    onSuccess:  () => invalideraFlaggor(queryClient),
  })

  const växlaFlagg = useCallback((key: FlagKey) => {
    toggleMutation.mutate({ key, value: !inställda[key] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inställda])

  const återställ = useCallback(() => {
    resetMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // V3-8: en misslyckad växling/återställning får inte se ut som att ingenting hände —
  // Feature flags-vyn visar felet (flaggan är då oförändrad) och låser reglagen under anropet.
  const ändringsFel: unknown = toggleMutation.error ?? resetMutation.error
  const ändringPågår = toggleMutation.isPending || resetMutation.isPending

  return { flaggor, inställda, läge, laddat: läge !== 'laddar', växlaFlagg, återställ, ändringsFel, ändringPågår }
}
