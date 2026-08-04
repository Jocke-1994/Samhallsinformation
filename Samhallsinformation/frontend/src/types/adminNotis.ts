// Delad notistyp för adminpanelens klocka (AdminPage.tsx) — populeras av
// flera oberoende källor (SupportInbox: ärendepåminnelser/tilldelningar,
// Anvandare: kontospärrningspåminnelser) som var och en bubblar upp sin
// lista via en `onPendingNotiser`-callback, samma mönster för alla källor.
export interface PendingNotis {
  arendeId:  string
  amne:      string
  typ:       'påminnelse' | 'tilldelad' | 'kontospärrning'
  notering?: string | null
  epost?:    string // bara satt för 'kontospärrning' — används för att djuplänka till Användarhantering
}
