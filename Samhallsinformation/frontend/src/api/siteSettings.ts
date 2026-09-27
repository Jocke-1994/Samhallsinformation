import { adminFetch } from './adminFetch'
import { felFranSvar, publikFetch } from './hamta'

export interface SiteSettings {
  showLoginButton: boolean
  showRegisterButton: boolean
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const res = await publikFetch(`/api/settings/site`)
  if (!res.ok) throw await felFranSvar(res, 'getSiteSettings')
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
  if (!res.ok) throw await felFranSvar(res, 'updateSiteSettings')
  return res.json()
}
