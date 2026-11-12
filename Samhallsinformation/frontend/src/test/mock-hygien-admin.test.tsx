import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminUserDto } from '../api/adminUsers'

// V3-20 (beslut D3): varje mock-yta i adminpanelen bär tydlig MOCK-märkning, och knappar
// som låtsades göra något är avstängda eller omtextade. Fabricerad data får inte se ut som
// sanning för en supportagent.

const auth = vi.hoisted(() => ({
  värde: { roll: 'Admin', aktivVy: 'Admin', email: 'adam@example.com' } as {
    roll: string
    aktivVy: string
    email: string
  },
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.värde }))

const ANNA: AdminUserDto = {
  id: 'u-anna',
  name: 'Anna',
  email: 'anna@example.com',
  role: 'Användare',
  isActive: true,
  suspendedAt: null,
  suspendedReason: null,
  suspensionReminderAt: null,
  suspensionReminderNote: null,
  authProvider: 'password',
  createdAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  deletionScheduledAt: null,
}

vi.mock('../api/adminUsers', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../api/adminUsers')>()
  return {
    ...orig,
    fetchAdminUsers: async () => [ANNA],
    fetchAdminUserSavedEvents: async () => [],
    fetchAdminUserPolisenBevakningar: async () => [],
    fetchAdminUserNotificationLog: async () => [],
    fetchAdminUserSettingLog: async () => [],
    fetchAdminUserSources: async () => [
      { sourceId: 1, shortName: 'Polisen', name: 'Polisen', isActive: true },
    ],
    fetchAdminUserPushSettings: async () => ({
      pushEnabled: true,
      pushNyaHandelser: true,
      pushNyVersion: false,
      enheter: [],
    }),
    fetchSavedEventsByEvent: async () => ({}),
  }
})
vi.mock('../api/support', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../api/support')>()
  return { ...orig, fetchAdminTickets: async () => [] }
})
vi.mock('../api/activityLog', () => ({
  createActivityLogEntry: vi.fn(),
  undoActivityLogEntry: vi.fn(),
  fetchAdminActivityLog: vi.fn(async () => ({
    rader: [],
    totalt: 0,
    sammanfattning: { ingestor: 0, fel: 0, varningar: 0 },
  })),
}))
vi.mock('../api/events', () => ({ checkEventLinkStatus: vi.fn() }))
vi.mock('../api/eventSearch', () => ({ searchEvents: vi.fn() }))

const RSS_KÄLLA = {
  id: 1,
  name: 'Polisen',
  shortName: 'Polisen',
  baseUrl: 'https://polisen.se',
  url: 'https://polisen.se/rss',
  category: 'Nationell',
  type: 0,
  isActive: true,
  isPublished: true,
  eventCount: 3,
  lastFetchedAt: new Date().toISOString(),
  lastFetchError: null,
}
const API_KÄLLA = {
  ...RSS_KÄLLA,
  id: 2,
  name: 'Krisinformation',
  shortName: 'Krisinfo',
  url: 'https://api.krisinformation.se',
  type: 1,
}

const dryRun = vi.fn()
vi.mock('../api/sources', () => ({
  fetchAdminSources: async () => [RSS_KÄLLA, API_KÄLLA],
  createAdminSource: vi.fn(),
  updateAdminSource: vi.fn(),
  deleteAdminSource: vi.fn(),
  resyncAdminSource: vi.fn(),
}))
vi.mock('../api/testing', () => ({
  dryRunSource: (...a: unknown[]) => dryRun(...a),
  fetchPreviewEvents: vi.fn(),
}))
vi.mock('../api/health', () => ({
  fetchAdminHealth: async () => ({
    api: { status: 'OK', latencyMs: 1 },
    db: { status: 'OK', latencyMs: 1 },
    ingestor: { status: 'OK', lastFetchedAt: null, aktivaKällor: 2, källorMedFel: 0 },
    notifieringar: { status: 'OK', felSenaste24h: 0, totaltSenaste24h: 0 },
  }),
}))
vi.mock('../components/Admin/LarmKort', () => ({ default: () => null }))

const { MockBadge, MockBanner, MockYta, IngetKopplatAn } =
  await import('../components/common/MockBadge')
