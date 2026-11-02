import { adminFetch, getToken } from './adminFetch'
import { felFranSvar, publikFetch } from './hamta'

export type PunktTyp = 'ny-funktion' | 'förbättring' | 'buggfix' | 'känt-problem' | 'kommer-snart'
export type Synlighet = 'alla' | 'inloggade'
export type PushSkickaVid = 'Annonsering' | 'Lansering' | 'Båda'

export interface UppdateringsPunkt {
  id:        string
  typ:       PunktTyp
  plats:     string
  text:      string
  synlighet: Synlighet
  /** "Prova själv"-mål (lib/provaSjalv.ts), null = ingen länk. Saknas i äldre svar. */
  provaSjalv?: string | null
}

export interface Uppdatering {
  id:                        string
  titel:                     string
  datum:                     string
  publicerad:                boolean
  punkter:                   UppdateringsPunkt[]
  schemalagdPubliceringUtc:  string | null
  schemalagdaFlaggor:        string[]
  skickaPush:                boolean
  pushVersion:               string | null
  pushMeddelande:            string | null
  visaBanderoll:             boolean
  annonseringUtc:            string | null
  annonseradUtc:             string | null
  pushSkickaVid:             PushSkickaVid
  createdAt:                 string
  visaVadArNytt:             boolean
}

export interface PunktRequest {
  typ:       PunktTyp
  plats:     string
  text:      string
  synlighet: Synlighet
  provaSjalv?: string | null
}

export interface UppdateringRequest {
  titel:                     string
  datum:                     string
  publicerad:                boolean
  punkter:                   PunktRequest[]
  schemalagdPubliceringUtc?: string | null
  schemalagdaFlaggor?:       string[]
  skickaPush?:               boolean
  pushVersion?:              string | null
  pushMeddelande?:           string | null
  visaBanderoll?:            boolean
  annonseringUtc?:           string | null
  pushSkickaVid?:            PushSkickaVid
  visaVadArNytt?:            boolean
}

// Publika endpointen filtrerar på Synlighet i backend: anonym får bara punkter
// märkta "alla", en giltig token ger även "inloggade". Token skickas därför
// när den finns. Ingen Content-Type-header på GET (undviker onödig preflight
// för anonyma besökare).
export async function fetchUppdateringar(): Promise<Uppdatering[]> {
  const token = getToken()
  const res = await publikFetch(`/api/uppdateringar`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw await felFranSvar(res, 'fetchUppdateringar')
  return res.json()
}

// Svaret skiljer sig mellan inloggad och anonym — de får aldrig dela cache-post.
// Prefixet ['uppdateringar'] behålls så admins invalidateQueries träffar båda.
export function uppdateringarQueryKey(isLoggedIn: boolean) {
  return ['uppdateringar', isLoggedIn ? 'inloggad' : 'anonym'] as const
}

export async function fetchAdminUppdateringar(): Promise<Uppdatering[]> {
  const res = await adminFetch('/api/admin/uppdateringar')
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminUppdateringar')
  return res.json()
}

export async function createUppdatering(req: UppdateringRequest): Promise<Uppdatering> {
  const res = await adminFetch('/api/admin/uppdateringar', {
    method: 'POST',
    body:   JSON.stringify(req),
  })
  if (!res.ok) throw await felFranSvar(res, 'createUppdatering')
  return res.json()
}

export async function updateUppdatering(id: string, req: UppdateringRequest): Promise<Uppdatering> {
  const res = await adminFetch(`/api/admin/uppdateringar/${id}`, {
    method: 'PUT',
    body:   JSON.stringify(req),
  })
  if (!res.ok) throw await felFranSvar(res, 'updateUppdatering')
  return res.json()
}

// Vad är nytt-rutan — bara för inloggade. Backend svarar 204 när det inte finns
// något att visa (redan sett, äldre än kontot, inget ikryssat), då blir det null.
export interface VadArNytt {
  id:      string
  titel:   string
  datum:   string
  punkter: UppdateringsPunkt[]
}

export async function fetchVadArNytt(): Promise<VadArNytt | null> {
  const res = await adminFetch('/api/uppdateringar/vad-ar-nytt')
  if (res.status === 204) return null
  if (!res.ok) throw await felFranSvar(res, 'fetchVadArNytt')
  return res.json()
}

export async function markeraVadArNyttSett(id: string): Promise<void> {
  const res = await adminFetch(`/api/uppdateringar/vad-ar-nytt/${id}/sett`, { method: 'POST' })
  if (!res.ok) throw await felFranSvar(res, 'markeraVadArNyttSett')
}

export async function deleteUppdatering(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/uppdateringar/${id}`, { method: 'DELETE' })
  if (!res.ok) throw await felFranSvar(res, 'deleteUppdatering')
}
