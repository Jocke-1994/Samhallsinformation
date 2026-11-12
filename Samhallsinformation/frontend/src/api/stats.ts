import { adminFetch } from './adminFetch'
import { felFranSvar } from './hamta'

export interface AdminStats {
  totalEvents: number
  eventsLast24h: number
  activeSources: number
  eventsByDay: { date: string; count: number }[]
  eventsBySource: { sourceId: number; sourceName: string; count: number }[]
  eventsBySeverity: { severity: string; count: number }[]
  notificationsByChannel: { channel: string; count: number }[]
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await adminFetch('/api/admin/stats')
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminStats')
  return res.json()
}