const { default: Impersonation } = await import('../components/Admin/Impersonation')
const { default: Felsökning } = await import('../components/Admin/Felsökning')
const { default: Kallhantering } = await import('../components/Admin/Kallhantering')
const { default: Aktivitetslogg } = await import('../components/Admin/Aktivitetslogg')
const { default: Anvandare } = await import('../components/Admin/Anvandare')

function visa(element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>)
}

const antalMock = () => screen.queryAllByText('MOCK').length

beforeEach(() => {
  auth.värde = { roll: 'Admin', aktivVy: 'Admin', email: 'adam@example.com' }
  dryRun.mockReset()
})

describe('MockBadge-komponenterna', () => {
  it('MockBadge, MockBanner och IngetKopplatAn säger tydligt vad ytan är', () => {
    render(
      <>
        <MockBadge />
        <MockBanner>förklaring</MockBanner>
        <IngetKopplatAn rubrik="Rubrik" />
      </>,
    )
    expect(screen.getAllByText('MOCK').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/exempeldata, inte riktig funktion/)).toBeInTheDocument()
    expect(screen.getByText('Inte kopplat än')).toBeInTheDocument()
  })

  it('MockYta stänger av varje knapp inuti', () => {
    render(
      <MockYta>
        <button>Gör något</button>
        <input aria-label="fält" />
      </MockYta>,
    )
    expect(screen.getByRole('button', { name: 'Gör något' })).toBeDisabled()
    expect(screen.getByLabelText('fält')).toBeDisabled()
  })
})

