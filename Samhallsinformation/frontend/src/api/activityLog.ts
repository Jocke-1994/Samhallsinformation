import { adminFetch } from './adminFetch'

export type KontoÅtgärdTyp = 'Sparat: tillagd' | 'Sparat: borttagen'

export interface SparadHandelseMini {
  eventId:     string
  title:       string
  sourceName:  string
  publishedAt: string
  sparadDatum: string
}

export interface ÅngraData {
  anvandareId: string
  handelse:    SparadHandelseMini
  undoAction:  'lägg-till' | 'ta-bort'
}

export interface LoggPost {
  id:         string
  tid:        string
  vem:        string
  typ:        KontoÅtgärdTyp
  rubrik:     string
  detalj:     string
  ångrad:     boolean
  ångraData?: ÅngraData
}

interface CreateLogEntryRequest {
  typ:        KontoÅtgärdTyp
  rubrik:     string
  detalj:     string
  aktivVy:    string
  ångraData?: ÅngraData
}

export async function fetchAdminActivityLog(): Promise<LoggPost[]> {
  const res = await adminFetch('/api/admin/activity-log')
  if (!res.ok) throw new Error(`fetchAdminActivityLog: ${res.status}`)
  return res.json()
}

export async function createActivityLogEntry(req: CreateLogEntryRequest): Promise<void> {
  const res = await adminFetch('/api/admin/activity-log', {
    method: 'POST',
    body:   JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`createActivityLogEntry: ${res.status}`)
}

export async function undoActivityLogEntry(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/activity-log/${id}/undo`, { method: 'PUT' })
  if (!res.ok) throw new Error(`undoActivityLogEntry: ${res.status}`)
}
