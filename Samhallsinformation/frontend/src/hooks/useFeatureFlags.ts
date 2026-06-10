import { useState, useCallback } from 'react'
import { type FlagKey, type FlagState, laddaFlaggor, sparaFlaggor, återställFlaggor } from '../lib/featureFlags'

export function useFeatureFlags() {
  const [flaggor, setFlaggor] = useState<FlagState>(laddaFlaggor)

  const växlaFlagg = useCallback((key: FlagKey) => {
    setFlaggor(prev => {
      const ny = { ...prev, [key]: !prev[key] }
      sparaFlaggor(ny)
      return ny
    })
  }, [])

  const återställ = useCallback(() => {
    setFlaggor(återställFlaggor())
  }, [])

  return { flaggor, växlaFlagg, återställ }
}
