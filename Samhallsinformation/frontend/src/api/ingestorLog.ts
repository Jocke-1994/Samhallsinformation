import { adminFetch } from './adminFetch'

export interface IngestorLogSummaryDto {
  totaltFel: number
  kritiska:  number
  perDag:    { date: string; count: number }[]
}

export interface IngestorLogRowDto {
  id:                  string
  runAt:               string
  success:             boolean
  eventsInserted:      number
  errorMessage:        string | null
  sourceName:          string
  återförsökLyckades:  boolean | null
}

export async function fetchIngestorLogSummary(days = 7): Promise<IngestorLogSummaryDto> {
  const res = await adminFetch(`/api/admin/ingestor-log/summary?days=${days}`)
  if (!res.ok) throw new Error(`fetchIngestorLogSummary: ${res.status}`)
  return res.json()
}

export async function fetchIngestorLogRecent(params?: { limit?: number; onlyErrors?: boolean }): Promise<IngestorLogRowDto[]> {
  const query = new URLSearchParams()
  if (params?.limit)      query.set('limit', String(params.limit))
  if (params?.onlyErrors) query.set('onlyErrors', 'true')
  const qs = query.toString()
  const res = await adminFetch(`/api/admin/ingestor-log/recent${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(`fetchIngestorLogRecent: ${res.status}`)
  return res.json()
}
