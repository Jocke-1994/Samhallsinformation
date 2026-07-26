import type { KallTyp, Kalla, SparFilter } from '../../../types'

export const NY_GRANS_DAGAR = 30

export function arNy(k: Kalla): boolean {
  return (Date.now() - new Date(k.tillagdISystem).getTime()) / 86_400_000 < NY_GRANS_DAGAR
}

export const KALLOR: Kalla[] = [
  { id: 1,  namn: 'Göteborgs Stad',               typ: 'Kommunal',  region: 'Västra Götaland', ort: 'Göteborg',  senasteNyhet: '2026-03-20T08:00:00', url: 'https://goteborg.se',                    tillagdISystem: '2025-06-01' },
  { id: 2,  namn: 'Västra Götalandsregionen',      typ: 'Regional',  region: 'Västra Götaland',                  senasteNyhet: '2026-03-20T09:30:00', url: 'https://vgregion.se',                    tillagdISystem: '2025-06-01' },
  { id: 3,  namn: 'Trafikverket',                  typ: 'Nationell',                                             senasteNyhet: '2026-03-20T10:00:00', url: 'https://trafikverket.se',                tillagdISystem: '2025-06-01' },
  { id: 4,  namn: 'SMHI',                          typ: 'Nationell',                                             senasteNyhet: '2026-03-19T14:00:00', url: 'https://smhi.se',                        tillagdISystem: '2025-06-01' },
  { id: 5,  namn: 'Västtrafik',                    typ: 'Regional',  region: 'Västra Götaland', ort: 'Göteborg', senasteNyhet: '2026-03-18T11:00:00', url: 'https://vasttrafik.se',                  tillagdISystem: '2025-06-01' },
  { id: 6,  namn: 'Polismyndigheten',              typ: 'Nationell',                                             senasteNyhet: '2026-03-20T07:00:00', url: 'https://polisen.se',                     tillagdISystem: '2025-06-01' },
  { id: 7,  namn: 'Länsstyrelsen Västra Götaland', typ: 'Regional',  region: 'Västra Götaland',                  senasteNyhet: '2026-03-15T09:00:00', url: 'https://lansstyrelsen.se/vastragotaland', tillagdISystem: '2025-06-01', deprecated: true, deprecatedAnledning: 'Länsstyrelsen Västra Götaland' },
  { id: 8,  namn: 'MSB',                           typ: 'Nationell',                                             senasteNyhet: '2026-03-13T16:00:00', url: 'https://msb.se',                         tillagdISystem: '2025-06-01', deprecated: true, deprecatedAnledning: 'MSB' },
  { id: 9,  namn: 'Stockholms Stad',               typ: 'Kommunal',  region: 'Stockholm',       ort: 'Stockholm',senasteNyhet: '2026-03-20T06:00:00', url: 'https://stockholm.se',                   tillagdISystem: '2025-06-01' },
  { id: 10, namn: 'Storstockholm',                 typ: 'Regional',  region: 'Stockholm',                        senasteNyhet: '2026-03-19T08:00:00', url: 'https://storstockholm.se',               tillagdISystem: '2025-06-01' },
  { id: 11, namn: 'Folkhälsomyndigheten',          typ: 'Nationell',                                             senasteNyhet: '2026-03-17T10:00:00', url: 'https://folkhalsomyndigheten.se',        tillagdISystem: '2026-03-10' },
  { id: 12, namn: 'Socialstyrelsen',               typ: 'Nationell',                                             senasteNyhet: '2026-03-10T12:00:00', url: 'https://socialstyrelsen.se',             tillagdISystem: '2026-03-10' },
  { id: 13, namn: 'Göteborgs Kommun',              typ: 'Kommunal',  region: 'Västra Götaland', ort: 'Göteborg', senasteNyhet: '2026-03-20T11:00:00', url: 'https://goteborg.se',                    tillagdISystem: '2026-03-15' },
  { id: 14, namn: 'Malmö Stad',                    typ: 'Kommunal',  region: 'Skåne',           ort: 'Malmö',    senasteNyhet: '2026-03-19T15:00:00', url: 'https://malmo.se',                       tillagdISystem: '2026-03-15' },
  { id: 15, namn: 'Region Skåne',                  typ: 'Regional',  region: 'Skåne',                            senasteNyhet: '2026-03-18T09:00:00', url: 'https://skane.se',                       tillagdISystem: '2026-03-18' },
]

export const SPAR_FORSLAG: Record<SparFilter, number[]> = {
  Allt:       [1, 2, 5, 7, 13],
  Regionalt:  [2, 5, 7],
  Nationellt: [],
}

export const ORSAK: Record<number, string> = {
  3:  'Rekommenderas som nationell källa för trafikinformation.',
  4:  'Rekommenderas för väder- och klimatinformation.',
  8:  'Rekommenderas för krisberedskap och säkerhet.',
  11: 'Rekommenderas för folkhälsa och sjukdomsinformation.',
  12: 'Rekommenderas för hälso- och sjukvårdsinformation.',
  5:  'Rekommenderas för att du har Västra Götalandsregionen i din aktiva källlista.',
  7:  'Rekommenderas för att du har Göteborgs Stad i din aktiva källlista.',
  10: 'Rekommenderas för att du har Stockholms Stad i din aktiva källlista.',
  15: 'Rekommenderas för att du har Malmö Stad i din aktiva källlista.',
  9:  'Rekommenderas som kommunal källa för Stockholmsregionen.',
  14: 'Rekommenderas som kommunal källa för Malmöregionen.',
}

export const DOT: Record<KallTyp, string> = {
  Nationell: 'bg-blue-500',
  Regional:  'bg-green-500',
  Kommunal:  'bg-yellow-400',
}

export const RUBRIK: Record<KallTyp, string> = {
  Nationell: 'text-blue-600',
  Regional:  'text-green-600',
  Kommunal:  'text-yellow-500',
}

export const TYPNAMN: Record<KallTyp, string> = {
  Nationell: 'Nationella',
  Regional:  'Regionala',
  Kommunal:  'Kommunala',
}

export function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item)
    return acc
  }, {})
}
