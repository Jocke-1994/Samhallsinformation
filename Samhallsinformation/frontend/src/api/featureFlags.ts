import { adminFetch, getToken } from './adminFetch'
import { felFranSvar, publikFetch } from './hamta'

// Token skickas med när den finns (samma mönster som fetchUppdateringar) —
// backend avgör om anroparen är en inloggad Admin för att räkna ut det
// effektiva värdet av en EndastAdmin-flagga (Testmiljö-läget). Utan token
// (eller en utloggad/vanlig besökare) ser alla en sådan flagga som av.
export async function fetchFeatureFlagOverrides(): Promise<Record<string, boolean>> {
  const token = getToken()
  const res = await publikFetch(`/api/feature-flags`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
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
  endastAdmin:     boolean
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

// Testmiljö-läget (Beslut 2026-10-19) — begränsar en redan aktiv flagga till
// bara inloggade Admin, utan att röra själva på/av-läget.
export async function setFeatureFlagEndastAdmin(key: string, endastAdmin: boolean): Promise<void> {
  const res = await adminFetch(`/api/admin/feature-flags/${key}/synlighet`, {
    method: 'PUT',
    body:   JSON.stringify({ endastAdmin }),
  })
  if (!res.ok) throw await felFranSvar(res, 'setFeatureFlagEndastAdmin')
}
