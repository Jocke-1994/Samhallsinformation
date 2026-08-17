// Delad localStorage-modul för kontoåtgärder som admin/support tar i
// Användarhantering (idag: Sparat-ändringar) — samma mönster som
// sparadeHandelserStorage.ts. Separat från Aktivitetsloggens statiska
// Ingestor/Notis/Fel-mock (ingen riktig backend-loggning för dem än), men
// de två källorna visas sammanslagna i Aktivitetslogg.tsx.
//
// Bakgrund: support har inte tillgång till Aktivitetsloggen, så om en
// supportmedarbetare råkar t.ex. ta bort fel sparad händelse finns annars
// inget sätt för admin att se vad som hände utan att bli informerad muntligt.
// Varje logg-post här kan bära en Ångra-payload som återställer exakt det
// som ändrades.

import type { SparadHandelseMini } from './sparadeHandelserStorage'

export type KontoÅtgärdTyp = 'Sparat: tillagd' | 'Sparat: borttagen'

export interface ÅngraData {
  anvandareId: string
  handelse:    SparadHandelseMini
  undoAction:  'lägg-till' | 'ta-bort'
}

export interface LoggPost {
  id:         string
  tid:        string // ISO-tidsstämpel
  vem:        string // t.ex. "Joakim Rehn (Support-läge)"
  typ:        KontoÅtgärdTyp
  rubrik:     string
  detalj:     string
  ångrad:     boolean
  ångraData?: ÅngraData
}

const STORAGE_KEY = 'si_admin_aktivitetslogg'

export function laddaLogg(): LoggPost[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return []
}

export function läggTillLoggpost(post: Omit<LoggPost, 'id' | 'ångrad'>): void {
  const alla = laddaLogg()
  alla.unshift({ ...post, id: crypto.randomUUID(), ångrad: false })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alla))
}

export function markeraÅngrad(id: string): void {
  const alla = laddaLogg().map(p => p.id === id ? { ...p, ångrad: true } : p)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alla))
}