describe('Impersonation', () => {
  it('är märkt MOCK, lovar inget om loggning och har inga aktiva "Logga in som"-knappar', () => {
    visa(<Impersonation onNavigate={() => {}} />)
    expect(antalMock()).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('note')).toHaveTextContent(/inte riktig funktion/)
    expect(screen.queryByText(/Användaren märker ingenting/)).toBeNull()
    expect(screen.queryByText(/(Sessionen|Varje session) loggas i aktivitetsloggen/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Logga in som' })).toBeNull()

    const knappar = screen.getAllByRole('button', { name: 'Inte tillgängligt' })
    expect(knappar.length).toBeGreaterThan(0)
    for (const k of knappar) expect(k).toBeDisabled()
  })

  it('visar ingen påhittad sessionshistorik', () => {
    visa(<Impersonation onNavigate={() => {}} />)
    expect(screen.getByText('Ingen sessionshistorik')).toBeInTheDocument()
    expect(screen.queryByText('Avslutad')).toBeNull()
    expect(screen.queryByText(/Kontrollera att avstängt konto/)).toBeNull()
  })
})

describe('Felsökning', () => {
  it('märker Kommande kontroller, Kontrollhistorik och Felloggar som MOCK', async () => {
    visa(<Felsökning />)
    await screen.findByText('Krisinformation')
    expect(antalMock()).toBeGreaterThanOrEqual(3)
    for (const rubrik of ['Kommande kontroller', 'Kontrollhistorik', 'Felloggar']) {
      const h = screen.getByRole('heading', { name: new RegExp(rubrik) })
      expect(within(h).getByText('MOCK'), rubrik).toBeInTheDocument()
    }
  })

  it('"Kör nu" och "Exportera" är avstängda (gjorde ingenting)', async () => {
    visa(<Felsökning />)
    await screen.findByText('Krisinformation')
    for (const k of screen.getAllByRole('button', { name: 'Kör nu' })) expect(k).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Exportera' })).toBeDisabled()
  })

  it('torrkörning: bara RSS-källor kan testas, API-källor är avstängda', async () => {
    visa(<Felsökning />)
    await screen.findByText('Krisinformation')
    const knappar = screen.getAllByRole('button', { name: 'Torrkör RSS' })
    expect(knappar).toHaveLength(2)
    expect(knappar[0]).toBeEnabled()
    expect(knappar[1]).toBeDisabled() // Krisinformation är WebAPI (typ 1) — skulle ge ett falskt negativt
  })

  it('torrkörning visar bara det som uppmättes, inga påhittade pipeline-steg', async () => {
    dryRun.mockResolvedValue({ count: 7, events: [] })
    visa(<Felsökning />)
    await screen.findByText('Krisinformation')
    fireEvent.click(screen.getAllByRole('button', { name: 'Torrkör RSS' })[0])
    expect(await screen.findByText(/7 poster lästes — inget sparades/)).toBeInTheDocument()
    expect(dryRun).toHaveBeenCalledTimes(1)
    for (const påhittat of [
      'Deduplicering',
      'Databas-skrivning',
      'Mappning',
      'HTTP 200',
      '^7 händelser inlästa',
    ]) {
      expect(screen.queryByText(new RegExp(påhittat))).toBeNull()
    }
  })

  it('torrkörning som misslyckas visar felet, inte gröna steg', async () => {
    dryRun.mockRejectedValue(new Error('Anslutning nekades'))
    visa(<Felsökning />)
    await screen.findByText('Krisinformation')
    fireEvent.click(screen.getAllByRole('button', { name: 'Torrkör RSS' })[0])
    expect(await screen.findByText('Anslutning nekades')).toBeInTheDocument()
    expect(screen.queryByText(/poster lästes/)).toBeNull()
  })
})

describe('Källhantering', () => {
  it('Schemalagda ändringar och Externa statusflöden är MOCK med avstängda knappar', async () => {
    visa(<Kallhantering />)
    await screen.findByText('Schemalagda ändringar')
    expect(antalMock()).toBeGreaterThanOrEqual(2)
    for (const namn of [
      '+ Schemalägg',
      'Kontrollera alla',
      'Kontrollera',
      'Importera som schemalagd ändring',
    ]) {
      const knappar = screen.getAllByRole('button', { name: namn })
      for (const k of knappar) expect(k, namn).toBeDisabled()
    }
    // Auto-import-reglaget och redigera/ta bort i mock-listorna är också avstängda.
    const kort = screen.getByText('Externa statusflöden').closest('div.bg-white') as HTMLElement
    for (const k of within(kort).getAllByRole('button')) expect(k).toBeDisabled()
  })
})

describe('Aktivitetslogg', () => {
  it('visar inga påhittade notisrader eller e-postadresser och kallar sig inte mock+live', async () => {
    visa(<Aktivitetslogg />)
    await waitFor(() => expect(screen.getByText('Aktivitetslogg')).toBeInTheDocument())
    expect(screen.queryByText(/anna\.svensson@mail\.se/)).toBeNull()
    expect(screen.queryByText(/erik\.lindgren@example\.com/)).toBeNull()
    expect(screen.queryByText('Notis skickad — Polisen')).toBeNull()
    expect(screen.queryByText('MOCK + LIVE')).toBeNull()
    // Sammanfattningen påstår inget antal skickade notiser.
    expect(screen.getByText('Skickade notiser (ej kopplat)')).toBeInTheDocument()
  })
})

describe('Användare: flikar utan backend', () => {
  async function öppnaAnna() {
    visa(<Anvandare />)
    fireEvent.click(await screen.findByText('Anna'))
    await screen.findByText('Push på')
  }

  it('Notifieringsinställningar säger "Inte kopplat än" i stället för "inga aktiva notifieringar"', async () => {
    await öppnaAnna()
    fireEvent.click(screen.getByRole('button', { name: 'Notifieringsinställningar' }))
    expect(screen.getByText('Inte kopplat än')).toBeInTheDocument()
    expect(screen.queryByText(/inga aktiva notifieringar/i)).toBeNull()
    // Den riktiga datan finns under Översikt — fliken hänvisar dit.
    fireEvent.click(screen.getByRole('button', { name: 'Visa under Översikt' }))
    expect(screen.getByText('Aktiva källor')).toBeInTheDocument()
  })

  it('Aktivitet säger "Inte kopplat än" i stället för "Ingen aktivitet registrerad"', async () => {
    await öppnaAnna()
    fireEvent.click(screen.getByRole('button', { name: 'Aktivitet' }))
    expect(screen.getByText('Inte kopplat än')).toBeInTheDocument()
    expect(screen.queryByText('Ingen aktivitet registrerad.')).toBeNull()
  })

  it('"Logga in som" finns inte längre (ingen backend som ger en session)', async () => {
    await öppnaAnna()
    expect(screen.queryByRole('button', { name: 'Logga in som' })).toBeNull()
  })
})
