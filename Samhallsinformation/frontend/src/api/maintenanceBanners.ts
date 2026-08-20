import { adminFetch } from './adminFetch'

export type BannerÅskådare = 'Alla' | 'Besökare' | 'Användare'

export interface MaintenanceBanner {
  id: string
  message: string
  startUtc: string
  endUtc: string
  audience: BannerÅskådare
}

export interface MaintenanceBannerRequest {
  message: string
  startUtc: string
  endUtc: string
  audience: BannerÅskådare
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchMaintenanceBanners(): Promise<MaintenanceBanner[]> {
  const res = await fetch(`${API_BASE}/api/maintenance-banners`)
  if (!res.ok) throw new Error(`fetchMaintenanceBanners: ${res.status}`)
  return res.json()
}

export async function createMaintenanceBanner(req: MaintenanceBannerRequest): Promise<MaintenanceBanner> {
  const res = await adminFetch('/api/admin/maintenance-banners', {
    method: 'POST',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`createMaintenanceBanner: ${res.status}`)
  return res.json()
}

export async function updateMaintenanceBanner(id: string, req: MaintenanceBannerRequest): Promise<MaintenanceBanner> {
  const res = await adminFetch(`/api/admin/maintenance-banners/${id}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`updateMaintenanceBanner: ${res.status}`)
  return res.json()
}

export async function deleteMaintenanceBanner(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/maintenance-banners/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteMaintenanceBanner: ${res.status}`)
}
