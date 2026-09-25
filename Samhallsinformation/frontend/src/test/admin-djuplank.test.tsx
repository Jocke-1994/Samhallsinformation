import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import type { AdminUserDto } from '../api/adminUsers'
import type { AdminTicketListItemDto } from '../api/support'

// Regressionstester för V2-16 (E6#3): en djuplänk i adminpanelen ska konsumeras
// EN gång. Annars hoppar Användare-panelen tillbaka till en tidigare vald
// användare vid varje refetch (fel mål för t.ex. "Stäng av konto"), och
// Support-inbox öppnar ett gammalt ärende vid varje besök.
//
// AdminPage är för tung att rendera hela (push, flaggor, alla sektioner), så
// testet kör de RIKTIGA komponenterna Anvandare/SupportInbox och den RIKTIGA
// hooken useAdminDjuplank i en liten sektionsväxlare som kopplar ihop dem på
// exakt samma sätt som AdminPage.

const DTO = (id: string, name: string, over: Partial<AdminUserDto> = {}): AdminUserDto => ({
  id, name, email: `${name.toLowerCase()}@example.com`, role: 'Användare', isActive: true,
  suspendedAt: null, suspendedReason: null, suspensionReminderAt: null, suspensionReminderNote: null,
  authProvider: 'password', createdAt: '2026-01-01T00:00:00Z', deletedAt: null, deletionScheduledAt: null,
  ...over,
})

const TICKET = (id: string, nr: number): AdminTicketListItemDto => ({
  id, ticketNumber: nr, subject: `Ärende ${nr}`, category: 'Fråga', status: 'Öppet', channel: 'arendehantering',
  isArchived: false, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
})

const hämtaAnvändare = vi.fn()
const hämtaNotisLogg = vi.fn()
const hämtaÄrende    = vi.fn()

vi.mock('../api/adminUsers', async importOriginal => {
  const orig = await importOriginal<typeof import('../api/adminUsers')>()
  return {
    ...orig,
    fetchAdminUsers: () => hämtaAnvändare(),
    fetchUserNotifications: async () => [],
    fetchAdminUserSavedEvents: async () => [],
    fetchAdminUserPolisenBevakningar: async () => [],
    fetchAdminUserNotificationLog: (id: string) => hämtaNotisLogg(id),
    fetchAdminUserSettingLog: async () => [],
    fetchAdminUserSources: async () => [],
    fetchAdminUserPushSettings: async () => ({ pushEnabled: true, pushNyaHandelser: true, pushNyVersion: true, enheter: [] }),
  }
})
vi.mock('../api/support', async importOriginal => {
  const orig = await importOriginal<typeof import('../api/support')>()
  return {
    ...orig,
    fetchAdminTickets: async () => [TICKET('t1', 1), TICKET('t2', 2)],
    fetchAdminTicket: (id: string) => hämtaÄrende(id),
    fetchAgents: async () => [],
    fetchSupportNotifications: async () => [],
  }
})
vi.mock('../api/activityLog', () => ({ createActivityLogEntry: vi.fn() }))
vi.mock('../api/events', () => ({ checkEventLinkStatus: vi.fn() }))
vi.mock('../api/eventSearch', () => ({ searchEvents: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ aktivVy: 'Admin' }) }))

const { default: Anvandare } = await import('../components/Admin/Anvandare')
const { default: SupportInbox } = await import('../components/Admin/SupportInbox')
const { useAdminDjuplank } = await import('../hooks/useAdminDjuplank')

// Speglar hur AdminPage kopplar djuplänkarna.
type Sektion = 'oversikt' | 'anvandare' | 'support-inbox'
function Sektionsväxlare() {
  const [section, setSection] = useState<Sektion>('oversikt')
  const {
    användarMål, inboxÄrendeId,
    öppnaAnvändare, öppnaInboxÄrende, konsumeraAnvändare, konsumeraInboxÄrende,
  } = useAdminDjuplank(section)

  return (
    <div>
      <button onClick={() => setSection('oversikt')}>till-oversikt</button>
      <button onClick={() => setSection('anvandare')}>till-anvandare</button>
      <button onClick={() => setSection('support-inbox')}>till-inbox</button>
      <button onClick={() => { öppnaAnvändare('anna@example.com', 'oversikt'); setSection('anvandare') }}>länk-anna</button>
      <button onClick={() => { öppnaInboxÄrende('t1'); setSection('support-inbox') }}>länk-t1</button>
      <button onClick={() => { öppnaInboxÄrende('t2'); setSection('support-inbox') }}>länk-t2</button>
      <span data-testid="mål">{användarMål?.epost ?? '-'}|{inboxÄrendeId ?? '-'}</span>

      {section === 'anvandare' && (
        <Anvandare
          defaultÖppnaEpost={användarMål?.epost}
          defaultFlik={användarMål?.flik ?? 'notifinstallningar'}
          onDjuplänkKonsumerad={konsumeraAnvändare}
        />
      )}
      {section === 'support-inbox' && (
        <SupportInbox defaultOpenId={inboxÄrendeId} onDjuplänkKonsumerad={konsumeraInboxÄrende} />
      )}
    </div>
  )
}

