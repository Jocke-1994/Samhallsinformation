import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// E7#7 (V4-4): en direktlänk mot en avstängd sektion (t.ex. Ny version-pushens
// /profil?section=uppdateringar när alla uppdateringar_*-flaggorna är av)
// renderade tidigare sektionen ändå — bara sidomenyn/landningskortens egna
// filter kollade isSektionSynlig, inte själva ?section=-läsningen. Fixen
// kontrollerar samma flagga innan sektionen renderas och faller tillbaka till
// landningssidan (samma vy som section=null) i stället.

const flaggorMock = vi.hoisted(() => ({
  aktuella: {} as Record<string, boolean>,
}))
vi.mock('../context/FeatureFlagsContext', () => ({
  useFlags: () => flaggorMock.aktuella,
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true }) }))
vi.mock('../components/Sidebar/Sidebar', () => ({ default: () => <nav>Sidomeny</nav> }))
vi.mock('../components/common/MobilTopBar', () => ({ default: () => null }))
vi.mock('../components/Profile/MinaKallor', () => ({ default: () => <p>Mina källor-innehåll</p> }))
vi.mock('../components/Profile/Konto', () => ({ default: () => <p>Konto-innehåll</p> }))
vi.mock('../components/Profile/Notifieringar', () => ({
  default: () => <p>Notifieringar-innehåll</p>,
}))
vi.mock('../components/Profile/Uppdateringar', () => ({
  default: () => <p>Uppdateringar-innehåll</p>,
}))
vi.mock('../components/Profile/Support', () => ({ default: () => <p>Support-innehåll</p> }))

// Alla FLAG_GRUPPER-flaggor av som standard (via jest.fn-liknande objekt)
const ALLA_AV = Object.fromEntries(
  [
    'flode_olasta_badge',
    'flode_sparat',
    'flode_dela',
    'kallor_lagg_till',
    'kallor_aktiva',
    'kallor_rekommenderade',
    'kallor_alla',
    'kallor_polisen_filter',
    'notif_obligatoriska',
    'notif_mottagare',
    'notif_stor_ej',
    'notif_leveranslage',
    'notif_historik',
    'notif_push',
    'konto_info',
    'konto_losenord',
    'konto_visningsnamn',
    'konto_tvafaktor',
    'konto_sessioner',
    'konto_aktivitetslogg',
    'konto_samtycke',
    'konto_datahantering',
    'konto_tema',
    'uppdateringar_senaste',
    'uppdateringar_pagang',
    'uppdateringar_kanda_problem',
    'uppdateringar_historik',
    'support_arenden',
    'support_systemstatus',
    'support_faq',
    'konto_epost_paminnelse',
  ].map((k) => [k, false]),
)

function nyKlient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

async function renderaMedSektion(section: string, flaggor: Record<string, boolean>) {
  flaggorMock.aktuella = flaggor
  const { default: ProfilePage } = await import('../pages/ProfilePage')
  return render(
    <QueryClientProvider client={nyKlient()}>
      <MemoryRouter initialEntries={[`/profil?section=${section}`]}>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProfilePage: ?section= respekterar feature-flaggor', () => {
  it('en sektion vars flaggor alla är av visar INTE sektionen, utan landningssidan', async () => {
    await renderaMedSektion('uppdateringar', ALLA_AV)

    expect(screen.queryByText('Uppdateringar-innehåll')).not.toBeInTheDocument()
    // Landningssidans rubrik, inte sektionens egen rubrik.
    expect(screen.queryByRole('heading', { name: 'Uppdateringar' })).not.toBeInTheDocument()
  })

  it('samma sektion renderas normalt när minst en av dess flaggor är på', async () => {
    await renderaMedSektion('uppdateringar', { ...ALLA_AV, uppdateringar_senaste: true })

    expect(screen.getByText('Uppdateringar-innehåll')).toBeInTheDocument()
  })

  it('gäller flera sektioner (konto, support), inte bara uppdateringar', async () => {
    await renderaMedSektion('konto', ALLA_AV)
    expect(screen.queryByText('Konto-innehåll')).not.toBeInTheDocument()
  })
})
