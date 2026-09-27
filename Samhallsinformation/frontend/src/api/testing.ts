import { adminFetch } from './adminFetch'
import { LANG_TIMEOUT_MS, felFranSvar } from './hamta'
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
  const res = await adminFetch('/api/admin/testing/preview', { timeoutMs: LANG_TIMEOUT_MS })
  if (!res.ok) throw await felFranSvar(res, 'fetchPreviewEvents')
  return res.json()
}

export async function dryRunSource(url: string, name: string): Promise<DryRunResult> {
  const res = await adminFetch('/api/admin/testing/dryrun', {
    method: 'POST',
    body: JSON.stringify({ url, name }),
    timeoutMs: LANG_TIMEOUT_MS,
  })
  if (!res.ok) throw await felFranSvar(res, 'dryRunSource')
  return res.json()
}
