import { adminFetch } from './adminFetch'
import type { CanonicalEvent } from '../types'

export interface PreviewSource {
  sourceId: number
  sourceName: string
  events: CanonicalEvent[]
}

export interface DryRunResult {
  count: number
  events: CanonicalEvent[]
}

export async function fetchPreviewEvents(): Promise<PreviewSource[]> {
  const res = await adminFetch('/api/admin/testing/preview')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function dryRunSource(url: string, name: string): Promise<DryRunResult> {
  const res = await adminFetch('/api/admin/testing/dryrun', {
    method: 'POST',
    body: JSON.stringify({ url, name }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data
}
