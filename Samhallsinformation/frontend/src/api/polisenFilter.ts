import { adminFetch } from './adminFetch'

export interface PolisenFilterDto {
  kategorier: string[] | null
  omraden:    string[] | null
}

export async function fetchPolisenFilter(): Promise<PolisenFilterDto> {
  const res = await adminFetch('/api/user/polisen-filter')
  if (!res.ok) throw new Error(`fetchPolisenFilter: ${res.status}`)
  return res.json()
}

export async function savePolisenFilter(filter: PolisenFilterDto): Promise<void> {
  const res = await adminFetch('/api/user/polisen-filter', {
    method: 'PUT',
    body: JSON.stringify(filter),
  })
  if (!res.ok) throw new Error(`savePolisenFilter: ${res.status}`)
}
