import { adminFetch } from './adminFetch'
import { felFranSvar } from './hamta'

export interface UserSourcePref {
  sourceId: number
  shortName: string
  isActive: boolean
  sortOrder: number
}

export interface SourcePrefUpdate {
  sourceId: number
  isActive: boolean
  sortOrder: number
}

export async function fetchUserSources(): Promise<UserSourcePref[]> {
  const res = await adminFetch('/api/user/sources')
  if (!res.ok) throw await felFranSvar(res, 'fetchUserSources')
  return res.json()
}

export async function saveUserSources(updates: SourcePrefUpdate[]): Promise<void> {
  const res = await adminFetch('/api/user/sources', {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw await felFranSvar(res, 'saveUserSources')
}
