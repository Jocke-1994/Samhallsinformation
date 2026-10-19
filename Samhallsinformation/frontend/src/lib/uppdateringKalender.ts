import type { Uppdatering } from '../api/uppdateringar'

// Kalendervy i Uppdateringar (beslut 2026-10-18, se docs/vault/Ideer/Uppdateringar-kalendervy.md):
// smal datakälla — bara poster med ett RIKTIGT datum i modellen (schemalagda
// och publicerade), aldrig utkast. En post med både annonsering och lansering
// visas som TVÅ separata kalenderposter (beslutat), inte en rad med två tider.

export type KalenderFas = 'Annonsering' | 'Lansering' | 'Publicerad'
export type KalenderKind = 'kommer-snart' | 'ny-funktion' | 'publicerad'

export interface KalenderEntry {
  id:            string
  uppdatering:   Uppdatering
  datum:         Date
  fas:           KalenderFas
  icon:          string
  kind:          KalenderKind
}

export const KALENDER_STIL: Record<KalenderKind, { bg: string; fg: string; dot: string; label: string }> = {
  'ny-funktion':  { bg: 'bg-violet-100',  fg: 'text-violet-700',  dot: 'bg-violet-600',  label: 'Ny funktion / lansering' },
  'kommer-snart': { bg: 'bg-emerald-100', fg: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Kommer snart (annonsering)' },
  publicerad:     { bg: 'bg-green-100',   fg: 'text-green-700',   dot: 'bg-green-600',   label: 'Publicerad' },
}

// Härleder kalenderposter rakt av ur fälten som redan finns på Uppdatering —
// ingen ny backend-datakälla. En post som fortfarande är schemalagd (oavsett
// om den redan annonserats) visar sin Lansering-post på schemalagdPublicerings
// Utc; "Publicerad" visas bara när schemaläggningen är helt klar (bakgrunds-
// tjänsten nollställer SchemalagdPubliceringUtc vid faktisk lansering).
export function byggKalenderEntries(uppdateringar: Uppdatering[]): KalenderEntry[] {
  const entries: KalenderEntry[] = []
  for (const u of uppdateringar) {
    if (u.annonseringUtc) {
      entries.push({ id: `${u.id}-annonsering`, uppdatering: u, datum: new Date(u.annonseringUtc), fas: 'Annonsering', icon: '📣', kind: 'kommer-snart' })
    }
    if (u.schemalagdPubliceringUtc) {
      entries.push({ id: `${u.id}-lansering`, uppdatering: u, datum: new Date(u.schemalagdPubliceringUtc), fas: 'Lansering', icon: '🚀', kind: 'ny-funktion' })
    } else if (u.publicerad) {
      entries.push({ id: `${u.id}-publicerad`, uppdatering: u, datum: new Date(u.datum), fas: 'Publicerad', icon: '✅', kind: 'publicerad' })
    }
  }
  return entries.sort((a, b) => a.datum.getTime() - b.datum.getTime())
}

export function sammaDag(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export interface MånadsCell {
  datum:    Date
  iAktuellMånad: boolean
  idag:     boolean
}

// 6×7-rutnät (42 celler), svensk vecka (mån–sön), inkl. spill från grann-
// månaderna så rutnätet alltid blir helt.
export function byggMånadsCeller(år: number, månad: number): MånadsCell[] {
  const idag = new Date()
  const förstaIMånaden = new Date(år, månad, 1)
  // getDay(): 0=sön..6=lör → gör om till 0=mån..6=sön
  const veckodagFörsta = (förstaIMånaden.getDay() + 6) % 7
  const startDatum = new Date(år, månad, 1 - veckodagFörsta)

  const celler: MånadsCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDatum)
    d.setDate(startDatum.getDate() + i)
    celler.push({ datum: d, iAktuellMånad: d.getMonth() === månad, idag: sammaDag(d, idag) })
  }
  return celler
}

export function visningsMålgrupp(u: Uppdatering): string {
  return u.punkter.some(p => p.synlighet === 'alla') ? 'Alla (även besökare)' : 'Endast inloggade'
}

// Push-raden gäller bara för de faser PushSkickaVid faktiskt styr
// (ScheduledReleaseBackgroundService.ExecuteDueAsync) — "Båda" gäller alla,
// annars bara den egna fasen. Publicerad-poster har redan passerat lanseringen.
export function pushGällerFör(u: Uppdatering, fas: KalenderFas): boolean {
  if (!u.skickaPush) return false
  if (u.pushSkickaVid === 'Båda') return true
  if (fas === 'Annonsering') return u.pushSkickaVid === 'Annonsering'
  return u.pushSkickaVid === 'Lansering'
}
