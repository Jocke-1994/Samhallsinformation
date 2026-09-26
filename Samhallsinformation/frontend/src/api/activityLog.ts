import { adminFetch } from './adminFetch'
import { felFranSvar } from './hamta'

export type AktörTyp = 'System' | 'Admin'

export type LoggTyp =
  | 'Ingestor'
  | 'Notis'
  | 'Fel'
  | 'Kontoåtgärd'
  | 'Konfiguration'
  | 'Konto'
  | 'Ärende'
  | 'Push'
  | 'Registrering'
  | 'Säkerhet'

export type LoggStatus = 'OK' | 'Fel' | 'Varning'

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
  id:            string
  tid:           string
  vem:           string
  aktörTyp:      AktörTyp
  typ:           LoggTyp
  rubrik:        string
  detalj:        string
  status:        LoggStatus
  ångrad:        boolean
  ångraData?:    ÅngraData
  ip?:           string | null
  enhet?:        string | null
  gammaltVärde?: string | null
  nyttVärde?:    string | null
  arkiverad:     boolean
  test:          boolean
  relateratÄrendeId?: string | null
}

export interface ActivityLogSammanfattning {
  ingestor:  number
  fel:       number
  varningar: number
}

export interface ActivityLogResponse {
  rader:          LoggPost[]
  totalt:         number
  sammanfattning: ActivityLogSammanfattning
}

export interface FetchActivityLogParams {
  aktörTyp?:       AktörTyp
  typ?:            string
  sök?:            string
  från?:           string
  till?:           string
  gräns?:          number
}

interface CreateLogEntryRequest {
  typ:        'Kontoåtgärd'
  rubrik:     string
  detalj:     string
  aktivVy:    string
  ångraData?: ÅngraData
}

export async function fetchAdminActivityLog(params?: FetchActivityLogParams): Promise<ActivityLogResponse> {
  const query = new URLSearchParams()
  if (params?.aktörTyp) query.set('aktörTyp', params.aktörTyp)
  if (params?.typ)      query.set('typ', params.typ)
  if (params?.sök)      query.set('sök', params.sök)
  if (params?.från)     query.set('från', params.från)
  if (params?.till)     query.set('till', params.till)
  if (params?.gräns)    query.set('gräns', String(params.gräns))
  const qs = query.toString()

  const res = await adminFetch(`/api/admin/activity-log${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminActivityLog')
  return res.json()
}

export async function createActivityLogEntry(req: CreateLogEntryRequest): Promise<void> {
  const res = await adminFetch('/api/admin/activity-log', {
    method: 'POST',
    body:   JSON.stringify(req),
  })
  if (!res.ok) throw await felFranSvar(res, 'createActivityLogEntry')
}

export async function undoActivityLogEntry(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/activity-log/${id}/undo`, { method: 'PUT' })
  if (!res.ok) throw await felFranSvar(res, 'undoActivityLogEntry')
}
