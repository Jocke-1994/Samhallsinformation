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

// Backend avvisar ogiltiga bevakningar med 400 och en tydlig svensk text
// (V3-17: max antal, listlängd, okända värden). Texten visas som den är.
export class BevakningError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BevakningError'
  }
}

async function throwOnFail(res: Response, namn: string): Promise<void> {
  if (res.ok) return
  if (res.status === 400) {
    const text = (await res.text().catch(() => '')).trim()
    if (text.length > 0 && text.length < 200) throw new BevakningError(text)
  }
  throw new Error(`${namn}: ${res.status}`)
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
  await throwOnFail(res, 'createBevakning')
  return res.json()
}

export async function updateBevakning(id: string, req: BevakningRequest): Promise<BevakningDto> {
  const res = await adminFetch(`/api/user/polisen-bevakningar/${id}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  })
  await throwOnFail(res, 'updateBevakning')
  return res.json()
}

export async function deleteBevakning(id: string): Promise<void> {
  const res = await adminFetch(`/api/user/polisen-bevakningar/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteBevakning: ${res.status}`)
}
