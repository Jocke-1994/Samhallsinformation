import { adminFetch } from './adminFetch'

export type PunktTyp = 'ny-funktion' | 'förbättring' | 'buggfix' | 'känt-problem' | 'kommer-snart'
export type Synlighet = 'alla' | 'inloggade'

export interface UppdateringsPunkt {
  id:        string
  typ:       PunktTyp
  plats:     string
  text:      string
  synlighet: Synlighet
}

export interface Uppdatering {
  id:         string
  titel:      string
  datum:      string
  publicerad: boolean
  punkter:    UppdateringsPunkt[]
}

export interface PunktRequest {
  typ:       PunktTyp
  plats:     string
  text:      string
  synlighet: Synlighet
}

export interface UppdateringRequest {
  titel:      string
  datum:      string
  publicerad: boolean
  punkter:    PunktRequest[]
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchUppdateringar(): Promise<Uppdatering[]> {
  const res = await fetch(`${API_BASE}/api/uppdateringar`)
  if (!res.ok) throw new Error(`fetchUppdateringar: ${res.status}`)
  return res.json()
}

export async function fetchAdminUppdateringar(): Promise<Uppdatering[]> {
  const res = await adminFetch('/api/admin/uppdateringar')
  if (!res.ok) throw new Error(`fetchAdminUppdateringar: ${res.status}`)
  return res.json()
}

export async function createUppdatering(req: UppdateringRequest): Promise<Uppdatering> {
  const res = await adminFetch('/api/admin/uppdateringar', {
    method: 'POST',
    body:   JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`createUppdatering: ${res.status}`)
  return res.json()
}

export async function updateUppdatering(id: string, req: UppdateringRequest): Promise<Uppdatering> {
  const res = await adminFetch(`/api/admin/uppdateringar/${id}`, {
    method: 'PUT',
    body:   JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`updateUppdatering: ${res.status}`)
  return res.json()
}

export async function deleteUppdatering(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/uppdateringar/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteUppdatering: ${res.status}`)
}
