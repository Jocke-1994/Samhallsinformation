import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
  AdminScheduledActionDto,
  AdminTicketDetailDto,
  AdminTicketListItemDto,
} from '../api/support'

// V4-3 (E6#14 + E6#18): redigering av en schemalagd åtgärd ska uppdatera (inte
// bara avbryt+skapa utan validering), och tomma datum-/tidsfält (skapa, redigera,
// påminnelse) ska hålla knappen disabled i stället för att kasta ett RangeError.

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

const schemaSvar = (over: Partial<AdminScheduledActionDto> = {}): AdminScheduledActionDto => ({
  id: 'sch1',
  type: 'svar',
  scheduledAt: '2030-01-01T09:00:00Z',
  createdByName: 'Agnes',
  text: 'Ursprunglig text',
  executed: false,
  ...over,
})

const detalj = (scheduledActions: AdminScheduledActionDto[] = []): AdminTicketDetailDto => ({
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
  scheduledActions,
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
  vi.mocked(api.fetchAdminTickets).mockResolvedValue([rad()])
  vi.mocked(api.fetchAgents).mockResolvedValue([{ id: 'a1', name: 'Agnes' }])
  vi.mocked(api.fetchSupportNotifications).mockResolvedValue([])
  vi.mocked(api.addScheduledAction).mockResolvedValue({ id: 'sch2' })
  vi.mocked(api.cancelScheduledAction).mockResolvedValue(undefined)
})

describe('SupportInbox — redigera schemalagd åtgärd (E6#14)', () => {
  it('lyckad redigering: den nya åtgärden skapas FÖRST, sedan avbryts den gamla (i den ordningen)', async () => {
    vi.mocked(api.fetchAdminTicket).mockResolvedValue(detalj([schemaSvar()]))
    rendera()
    await öppnaÄrendet()

    await userEvent.click(await screen.findByText(/kl \d\d:\d\d/))
    await userEvent.click(screen.getByRole('button', { name: 'Redigera' }))
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    await waitFor(() => expect(api.cancelScheduledAction).toHaveBeenCalled())
    expect(api.addScheduledAction).toHaveBeenCalledTimes(1)
    expect(api.cancelScheduledAction).toHaveBeenCalledWith('sch1')

    // add anropades FÖRE cancel (ordningen V3-8 redan satte: ny åtgärd säkras innan den gamla tas bort).
    const addOrder = vi.mocked(api.addScheduledAction).mock.invocationCallOrder[0]
    const cancelOrder = vi.mocked(api.cancelScheduledAction).mock.invocationCallOrder[0]
    expect(addOrder).toBeLessThan(cancelOrder)
  })

  it('tom text för en "svar"-åtgärd: Spara-knappen är disabled (samma regel som skapa-formuläret)', async () => {
    vi.mocked(api.fetchAdminTicket).mockResolvedValue(detalj([schemaSvar()]))
    rendera()
    await öppnaÄrendet()

    await userEvent.click(await screen.findByText(/kl \d\d:\d\d/))
    await userEvent.click(screen.getByRole('button', { name: 'Redigera' }))

    const textarea = screen.getByDisplayValue('Ursprunglig text')
    await userEvent.clear(textarea)

    expect(screen.getByRole('button', { name: 'Spara' })).toBeDisabled()
    expect(api.addScheduledAction).not.toHaveBeenCalled()
  })

  it('en "tilldela"-åtgärd utan vald agent: Spara-knappen är disabled', async () => {
    vi.mocked(api.fetchAdminTicket).mockResolvedValue(
      detalj([
        schemaSvar({
          id: 'sch1',
          type: 'tilldela',
          text: null,
          reassignToUserId: 'a1',
          reassignToName: 'Agnes',
        }),
      ]),
    )
    rendera()
    await öppnaÄrendet()

    await userEvent.click(await screen.findByText(/kl \d\d:\d\d/))
    await userEvent.click(screen.getByRole('button', { name: 'Redigera' }))

    const agentSelect = screen
      .getAllByRole('combobox')
      .find((s) => (s as HTMLSelectElement).value === 'a1') as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: '' } })

    expect(screen.getByRole('button', { name: 'Spara' })).toBeDisabled()
    expect(api.addScheduledAction).not.toHaveBeenCalled()
  })

  it('tömt datumfält vid redigering: Spara är disabled, klick kastar inget', async () => {
    vi.mocked(api.fetchAdminTicket).mockResolvedValue(detalj([schemaSvar()]))
    rendera()
    await öppnaÄrendet()

    await userEvent.click(await screen.findByText(/kl \d\d:\d\d/))
    await userEvent.click(screen.getByRole('button', { name: 'Redigera' }))

    const datumFält = document.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(datumFält, { target: { value: '' } })

    const sparaKnapp = screen.getByRole('button', { name: 'Spara' })
    expect(sparaKnapp).toBeDisabled()
    expect(() => fireEvent.click(sparaKnapp)).not.toThrow()
    expect(api.addScheduledAction).not.toHaveBeenCalled()
  })

  it('tömt tidsfält vid redigering: Spara är disabled', async () => {
    vi.mocked(api.fetchAdminTicket).mockResolvedValue(detalj([schemaSvar()]))
    rendera()
    await öppnaÄrendet()

    await userEvent.click(await screen.findByText(/kl \d\d:\d\d/))
    await userEvent.click(screen.getByRole('button', { name: 'Redigera' }))

    const tidFält = document.querySelector('input[type="time"]') as HTMLInputElement
    fireEvent.change(tidFält, { target: { value: '' } })

    expect(screen.getByRole('button', { name: 'Spara' })).toBeDisabled()
  })
})

