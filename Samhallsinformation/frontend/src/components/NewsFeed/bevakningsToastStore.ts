import { useSyncExternalStore } from 'react'

// Toast-tillstånd för bevakningsklockan (E7#3). Ligger utanför komponenten
// med flit: när en bevakning tas bort kan hela NewsItem-kortet (och därmed
// klockan) försvinna ur flödet i samma stund — en toast som bor i klockans
// egen state dör då med den, och Ångra-knappen hann aldrig visas. Här överlever
// toasten, och BevakningsToastHost (monterad i App) renderar den.
export interface BevakningsToast {
  id: number
  text: string
  typ: 'info' | 'fel'
  // Om satt visas en Ångra-knapp som återskapar bevakningen. Bara data, inte
  // en callback — hosten anropar då SIN färska skapa() ur kontexten i stället
  // för en stängd-över-gammalt-tillstånd-funktion (den kunde annars tro att
  // taket på max antal bevakningar redan var nått).
  ångra?: { kategorier: string[] | null; omraden: string[] | null }
}

let aktuell: BevakningsToast | null = null
let nästaId = 1
const lyssnare = new Set<() => void>()

function meddela() {
  lyssnare.forEach((l) => l())
}

export function visaBevakningsToast(toast: Omit<BevakningsToast, 'id'>) {
  aktuell = { ...toast, id: nästaId++ }
  meddela()
}

export function stängBevakningsToast() {
  if (aktuell === null) return
  aktuell = null
  meddela()
}

function prenumerera(l: () => void) {
  lyssnare.add(l)
  return () => {
    lyssnare.delete(l)
  }
}

export function useBevakningsToast(): BevakningsToast | null {
  return useSyncExternalStore(prenumerera, () => aktuell)
}
