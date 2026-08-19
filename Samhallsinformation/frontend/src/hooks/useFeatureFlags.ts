import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type FlagKey, type FlagState, FLAG_DEFINITIONER } from '../lib/featureFlags'
import { fetchFeatureFlagOverrides, setFeatureFlagOverride, resetFeatureFlagOverrides } from '../api/featureFlags'

function standardvärden(): FlagState {
  return Object.fromEntries(FLAG_DEFINITIONER.map(f => [f.key, f.defaultAktiv])) as FlagState
}

export function useFeatureFlags() {
  const queryClient = useQueryClient()

  // Globalt tillstånd, samma för alla besökare — inte en per-webbläsare-
  // inställning. Faller tillbaka på kodens defaultAktiv-värden medan den
  // första hämtningen pågår, precis som localStorage-varianten gjorde vid
  // tom lagring.
  const { data: overrides = {} } = useQuery({
    queryKey: ['feature-flags'],
    queryFn:  fetchFeatureFlagOverrides,
  })

  const flaggor: FlagState = { ...standardvärden(), ...overrides } as FlagState

  function invalidera() {
    queryClient.invalidateQueries({ queryKey: ['feature-flags'] })
  }

  const toggleMutation = useMutation({
    mutationFn: (vars: { key: FlagKey; value: boolean }) => setFeatureFlagOverride(vars.key, vars.value),
    onSuccess:  invalidera,
  })

  const resetMutation = useMutation({
    mutationFn: resetFeatureFlagOverrides,
    onSuccess:  invalidera,
  })

  const växlaFlagg = useCallback((key: FlagKey) => {
    toggleMutation.mutate({ key, value: !flaggor[key] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaggor])

  const återställ = useCallback(() => {
    resetMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { flaggor, växlaFlagg, återställ }
}
