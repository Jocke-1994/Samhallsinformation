import { adminFetch } from './adminFetch'

export interface SiteSettings {
  showLoginButton: boolean
  showRegisterButton: boolean
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function getSiteSettings(): Promise<SiteSettings> {
  const res = await fetch(`${API_BASE}/api/settings/site`)
  if (!res.ok) throw new Error(`getSiteSettings: ${res.status}`)
  return res.json()
}

export async function updateSiteSettings(req: {
  showLoginButton?: boolean
  showRegisterButton?: boolean
}): Promise<SiteSettings> {
  const res = await adminFetch('/api/admin/settings/site', {
    method: 'PUT',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`updateSiteSettings: ${res.status}`)
  return res.json()
}
