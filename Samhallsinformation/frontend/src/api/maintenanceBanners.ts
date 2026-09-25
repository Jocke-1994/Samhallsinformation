import { adminFetch, getToken } from './adminFetch'

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

// Publik lista — servern filtrerar på tid och målgrupp. Token skickas om den finns
// så servern kan skilja inloggad från besökare (Användare-/Besökare-banderoller).
export async function fetchMaintenanceBanners(): Promise<MaintenanceBanner[]> {
  const token = getToken()
  const res = await fetch(`${API_BASE}/api/maintenance-banners`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw new Error(`fetchMaintenanceBanners: ${res.status}`)
  return res.json()
}

// Admin: hela listan (även kommande, avslutade och alla målgrupper).
export async function fetchAdminMaintenanceBanners(): Promise<MaintenanceBanner[]> {
  const res = await adminFetch('/api/admin/maintenance-banners')
  if (!res.ok) throw new Error(`fetchAdminMaintenanceBanners: ${res.status}`)
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
