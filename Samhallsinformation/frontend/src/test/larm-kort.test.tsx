import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminAlertDto } from '../api/alerts'

// V1-9: Larm-kortet i Systemhälsa. Lista renderas, Kvittera anropar API:t och uppdaterar listan,
// laddfel visas som fel (aldrig som "Inga larm") och tom lista säger "Inga larm".

vi.mock('../api/alerts', () => ({
  fetchAdminAlerts: vi.fn(),
  acknowledgeAdminAlert: vi.fn(),
}))

const { fetchAdminAlerts, acknowledgeAdminAlert } = await import('../api/alerts')
const { default: LarmKort } = await import('../components/Admin/LarmKort')

const larm = (over: Partial<AdminAlertDto> = {}): AdminAlertDto => ({
  id: 'a1', ruleId: 'source_failing', severity: 'critical',
  title: 'Källan "Polisen" fungerar inte', detail: '3 misslyckade hämtningar i rad.',
  firstRaisedAt: '2026-09-25T10:00:00Z', lastSeenAt: '2026-09-25T10:20:00Z', occurrenceCount: 4,
  acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, ...over,
})

function rendera() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><LarmKort /></QueryClientProvider>)
}

beforeEach(() => {
  vi.mocked(fetchAdminAlerts).mockReset()
  vi.mocked(acknowledgeAdminAlert).mockReset()
})

describe('LarmKort', () => {
  it('renderar öppna larm med allvarlighet, titel, antal och Kvittera-knapp', async () => {
    vi.mocked(fetchAdminAlerts).mockResolvedValue({
      open: [larm(), larm({ id: 'a2', severity: 'warning', title: 'Många push-utskick misslyckas', occurrenceCount: 1 })],
      recentlyResolved: [],
    })
    rendera()

    expect(await screen.findByText('Källan "Polisen" fungerar inte')).toBeInTheDocument()
    expect(screen.getByText('Kritisk')).toBeInTheDocument()
    expect(screen.getByText('Varning')).toBeInTheDocument()
    expect(screen.getByText(/sedd i 4 kontroller/)).toBeInTheDocument()
    expect(screen.getByText(/sedd i 1 kontroll(?!er)/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Kvittera' })).toHaveLength(2)
  })

  it('Kvittera anropar API:t med rätt id och hämtar om listan', async () => {
    vi.mocked(fetchAdminAlerts)
      .mockResolvedValueOnce({ open: [larm()], recentlyResolved: [] })
      .mockResolvedValue({ open: [larm({ acknowledgedAt: '2026-09-25T11:00:00Z', acknowledgedBy: 'Anna' })], recentlyResolved: [] })
    vi.mocked(acknowledgeAdminAlert).mockResolvedValue(larm({ acknowledgedAt: '2026-09-25T11:00:00Z', acknowledgedBy: 'Anna' }))
    rendera()

    await userEvent.click(await screen.findByRole('button', { name: 'Kvittera' }))

    await waitFor(() => expect(acknowledgeAdminAlert).toHaveBeenCalledWith('a1'))
    expect(await screen.findByText(/Kvitterad av Anna/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kvittera' })).not.toBeInTheDocument()
    expect(fetchAdminAlerts).toHaveBeenCalledTimes(2)
  })

  it('visar ett fel vid larmet om kvitteringen misslyckas, och behåller Kvittera-knappen', async () => {
    vi.mocked(fetchAdminAlerts).mockResolvedValue({ open: [larm()], recentlyResolved: [] })
    vi.mocked(acknowledgeAdminAlert).mockRejectedValue(new Error('acknowledgeAdminAlert: 500'))
    rendera()

    await userEvent.click(await screen.findByRole('button', { name: 'Kvittera' }))

    expect(await screen.findByText(/Kunde inte kvittera larmet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kvittera' })).toBeInTheDocument()
  })

  it('laddfel visas som fel — inte som "Inga larm"', async () => {
    vi.mocked(fetchAdminAlerts).mockRejectedValue(new Error('fetchAdminAlerts: 500'))
    rendera()

    expect(await screen.findByText(/Kunde inte hämta larm/)).toBeInTheDocument()
    expect(screen.queryByText('Inga larm')).not.toBeInTheDocument()
  })

  it('tom lista visar "Inga larm"', async () => {
    vi.mocked(fetchAdminAlerts).mockResolvedValue({ open: [], recentlyResolved: [] })
    rendera()

    expect(await screen.findByText('Inga larm')).toBeInTheDocument()
  })
})
