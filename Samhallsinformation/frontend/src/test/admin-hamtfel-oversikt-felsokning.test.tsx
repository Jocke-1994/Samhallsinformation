import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminSource } from '../types'
import type { AdminHealthDto } from '../api/health'

// V3-8 (E6#8): ett misslyckat anrop får aldrig se ut som "0", "tomt" eller "100 % frisk".
// Översikt och Systemhälsa/Felsökning: hämtfel -> felmeddelande + "Försök igen" (aldrig
// siffror/friskt), tomt svar -> tomt-läge, lyckat -> data.

vi.mock('../api/sources', () => ({ fetchAdminSources: vi.fn(), updateAdminSource: vi.fn() }))
vi.mock('../api/adminUsers', () => ({ fetchAdminUsers: vi.fn() }))
vi.mock('../api/support', () => ({ fetchAdminTickets: vi.fn() }))
vi.mock('../api/activityLog', () => ({ fetchAdminActivityLog: vi.fn() }))
vi.mock('../api/health', () => ({ fetchAdminHealth: vi.fn() }))
vi.mock('../api/alerts', () => ({ fetchAdminAlerts: vi.fn(), acknowledgeAdminAlert: vi.fn() }))
vi.mock('../api/testing', () => ({ dryRunSource: vi.fn() }))

const { fetchAdminSources, updateAdminSource } = await import('../api/sources')
const { fetchAdminUsers } = await import('../api/adminUsers')
const { fetchAdminTickets } = await import('../api/support')
const { fetchAdminActivityLog } = await import('../api/activityLog')
const { fetchAdminHealth } = await import('../api/health')
const { fetchAdminAlerts } = await import('../api/alerts')
const { default: Oversikt } = await import('../components/Admin/Oversikt')
const { default: Felsökning } = await import('../components/Admin/Felsökning')

const källa = (id: number, over: Partial<AdminSource> = {}): AdminSource =>
  ({
    id,
    name: `Källa ${id}`,
    shortName: `K${id}`,
    isActive: true,
    lastFetchError: null,
    lastFetchedAt: new Date().toISOString(),
    type: 0,
    url: `https://k${id}.se/rss`,
    baseUrl: `https://k${id}.se`,
    ...over,
  }) as unknown as AdminSource

const hälsa = (over: Partial<AdminHealthDto> = {}): AdminHealthDto => ({
  api: { status: 'OK', latencyMs: 3 },
  db: { status: 'OK', latencyMs: 5 },
  ingestor: { status: 'OK', lastFetchedAt: null, aktivaKällor: 2, källorMedFel: 0 },
  notifieringar: { status: 'OK', felSenaste24h: 0, totaltSenaste24h: 0 },
  ...over,
})

function rendera(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.mocked(fetchAdminSources).mockReset()
  vi.mocked(updateAdminSource).mockReset()
  vi.mocked(fetchAdminUsers).mockReset()
  vi.mocked(fetchAdminTickets).mockReset()
  vi.mocked(fetchAdminActivityLog).mockReset()
  vi.mocked(fetchAdminHealth).mockReset()
  vi.mocked(fetchAdminAlerts).mockReset().mockResolvedValue({ open: [], recentlyResolved: [] })
})

