import type { QueryClient } from '@tanstack/react-query'

// Query-nycklarna för flaggor på ett ställe, så alla mutationsvägar
// invaliderar exakt samma queries som hooken läser.
export const FLAGG_QUERY_KEY = ['feature-flags'] as const
export const ADMIN_FLAGG_QUERY_KEY = ['admin-feature-flags'] as const

// Efter varje flaggrelaterad mutation: uppdatera både den publika vyn
// (Key -> Value) och adminvyn (inkl. "redo att lanseras").
export function invalideraFlaggor(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: FLAGG_QUERY_KEY })
  queryClient.invalidateQueries({ queryKey: ADMIN_FLAGG_QUERY_KEY })
}

// Senast KÄNDA overrides från backend. Används när en hämtning pågår eller
// misslyckas, så att en flagga som en admin stängt av (kill switch) inte
// tyst byter till kodens defaultAktiv och slås på. Hålls i minnet och
// speglas i sessionStorage (så en omladdning mitt i ett fel också kommer ihåg).
const LAGRINGSNYCKEL = 'si_flag_overrides'

let kända: Record<string, boolean> | null = null

export function läsKändaOverrides(): Record<string, boolean> | null {
  if (kända) return kända
  try {
    const rå = sessionStorage.getItem(LAGRINGSNYCKEL)
    if (rå) {
      const tolkad = JSON.parse(rå)
      if (tolkad && typeof tolkad === 'object' && !Array.isArray(tolkad)) {
        kända = tolkad as Record<string, boolean>
      }
    }
  } catch {
    // sessionStorage blockerat eller trasig JSON — då finns inget känt läge.
  }
  return kända
}

export function sparaKändaOverrides(overrides: Record<string, boolean>) {
  kända = overrides
  try {
    sessionStorage.setItem(LAGRINGSNYCKEL, JSON.stringify(overrides))
  } catch {
    // Ignorera — minnesvarianten räcker för den här sessionen.
  }
}

export function rensaKändaOverrides() {
  kända = null
  try {
    sessionStorage.removeItem(LAGRINGSNYCKEL)
  } catch {
    // Ignorera.
  }
}
