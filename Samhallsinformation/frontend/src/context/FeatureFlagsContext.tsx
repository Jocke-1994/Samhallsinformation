import { createContext, useContext } from 'react'
import { useFeatureFlags, type FlaggLäge } from '../hooks/useFeatureFlags'
import type { FlagKey, FlagState } from '../lib/featureFlags'

interface FeatureFlagsContextValue {
  /** Effektiva flaggor — det UI:t ska läsa (mock-flaggor avstängda i produktion). */
  flaggor: FlagState
  /** Vad admin faktiskt ställt in — för Feature flags-vyn. */
  inställda: FlagState
  läge: FlaggLäge
  laddat: boolean
  växlaFlagg: (key: FlagKey) => void
  återställ: () => void
  /** Felet från senaste misslyckade växling/återställning (annars null/undefined). */
  ändringsFel: unknown
  ändringPågår: boolean
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

// Konsumenter som inte vill visa/dölja UI förrän flaggorna är hämtade kan
// vänta på `laddat` (false bara under första hämtningen).
export function useFlaggLäge(): { läge: FlaggLäge; laddat: boolean } {
  const ctx = useContext(FeatureFlagsContext)
  if (!ctx) throw new Error('useFlaggLäge måste användas inom FeatureFlagsProvider')
  return { läge: ctx.läge, laddat: ctx.laddat }
}

export function useFeatureFlagsAdmin() {
  const ctx = useContext(FeatureFlagsContext)
  if (!ctx) throw new Error('useFeatureFlagsAdmin måste användas inom FeatureFlagsProvider')
  return ctx
}
