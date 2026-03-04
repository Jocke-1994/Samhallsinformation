import type { EventsResponse } from '../types'

interface FetchEventsParams {
  sourceId?: number
  geography?: string
  national?: boolean
  page?: number
  pageSize?: number
}

export async function fetchEvents(params: FetchEventsParams = {}): Promise<EventsResponse> {
  const query = new URLSearchParams()
  if (params.sourceId !== undefined) query.set('source', String(params.sourceId))
  if (params.geography) query.set('geography', params.geography)
  if (params.national !== undefined) query.set('national', String(params.national))
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))

  const res = await fetch(`/api/events?${query}`)
  if (!res.ok) throw new Error('Kunde inte hämta händelser')
  return res.json()
}
