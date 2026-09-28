import { adminFetch } from './adminFetch'
import { felFranSvar, publikFetch } from './hamta'

export async function fetchFeatureFlagOverrides(): Promise<Record<string, boolean>> {
  const res = await publikFetch(`/api/feature-flags`)
  if (!res.ok) throw await felFranSvar(res, 'fetchFeatureFlagOverrides')
  return res.json()
}

export async function setFeatureFlagOverride(key: string, value: boolean): Promise<void> {
  const res = await adminFetch(`/api/admin/feature-flags/${key}`, {
    method: 'PUT',
    body:   JSON.stringify({ value }),
  })
  if (!res.ok) throw await felFranSvar(res, 'setFeatureFlagOverride')
}

export async function resetFeatureFlagOverrides(): Promise<void> {
  const res = await adminFetch('/api/admin/feature-flags', { method: 'DELETE' })
  if (!res.ok) throw await felFranSvar(res, 'resetFeatureFlagOverrides')
}

export interface AdminFeatureFlagOverride {
  key:             string
  value:           boolean
  redoAttLanseras: boolean
}

// Adminens fulla vy (inkl. redoAttLanseras) — till skillnad från den
// publika fetchFeatureFlagOverrides ovan, som bara ger Key→Value.
export async function fetchAdminFeatureFlags(): Promise<AdminFeatureFlagOverride[]> {
  const res = await adminFetch('/api/admin/feature-flags')
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminFeatureFlags')
  return res.json()
}

export async function setFeatureFlagRedo(key: string, redoAttLanseras: boolean): Promise<void> {
  const res = await adminFetch(`/api/admin/feature-flags/${key}/redo`, {
    method: 'PUT',
    body:   JSON.stringify({ redoAttLanseras }),
  })
  if (!res.ok) throw await felFranSvar(res, 'setFeatureFlagRedo')
}
