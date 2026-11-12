import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuth } from '../context/AuthContext'
import { AuthMedQuery } from './authMedQuery'

// V3-13 (E5#9): webbläsarens push-prenumeration får inte överleva utloggningen.
// Vid kontrollerad utloggning och vid sessionsslut (refresh-token avvisad)
// avregistreras enheten på servern och prenumerationen släpps i webbläsaren —
// båda best effort, aldrig blockerande. Tillfälliga refresh-fel (429/5xx/nät)
// avslutar inte sessionen och rör därför inte prenumerationen.

const NU = new Date('2026-09-25T12:00:00Z').getTime()
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123'

function skapaJwt(expMs: number): string {
  const payload = { role: 'Användare', exp: Math.floor(expMs / 1000) }
  return `x.${btoa(JSON.stringify(payload))}.x`
}

function Panel() {
  const { isLoggedIn, logout } = useAuth()
  return (
    <div>
      <div data-testid="status">{isLoggedIn ? 'inloggad' : 'utloggad'}</div>
      <button onClick={logout}>Logga ut</button>
    </div>
  )
}

const fetchMock = vi.fn()
const unsubscribeMock = vi.fn()
const getSubscriptionMock = vi.fn()
const getRegistrationMock = vi.fn()

function installeraServiceWorker() {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: getRegistrationMock },
  })
}

function renderaInloggad(minuter = 15) {
  const token = skapaJwt(Date.now() + minuter * 60_000)
  localStorage.setItem('si_token', token)
  localStorage.setItem('si_refresh_token', 'refresh-1')
  render(
    <AuthMedQuery>
      <Panel />
    </AuthMedQuery>,
  )
  return token
}

const anropTill = (slutPa: string, metod?: string) =>
  fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).endsWith(slutPa) &&
      (!metod || (init as RequestInit | undefined)?.method === metod),
  )

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
  unsubscribeMock.mockReset().mockResolvedValue(true)
  getSubscriptionMock
    .mockReset()
    .mockResolvedValue({ endpoint: ENDPOINT, unsubscribe: unsubscribeMock })
  getRegistrationMock
    .mockReset()
    .mockResolvedValue({ pushManager: { getSubscription: getSubscriptionMock } })
  vi.stubGlobal('fetch', fetchMock)
  installeraServiceWorker()
})

afterEach(() => {
  vi.unstubAllGlobals()
  // @ts-expect-error — städar bort testets egen navigator.serviceWorker
  delete navigator.serviceWorker
})

