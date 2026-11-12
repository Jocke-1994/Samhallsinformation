import type { FaqKategori } from '../types'
import { adminFetch } from './adminFetch'
import { felFranSvar, publikFetch } from './hamta'

export interface FaqItem {
  id: string
  kategori: FaqKategori
  publicerad: boolean
  fraga: string
  svar: string
  flagKey: string | null
}

export interface FaqRequest {
  kategori: FaqKategori
  fraga: string
  svar: string
  publicerad: boolean
  flagKey: string | null
}

export async function fetchFaq(): Promise<FaqItem[]> {
  const res = await publikFetch(`/api/faq`)
  if (!res.ok) throw await felFranSvar(res, 'fetchFaq')
  return res.json()
}

export async function fetchAdminFaq(): Promise<FaqItem[]> {
  const res = await adminFetch('/api/admin/faq')
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminFaq')
  return res.json()
}

export async function createFaqItem(req: FaqRequest): Promise<FaqItem> {
  const res = await adminFetch('/api/admin/faq', {
    method: 'POST',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw await felFranSvar(res, 'createFaqItem')
  return res.json()
}

export async function updateFaqItem(id: string, req: FaqRequest): Promise<FaqItem> {
  const res = await adminFetch(`/api/admin/faq/${id}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw await felFranSvar(res, 'updateFaqItem')
  return res.json()
}

export async function deleteFaqItem(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/faq/${id}`, { method: 'DELETE' })
  if (!res.ok) throw await felFranSvar(res, 'deleteFaqItem')
}
