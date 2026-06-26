import { createContext, useContext } from 'react'
import { useFeatureFlags } from '../hooks/useFeatureFlags'
import type { FlagKey, FlagState } from '../lib/featureFlags'

interface FeatureFlagsContextValue {
  flaggor: FlagState
  växlaFlagg: (key: FlagKey) => void
  återställ: () => void
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null)

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const value = useFeatureFlags()
  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
}

export function useFlags(): FlagState {
  const ctx = useContext(FeatureFlagsContext)
  if (!ctx) throw new Error('useFlags måste användas inom FeatureFlagsProvider')
  return ctx.flaggor
}

export function useFeatureFlagsAdmin() {
  const ctx = useContext(FeatureFlagsContext)
  if (!ctx) throw new Error('useFeatureFlagsAdmin måste användas inom FeatureFlagsProvider')
  return ctx
}