describe('Utloggning avregistrerar enheten (V3-13)', () => {
  it('kontrollerad utloggning: servern får DELETE med användarens token och webbläsaren släpper prenumerationen', async () => {
    const user = userEvent.setup()
    const token = renderaInloggad()

    await user.click(screen.getByRole('button', { name: 'Logga ut' }))

    await waitFor(() => expect(unsubscribeMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(anropTill('/api/push/subscribe', 'DELETE')).toHaveLength(1))
    const [, init] = anropTill('/api/push/subscribe', 'DELETE')[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({ endpoint: ENDPOINT })
    // Token fångas före rensningen — anropet hade annars gått ut utan Authorization.
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`)
    expect(screen.getByTestId('status')).toHaveTextContent('utloggad')
  })

  it('utan prenumeration i webbläsaren görs inget serveranrop', async () => {
    getSubscriptionMock.mockResolvedValue(null)
    const user = userEvent.setup()
    renderaInloggad()

    await user.click(screen.getByRole('button', { name: 'Logga ut' }))

    await waitFor(() => expect(getSubscriptionMock).toHaveBeenCalled())
    expect(anropTill('/api/push/subscribe')).toHaveLength(0)
    expect(unsubscribeMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('status')).toHaveTextContent('utloggad')
  })

  it('fel i webbläsarens unsubscribe blockerar inte utloggningen, och serveranropet går ändå', async () => {
    unsubscribeMock.mockRejectedValue(new Error('unsubscribe kraschade'))
    const user = userEvent.setup()
    renderaInloggad()

    await user.click(screen.getByRole('button', { name: 'Logga ut' }))

    expect(screen.getByTestId('status')).toHaveTextContent('utloggad')
    expect(localStorage.getItem('si_token')).toBeNull()
    await waitFor(() => expect(anropTill('/api/push/subscribe', 'DELETE')).toHaveLength(1))
  })

  it.each([
    [
      'nätverksfel',
      () =>
        fetchMock.mockImplementation((url: string) =>
          String(url).endsWith('/api/push/subscribe')
            ? Promise.reject(new TypeError('Failed to fetch'))
            : Promise.resolve(new Response('{}')),
        ),
    ],
    [
      'serverfel 500',
      () =>
        fetchMock.mockImplementation((url: string) =>
          Promise.resolve(
            new Response('{}', { status: String(url).endsWith('/api/push/subscribe') ? 500 : 200 }),
          ),
        ),
    ],
  ])(
    '%s vid serveravregistreringen blockerar inte utloggningen, och webbläsaren släpper ändå prenumerationen',
    async (_namn, satt) => {
      satt()
      const user = userEvent.setup()
      renderaInloggad()

      await user.click(screen.getByRole('button', { name: 'Logga ut' }))

      expect(screen.getByTestId('status')).toHaveTextContent('utloggad')
      await waitFor(() => expect(unsubscribeMock).toHaveBeenCalledTimes(1))
    },
  )

  it('getRegistration som kastar blockerar inte utloggningen', async () => {
    getRegistrationMock.mockRejectedValue(new Error('ingen service worker'))
    const user = userEvent.setup()
    renderaInloggad()

    await user.click(screen.getByRole('button', { name: 'Logga ut' }))

    await waitFor(() => expect(getRegistrationMock).toHaveBeenCalled())
    expect(screen.getByTestId('status')).toHaveTextContent('utloggad')
    expect(localStorage.getItem('si_refresh_token')).toBeNull()
  })

  it('webbläsare utan service worker: utloggningen fungerar som vanligt', async () => {
    // @ts-expect-error — simulerar en miljö utan navigator.serviceWorker
    delete navigator.serviceWorker
    const user = userEvent.setup()
    renderaInloggad()

    await user.click(screen.getByRole('button', { name: 'Logga ut' }))

    expect(screen.getByTestId('status')).toHaveTextContent('utloggad')
    expect(anropTill('/api/push/subscribe')).toHaveLength(0)
  })
})

describe('Sessionsslut vs tillfälliga fel (V3-13)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NU)
  })

  async function spolaTillRefresh() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13 * 60_000 + 1000)
    })
  }

  function renderaMedFakeTimers() {
    localStorage.setItem('si_token', skapaJwt(NU + 15 * 60_000))
    localStorage.setItem('si_refresh_token', 'refresh-1')
    render(
      <AuthMedQuery>
        <Panel />
      </AuthMedQuery>,
    )
  }

  it('refresh-token avvisad (401): sessionen slutar och enheten avregistreras i webbläsaren', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }))
    renderaMedFakeTimers()

    await spolaTillRefresh()

    expect(screen.getByTestId('status')).toHaveTextContent('utloggad')
    expect(unsubscribeMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['429', () => fetchMock.mockResolvedValue(new Response('{}', { status: 429 }))],
    ['500', () => fetchMock.mockResolvedValue(new Response('{}', { status: 500 }))],
    ['nätverksfel', () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))],
  ])(
    'tillfälligt refresh-fel (%s): sessionen består och prenumerationen rörs inte',
    async (_namn, satt) => {
      satt()
      renderaMedFakeTimers()

      await spolaTillRefresh()

      expect(screen.getByTestId('status')).toHaveTextContent('inloggad')
      expect(getRegistrationMock).not.toHaveBeenCalled()
      expect(unsubscribeMock).not.toHaveBeenCalled()
      expect(anropTill('/api/push/subscribe')).toHaveLength(0)
    },
  )
})