let queryClient: QueryClient
function visa() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Sektionsväxlare />
    </QueryClientProvider>,
  )
}
const klicka = (text: string) => fireEvent.click(screen.getByText(text))
// Detaljpanelens header (span med GUID-title); raderna i listan har också GUID-title på en <td>.
const panel = (id: string) => document.querySelector(`span[title="GUID: ${id}"]`)
const panelÖppen = (id: string) => waitFor(() => expect(panel(id)).not.toBeNull())
const väntaLite = () => act(async () => { await new Promise(r => setTimeout(r, 60)) })

beforeEach(() => {
  hämtaAnvändare.mockReset().mockResolvedValue([DTO('a1', 'Anna'), DTO('b1', 'Bertil')])
  hämtaNotisLogg.mockReset().mockResolvedValue([])
  hämtaÄrende.mockReset().mockImplementation(async (id: string) => ({
    ticket: { ...TICKET(id, id === 't1' ? 1 : 2), createdByName: null }, messages: [], scheduledActions: [],
  }))
})

describe('Användare: djuplänk', () => {
  it('öppnar rätt användare och nollställer djuplänken (konsumeras en gång)', async () => {
    visa()
    klicka('länk-anna')
    await panelÖppen('a1')
    await waitFor(() => expect(screen.getByTestId('mål')).toHaveTextContent('-|-'))
  })

  it('hoppar inte tillbaka till den gamla användaren när listan hämtas om', async () => {
    visa()
    klicka('länk-anna')
    await panelÖppen('a1')
    await waitFor(() => expect(screen.getByTestId('mål')).toHaveTextContent('-|-'))

    // Admin väljer själv Bertil ur listan och en åtgärd triggar refetch.
    fireEvent.click(screen.getByText('Bertil'))
    await panelÖppen('b1')

    hämtaAnvändare.mockResolvedValue([DTO('a1', 'Anna'), DTO('b1', 'Bertil', { isActive: false })])
    await act(async () => { await queryClient.refetchQueries({ queryKey: ['admin-users'] }) })
    await väntaLite()

    expect(hämtaAnvändare).toHaveBeenCalledTimes(2)
    expect(panel('b1')).not.toBeNull()
    expect(panel('a1')).toBeNull()
    expect(hämtaNotisLogg).toHaveBeenLastCalledWith('b1')
  })

  it('en ny djuplänk till samma användare öppnar panelen igen', async () => {
    visa()
    klicka('länk-anna')
    await panelÖppen('a1')
    await waitFor(() => expect(screen.getByTestId('mål')).toHaveTextContent('-|-'))

    fireEvent.click(screen.getByText('Bertil'))
    await panelÖppen('b1')

    klicka('länk-anna')
    await panelÖppen('a1')
    expect(panel('b1')).toBeNull()
  })

  it('en obekräftad djuplänk (användaren finns inte) rensas när man lämnar sektionen', async () => {
    hämtaAnvändare.mockResolvedValue([DTO('b1', 'Bertil')]) // Anna saknas, t.ex. Support-roll
    visa()
    klicka('länk-anna')
    await väntaLite()
    expect(screen.getByTestId('mål')).toHaveTextContent('anna@example.com|-')

    klicka('till-oversikt')
    await waitFor(() => expect(screen.getByTestId('mål')).toHaveTextContent('-|-'))

    // Annas konto dyker upp senare — panelen ska INTE öppnas av en gammal djuplänk.
    hämtaAnvändare.mockResolvedValue([DTO('a1', 'Anna'), DTO('b1', 'Bertil')])
    klicka('till-anvandare')
    await screen.findByText('Anna')
    await väntaLite()
    expect(panel('a1')).toBeNull()
  })
})

describe('Support-inbox: djuplänk', () => {
  it('öppnar rätt ärende och nollställer djuplänken', async () => {
    visa()
    klicka('länk-t1')
    await waitFor(() => expect(hämtaÄrende).toHaveBeenCalledWith('t1'))
    expect(hämtaÄrende).not.toHaveBeenCalledWith('t2')
    await waitFor(() => expect(screen.getByTestId('mål')).toHaveTextContent('-|-'))
  })

  it('öppnar inte ett gammalt ärende vid nytt besök utan djuplänk', async () => {
    visa()
    klicka('länk-t1')
    await waitFor(() => expect(hämtaÄrende).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('mål')).toHaveTextContent('-|-'))
    fireEvent.click(await screen.findByText('✕')) // agenten stänger ärendet

    klicka('till-oversikt')
    klicka('till-inbox')
    await väntaLite()

    expect(screen.queryByText('✕')).not.toBeInTheDocument() // ingen modal
    expect(hämtaÄrende).toHaveBeenCalledTimes(1)
  })

  it('samma ärende två gånger i rad öppnas båda gångerna', async () => {
    visa()
    klicka('länk-t1')
    fireEvent.click(await screen.findByText('✕'))
    await waitFor(() => expect(screen.queryByText('✕')).not.toBeInTheDocument())

    klicka('till-oversikt')
    klicka('länk-t1')
    expect(await screen.findByText('✕')).toBeInTheDocument()
  })

  it('en djuplänk medan inboxen redan är öppen byter ärende', async () => {
    visa()
    klicka('länk-t1')
    await waitFor(() => expect(hämtaÄrende).toHaveBeenCalledWith('t1'))
    await waitFor(() => expect(screen.getByTestId('mål')).toHaveTextContent('-|-'))

    klicka('länk-t2') // t.ex. notisklockan, samtidigt som t1-modalen är öppen
    await waitFor(() => expect(hämtaÄrende).toHaveBeenCalledWith('t2'))
  })
})
