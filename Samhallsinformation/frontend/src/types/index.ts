export interface Source {
  id: number
  name: string
  shortName: string
  baseUrl: string
  isActive: boolean
}

export interface CanonicalEvent {
  id: string
  sourceId: number
  title: string
  content: string
  publishedAt: string
  url: string
  geography: string | null
  severity: 'Bra att veta' | 'Viktigt' | 'Kritisk'
  isNational: boolean
}

export interface EventsResponse {
  total: number
  page: number
  pageSize: number
  events: CanonicalEvent[]
}
