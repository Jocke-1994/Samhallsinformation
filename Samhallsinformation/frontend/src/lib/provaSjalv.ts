import type { FlagKey, FlagState } from './featureFlags'

// "Prova själv"-länkar i Uppdateringar (Ideer/Prova-sjalv-lankar.md, skiss
// godkänd 2026-11-02). Admin väljer ett MÅL per rad ur en fast lista, aldrig
// en fritext-adress. Backenden lagrar bara nyckeln och validerar den mot samma
// lista (UppdateringsVärden.ProvaSjalvMål) — adress, etikett, flagga och
// kontokrav bor här.

export type ProvaSjalvMål =
  | 'senaste-nytt-plats' | 'profil-uppdateringar' | 'konto-push' | 'aktivera-push'
  | 'mitt-flode-sparat' | 'mina-kallor' | 'support'

export interface ProvaSjalvMålInfo {
  etikett:     string
  till:        string
  /** Länken visas bara när den här flaggan är på — annars leder den till något som inte finns. */
  flagga:      FlagKey | null
  kräverKonto: boolean
}

export const PROVA_SJALV: Record<ProvaSjalvMål, ProvaSjalvMålInfo> = {
  'senaste-nytt-plats':   { etikett: 'Senaste nytt → Filtrera på plats', till: '/?vy=plats',                    flagga: 'flode_platsfilter',     kräverKonto: false },
  'profil-uppdateringar': { etikett: 'Profil → Uppdateringar',           till: '/profil?section=uppdateringar', flagga: 'uppdateringar_senaste', kräverKonto: true },
  'konto-push':           { etikett: 'Konto → Push-notiser',             till: '/profil?section=konto',         flagga: 'notif_push',            kräverKonto: true },
  // Inte en länk utan en ruta med en Aktivera-knapp (AktiveraPushRuta, beslut
  // 2026-11-03). Besökare utan konto får en vanlig "kräver konto"-länk hit.
  'aktivera-push':        { etikett: 'Knapp: Aktivera push-notiser',     till: '/profil?section=konto',         flagga: 'notif_push',            kräverKonto: true },
  'mitt-flode-sparat':    { etikett: 'Mitt flöde → Sparat',              till: '/?vy=sparat',                   flagga: 'flode_sparat',          kräverKonto: true },
  'mina-kallor':          { etikett: 'Mina källor',                      till: '/profil?section=mina-kallor',   flagga: null,                    kräverKonto: true },
  'support':              { etikett: 'Support',                          till: '/profil?section=support',       flagga: null,                    kräverKonto: true },
}

export const PROVA_SJALV_MÅL = Object.keys(PROVA_SJALV) as ProvaSjalvMål[]

export function ärProvaSjalvMål(v: unknown): v is ProvaSjalvMål {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PROVA_SJALV, v)
}

export interface ProvaSjalvLänk {
  href:        string
  /** Besökare som måste logga in först — länken visar "kräver konto" och går via inloggningen. */
  kräverKonto: boolean
}

/**
 * Vart "Prova själv" ska leda just nu, eller null om ingen länk ska visas:
 * okänt mål, avstängd funktion, eller sidan man redan står på (`härifrån`).
 */
export function provaSjalvLänk(mål: string | null | undefined, { inloggad, flaggor, härifrån }: {
  inloggad: boolean
  flaggor:  Partial<FlagState>
  härifrån?: ProvaSjalvMål
}): ProvaSjalvLänk | null {
  if (!ärProvaSjalvMål(mål) || mål === härifrån) return null
  const info = PROVA_SJALV[mål]
  if (info.flagga && !flaggor[info.flagga]) return null
  if (info.kräverKonto && !inloggad)
    return { href: `/login?redirect=${encodeURIComponent(info.till)}`, kräverKonto: true }
  return { href: info.till, kräverKonto: false }
}
