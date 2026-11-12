import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// V3-20 (E6#11): notisklockan hade två ägare (Support-inbox och Användare) som ersatte
// varandras lista via onPendingNotiser — tom på Översikt, flippande mellan flikar. Nu äger
// AdminPage båda queryerna (useAdminNotiser) och klockan visar båda listorna oavsett flik.

const auth = vi.hoisted(() => ({
  värde: {
    isLoggedIn: true,
    roll: 'Admin',
    aktivVy: 'Admin',
    name: 'Test',
    email: 'x@example.com',
    byttVy: () => {},
  },
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.värde }))
vi.mock('../context/FeatureFlagsContext', () => ({
  useFeatureFlagsAdmin: () => ({
    flaggor: {},
    inställda: {},
    växlaFlagg: () => {},
    återställ: () => {},
  }),
}))
vi.mock('../hooks/usePwaIdentity', () => ({ usePwaIdentity: () => {}, ADMIN_PWA_IDENTITET: {} }))
vi.mock('../hooks/usePushSubscription', () => ({
  usePushSubscription: () => ({
    isSubscribed: false,
    loading: false,
    subscribe: async () => {},
    unsubscribe: async () => {},
  }),
  isPushSupported: () => false,
}))
vi.mock('../api/push', () => ({
  fetchPushSettings: async () => ({ pushEnabled: true }),
  savePushSettings: async () => {},
}))

const hämtaÄrendeNotiser = vi.fn()
const hämtaKontoNotiser = vi.fn()
vi.mock('../api/support', () => ({
  fetchAdminTickets: async () => [],
  fetchSupportNotifications: () => hämtaÄrendeNotiser(),
}))
vi.mock('../api/adminUsers', () => ({ fetchUserNotifications: () => hämtaKontoNotiser() }))

// Sektionerna är stubbar — poängen är att klockan är komplett UTAN att Support-inbox/Användare renderats.
function stub(namn: string) {
  return { default: () => <div data-testid="sektion">{namn}</div> }
}
for (const sökväg of [
  'Oversikt',
  'Kallhantering',
  'Felsökning',
  'Anvandare',
  'SupportInbox',
  'Rapporter',
  'Aktivitetslogg',
  'Impersonation',
  'AdminUppdateringar',
  'AdminFaq',
  'FeatureFlagsAdmin',
  'SiteSettingsAdmin',
  'MaintenanceBannerAdmin',
  'FunktionsIdePipeline',
  'Sandlada',
  'Handelsesok',
]) {
  vi.doMock(`../components/Admin/${sökväg}`, () => stub(sökväg))
}

const { default: AdminPage } = await import('../pages/AdminPage')

function visaAdminPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const ÄRENDE_NOTIS = {
  ticketId: 't1',
  amne: 'Förfallen påminnelse i ärende',
  typ: 'påminnelse',
  notering: 'Ring tillbaka',
}
const KONTO_NOTIS = {
  userId: 'u1',
  namn: 'Bertil Spärrad',
  epost: 'bertil@example.com',
  notering: 'Se över spärren',
}

beforeEach(() => {
  auth.värde = {
    isLoggedIn: true,
    roll: 'Admin',
    aktivVy: 'Admin',
    name: 'Test',
    email: 'x@example.com',
    byttVy: () => {},
  }
  hämtaÄrendeNotiser.mockReset().mockResolvedValue([ÄRENDE_NOTIS])
  hämtaKontoNotiser.mockReset().mockResolvedValue([KONTO_NOTIS])
})

describe('Admin-klockan (en gemensam källa)', () => {
  it('visar både ärende- och kontonotiser direkt på Översikt, utan att Support-inbox eller Användare öppnats', async () => {
    visaAdminPage()
    expect(screen.getByTestId('sektion')).toHaveTextContent('Oversikt') // startsektionen, inte en notisägare

    const klocka = screen.getByTitle('Notiser')
    await waitFor(() => expect(within(klocka).getByText('2')).toBeInTheDocument())

    fireEvent.click(klocka)
    expect(await screen.findByText('Förfallen påminnelse i ärende')).toBeInTheDocument()
    expect(screen.getByText('Bertil Spärrad')).toBeInTheDocument()
  })

  it('listan är oförändrad när man byter flik (ingen flippande lista)', async () => {
    visaAdminPage()
    const klocka = screen.getByTitle('Notiser')
    await waitFor(() => expect(within(klocka).getByText('2')).toBeInTheDocument())

    for (const flik of [/Support-inbox/, /Användare/, /Översikt/]) {
      fireEvent.click(screen.getByRole('button', { name: flik }))
      expect(within(screen.getByTitle('Notiser')).getByText('2')).toBeInTheDocument()
    }
  })

  it('en gemensam query per sort: notiserna hämtas en gång var oavsett antal flikbyten', async () => {
    visaAdminPage()
    await waitFor(() => expect(hämtaÄrendeNotiser).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /Support-inbox/ }))
    fireEvent.click(screen.getByRole('button', { name: /Användare/ }))
    expect(hämtaÄrendeNotiser).toHaveBeenCalledTimes(1)
    expect(hämtaKontoNotiser).toHaveBeenCalledTimes(1)
  })

  it('Support: bara ärendenotiser, kontospärr-notiserna (Admin-only, 403) hämtas aldrig', async () => {
    auth.värde = { ...auth.värde, roll: 'Support', aktivVy: 'Support' }
    visaAdminPage()
    const klocka = screen.getByTitle('Notiser')
    await waitFor(() => expect(within(klocka).getByText('1')).toBeInTheDocument())
    expect(hämtaKontoNotiser).not.toHaveBeenCalled()
  })
})
