import type { Source, AdminSource } from '../types'
import { adminFetch } from './adminFetch'

const MOCK_SOURCES: Source[] = [
  { id: 1,  name: 'Polisen',                      shortName: 'Polisen',          baseUrl: 'https://polisen.se',              isActive: true, scope: 'nationell' },
  { id: 2,  name: 'SMHI',                         shortName: 'SMHI',             baseUrl: 'https://smhi.se',                 isActive: false, scope: 'nationell' },
  { id: 3,  name: 'MSB',                          shortName: 'MSB',              baseUrl: 'https://msb.se',                  isActive: false, scope: 'nationell' },
  { id: 4,  name: 'Trafikverket',                 shortName: 'Trafikverket',     baseUrl: 'https://trafikverket.se',         isActive: false, scope: 'nationell' },
  { id: 5,  name: 'Krisinformation.se',           shortName: 'Krisinformation',  baseUrl: 'https://krisinformation.se',      isActive: true,  scope: 'nationell' },
  { id: 6,  name: 'Göteborgs Stad',               shortName: 'Gbg Stad',         baseUrl: 'https://goteborg.se',             isActive: false, scope: 'regional'  },
  { id: 7,  name: 'Länsstyrelsen Västra Götaland',shortName: 'Lst VGR',          baseUrl: 'https://lansstyrelsen.se/vgr',    isActive: false, scope: 'regional'  },
  { id: 8,  name: 'Västra Götalandsregionen',     shortName: 'VGR',              baseUrl: 'https://vgregion.se',             isActive: false, scope: 'regional'  },
]

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchSources(): Promise<Source[]> {
  if (USE_MOCK) return MOCK_SOURCES
  const res = await fetch(`${API_BASE}/api/sources`)
  if (!res.ok) throw new Error(`fetchSources: ${res.status}`)
  return res.json()
}

export async function fetchAdminSources(): Promise<AdminSource[]> {
  const res = await adminFetch('/api/admin/sources')
  if (!res.ok) throw new Error(`fetchAdminSources: ${res.status}`)
  return res.json()
}

export async function createAdminSource(req: {
  name: string; shortName: string; baseUrl: string; url?: string; category?: string; type: number
}): Promise<AdminSource> {
  const res = await adminFetch('/api/admin/sources', {
    method: 'POST',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`createAdminSource: ${res.status}`)
  return res.json()
}

export async function updateAdminSource(id: number, req: {
  name?: string; shortName?: string; url?: string; category?: string; isActive?: boolean; isPublished?: boolean
}): Promise<AdminSource> {
  const res = await adminFetch(`/api/admin/sources/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`updateAdminSource: ${res.status}`)
  return res.json()
}

export async function deleteAdminSource(id: number): Promise<void> {
  const res = await adminFetch(`/api/admin/sources/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteAdminSource: ${res.status}`)
}
