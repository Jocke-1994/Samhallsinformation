// Delad localStorage-modul för att koppla ett händelsesök-resultat till en
// mock-användare i Anvandare.tsx (samma mönster som faqStorage.ts, session
// 17) — Händelsesök skriver, Användarhanteringens Sparat-sektion läser.
// Helt mockat: kopplar mot mock-användar-ID:n, ingen riktig backend.

export interface SparadHandelseMini {
  eventId:     string
  title:       string
  sourceName:  string
  publishedAt: string
  sparadDatum: string
}

const STORAGE_KEY = 'si_admin_sparade_handelser'

export function laddaSparadeHandelser(): Record<number, SparadHandelseMini[]> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return {}
}

export function sparaHandelseForAnvandare(anvandareId: number, handelse: SparadHandelseMini): void {
  const alla  = laddaSparadeHandelser()
  const lista = alla[anvandareId] ?? []
  if (lista.some(h => h.eventId === handelse.eventId)) return // redan sparad, undvik dubblett
  alla[anvandareId] = [handelse, ...lista]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alla))
}

export function taBortSparadHandelse(anvandareId: number, eventId: string): void {
  const alla = laddaSparadeHandelser()
  alla[anvandareId] = (alla[anvandareId] ?? []).filter(h => h.eventId !== eventId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alla))
}
