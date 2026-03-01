import type { Source } from '../types'

export async function fetchSources(): Promise<Source[]> {
  const res = await fetch('/api/sources')
  if (!res.ok) throw new Error('Kunde inte hämta källor')
  return res.json()
}
