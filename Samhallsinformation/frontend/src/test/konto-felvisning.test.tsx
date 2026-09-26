import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Konto from '../components/Profile/Konto'
import PushKort from '../components/Profile/Konto/PushKort'
import SupportVisningsnamnKort from '../components/Profile/Konto/SupportVisningsnamnKort'
import Datahantering from '../components/Profile/Konto/Datahantering'
import EmailVerificationBanner from '../components/common/EmailVerificationBanner'
import * as authApi from '../api/auth'
import * as pushApi from '../api/push'

// V3-9: Konto-sidans skrivande anrop (namn, e-postbyte, avbryt e-postbyte,
// push-kategorier, visningsnamn, dataexport/radering) och påminnelsebannerns
// "Skicka igen" ska visa ett begripligt svenskt fel, låsa knappen under anrop
// och aldrig visa tekniska texter som "requestEmailChange: 500".
vi.mock('../api/auth')
vi.mock('../api/push')
vi.mock('../hooks/usePushSubscription', () => ({
  isPushSupported: () => true,
  usePushSubscription: () => ({ isSubscribed: true, loading: false, subscribe: vi.fn(), unsubscribe: vi.fn() }),
}))
const auth = { roll: 'Användare', setAccessToken: vi.fn(), isLoggedIn: true, emailVerified: false, email: 'a@b.se', logout: vi.fn() }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../context/FeatureFlagsContext', () => ({ useFlags: () => ({ konto_info: true, konto_epost_paminnelse: true }) }))

const authMock = vi.mocked(authApi)
const pushMock = vi.mocked(pushApi)

function med(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.fetchMe.mockResolvedValue({
    email: 'a@b.se', name: 'Anna', displayName: null, role: 'Användare',
    emailVerified: true, pendingEmail: null, authProvider: 'google',
  })
})

