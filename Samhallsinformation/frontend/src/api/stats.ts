const API_BASE = import.meta.env.VITE_API_URL ?? ''

export interface AdminStats {
  totalEvents:      number
  eventsLast24h:    number
  activeSources:    number
  eventsByDay:      { date: string; count: number }[]
  eventsBySource:   { sourceId: number; sourceName: string; count: number }[]
  eventsBySeverity: { severity: string; count: number }[]
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch(`${API_BASE}/api/admin/stats`)
  if (!res.ok) throw new Error(`fetchAdminStats: ${res.status}`)
  return res.json()
}
