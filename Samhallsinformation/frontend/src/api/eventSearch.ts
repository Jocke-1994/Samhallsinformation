import { adminFetch } from './adminFetch'

export interface SearchableSource {
  id: number
  name: string
  shortName: string
}

export interface AdminSearchEvent {
  id: string
  title: string
  content: string
  url: string
  geography: string | null
  severity: 'Bra att veta' | 'Viktigt' | 'Kritisk'
  eventType: string | null
  isNational: boolean
  publishedAt: string
  sourceId: number
  sourceName: string
}

export interface AdminSearchResult {
  total: number
  page: number
  pageSize: number
  events: AdminSearchEvent[]
}

export interface SearchParams {
  sourceId?: number
  geography?: string
  eventType?: string
  sokord?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export async function fetchSearchableSources(): Promise<SearchableSource[]> {
  const res = await adminFetch('/api/admin/events/sources')
  if (!res.ok) throw new Error(`fetchSearchableSources: ${res.status}`)
  return res.json()
}

export async function fetchEventTypes(sourceId?: number): Promise<string[]> {
  const qs = sourceId ? `?sourceId=${sourceId}` : ''
  const res = await adminFetch(`/api/admin/events/types${qs}`)
  if (!res.ok) throw new Error(`fetchEventTypes: ${res.status}`)
  return res.json()
}

export async function searchEvents(params: SearchParams): Promise<AdminSearchResult> {
  const qs = new URLSearchParams()
  if (params.sourceId)  qs.set('sourceId', String(params.sourceId))
  if (params.geography) qs.set('geography', params.geography)
  if (params.eventType) qs.set('eventType', params.eventType)
  if (params.sokord)    qs.set('sokord', params.sokord)
  if (params.from)      qs.set('from', params.from)
  if (params.to)        qs.set('to', params.to)
  qs.set('page', String(params.page ?? 1))
  qs.set('pageSize', String(params.pageSize ?? 20))

  const res = await adminFetch(`/api/admin/events/search?${qs.toString()}`)
  if (!res.ok) throw new Error(`searchEvents: ${res.status}`)
  return res.json()
}
