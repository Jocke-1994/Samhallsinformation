export interface Source {
  id: number
  name: string
  shortName: string
  baseUrl: string
  url?: string | null
  category?: string | null
  isActive: boolean
  scope: 'nationell' | 'regional'
}

export interface AdminSource {
  id: number
  name: string
  shortName: string
  baseUrl: string
  url: string | null
  category: string | null
  type: number
  isActive: boolean
  isPublished: boolean
  eventCount: number
  lastFetchedAt: string | null
  lastFetchError: string | null
}

export interface CanonicalEvent {
  id: string
  sourceId: number
  title: string
  content: string
  publishedAt: string
  url: string
  geography: string | null
  eventType?: string | null // saknas i MOCK_EVENTS (offline-fallback, api/events.ts) — alltid satt av EventsController i skarpt läge
  severity: 'Bra att veta' | 'Viktigt' | 'Kritisk'
  isNational: boolean
}

export interface EventsResponse {
  total: number
  page: number
  pageSize: number
  events: CanonicalEvent[]
  // Bara i serverflödena (Mitt flöde/Sparat, V3-11). hasMore är auktoritativt;
  // total är en nedre gräns när totalExakt är false.
  hasMore?: boolean
  totalExakt?: boolean
}

// Geografiskt platsfilter (docs/vault/Ideer/Geografiskt-platsfilter-besokare.md).
// Matchar PlatserController 1:1 — niva speglar backendens PlatsKatalogNivå-enum.
export interface PlatsKatalogPost {
  namn: string
  niva: 'Kommun' | 'Lan' | 'Nationellt'
  lan: string | null
  antalHandelser: number
  aktiv: boolean
}

export interface PlatsSektion {
  plats: string
  lan: string | null
  handelser: CanonicalEvent[]
}

// ProfileNav
export type ProfileSection = 'mina-kallor' | 'notifieringar' | 'konto' | 'uppdateringar' | 'support'

// MinaKallor
export type KallTyp = 'Nationell' | 'Regional' | 'Kommunal'
export type SparFilter = 'Allt' | 'Regionalt' | 'Nationellt'
export type RekFlik = 'Alla' | KallTyp
export type AllaFlik = RekFlik | 'Nya'

export interface Kalla {
  id: number
  namn: string
  typ: KallTyp
  region?: string
  ort?: string
  senasteNyhet: string
  deprecated?: boolean
  deprecatedAnledning?: string
  url: string
  tillagdISystem: string
}

// Uppdateringar — changelog-formen (Release/ChangeEntry) flyttad till
// api/uppdateringar.ts när den blev databas-backad (session 49). KändBugg/
// KommandeVersion är en annan sorts innehåll (inte release-format), kvar här.
export interface KändBugg {
  text: string
  allvar: 'låg' | 'medel' | 'hög'
  workaround?: string
  status?: string
}

export interface KommandeVersion {
  version: string
  description: string
  plannedDate: string
}

export interface NastaSteg {
  typ: 'ersattare' | 'borttagning'
  datum: string
}

export interface Subkalla {
  namn: string
  status: string
  dotColor: string
  kollad: string
  nastaKontroll: string | null
  paverkan: string
  nastaSteg?: NastaSteg
  kanalPaverkan?: string[]
}

export interface Tjanst {
  namn: string
  status: string
  dotColor: string
  kollad: string
  nastaKontroll: string | null
  subkallor?: Subkalla[]
  paverkan?: string
  kanalPaverkan?: string[]
  beraknatIDrift?: string
}

export interface PlaneratUnderhall {
  namn: string
  typ: 'Intern tjänst' | 'Extern källa'
  start: string
  beraknatSlut: string
  beskrivning: string
}

export interface FaqItem {
  q: string
  a: string
  kategori: FaqKategori
}

export type FaqKategori = 'Notifieringar' | 'Mina källor' | 'Konto' | 'Uppdateringar'
