import { adminFetch } from './adminFetch'

export interface AdminStats {
  totalEvents:      number
  eventsLast24h:    number
  activeSources:    number
  eventsByDay:      { date: string; count: number }[]
  eventsBySource:   { sourceId: number; sourceName: string; count: number }[]
  eventsBySeverity: { severity: string; count: number }[]
  notificationsByChannel: { channel: string; count: number }[]
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await adminFetch('/api/admin/stats')
  if (!res.ok) throw new Error(`fetchAdminStats: ${res.status}`)
  return res.json()
}