describe('Översikt — hämtfel är inte 0 eller "100 % frisk"', () => {
  it('alla anrop misslyckas: "—" och "Kunde inte hämtas" i korten, aldrig 0 eller 100%, plus Försök igen', async () => {
    vi.mocked(fetchAdminSources).mockRejectedValue(new Error('fetchAdminSources: 500'))
    vi.mocked(fetchAdminUsers).mockRejectedValue(new Error('fetchAdminUsers: 500'))
    vi.mocked(fetchAdminTickets).mockRejectedValue(new Error('fetchAdminTickets: 403'))
    vi.mocked(fetchAdminActivityLog).mockRejectedValue(new Error('fetchAdminActivityLog: 500'))
    rendera(<Oversikt onNavigate={() => {}} />)

    await waitFor(() => expect(screen.getAllByText('Kunde inte hämtas')).toHaveLength(4))
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(screen.queryByText('0/0 källor utan fel')).not.toBeInTheDocument()
    expect(screen.queryByText('+0 senaste 7 dagarna')).not.toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(4)
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Försök igen' }).length).toBeGreaterThan(0)
    // Listorna säger inte "Inga aktiva källor" / "Ingen aktivitet" när de bara inte gick att hämta.
    expect(screen.queryByText('Inga aktiva källor.')).not.toBeInTheDocument()
    expect(screen.queryByText('Ingen aktivitet att visa.')).not.toBeInTheDocument()
  })

  it('Försök igen hämtar om och visar data när det lyckas', async () => {
    vi.mocked(fetchAdminSources)
      .mockRejectedValueOnce(new Error('fetchAdminSources: 500'))
      .mockResolvedValue([källa(1), källa(2, { lastFetchError: 'timeout' })])
    vi.mocked(fetchAdminUsers).mockResolvedValue([])
    vi.mocked(fetchAdminTickets).mockResolvedValue([])
    vi.mocked(fetchAdminActivityLog).mockResolvedValue({
      rader: [],
      totalt: 0,
      sammanfattning: { ingestor: 0, fel: 0, varningar: 0 },
    })
    rendera(<Oversikt onNavigate={() => {}} />)

    await screen.findAllByText('Kunde inte hämtas')
    await userEvent.click(screen.getAllByRole('button', { name: 'Försök igen' })[0])

    expect(await screen.findByText('50%')).toBeInTheDocument()
    expect(screen.getByText('1/2 källor utan fel')).toBeInTheDocument()
    expect(screen.queryByText('Kunde inte hämtas')).not.toBeInTheDocument()
  })

  it('bekräftat tomt svar visar tomt-läge (0 användare, inga aktiva källor), inte fel', async () => {
    vi.mocked(fetchAdminSources).mockResolvedValue([])
    vi.mocked(fetchAdminUsers).mockResolvedValue([])
    vi.mocked(fetchAdminTickets).mockResolvedValue([])
    vi.mocked(fetchAdminActivityLog).mockResolvedValue({
      rader: [],
      totalt: 0,
      sammanfattning: { ingestor: 0, fel: 0, varningar: 0 },
    })
    rendera(<Oversikt onNavigate={() => {}} />)

    expect(await screen.findByText('Inga aktiva källor.')).toBeInTheDocument()
    expect(screen.getByText('Ingen aktivitet att visa.')).toBeInTheDocument()
    expect(screen.getByText('+0 senaste 7 dagarna')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Kunde inte hämtas')).not.toBeInTheDocument()
    // Inga aktiva källor att mäta på är inte "100 %".
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    expect(screen.getByText('Inga aktiva källor att mäta')).toBeInTheDocument()
  })

  it('lyckat: riktiga siffror', async () => {
    vi.mocked(fetchAdminSources).mockResolvedValue([källa(1), källa(2)])
    vi.mocked(fetchAdminUsers).mockResolvedValue([])
    vi.mocked(fetchAdminTickets).mockResolvedValue([])
    vi.mocked(fetchAdminActivityLog).mockResolvedValue({
      rader: [],
      totalt: 0,
      sammanfattning: { ingestor: 0, fel: 0, varningar: 0 },
    })
    rendera(<Oversikt onNavigate={() => {}} />)

    expect(await screen.findByText('100%')).toBeInTheDocument()
    expect(screen.getByText('2/2 källor utan fel')).toBeInTheDocument()
  })
})

describe('Felsökning / Systemhälsa — hälsofel är inte "frisk"', () => {
  it('hälso-anropet misslyckas: "Status okänd", varje tjänst "Okänd", felruta med Försök igen — aldrig "Alla system OK"', async () => {
    vi.mocked(fetchAdminSources).mockResolvedValue([källa(1)])
    vi.mocked(fetchAdminHealth).mockRejectedValue(new Error('fetchAdminHealth: 500'))
    rendera(<Felsökning />)

    expect(await screen.findByText('Status okänd')).toBeInTheDocument()
    expect(screen.getAllByText('Okänd')).toHaveLength(4)
    expect(screen.queryByText('Alla system OK')).not.toBeInTheDocument()
    expect(screen.queryByText('Kontrollerar...')).not.toBeInTheDocument()
    expect(screen.getByText(/Kunde inte hämta systemhälsan/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Försök igen' })).toBeInTheDocument()
  })

  it('Försök igen efter hälsofel ger riktig status', async () => {
    vi.mocked(fetchAdminSources).mockResolvedValue([källa(1)])
    vi.mocked(fetchAdminHealth)
      .mockRejectedValueOnce(new Error('fetchAdminHealth: 500'))
      .mockResolvedValue(hälsa())
    rendera(<Felsökning />)

    await userEvent.click(await screen.findByRole('button', { name: 'Försök igen' }))

    expect(await screen.findByText('Alla system OK')).toBeInTheDocument()
    expect(screen.queryByText('Status okänd')).not.toBeInTheDocument()
  })

  it('lyckat hälsosvar med en tjänst nere visar Driftstörning (data visas)', async () => {
    vi.mocked(fetchAdminSources).mockResolvedValue([källa(1)])
    vi.mocked(fetchAdminHealth).mockResolvedValue(hälsa({ db: { status: 'Nere', latencyMs: 0 } }))
    rendera(<Felsökning />)

    expect(await screen.findByText('Driftstörning')).toBeInTheDocument()
    expect(screen.queryByText('Status okänd')).not.toBeInTheDocument()
  })

  it('källistan misslyckas: felmeddelande + Försök igen, inte tom lista', async () => {
    vi.mocked(fetchAdminSources).mockRejectedValue(new Error('fetchAdminSources: 500'))
    vi.mocked(fetchAdminHealth).mockResolvedValue(hälsa())
    rendera(<Felsökning />)

    // Komponenten har egen retry: 1 (1 s väntan) — därför längre timeout.
    expect(
      await screen.findByText('Kunde inte hämta källorna.', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Källor okända')).toBeInTheDocument()
    expect(screen.queryByText('Inga källor finns.')).not.toBeInTheDocument()
  })

  it('tom källista visar tomt-läge; lyckad visar källorna', async () => {
    vi.mocked(fetchAdminHealth).mockResolvedValue(hälsa())
    vi.mocked(fetchAdminSources).mockResolvedValue([])
    const tom = rendera(<Felsökning />)
    expect(await screen.findByText('Inga källor finns.')).toBeInTheDocument()
    tom.unmount()

    vi.mocked(fetchAdminSources).mockResolvedValue([källa(1)])
    rendera(<Felsökning />)
    expect(await screen.findByText('Källa 1')).toBeInTheDocument()
  })

  it('misslyckad aktiv-toggle visas som fel vid källorna', async () => {
    vi.mocked(fetchAdminSources).mockResolvedValue([källa(1)])
    vi.mocked(fetchAdminHealth).mockResolvedValue(hälsa())
    vi.mocked(updateAdminSource).mockRejectedValue(new Error('updateAdminSource: 500'))
    rendera(<Felsökning />)

    await screen.findByText('Källa 1')
    await userEvent.click(screen.getByText('Aktiv').nextElementSibling as HTMLElement)

    expect(
      await screen.findByText('Kunde inte ändra källans status. Försök igen.'),
    ).toBeInTheDocument()
  })
})
