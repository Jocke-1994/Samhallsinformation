export type FlagKey =
  | 'flode_olasta_badge'
  | 'flode_sparat'
  | 'kallor_lagg_till'
  | 'kallor_aktiva'
  | 'kallor_rekommenderade'
  | 'kallor_alla'
  | 'kallor_polisen_filter'
  | 'notif_obligatoriska'
  | 'notif_mottagare'
  | 'notif_stor_ej'
  | 'notif_leveranslage'
  | 'notif_historik'
  | 'notif_push'
  | 'konto_info'
  | 'konto_losenord'
  | 'konto_visningsnamn'
  | 'konto_tvafaktor'
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
  | 'konto_epost_paminnelse'

export interface FlagDefinition {
  key: FlagKey
  label: string
  beskrivning: string
  defaultAktiv: boolean
  /**
   * Sätts bara på flaggor som är avstängda i väntan på ett lanseringsbeslut,
   * INTE på funktioner som stängts av permanent/farligt (t.ex. mock-UI utan
   * backend). Visas i idé-pipelinens detaljvy när en idé länkas till den
   * här flaggan via FlagKey.
   */
  roadmap?: string
  /** ISO-datum (YYYY-MM-DD) för när funktionen blev "klar, väntar på beslut". */
  roadmapSedan?: string
  /** PR-nummer som byggde funktionen, länkas till GitHub i idé-detaljvyn. */
  roadmapPrNummer?: number[]
}

export interface FlagGrupp {
  key: string
  label: string
  ikon: string
  flaggor: FlagDefinition[]
}

export const FLAG_GRUPPER: FlagGrupp[] = [
  {
    key: 'flode',
    label: 'Flöde',
    ikon: '📰',
    flaggor: [
      { key: 'flode_olasta_badge', label: 'Olästa-badge',   beskrivning: 'Visa antal olästa händelser i huvudrubriken',        defaultAktiv: false },
      { key: 'flode_sparat',       label: 'Sparat',         beskrivning: 'Bokmärk händelser och bläddra bland sparade senare', defaultAktiv: false,
        roadmap: 'Fullt byggd (backend + UI), medvetet vilande för en framtida funktionslansering.',
        roadmapSedan: '2026-08-04', roadmapPrNummer: [380, 384, 385] },
    ],
  },
  {
    key: 'mina-kallor',
    label: 'Mina källor',
    ikon: '🗂️',
    flaggor: [
      { key: 'kallor_lagg_till',      label: 'Lägg till källa',        beskrivning: 'Möjlighet att lägga till nya källor',             defaultAktiv: false },
      { key: 'kallor_aktiva',         label: 'Aktiva källor',          beskrivning: 'Visa användarens aktiva och prenumererade källor', defaultAktiv: true },
      { key: 'kallor_rekommenderade', label: 'Rekommenderade källor',  beskrivning: 'Visa rekommenderade källor baserat på profil',     defaultAktiv: false },
      { key: 'kallor_alla',           label: 'Alla källor',            beskrivning: 'Bläddra bland samtliga tillgängliga källor',       defaultAktiv: true },
      { key: 'kallor_polisen_filter', label: 'Polisen-filter',         beskrivning: 'Kategori/kommun-urval och prenumerationsklocka för Polisen-händelser', defaultAktiv: false,
        roadmap: 'Fullt byggd (backend + UI, FAS 4), tillfälligt avstängd.',
        roadmapSedan: '2026-08-12' },
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
      { key: 'konto_visningsnamn',   label: 'Visningsnamn för support', beskrivning: 'Sätt ett visningsnamn som visas i supportsvar istället för "Support" — bara synligt för Admin/Support', defaultAktiv: true },
      { key: 'konto_tvafaktor',      label: 'Tvåfaktor',         beskrivning: 'Aktivera tvåfaktorsautentisering',               defaultAktiv: false },
      { key: 'notif_push',           label: 'Push-notiser',      beskrivning: 'Aktivera riktiga push-notiser i webbläsaren',    defaultAktiv: false,
        roadmap: 'Byggd och verifierad end-to-end i produktion (grundpushen). Väntar bara på ett produktbeslut om lansering. Flyttad hit från Notifieringar-sektionen (samlar alla notisinställningar under Konto) — appens enda mail/SMS-attrapp (App-notiser) togs samtidigt bort helt eftersom ingen mail/SMS-leverans finns.',
        roadmapSedan: '2026-08-03', roadmapPrNummer: [392, 393, 394, 395] },
      { key: 'konto_sessioner',      label: 'Sessioner',         beskrivning: 'Visa och avsluta aktiva inloggningar',           defaultAktiv: false },
      { key: 'konto_aktivitetslogg', label: 'Aktivitetslogg',    beskrivning: 'Visa inloggningshistorik och kontoaktivitet',    defaultAktiv: false },
      { key: 'konto_samtycke',       label: 'Spara samtycke',    beskrivning: 'Hantera samtycken för datalagring',              defaultAktiv: false },
      { key: 'konto_datahantering',  label: 'Datahantering',     beskrivning: 'Exportera eller radera kontodata',               defaultAktiv: false },
      { key: 'konto_tema',           label: 'Tema',              beskrivning: 'Växla mellan ljust och mörkt läge',              defaultAktiv: true },
      { key: 'konto_epost_paminnelse', label: 'E-postpåminnelse', beskrivning: 'Visa en banderoll som påminner om att bekräfta e-postadressen', defaultAktiv: true },
    ],
  },
  {
    key: 'uppdateringar',
    label: 'Uppdateringar',
    ikon: '🔄',
    flaggor: [
      { key: 'uppdateringar_senaste',       label: 'Senaste version', beskrivning: 'Visa det senaste releaset med ändringslogg',        defaultAktiv: false,
        roadmap: 'Innehållet är inaktuellt (stannar vid v0.5.0/25 juni 2026, inget om allt som skeppats sen dess). Avstängd tills changelogen är omskriven och godkänd.',
        roadmapSedan: '2026-08-16' },
      { key: 'uppdateringar_pagang',        label: 'Påväg',           beskrivning: 'Visa nästa planerade version och vad som är på gång', defaultAktiv: false },
      { key: 'uppdateringar_kanda_problem', label: 'Kända problem',   beskrivning: 'Visa lista över kända buggar och workarounds',       defaultAktiv: false },
      { key: 'uppdateringar_historik',      label: 'Versionshistorik', beskrivning: 'Visa alla tidigare versioner och deras ändringar',  defaultAktiv: false,
        roadmap: 'Samma orsak som Senaste version — historiken slutar vid v0.5.0. Avstängd tills changelogen är omskriven och godkänd.',
        roadmapSedan: '2026-08-16' },
    ],
  },
  {
    key: 'support',
    label: 'Support',
    ikon: '💬',
    flaggor: [
      { key: 'support_arenden',      label: 'Ärendehantering', beskrivning: 'Skapa och följa upp supportärenden',    defaultAktiv: false,
        roadmap: 'Riktigt backend med tilldelning, påminnelser och schemalagda åtgärder. Väntar på ett lanseringsbeslut.',
        roadmapSedan: '2026-08-03', roadmapPrNummer: [397, 398, 400, 401, 402] },
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
