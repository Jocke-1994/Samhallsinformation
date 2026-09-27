import { adminFetch } from './adminFetch'
import { LANG_TIMEOUT_MS, felFranSvar } from './hamta'

export type HälsaStatus = 'OK' | 'Varning' | 'Nere'

export interface AdminHealthDto {
  api: { status: HälsaStatus; latencyMs: number }
  db:  { status: HälsaStatus; latencyMs: number }
  ingestor: {
    status:        HälsaStatus
    lastFetchedAt: string | null
    aktivaKällor:  number
    källorMedFel:  number
  }
  notifieringar: {
    status:           HälsaStatus
    felSenaste24h:    number
    totaltSenaste24h: number
  }
}

export async function fetchAdminHealth(): Promise<AdminHealthDto> {
  const res = await adminFetch('/api/admin/health', { timeoutMs: LANG_TIMEOUT_MS })
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminHealth')
  return res.json()
}