describe('SupportInbox — tomma datum-/tidsfält i skapa-formulären (E6#18)', () => {
  it('påminnelse: tömt tidsfält håller Spara disabled i stället för att kasta', async () => {
    vi.mocked(api.fetchAdminTicket).mockResolvedValue(detalj())
    rendera()
    await öppnaÄrendet()

    await userEvent.click(screen.getAllByRole('button', { name: '+ Lägg till' })[0])
    const [datumFält] = Array.from(
      document.querySelectorAll('input[type="date"]'),
    ) as HTMLInputElement[]
    const [tidFält] = Array.from(
      document.querySelectorAll('input[type="time"]'),
    ) as HTMLInputElement[]
    fireEvent.change(datumFält, { target: { value: '2030-01-01' } })
    fireEvent.change(tidFält, { target: { value: '' } })

    const sparaKnapp = screen.getByRole('button', { name: 'Spara' })
    expect(sparaKnapp).toBeDisabled()
    expect(() => fireEvent.click(sparaKnapp)).not.toThrow()
    expect(api.setTicketReminder).not.toHaveBeenCalled()
  })

  it('schemalägg: tömt tidsfält håller Schemalägg disabled', async () => {
    vi.mocked(api.fetchAdminTicket).mockResolvedValue(detalj())
    rendera()
    await öppnaÄrendet()

    await userEvent.click(screen.getAllByRole('button', { name: '+ Lägg till' })[1])
    const datumFält = Array.from(
      document.querySelectorAll('input[type="date"]'),
    ).pop() as HTMLInputElement
    const tidFält = Array.from(
      document.querySelectorAll('input[type="time"]'),
    ).pop() as HTMLInputElement
    fireEvent.change(datumFält, { target: { value: '2030-01-01' } })
    fireEvent.change(tidFält, { target: { value: '' } })
    await userEvent.type(screen.getByPlaceholderText('Meddelande till användaren...'), 'X')

    const knapp = screen.getByRole('button', { name: 'Schemalägg' })
    expect(knapp).toBeDisabled()
    expect(() => fireEvent.click(knapp)).not.toThrow()
    expect(api.addScheduledAction).not.toHaveBeenCalled()
  })
})
