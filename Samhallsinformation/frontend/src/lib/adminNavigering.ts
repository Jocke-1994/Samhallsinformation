import type { SystemRoll } from '../context/AuthContext'

// Adminpanelens sektioner och vilka roller som ser dem — EN källa till sanning
// för sidomenyn, startsektionen och sektionsvakten i AdminPage. Ska spegla
// backends [Authorize(Roles = ...)] (beslut D1, V3-10): Support når Support-inbox
// och läser Användare/Händelsesök, allt annat är Admin-only. En flik Support
// får se men backend nekar ger 403 och en tom/trasig sida.

export type AdminSection =
  | 'oversikt'
  | 'kallor'
  | 'sandlada'
  | 'uppdateringar'
  | 'faq'
  | 'anvandare'
  | 'support-inbox'
  | 'handelsesok'
  | 'aktivitetslogg'
  | 'rapporter'
  | 'felsökning'
  | 'impersonation'
  | 'feature-flags'
  | 'funktionsideer'

export type AdminRoll = 'Admin' | 'Support'

export const ADMIN_NAV: { key: AdminSection; label: string; ikon: string; roller: AdminRoll[] }[] = [
  { key: 'oversikt',       label: 'Översikt',         ikon: '🏠', roller: ['Admin'] },
  { key: 'kallor',         label: 'Källhantering',     ikon: '📡', roller: ['Admin'] },
  { key: 'sandlada',       label: 'Sandlåda',          ikon: '🧪', roller: ['Admin'] },
  { key: 'uppdateringar',  label: 'Uppdateringar',     ikon: '📝', roller: ['Admin'] },
  { key: 'faq',            label: 'FAQ-hantering',     ikon: '❓', roller: ['Admin'] },
  { key: 'anvandare',      label: 'Användare',         ikon: '👥', roller: ['Admin', 'Support'] },
  { key: 'support-inbox',  label: 'Support-inbox',     ikon: '🎫', roller: ['Admin', 'Support'] },
  { key: 'handelsesok',    label: 'Händelsesök',       ikon: '🔍', roller: ['Admin', 'Support'] },
  { key: 'aktivitetslogg', label: 'Aktivitetslogg',    ikon: '📋', roller: ['Admin'] },
  { key: 'rapporter',      label: 'Rapporter',         ikon: '📊', roller: ['Admin'] },
  { key: 'felsökning',     label: 'Felsökning',        ikon: '🔧', roller: ['Admin'] },
  { key: 'impersonation',  label: 'Impersonation',  ikon: '🎭', roller: ['Admin'] },
  { key: 'feature-flags',  label: 'Feature flags',  ikon: '🚩', roller: ['Admin'] },
  { key: 'funktionsideer', label: 'Funktionsidéer', ikon: '💡', roller: ['Admin'] },
]

/**
 * Vilken admin-roll UI:t ska bete sig som. Ett riktigt Support-konto (`roll`) är alltid
 * Support, oavsett vad en gammal `si_aktiv_vy` i localStorage säger (delad webbläsare
 * efter en admin-session). En Admin som valt Support-vyn ser samma begränsade UI som
 * Support får (förhandsvisning av rollen).
 */
export function effektivAdminRoll(roll: SystemRoll | undefined, aktivVy: SystemRoll | undefined): AdminRoll {
  return roll === 'Support' || aktivVy === 'Support' ? 'Support' : 'Admin'
}

export function tillåtnaSektioner(roll: AdminRoll): AdminSection[] {
  return ADMIN_NAV.filter(n => n.roller.includes(roll)).map(n => n.key)
}

export function startSektion(roll: AdminRoll): AdminSection {
  return roll === 'Support' ? 'support-inbox' : 'oversikt'
}
