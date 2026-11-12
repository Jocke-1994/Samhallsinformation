import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminTicketDetailDto, AdminTicketListItemDto } from '../api/support'

// V3-8 (E6#8 + E6#10): Support-inbox. Hämtfel visas som fel (inte "Inga ärenden", inte 0),
// ärendemodalen ger besked i stället för ingenting, och varje mutation behåller
// modal + inmatning vid fel. Särskilt: svaret till en medborgare får aldrig försvinna vid fel.

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ roll: 'Admin', aktivVy: 'Admin', email: 'adam@example.com' }),
}))
vi.mock('../api/support', () => ({
  fetchAdminTickets: vi.fn(),
  fetchAdminTicket: vi.fn(),
  fetchAgents: vi.fn(),
  fetchSupportNotifications: vi.fn(),
  replyAsAgent: vi.fn(),
  setTicketStatus: vi.fn(),
  assignTicket: vi.fn(),
  setTicketReminder: vi.fn(),
  setTicketArchived: vi.fn(),
  addScheduledAction: vi.fn(),
  cancelScheduledAction: vi.fn(),
}))
vi.mock('../api/featureIdeas', () => ({ createFeatureIdea: vi.fn() }))

const api = await import('../api/support')
const { createFeatureIdea } = await import('../api/featureIdeas')
const { default: SupportInbox } = await import('../components/Admin/SupportInbox')

const rad = (over: Partial<AdminTicketListItemDto> = {}): AdminTicketListItemDto => ({
  id: 't1',
  ticketNumber: 7,
  subject: 'Får inga notiser',
  category: 'Notifieringar',
  status: 'Öppet',
  channel: 'arendehantering',
  contactName: 'Anna',
  contactEmail: 'anna@example.se',
  isArchived: false,
  createdAt: '2026-09-20T10:00:00Z',
  updatedAt: '2026-09-20T10:00:00Z',
  ...over,
})
const detalj = (): AdminTicketDetailDto => ({
  ticket: { ...rad(), createdByName: 'Anna', reminderAt: null, reminderNote: null },
  messages: [
    {
      id: 'm1',
      senderType: 'user',
      isInternal: false,
      text: 'Hjälp!',
      createdAt: '2026-09-20T10:00:00Z',
      authorName: 'Anna',
    },
  ] as AdminTicketDetailDto['messages'],
  scheduledActions: [],
})

function rendera() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SupportInbox />
    </QueryClientProvider>,
  )
}

async function öppnaÄrendet() {
  await userEvent.click(await screen.findByText('Får inga notiser'))
  await screen.findByText('Hjälp!')
}

beforeEach(() => {
  for (const f of Object.values(api)) (f as ReturnType<typeof vi.fn>).mockReset()
  vi.mocked(createFeatureIdea).mockReset()
  vi.mocked(api.fetchAdminTickets).mockResolvedValue([rad()])
  vi.mocked(api.fetchAdminTicket).mockResolvedValue(detalj())
  vi.mocked(api.fetchAgents).mockResolvedValue([{ id: 'a1', name: 'Agnes' }])
  vi.mocked(api.fetchSupportNotifications).mockResolvedValue([])
  for (const f of [
    api.replyAsAgent,
    api.setTicketStatus,
    api.assignTicket,
    api.setTicketReminder,
    api.setTicketArchived,
    api.addScheduledAction,
    api.cancelScheduledAction,
  ]) {
    vi.mocked(f as (...a: unknown[]) => Promise<unknown>).mockResolvedValue(undefined)
  }
})

