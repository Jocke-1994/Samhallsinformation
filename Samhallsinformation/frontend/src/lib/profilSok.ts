import type { ProfileSection } from '../types'
import type { FlagKey, FlagState } from './featureFlags'

export interface SearchItem {
  section: ProfileSection
  sectionLabel: string
  label: string
  keywords: string[]
  /** Träffen visas bara om minst en av flaggorna är på (effektiva flaggor). */
  flaggor: FlagKey[]
}

const SEARCH_INDEX: SearchItem[] = [
  // Mina källor
  { section: 'mina-kallor', sectionLabel: 'Mina källor', label: 'Hämta källor via SPAR', keywords: ['spar', 'adress', 'folkbokföring', 'automatisk', 'förslag'], flaggor: ['konto_samtycke'] },
  { section: 'mina-kallor', sectionLabel: 'Mina källor', label: 'Lägg till källa manuellt', keywords: ['sök', 'källa', 'lägg till', 'myndighet', 'organisation'], flaggor: ['kallor_lagg_till', 'kallor_alla'] },
  { section: 'mina-kallor', sectionLabel: 'Mina källor', label: 'Aktiva källor', keywords: ['aktiv', 'källa', 'ta bort', 'radera'], flaggor: ['kallor_aktiva'] },
  // Notifieringar
  { section: 'notifieringar', sectionLabel: 'Notifieringar', label: 'Obligatoriska källor', keywords: ['msb', 'polisen', 'obligatorisk', 'alltid', 'kris'], flaggor: ['notif_obligatoriska'] },
  { section: 'notifieringar', sectionLabel: 'Notifieringar', label: 'Globala inställningar', keywords: ['sms', 'e-post', 'mail', 'frekvens', 'kanal', 'tyst läge', 'push', 'notis'], flaggor: ['notif_mottagare', 'notif_stor_ej', 'notif_leveranslage'] },
  { section: 'notifieringar', sectionLabel: 'Notifieringar', label: 'Per källa-inställningar', keywords: ['källa', 'notis', 'toggle', 'aktivera', 'inaktivera'], flaggor: ['notif_leveranslage'] },
  { section: 'notifieringar', sectionLabel: 'Notifieringar', label: 'Geografifilter', keywords: ['geo', 'geografi', 'stad', 'län', 'lokal', 'region', 'plats'], flaggor: ['notif_leveranslage'] },
  // Konto
  { section: 'konto', sectionLabel: 'Konto', label: 'Kontouppgifter', keywords: ['namn', 'e-post', 'mail', 'uppgifter', 'profil', 'användare'], flaggor: ['konto_info'] },
  { section: 'konto', sectionLabel: 'Konto', label: 'Byt lösenord', keywords: ['lösenord', 'password', 'byt', 'säkerhet', 'ändra'], flaggor: ['konto_losenord'] },
  { section: 'konto', sectionLabel: 'Konto', label: 'Exportera persondata', keywords: ['gdpr', 'export', 'data', 'ladda ner', 'personuppgifter'], flaggor: ['konto_datahantering'] },
  { section: 'konto', sectionLabel: 'Konto', label: 'Radera konto', keywords: ['radera', 'ta bort', 'konto', 'gdpr', 'permanent'], flaggor: ['konto_datahantering'] },
  // Uppdateringar
  { section: 'uppdateringar', sectionLabel: 'Uppdateringar', label: 'Senaste version', keywords: ['version', 'release', 'ny', 'senaste', 'uppdatering'], flaggor: ['uppdateringar_senaste'] },
  { section: 'uppdateringar', sectionLabel: 'Uppdateringar', label: 'Kända buggar', keywords: ['bugg', 'fel', 'problem', 'issue', 'känd'], flaggor: ['uppdateringar_kanda_problem'] },
  { section: 'uppdateringar', sectionLabel: 'Uppdateringar', label: 'Versionshistorik', keywords: ['historik', 'changelog', 'tidigare', 'version'], flaggor: ['uppdateringar_historik'] },
  // Support
  { section: 'support', sectionLabel: 'Support', label: 'Mina ärenden', keywords: ['ärende', 'ticket', 'support', 'hjälp', 'kontakt'], flaggor: ['support_arenden'] },
  { section: 'support', sectionLabel: 'Support', label: 'Systemstatus', keywords: ['status', 'drift', 'nere', 'system', 'driftstatus'], flaggor: ['support_systemstatus'] },
  { section: 'support', sectionLabel: 'Support', label: 'FAQ', keywords: ['faq', 'frågor', 'vanliga', 'svar', 'hjälp'], flaggor: ['support_faq'] },
  { section: 'support', sectionLabel: 'Support', label: 'Skapa nytt ärende', keywords: ['nytt ärende', 'skicka', 'kontakta', 'meddelande', 'formulär'], flaggor: ['support_arenden'] },
]

// Exporteras för test: sökindexet får aldrig lova en funktion vars flagga är av.
export function searchIndex(query: string, flaggor: FlagState): Map<ProfileSection, SearchItem[]> {
  const q = query.toLowerCase().trim()
  const results = SEARCH_INDEX.filter(item => item.flaggor.some(f => flaggor[f])).filter(item =>
    item.label.toLowerCase().includes(q) ||
    item.sectionLabel.toLowerCase().includes(q) ||
    item.keywords.some(k => k.includes(q))
  )
  const grouped = new Map<ProfileSection, SearchItem[]>()
  for (const item of results) {
    if (!grouped.has(item.section)) grouped.set(item.section, [])
    grouped.get(item.section)!.push(item)
  }
  return grouped
}
