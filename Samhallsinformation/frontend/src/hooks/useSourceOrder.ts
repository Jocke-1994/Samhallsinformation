import { useState, useEffect } from 'react'

const STORAGE_KEY = 'si_source_order'

export function useSourceOrder(shortNames: string[]): [string[], (order: string[]) => void] {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: string[] = JSON.parse(stored)
        const known = parsed.filter(n => shortNames.includes(n))
        const nyaTillkomna = shortNames.filter(n => !parsed.includes(n))
        return [...known, ...nyaTillkomna]
      }
    } catch {}
    return shortNames
  })

  useEffect(() => {
    setOrder(prev => {
      const nyaTillkomna = shortNames.filter(n => !prev.includes(n))
      const filtrerade = prev.filter(n => shortNames.includes(n))
      return [...filtrerade, ...nyaTillkomna]
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortNames.join(',')])

  function sparaOrdning(nyOrdning: string[]) {
    setOrder(nyOrdning)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nyOrdning))
  }

  return [order, sparaOrdning]
}
