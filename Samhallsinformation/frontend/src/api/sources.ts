import type { Source } from '../types'

const MOCK_SOURCES: Source[] = [
  { id: 1,  name: 'Polisen',                      shortName: 'Polisen',          baseUrl: 'https://polisen.se',              isActive: true },
  { id: 2,  name: 'SMHI',                         shortName: 'SMHI',             baseUrl: 'https://smhi.se',                 isActive: true },
  { id: 3,  name: 'MSB',                          shortName: 'MSB',              baseUrl: 'https://msb.se',                  isActive: true },
  { id: 4,  name: 'Trafikverket',                 shortName: 'Trafikverket',     baseUrl: 'https://trafikverket.se',         isActive: true },
  { id: 5,  name: 'Krisinformation.se',           shortName: 'Krisinformation',  baseUrl: 'https://krisinformation.se',      isActive: true },
  { id: 6,  name: 'Göteborgs Stad',               shortName: 'Gbg Stad',         baseUrl: 'https://goteborg.se',             isActive: true },
  { id: 7,  name: 'Länsstyrelsen Västra Götaland',shortName: 'Lst VGR',          baseUrl: 'https://lansstyrelsen.se/vgr',    isActive: true },
  { id: 8,  name: 'Västra Götalandsregionen',     shortName: 'VGR',              baseUrl: 'https://vgregion.se',             isActive: true },
]

export async function fetchSources(): Promise<Source[]> {
  try {
    const res = await fetch('/api/sources')
    if (!res.ok) throw new Error()
    return res.json()
  } catch {
    return MOCK_SOURCES
  }
}