describe('Konto: kontouppgifter', () => {
  it('misslyckat namnbyte: felmeddelande, inget "Sparat", knappen aktiv igen', async () => {
    const user = userEvent.setup()
    authMock.updateMyProfile.mockRejectedValue(new Error('updateMyProfile: 500'))
    med(<Konto />)

    const falt = await screen.findByDisplayValue('Anna')
    await user.clear(falt)
    await user.type(falt, 'Anna B')
    await user.click(screen.getByRole('button', { name: 'Spara' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Namnet kunde inte sparas')
    expect(screen.queryByText(/Sparat/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Spara' })).toBeEnabled()
    expect(authMock.updateMyProfile).toHaveBeenCalledTimes(1)
  })

  it('lyckat namnbyte: "Sparat" visas och token uppdateras', async () => {
    const user = userEvent.setup()
    authMock.updateMyProfile.mockResolvedValue({ accessToken: 'ny-token' })
    med(<Konto />)

    await user.type(await screen.findByDisplayValue('Anna'), ' B')
    await user.click(screen.getByRole('button', { name: 'Spara' }))

    expect(await screen.findByText(/Sparat/)).toBeInTheDocument()
    expect(auth.setAccessToken).toHaveBeenCalledWith('ny-token')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('misslyckat e-postbyte: svenskt fel (aldrig den tekniska texten) och ingen väntande-banner', async () => {
    const user = userEvent.setup()
    authMock.requestEmailChange.mockRejectedValue(new Error('requestEmailChange: 500'))
    med(<Konto />)

    const falt = await screen.findByDisplayValue('a@b.se')
    await user.clear(falt)
    await user.type(falt, 'ny@b.se')
    await user.click(screen.getByRole('button', { name: 'Skicka bekräftelse' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bekräftelsen kunde inte skickas')
    expect(screen.queryByText(/requestEmailChange/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Bekräftelse skickad till/)).not.toBeInTheDocument()
  })

  it('visar serverns egen svenska text vid t.ex. upptagen e-post', async () => {
    const user = userEvent.setup()
    authMock.requestEmailChange.mockRejectedValue(new Error('E-postadressen används redan.'))
    med(<Konto />)

    const falt = await screen.findByDisplayValue('a@b.se')
    await user.clear(falt)
    await user.type(falt, 'upptagen@b.se')
    await user.click(screen.getByRole('button', { name: 'Skicka bekräftelse' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('E-postadressen används redan.')
  })

  it('låser "Skicka bekräftelse" under pågående anrop (inga två mejl)', async () => {
    const user = userEvent.setup()
    let avsluta!: () => void
    authMock.requestEmailChange.mockReturnValue(new Promise<void>(resolve => { avsluta = resolve }))
    med(<Konto />)

    const falt = await screen.findByDisplayValue('a@b.se')
    await user.clear(falt)
    await user.type(falt, 'ny@b.se')
    await user.click(screen.getByRole('button', { name: 'Skicka bekräftelse' }))

    const upptagen = await screen.findByRole('button', { name: 'Skickar…' })
    expect(upptagen).toBeDisabled()
    await user.click(upptagen)
    expect(authMock.requestEmailChange).toHaveBeenCalledTimes(1)

    avsluta()
    expect(await screen.findByText(/Bekräftelse skickad till/)).toBeInTheDocument()
  })

  it('misslyckad avbrytning av e-postbyte: felet syns och bannern står kvar', async () => {
    const user = userEvent.setup()
    authMock.fetchMe.mockResolvedValue({
      email: 'a@b.se', name: 'Anna', displayName: null, role: 'Användare',
      emailVerified: true, pendingEmail: 'ny@b.se', authProvider: 'google',
    })
    authMock.cancelEmailChange.mockRejectedValue(new Error('cancelEmailChange: 500'))
    med(<Konto />)

    await user.click(await screen.findByRole('button', { name: 'Avbryt' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bytet kunde inte avbrytas')
    expect(screen.getByText(/Bekräftelse skickad till/)).toBeInTheDocument()
  })
})

describe('Push-kategorier', () => {
  beforeEach(() => {
    pushMock.fetchPushSettings.mockResolvedValue({ pushNyaHandelser: false, pushNyVersion: false } as never)
  })

  it('misslyckad växling: felmeddelande och reglaget står kvar i sitt gamla läge', async () => {
    const user = userEvent.setup()
    pushMock.savePushSettings.mockRejectedValue(new Error('savePushSettings: 500'))
    med(<PushKort />)

    const reglage = (await screen.findAllByRole('button'))[0]
    await user.click(reglage)

    expect(await screen.findByRole('alert')).toHaveTextContent('Notisinställningen kunde inte sparas')
    expect(reglage.className).toContain('bg-slate-200')
    expect(reglage).toBeEnabled()
  })

  it('lyckad växling: reglaget slår om, inget felmeddelande', async () => {
    const user = userEvent.setup()
    pushMock.savePushSettings.mockResolvedValue(undefined)
    med(<PushKort />)

    const reglage = (await screen.findAllByRole('button'))[0]
    await user.click(reglage)

    await waitFor(() => expect(reglage.className).toContain('bg-violet-600'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('låser reglagen under pågående anrop', async () => {
    const user = userEvent.setup()
    let avsluta!: () => void
    pushMock.savePushSettings.mockReturnValue(new Promise<void>(resolve => { avsluta = resolve }))
    med(<PushKort />)

    const [forsta, andra] = await screen.findAllByRole('button')
    await user.click(forsta)
    await waitFor(() => expect(andra).toBeDisabled())
    await user.click(andra)
    expect(pushMock.savePushSettings).toHaveBeenCalledTimes(1)

    avsluta()
    await waitFor(() => expect(andra).toBeEnabled())
  })
})

describe('Support-visningsnamn', () => {
  it('misslyckad sparning: svenskt fel i stället för teknisk text, och inget "Sparat"', async () => {
    const user = userEvent.setup()
    authMock.updateDisplayName.mockRejectedValue(new Error('updateDisplayName: 500'))
    med(<SupportVisningsnamnKort />)

    await user.click(await screen.findByRole('button', { name: 'Spara' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Visningsnamnet kunde inte sparas')
    expect(screen.queryByText(/updateDisplayName/)).not.toBeInTheDocument()
    expect(screen.queryByText(/✓ Sparat/)).not.toBeInTheDocument()
  })
})

describe('Datahantering', () => {
  it('misslyckad export: svenskt fel i stället för teknisk text', async () => {
    const user = userEvent.setup()
    authMock.exportMyData.mockRejectedValue(new Error('exportMyData: 500'))
    med(<Datahantering highlightId={null} />)

    await user.click(screen.getByRole('button', { name: /Exportera|Ladda ner/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte exportera din data')
    expect(screen.queryByText(/exportMyData/)).not.toBeInTheDocument()
  })
})

describe('Påminnelsebanner: "Skicka igen"', () => {
  it('misslyckat utskick: felmeddelande, knappen aktiv igen (inte fast i "Skickar…")', async () => {
    const user = userEvent.setup()
    authMock.resendVerification.mockRejectedValue(new Error('resendVerification: 500'))
    med(<EmailVerificationBanner />)

    await user.click(screen.getByRole('button', { name: 'Skicka igen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Mejlet kunde inte skickas')
    expect(screen.queryByText('Skickat!')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skicka igen' })).toBeEnabled()
  })

  it('lyckat utskick: "Skickat!" och låst knapp, inget felmeddelande', async () => {
    const user = userEvent.setup()
    authMock.resendVerification.mockResolvedValue(undefined)
    med(<EmailVerificationBanner />)

    await user.click(screen.getByRole('button', { name: 'Skicka igen' }))

    expect(await screen.findByRole('button', { name: 'Skickat!' })).toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
