import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// E7#4 (V4-4): gästens "Skapa konto"-knapp anropade tidigare alltid login() —
// oavsett vilken av de två knapparna man klickade på loggade man bara in, det
// fanns inget registreringsanrop. Fixen ersätter modalen med riktiga länkar
// till /login och /register (samma sidor som resten av appen redan använder,
// inkl. Google och glömt lösenord). Testet bekräftar att knapparna länkar rätt
// i stället för att stubba bort skillnaden.
//
// Samma fynd flaggade att gäst-grenen på /profil saknade MobilTopBar/swipe —
// på mobil fanns ingen väg tillbaka till flödet. Testet bekräftar att
// menyknappen finns och faktiskt öppnar sidomenyn.

vi.mock('../context/FeatureFlagsContext', () => ({
  useFlags: () => ({
    'mina-kallor': true,
    notifieringar: false,
    konto: true,
    support: true,
  }),
}))

const siteSettingsMock = vi.hoisted(() => ({ showLoginButton: true, showRegisterButton: true }))
vi.mock('../api/siteSettings', () => ({
  getSiteSettings: async () => ({
    showLoginButton: siteSettingsMock.showLoginButton,
    showRegisterButton: siteSettingsMock.showRegisterButton,
  }),
}))

vi.mock('../components/Sidebar/Sidebar', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (
    <nav data-testid="sidebar">{isOpen ? 'öppen' : 'stängd'}</nav>
  ),
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: false }) }))

function nyKlient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function rendera(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={nyKlient()}>
      <MemoryRouter initialEntries={['/profil']}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('GästProfil: "Skapa konto" och "Logga in" länkar till rätt sida', () => {
  it('länkar till /register (inte en modal som bara loggar in)', async () => {
    const { default: GästProfil } = await import('../pages/GästProfil')
    rendera(<GästProfil />)

    const skapaKonto = screen.getByRole('link', { name: 'Skapa konto' })
    expect(skapaKonto).toHaveAttribute('href', '/register?redirect=/profil')
  })

  it('länkar till /login (samma sida som resten av appen, inte en modal)', async () => {
    const { default: GästProfil } = await import('../pages/GästProfil')
    rendera(<GästProfil />)

    const loggaIn = screen.getByRole('link', { name: 'Logga in' })
    expect(loggaIn).toHaveAttribute('href', '/login?redirect=/profil')
  })

  it('respekterar showLoginButton/showRegisterButton', async () => {
    siteSettingsMock.showLoginButton = false
    siteSettingsMock.showRegisterButton = true
    const { default: GästProfil } = await import('../pages/GästProfil')
    rendera(<GästProfil />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Skapa konto' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Logga in' })).not.toBeInTheDocument()
    })

    siteSettingsMock.showLoginButton = true
    siteSettingsMock.showRegisterButton = true
  })
})

describe('ProfilePage: gäst-grenen har samma mobilmeny som den inloggade vyn', () => {
  it('visar menyknappen och öppnar sidomenyn vid klick', async () => {
    const { default: ProfilePage } = await import('../pages/ProfilePage')
    rendera(<ProfilePage />)

    expect(screen.getByTestId('sidebar')).toHaveTextContent('stängd')
    const menyknapp = screen.getByRole('button', { name: 'Öppna meny' })

    await userEvent.click(menyknapp)

    expect(screen.getByTestId('sidebar')).toHaveTextContent('öppen')
  })
})
