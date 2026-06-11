import type { Source } from '../types'

const MOCK_SOURCES: Source[] = [
  { id: 1,  name: 'Polisen',                      shortName: 'Polisen',          baseUrl: 'https://polisen.se',              isActive: true, scope: 'nationell' },
  { id: 2,  name: 'SMHI',                         shortName: 'SMHI',             baseUrl: 'https://smhi.se',                 isActive: false, scope: 'nationell' },
  { id: 3,  name: 'MSB',                          shortName: 'MSB',              baseUrl: 'https://msb.se',                  isActive: false, scope: 'nationell' },
  { id: 4,  name: 'Trafikverket',                 shortName: 'Trafikverket',     baseUrl: 'https://trafikverket.se',         isActive: false, scope: 'nationell' },
  { id: 5,  name: 'Krisinformation.se',           shortName: 'Krisinformation',  baseUrl: 'https://krisinformation.se',      isActive: true,  scope: 'nationell' },
  { id: 6,  name: 'Göteborgs Stad',               shortName: 'Gbg Stad',         baseUrl: 'https://goteborg.se',             isActive: false, scope: 'regional'  },
  { id: 7,  name: 'Länsstyrelsen Västra Götaland',shortName: 'Lst VGR',          baseUrl: 'https://lansstyrelsen.se/vgr',    isActive: false, scope: 'regional'  },
  { id: 8,  name: 'Västra Götalandsregionen',     shortName: 'VGR',              baseUrl: 'https://vgregion.se',             isActive: false, scope: 'regional'  },
]

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchSources(): Promise<Source[]> {
  if (USE_MOCK) return MOCK_SOURCES
  const res = await fetch(`${API_BASE}/api/sources`)
  if (!res.ok) throw new Error(`fetchSources: ${res.status}`)
  return res.json()
}
