import { adminFetch } from './adminFetch'
import { felFranSvar } from './hamta'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AdminAlertDto {
  id:              string
  ruleId:          string
  severity:        AlertSeverity
  title:           string
  detail:          string
  firstRaisedAt:   string
  lastSeenAt:      string
  occurrenceCount: number
  acknowledgedAt:  string | null
  acknowledgedBy:  string | null
  resolvedAt:      string | null
}

export interface AdminAlertListDto {
  open:             AdminAlertDto[]
  recentlyResolved: AdminAlertDto[]
}

export async function fetchAdminAlerts(): Promise<AdminAlertListDto> {
  const res = await adminFetch('/api/admin/alerts')
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminAlerts')
  return res.json()
}

export async function acknowledgeAdminAlert(id: string): Promise<AdminAlertDto> {
  const res = await adminFetch(`/api/admin/alerts/${id}/acknowledge`, { method: 'POST' })
  if (!res.ok) throw await felFranSvar(res, 'acknowledgeAdminAlert')
  return res.json()
}
