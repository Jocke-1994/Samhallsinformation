import type { PlatsKatalogPost, PlatsSektion } from '../types'
import { felFranSvar, publikFetch } from './hamta'

// Pluppkatalogen: alla svenska kommuner/län + Nationellt (beslut 13 — sökbart
// även där ingen aktiv händelse finns, visas då gråmarkerad med antalHandelser=0).
// Publikt, fungerar för besökare utan konto (beslut 11).
export async function fetchPlatskatalog(): Promise<PlatsKatalogPost[]> {
  const res = await publikFetch('/api/platser/katalog')
  if (!res.ok) throw await felFranSvar(res, 'fetchPlatskatalog')
  return res.json()
}

// Sektionerad resultatvy för en eller flera valda pluppar (beslut 3+4).
export async function fetchPlatsHandelser(platser: string[]): Promise<PlatsSektion[]> {
  const query = new URLSearchParams({ platser: platser.join(',') })
  const res = await publikFetch(`/api/platser/handelser?${query}`)
  if (!res.ok) throw await felFranSvar(res, 'fetchPlatsHandelser')
  return res.json()
}
