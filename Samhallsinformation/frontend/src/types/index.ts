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
}

export interface CanonicalEvent {
  id: string
  sourceId: number
  title: string
  content: string
  publishedAt: string
  url: string
  geography: string | null
  severity: 'Bra att veta' | 'Viktigt' | 'Kritisk'
  isNational: boolean
}

export interface EventsResponse {
  total: number
  page: number
  pageSize: number
  events: CanonicalEvent[]
}

// ProfileNav
export type ProfileSection =
  | 'mina-kallor'
  | 'notifieringar'
  | 'konto'
  | 'uppdateringar'
  | 'support'

// MinaKallor
export type KallTyp    = 'Nationell' | 'Regional' | 'Kommunal'
export type SparFilter = 'Allt' | 'Regionalt' | 'Nationellt'
export type RekFlik    = 'Alla' | KallTyp
export type AllaFlik   = RekFlik | 'Nya'

export interface Kalla {
  id:              number
  namn:            string
  typ:             KallTyp
  region?:         string
  ort?:            string
  senasteNyhet:    string
  deprecated?:     boolean
  deprecatedAnledning?: string
  url:             string
  tillagdISystem:  string
}

// Uppdateringar
export interface ChangeEntry {
  type: 'nytt' | 'förbättrat' | 'fixat'
  text: string
  summary: string
  section?: ProfileSection
  linkText?: string
  highlightId?: string
}

export interface Release {
  version: string
  date: string
  changes: ChangeEntry[]
}

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

// Support
export type ArendeStatus = 'Öppet' | 'Under behandling' | 'Hanterat' | 'Stängt'

export interface Meddelande {
  fran: 'du' | 'support'
  text: string
  tid: string
}

export interface Arende {
  id: string
  kategori: string
  amne: string
  status: ArendeStatus
  skapat: string
  uppdaterat: string
  meddelanden: Meddelande[]
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
