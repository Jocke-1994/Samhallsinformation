import { adminFetch } from './adminFetch'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchFeatureFlagOverrides(): Promise<Record<string, boolean>> {
  const res = await fetch(`${API_BASE}/api/feature-flags`)
  if (!res.ok) throw new Error(`fetchFeatureFlagOverrides: ${res.status}`)
  return res.json()
}

export async function setFeatureFlagOverride(key: string, value: boolean): Promise<void> {
  const res = await adminFetch(`/api/admin/feature-flags/${key}`, {
    method: 'PUT',
    body:   JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(`setFeatureFlagOverride: ${res.status}`)
}

export async function resetFeatureFlagOverrides(): Promise<void> {
  const res = await adminFetch('/api/admin/feature-flags', { method: 'DELETE' })
  if (!res.ok) throw new Error(`resetFeatureFlagOverrides: ${res.status}`)
}
