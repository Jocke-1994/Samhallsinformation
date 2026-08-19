import { adminFetch } from './adminFetch'

export interface BevakningDto {
  id:         string
  kategorier: string[] | null
  omraden:    string[] | null
}

export interface BevakningRequest {
  kategorier: string[] | null
  omraden:    string[] | null
}

export async function fetchBevakningar(): Promise<BevakningDto[]> {
  const res = await adminFetch('/api/user/polisen-bevakningar')
  if (!res.ok) throw new Error(`fetchBevakningar: ${res.status}`)
  return res.json()
}

export async function createBevakning(req: BevakningRequest): Promise<BevakningDto> {
  const res = await adminFetch('/api/user/polisen-bevakningar', {
    method: 'POST',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`createBevakning: ${res.status}`)
  return res.json()
}

export async function updateBevakning(id: string, req: BevakningRequest): Promise<BevakningDto> {
  const res = await adminFetch(`/api/user/polisen-bevakningar/${id}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`updateBevakning: ${res.status}`)
  return res.json()
}

export async function deleteBevakning(id: string): Promise<void> {
  const res = await adminFetch(`/api/user/polisen-bevakningar/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteBevakning: ${res.status}`)
}
