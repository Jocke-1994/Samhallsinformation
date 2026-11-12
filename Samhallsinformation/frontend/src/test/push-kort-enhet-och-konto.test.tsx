import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PushKort from '../components/Profile/Konto/PushKort'
import * as pushApi from '../api/push'

// V3-13 (E7#6): kortet skiljer på KONTOTS inställningar (server, per konto) och
// DEN HÄR ENHETENS registrering (webbläsare). En enhet utan prenumeration ska
// visa kontots faktiska läge, och en växling får bara skicka det användaren
// själv ändrade — aldrig nollställa kategorier satta från andra enheter.

vi.mock('../api/push')

const hook = {
  isSubscribed: false,
  loading: false,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}
vi.mock('../hooks/usePushSubscription', () => ({
  isPushSupported: () => true,
  usePushSubscription: () => hook,
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ email: 'a@b.se' }) }))

const pushMock = vi.mocked(pushApi)

function renderaKort() {
  const klient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={klient}>
      <PushKort />
    </QueryClientProvider>,
  )
}

const reglage = () =>
  screen.getAllByRole('button').filter((b) => b.className.includes('rounded-full'))
const arPa = (b: HTMLElement) => b.className.includes('bg-violet-600')

beforeEach(() => {
  vi.clearAllMocks()
  hook.isSubscribed = false
  hook.loading = false
  hook.subscribe.mockResolvedValue({})
  hook.unsubscribe.mockResolvedValue(undefined)
  pushMock.fetchPushSettings.mockResolvedValue({
    pushEnabled: true,
    pushNyaHandelser: true,
    pushNyVersion: false,
  })
  pushMock.savePushSettings.mockResolvedValue(undefined)
})

describe('PushKort — enhet utan prenumeration', () => {
  it('hämtar kontots inställningar och visar dem, även utan prenumeration på enheten', async () => {
    renderaKort()

    await waitFor(() => expect(reglage()).toHaveLength(2))
    expect(pushMock.fetchPushSettings).toHaveBeenCalledTimes(1)
    const [handelse, version] = reglage()
    expect(arPa(handelse)).toBe(true) // kontot har "Ny händelse" på (satt från en annan enhet)
    expect(arPa(version)).toBe(false)
  })

  it('visar enhetsstatus separat och skickar ingen inställningsändring av sig själv', async () => {
    renderaKort()

    expect(
      await screen.findByText('Den här enheten är inte registrerad för notiser.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aktivera på den här enheten' })).toBeInTheDocument()
    expect(pushMock.savePushSettings).not.toHaveBeenCalled()
  })

  it('"Aktivera på den här enheten" registrerar bara enheten och rör inte kontots inställningar', async () => {
    const user = userEvent.setup()
    renderaKort()

    await user.click(await screen.findByRole('button', { name: 'Aktivera på den här enheten' }))

    expect(hook.subscribe).toHaveBeenCalledTimes(1)
    expect(pushMock.savePushSettings).not.toHaveBeenCalled()
  })

  it('växling av en kategori skickar BARA den ändringen, inte hela "nästa tillstånd"', async () => {
    const user = userEvent.setup()
    renderaKort()
    await waitFor(() => expect(reglage()).toHaveLength(2))

    await user.click(reglage()[1]) // slå på "Ny version" — "Ny händelse" står på från annan enhet

    await waitFor(() => expect(pushMock.savePushSettings).toHaveBeenCalledTimes(1))
    expect(pushMock.savePushSettings).toHaveBeenCalledWith({ pushNyVersion: true })
    expect(hook.subscribe).toHaveBeenCalledTimes(1) // enheten registreras när användaren själv slår på
    await waitFor(() => expect(arPa(reglage()[1])).toBe(true))
    expect(arPa(reglage()[0])).toBe(true) // den andra kategorin står kvar
  })

  it('nekat tillstånd vid växling: kontots inställning ändras inte', async () => {
    hook.subscribe.mockRejectedValue(new Error('Tillstånd nekades'))
    const user = userEvent.setup()
    renderaKort()
    await waitFor(() => expect(reglage()).toHaveLength(2))

    await user.click(reglage()[1])

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(pushMock.savePushSettings).not.toHaveBeenCalled()
    expect(arPa(reglage()[1])).toBe(false)
  })

  it('kontoinställningarna kunde inte hämtas: inga reglage som ser "av" ut, felmeddelande visas', async () => {
    pushMock.fetchPushSettings.mockRejectedValue(new Error('fetchPushSettings: 500'))
    renderaKort()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'notisinställningar kunde inte hämtas',
    )
    expect(reglage()).toHaveLength(0)
    expect(pushMock.savePushSettings).not.toHaveBeenCalled()
  })
})

describe('PushKort — enhet med prenumeration', () => {
  beforeEach(() => {
    hook.isSubscribed = true
  })

  it('visar att enheten är registrerad och kontots läge, utan aktiveringsknapp', async () => {
    renderaKort()

    expect(
      await screen.findByText('Den här enheten är registrerad för notiser.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(reglage()).toHaveLength(2))
    expect(arPa(reglage()[0])).toBe(true)
    expect(
      screen.queryByRole('button', { name: 'Aktivera på den här enheten' }),
    ).not.toBeInTheDocument()
  })

  it('avstängning av den enda aktiva kategorin sparar först, avregistrerar sedan enheten', async () => {
    const ordning: string[] = []
    pushMock.savePushSettings.mockImplementation(async () => {
      ordning.push('spara')
    })
    hook.unsubscribe.mockImplementation(async () => {
      ordning.push('avregistrera')
    })
    const user = userEvent.setup()
    renderaKort()
    await waitFor(() => expect(reglage()).toHaveLength(2))

    await user.click(reglage()[0]) // "Ny händelse" av → ingen kategori kvar

    await waitFor(() => expect(ordning).toEqual(['spara', 'avregistrera']))
    expect(pushMock.savePushSettings).toHaveBeenCalledWith({ pushNyaHandelser: false })
  })

  it('misslyckad sparning: enheten avregistreras inte och reglaget står kvar', async () => {
    pushMock.savePushSettings.mockRejectedValue(new Error('savePushSettings: 500'))
    const user = userEvent.setup()
    renderaKort()
    await waitFor(() => expect(reglage()).toHaveLength(2))

    await user.click(reglage()[0])

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Notisinställningen kunde inte sparas',
    )
    expect(hook.unsubscribe).not.toHaveBeenCalled()
    expect(arPa(reglage()[0])).toBe(true)
  })

  it('avstängning när en annan kategori är kvar på: enheten behålls', async () => {
    pushMock.fetchPushSettings.mockResolvedValue({
      pushEnabled: true,
      pushNyaHandelser: true,
      pushNyVersion: true,
    })
    const user = userEvent.setup()
    renderaKort()
    await waitFor(() => expect(reglage()).toHaveLength(2))

    await user.click(reglage()[0])

    await waitFor(() =>
      expect(pushMock.savePushSettings).toHaveBeenCalledWith({ pushNyaHandelser: false }),
    )
    expect(hook.unsubscribe).not.toHaveBeenCalled()
  })
})
