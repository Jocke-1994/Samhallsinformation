import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Link } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../App'

// V3-7 (E7#8): en okänd URL gav en tom sida (ingen catch-all-route) och ett
// kastande sidfel gav vit skärm (ingen ErrorBoundary). Testet kör den RIKTIGA
// App-komponenten; tunga sidor, sidomeny och kontexter är ersatta med stubbar.

const styr = vi.hoisted(() => ({ omKastar: false }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: false, emailVerified: false, email: null }),
}))
vi.mock('../context/FeatureFlagsContext', () => ({
  useFlags: () => ({ konto_epost_paminnelse: false }),
}))
vi.mock('../api/sources', () => ({ fetchSources: async () => [] }))
vi.mock('../api/userSources', () => ({ fetchUserSources: async () => [] }))
vi.mock('../api/auth', () => ({ resendVerification: vi.fn() }))
vi.mock('../api/maintenanceBanners', () => ({ fetchMaintenanceBanners: async () => [] }))
vi.mock('../hooks/useUnreadSourceIds', () => ({ useUnreadSourceIds: () => new Set() }))

vi.mock('../components/Sidebar/Sidebar', () => ({ default: () => <nav>Sidomeny</nav> }))
vi.mock('../components/NewsFeed/NewsFeed', () => ({ default: () => <p>Nyhetsflödet</p> }))
vi.mock('../components/CookieConsent/CookieConsent', () => ({ default: () => null }))
vi.mock('../components/NewsFeed/BevakningsToastHost', () => ({ default: () => null }))

vi.mock('../pages/OmPage', () => ({
  default: () => {
    if (styr.omKastar) throw new Error('sidfel')
    return <p>Om-sidan</p>
  },
}))
vi.mock('../pages/VillkorPage', () => ({ default: () => <p>Villkor-sidan</p> }))
vi.mock('../pages/ProfilePage', () => ({ default: () => <p>ProfilePage</p> }))
vi.mock('../pages/AdminPage', () => ({ default: () => <p>AdminPage</p> }))
vi.mock('../pages/LoginPage', () => ({ default: () => <p>LoginPage</p> }))
vi.mock('../pages/OnboardingPage', () => ({ default: () => <p>OnboardingPage</p> }))
vi.mock('../pages/ForgotPasswordPage', () => ({ default: () => <p>ForgotPasswordPage</p> }))
vi.mock('../pages/ResetPasswordPage', () => ({ default: () => <p>ResetPasswordPage</p> }))
vi.mock('../pages/VerifyEmailPage', () => ({ default: () => <p>VerifyEmailPage</p> }))
vi.mock('../pages/ConfirmEmailChangePage', () => ({ default: () => <p>ConfirmEmailChangePage</p> }))
vi.mock('../pages/CancelDeletionPage', () => ({ default: () => <p>CancelDeletionPage</p> }))
vi.mock('../pages/UppdateringarPage', () => ({ default: () => <p>UppdateringarPage</p> }))

function renderaApp(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        {/* Länk utanför App, som sidomenyn/webbläsarens bakåtknapp — navigerar bort från en sida. */}
        <Link to="/villkor">Gå till villkor</Link>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App: catch-all-route och ErrorBoundary', () => {
  beforeEach(() => {
    styr.omKastar = false
    // Tysta React/boundary-loggen för de avsiktliga renderfelen.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('okänd URL renderar NotFound med länk till startsidan', () => {
    renderaApp('/finns-inte-alls')

    expect(screen.getByRole('heading', { name: 'Sidan finns inte' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Till startsidan' })).toHaveAttribute('href', '/')
  })

  it('okänd underväg under en känd route renderar också NotFound', () => {
    renderaApp('/om/nagot-som-inte-finns')

    expect(screen.getByRole('heading', { name: 'Sidan finns inte' })).toBeInTheDocument()
  })

  it('känd URL renderar sin sida, inte NotFound (regression)', () => {
    renderaApp('/om')

    expect(screen.getByText('Om-sidan')).toBeInTheDocument()
    expect(screen.queryByText('Sidan finns inte')).not.toBeInTheDocument()
  })

  it('startsidan renderar sitt innehåll, inte NotFound (regression)', () => {
    renderaApp('/')

    expect(screen.getByText('Nyhetsflödet')).toBeInTheDocument()
    expect(screen.queryByText('Sidan finns inte')).not.toBeInTheDocument()
  })

  it('/cancel-deletion och /verify-email med token krockar inte med catch-all', () => {
    const { unmount } = renderaApp('/cancel-deletion?token=abc')
    expect(screen.getByText('CancelDeletionPage')).toBeInTheDocument()
    unmount()

    renderaApp('/verify-email?token=abc')
    expect(screen.getByText('VerifyEmailPage')).toBeInTheDocument()
    expect(screen.queryByText('Sidan finns inte')).not.toBeInTheDocument()
  })

  it('en sida som kastar vid render ger felvy i route-ytan, inte vit skärm', () => {
    styr.omKastar = true
    renderaApp('/om')

    expect(screen.getByRole('alert')).toHaveTextContent('Något gick fel')
    expect(screen.getByRole('button', { name: 'Ladda om sidan' })).toBeInTheDocument()
    // Utanför boundaryn (t.ex. sidomenyn/banderollerna) överlever — här: länken utanför Routes.
    expect(screen.getByText('Gå till villkor')).toBeInTheDocument()
  })

  it('felvyn nollställs vid navigering till en annan route', async () => {
    styr.omKastar = true
    renderaApp('/om')
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Gå till villkor'))

    expect(screen.getByText('Villkor-sidan')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
