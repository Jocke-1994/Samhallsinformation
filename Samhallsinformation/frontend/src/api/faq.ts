import type { FaqKategori } from '../types'
import { adminFetch } from './adminFetch'

export interface FaqItem {
  id:         string
  kategori:   FaqKategori
  publicerad: boolean
  fraga:      string
  svar:       string
  flagKey:    string | null
}

export interface FaqRequest {
  kategori:   FaqKategori
  fraga:      string
  svar:       string
  publicerad: boolean
  flagKey:    string | null
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchFaq(): Promise<FaqItem[]> {
  const res = await fetch(`${API_BASE}/api/faq`)
  if (!res.ok) throw new Error(`fetchFaq: ${res.status}`)
  return res.json()
}

export async function fetchAdminFaq(): Promise<FaqItem[]> {
  const res = await adminFetch('/api/admin/faq')
  if (!res.ok) throw new Error(`fetchAdminFaq: ${res.status}`)
  return res.json()
}

export async function createFaqItem(req: FaqRequest): Promise<FaqItem> {
  const res = await adminFetch('/api/admin/faq', {
    method: 'POST',
    body:   JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`createFaqItem: ${res.status}`)
  return res.json()
}

export async function updateFaqItem(id: string, req: FaqRequest): Promise<FaqItem> {
  const res = await adminFetch(`/api/admin/faq/${id}`, {
    method: 'PUT',
    body:   JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`updateFaqItem: ${res.status}`)
  return res.json()
}

export async function deleteFaqItem(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/faq/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteFaqItem: ${res.status}`)
}