describe('Support-inbox — hämtfel är inte "inga ärenden"', () => {
  it('listan misslyckas: felmeddelande + Försök igen, "—" i stat-korten, aldrig 0 eller "Inga ärenden matchar filtret"', async () => {
    vi.mocked(api.fetchAdminTickets).mockRejectedValue(new Error('fetchAdminTickets: 403'))
    rendera()

    const fel = await screen.findByRole('alert')
    expect(fel).toHaveTextContent('Kunde inte hämta ärendena')
    expect(screen.queryByText('Inga ärenden matchar filtret.')).not.toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(4)
    expect(screen.queryByText('0')).not.toBeInTheDocument()

    vi.mocked(api.fetchAdminTickets).mockResolvedValue([rad()])
    await userEvent.click(screen.getByRole('button', { name: 'Försök igen' }))
    expect(await screen.findByText('Får inga notiser')).toBeInTheDocument()
  })

  it('tomt svar: "Inga ärenden matchar filtret." och riktiga nollor', async () => {
    vi.mocked(api.fetchAdminTickets).mockResolvedValue([])
    rendera()

    expect(await screen.findByText('Inga ärenden matchar filtret.')).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(4)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('klick på en rad när ärendet inte går att hämta ger en modal med fel och Försök igen (tidigare: ingenting)', async () => {
    vi.mocked(api.fetchAdminTicket)
      .mockRejectedValueOnce(new Error('fetchAdminTicket: 500'))
      .mockResolvedValue(detalj())
    rendera()

    await userEvent.click(await screen.findByText('Får inga notiser'))

    const fel = await screen.findByText('Kunde inte hämta ärendet.')
    expect(fel).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Försök igen' }))
    expect(await screen.findByText('Hjälp!')).toBeInTheDocument()
  })

  it('agentlistan misslyckas: felet sägs i modalen (inte bara en tom Tilldelad-lista)', async () => {
    vi.mocked(api.fetchAgents).mockRejectedValue(new Error('fetchAgents: 500'))
    rendera()

    await öppnaÄrendet()

    expect(await screen.findByText('Kunde inte hämta agentlistan.')).toBeInTheDocument()
  })
})

describe('Support-inbox — svaret till medborgaren', () => {
  const skrivSvar = async (text: string) => {
    await userEvent.type(screen.getByPlaceholderText('Skriv svar till användaren...'), text)
  }

  it('FEL: texten finns kvar i rutan, modalen är öppen och felet visas (serverns text)', async () => {
    vi.mocked(api.replyAsAgent).mockRejectedValue(new Error('Ärendet är låst av en annan agent.'))
    rendera()
    await öppnaÄrendet()

    await skrivSvar('Hej Anna, vi tittar på det')
    await userEvent.click(screen.getByRole('button', { name: 'Skicka svar' }))

    const fel = await screen.findByRole('alert')
    expect(fel).toHaveTextContent('Ärendet är låst av en annan agent.')
    expect(screen.getByPlaceholderText('Skriv svar till användaren...')).toHaveValue(
      'Hej Anna, vi tittar på det',
    )
    expect(screen.getByText('Hjälp!')).toBeInTheDocument() // modalen är kvar
  })

  it('FEL utan serverns text: reservtext med besked att texten finns kvar', async () => {
    vi.mocked(api.replyAsAgent).mockRejectedValue(new Error('replyAsAgent: 500'))
    rendera()
    await öppnaÄrendet()

    await skrivSvar('Ett långt svar')
    await userEvent.click(screen.getByRole('button', { name: 'Skicka svar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Svaret kunde inte skickas. Din text finns kvar',
    )
    expect(screen.getByPlaceholderText('Skriv svar till användaren...')).toHaveValue(
      'Ett långt svar',
    )
  })

  it('LYCKAT: rutan töms först när servern svarat', async () => {
    let lös: () => void = () => {}
    vi.mocked(api.replyAsAgent).mockImplementation(
      () =>
        new Promise<void>((res) => {
          lös = res
        }),
    )
    rendera()
    await öppnaÄrendet()

    await skrivSvar('Svar')
    await userEvent.click(screen.getByRole('button', { name: 'Skicka svar' }))

    // Under anropet: texten kvar, knappen låst.
    expect(screen.getByPlaceholderText('Skriv svar till användaren...')).toHaveValue('Svar')
    expect(screen.getByRole('button', { name: 'Skickar...' })).toBeDisabled()

    lös()
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Skriv svar till användaren...')).toHaveValue(''),
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('dubbelklick på Skicka ger ETT anrop', async () => {
    vi.mocked(api.replyAsAgent).mockImplementation(() => new Promise<void>(() => {}))
    rendera()
    await öppnaÄrendet()

    await skrivSvar('Svar')
    fireEvent.click(screen.getByRole('button', { name: 'Skicka svar' }))
    fireEvent.click(screen.getByRole('button', { name: /Skickar\.\.\.|Skicka svar/ }))

    await waitFor(() => expect(api.replyAsAgent).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(api.replyAsAgent).toHaveBeenCalledTimes(1)
  })
})

describe('Support-inbox — övriga mutationer visar fel och behåller formuläret', () => {
  it('påminnelse: fel -> formuläret öppet med inmatningen kvar och felet visat', async () => {
    vi.mocked(api.setTicketReminder).mockRejectedValue(new Error('setTicketReminder: 500'))
    rendera()
    await öppnaÄrendet()

    await userEvent.click(screen.getAllByRole('button', { name: '+ Lägg till' })[0])
    const [datumFält] = Array.from(
      document.querySelectorAll('input[type="date"]'),
    ) as HTMLInputElement[]
    fireEvent.change(datumFält, { target: { value: '2026-10-01' } })
    await userEvent.type(screen.getByPlaceholderText('Vad ska kontrolleras?'), 'Kolla igen')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    expect(
      await screen.findByText('Påminnelsen kunde inte sparas. Försök igen.'),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Vad ska kontrolleras?')).toHaveValue('Kolla igen')
  })

  it('påminnelse: lyckat -> formuläret stängs', async () => {
    rendera()
    await öppnaÄrendet()

    await userEvent.click(screen.getAllByRole('button', { name: '+ Lägg till' })[0])
    const [datumFält] = Array.from(
      document.querySelectorAll('input[type="date"]'),
    ) as HTMLInputElement[]
    fireEvent.change(datumFält, { target: { value: '2026-10-01' } })
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Vad ska kontrolleras?')).not.toBeInTheDocument(),
    )
    expect(api.setTicketReminder).toHaveBeenCalled()
  })

  it('schemalagd åtgärd: fel -> formuläret och texten kvar, felet visat', async () => {
    vi.mocked(api.addScheduledAction).mockRejectedValue(new Error('Tiden måste ligga i framtiden.'))
    rendera()
    await öppnaÄrendet()

    await userEvent.click(screen.getAllByRole('button', { name: '+ Lägg till' })[1])
    const datumFält = Array.from(
      document.querySelectorAll('input[type="date"]'),
    ).pop() as HTMLInputElement
    fireEvent.change(datumFält, { target: { value: '2020-01-01' } })
    await userEvent.type(screen.getByPlaceholderText('Meddelande till användaren...'), 'Påminn mig')
    await userEvent.click(screen.getByRole('button', { name: 'Schemalägg' }))

    expect(await screen.findByText('Tiden måste ligga i framtiden.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Meddelande till användaren...')).toHaveValue('Påminn mig')
  })

  it('schemalagd åtgärd: dubbelklick ger ETT anrop', async () => {
    vi.mocked(api.addScheduledAction).mockImplementation(
      () => new Promise<{ id: string }>(() => {}),
    )
    rendera()
    await öppnaÄrendet()

    await userEvent.click(screen.getAllByRole('button', { name: '+ Lägg till' })[1])
    const datumFält = Array.from(
      document.querySelectorAll('input[type="date"]'),
    ).pop() as HTMLInputElement
    fireEvent.change(datumFält, { target: { value: '2030-01-01' } })
    await userEvent.type(screen.getByPlaceholderText('Meddelande till användaren...'), 'X')
    const knapp = screen.getByRole('button', { name: 'Schemalägg' })
    fireEvent.click(knapp)
    fireEvent.click(knapp)

    await waitFor(() => expect(api.addScheduledAction).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(api.addScheduledAction).toHaveBeenCalledTimes(1)
  })

  it('statusändring som misslyckas visas som fel', async () => {
    vi.mocked(api.setTicketStatus).mockRejectedValue(new Error('setTicketStatus: 500'))
    rendera()
    await öppnaÄrendet()

    await userEvent.click(screen.getByRole('button', { name: 'Markera hanterat' }))

    expect(await screen.findByText('Statusen kunde inte ändras. Försök igen.')).toBeInTheDocument()
  })

  it('tilldelning som misslyckas visas som fel', async () => {
    vi.mocked(api.assignTicket).mockRejectedValue(new Error('assignTicket: 500'))
    rendera()
    await öppnaÄrendet()

    await userEvent.selectOptions(
      screen
        .getAllByRole('combobox')
        .find((s) => (s as HTMLSelectElement).value === '' && s.textContent?.includes('Ingen'))!,
      'a1',
    )

    expect(
      await screen.findByText('Ärendet kunde inte tilldelas. Försök igen.'),
    ).toBeInTheDocument()
  })

  it('arkivering som misslyckas visas som fel', async () => {
    vi.mocked(api.setTicketArchived).mockRejectedValue(new Error('setTicketArchived: 500'))
    rendera()
    await öppnaÄrendet()

    await userEvent.click(screen.getByRole('button', { name: '📦 Arkivera' }))

    expect(
      await screen.findByText('Ärendet kunde inte arkiveras/återställas. Försök igen.'),
    ).toBeInTheDocument()
  })

  it('"Skapa idé" som misslyckas visas som fel och knappen finns kvar', async () => {
    vi.mocked(createFeatureIdea).mockRejectedValue(new Error('createFeatureIdea: 500'))
    rendera()
    await öppnaÄrendet()

    await userEvent.click(screen.getByRole('button', { name: /Skapa idé av det här ärendet/ }))

    expect(await screen.findByText('Idén kunde inte skapas. Försök igen.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Skapa idé av det här ärendet/ })).toBeInTheDocument()
  })
})
