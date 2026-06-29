export type FlagKey =
  | 'kallor_lagg_till'
  | 'kallor_aktiva'
  | 'kallor_rekommenderade'
  | 'kallor_alla'
  | 'notif_obligatoriska'
  | 'notif_mottagare'
  | 'notif_stor_ej'
  | 'notif_leveranslage'
  | 'notif_historik'
  | 'konto_info'
  | 'konto_losenord'
  | 'konto_tvafaktor'
  | 'konto_app_notiser'
  | 'konto_sessioner'
  | 'konto_aktivitetslogg'
  | 'konto_samtycke'
  | 'konto_datahantering'
  | 'konto_tema'
  | 'uppdateringar_senaste'
  | 'uppdateringar_pagang'
  | 'uppdateringar_kanda_problem'
  | 'uppdateringar_historik'
  | 'support_arenden'
  | 'support_systemstatus'
  | 'support_faq'

export interface FlagDefinition {
  key: FlagKey
  label: string
  beskrivning: string
  defaultAktiv: boolean
}

export interface FlagGrupp {
  key: string
  label: string
  ikon: string
  flaggor: FlagDefinition[]
}

export const FLAG_GRUPPER: FlagGrupp[] = [
  {
    key: 'mina-kallor',
    label: 'Mina källor',
    ikon: '🗂️',
    flaggor: [
      { key: 'kallor_lagg_till',      label: 'Lägg till källa',        beskrivning: 'Möjlighet att lägga till nya källor',             defaultAktiv: true },
      { key: 'kallor_aktiva',         label: 'Aktiva källor',          beskrivning: 'Visa användarens aktiva och prenumererade källor', defaultAktiv: true },
      { key: 'kallor_rekommenderade', label: 'Rekommenderade källor',  beskrivning: 'Visa rekommenderade källor baserat på profil',     defaultAktiv: false },
      { key: 'kallor_alla',           label: 'Alla källor',            beskrivning: 'Bläddra bland samtliga tillgängliga källor',       defaultAktiv: true },
    ],
  },
  {
    key: 'notifieringar',
    label: 'Notifieringar',
    ikon: '🔔',
    flaggor: [
      { key: 'notif_obligatoriska', label: 'Obligatoriska källor', beskrivning: 'Källor som alltid notifierar oavsett inställning', defaultAktiv: false },
      { key: 'notif_mottagare',     label: 'Mottagare',            beskrivning: 'Hantera e-post och andra mottagarkanaler',         defaultAktiv: false },
      { key: 'notif_stor_ej',       label: 'Stör ej',              beskrivning: 'Tysta notifieringar under valda tider',           defaultAktiv: false },
      { key: 'notif_leveranslage',  label: 'Leveransläge',         beskrivning: 'Ställ in hur och när notifieringar levereras',    defaultAktiv: false },
      { key: 'notif_historik',      label: 'Notishistorik',        beskrivning: 'Visa tidigare skickade notifieringar',            defaultAktiv: false },
    ],
  },
  {
    key: 'konto',
    label: 'Konto',
    ikon: '👤',
    flaggor: [
      { key: 'konto_info',           label: 'Kontoinformation',  beskrivning: 'Visa och ändra namn, e-post och grunduppgifter', defaultAktiv: true },
      { key: 'konto_losenord',       label: 'Lösenordsbyte',     beskrivning: 'Byt lösenord för kontot',                       defaultAktiv: true },
      { key: 'konto_tvafaktor',      label: 'Tvåfaktor',         beskrivning: 'Aktivera tvåfaktorsautentisering',               defaultAktiv: false },
      { key: 'konto_app_notiser',    label: 'App-notiser',       beskrivning: 'Inställningar för push-notiser i appen',         defaultAktiv: false },
      { key: 'konto_sessioner',      label: 'Sessioner',         beskrivning: 'Visa och avsluta aktiva inloggningar',           defaultAktiv: false },
      { key: 'konto_aktivitetslogg', label: 'Aktivitetslogg',    beskrivning: 'Visa inloggningshistorik och kontoaktivitet',    defaultAktiv: false },
      { key: 'konto_samtycke',       label: 'Spara samtycke',    beskrivning: 'Hantera samtycken för datalagring',              defaultAktiv: false },
      { key: 'konto_datahantering',  label: 'Datahantering',     beskrivning: 'Exportera eller radera kontodata',               defaultAktiv: true },
      { key: 'konto_tema',           label: 'Tema',              beskrivning: 'Växla mellan ljust och mörkt läge',              defaultAktiv: true },
    ],
  },
  {
    key: 'uppdateringar',
    label: 'Uppdateringar',
    ikon: '🔄',
    flaggor: [
      { key: 'uppdateringar_senaste',       label: 'Senaste version', beskrivning: 'Visa det senaste releaset med ändringslogg',        defaultAktiv: true },
      { key: 'uppdateringar_pagang',        label: 'Påväg',           beskrivning: 'Visa nästa planerade version och vad som är på gång', defaultAktiv: false },
      { key: 'uppdateringar_kanda_problem', label: 'Kända problem',   beskrivning: 'Visa lista över kända buggar och workarounds',       defaultAktiv: false },
      { key: 'uppdateringar_historik',      label: 'Versionshistorik', beskrivning: 'Visa alla tidigare versioner och deras ändringar',  defaultAktiv: true },
    ],
  },
  {
    key: 'support',
    label: 'Support',
    ikon: '💬',
    flaggor: [
      { key: 'support_arenden',      label: 'Ärendehantering', beskrivning: 'Skapa och följa upp supportärenden',    defaultAktiv: false },
      { key: 'support_systemstatus', label: 'Systemstatus',    beskrivning: 'Visa aktuell driftstatus för systemet', defaultAktiv: false },
      { key: 'support_faq',          label: 'FAQ',             beskrivning: 'Vanliga frågor och svar',               defaultAktiv: true },
    ],
  },
]

export const FLAG_DEFINITIONER = FLAG_GRUPPER.flatMap(g => g.flaggor)

export function isSektionSynlig(sektionKey: string, flaggor: FlagState): boolean {
  const grupp = FLAG_GRUPPER.find(g => g.key === sektionKey)
  if (!grupp) return true
  return grupp.flaggor.some(f => flaggor[f.key])
}

export type FlagState = Record<FlagKey, boolean>

const STORAGE_KEY = 'samhallsinformation_feature_flags'

export function laddaFlaggor(): FlagState {
  const defaults = Object.fromEntries(
    FLAG_DEFINITIONER.map(f => [f.key, f.defaultAktiv])
  ) as FlagState
  try {
    const sparad = localStorage.getItem(STORAGE_KEY)
    if (!sparad) return defaults
    return { ...defaults, ...JSON.parse(sparad) }
  } catch {
    return defaults
  }
}

export function sparaFlaggor(flaggor: FlagState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flaggor))
}

export function återställFlaggor(): FlagState {
  localStorage.removeItem(STORAGE_KEY)
  return Object.fromEntries(
    FLAG_DEFINITIONER.map(f => [f.key, f.defaultAktiv])
  ) as FlagState
}
