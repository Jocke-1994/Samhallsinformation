import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { AuthProvider, useAuth } from '../context/AuthContext'

// Regressionstester för V1-4 (E5#2, E5#8): refresh får bara logga ut användaren
// när servern avvisar refresh-token (401/403), och schemaläggningen får aldrig
// bli en tät loop vid klockskillnad.

const NU = new Date('2026-09-25T12:00:00Z').getTime()

// Minimal JWT (osignerad — klienten avkodar bara payloaden).
function skapaJwt(expMs: number, extra: Record<string, unknown> = {}): string {
  const payload = { role: 'Användare', exp: Math.floor(expMs / 1000), ...extra }
  return `x.${btoa(JSON.stringify(payload))}.x`
}

function tokenSvar(access: string, refresh: string): Response {
  return new Response(JSON.stringify({ accessToken: access, refreshToken: refresh }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function Status() {
  const { isLoggedIn } = useAuth()
  return <div data-testid="status">{isLoggedIn ? 'inloggad' : 'utloggad'}</div>
}

// Seedar en inloggad session vars access-token går ut om `minuter` minuter.
function renderaInloggad(minuter = 15) {
  localStorage.setItem('si_token', skapaJwt(NU + minuter * 60_000))
  localStorage.setItem('si_refresh_token', 'refresh-1')
  return render(<AuthProvider><Status /></AuthProvider>)
}

const status = () => screen.getByTestId('status').textContent
const refreshAnrop = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/auth/refresh'))

// Spola fram tiden så att den schemalagda refreshen (13 min) avfyras och anropet hinner klart.
async function spolaTillRefresh() {
  await act(async () => { await vi.advanceTimersByTimeAsync(13 * 60_000 + 1000) })
}

describe('AuthContext — refresh-felhantering', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NU)
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('401 från servern loggar ut och rensar lagrade tokens', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }))
    renderaInloggad()
    expect(status()).toBe('inloggad')

    await spolaTillRefresh()

    expect(status()).toBe('utloggad')
    expect(localStorage.getItem('si_token')).toBeNull()
    expect(localStorage.getItem('si_refresh_token')).toBeNull()
    expect(refreshAnrop(fetchMock)).toHaveLength(1)
  })

  it('403 (avstängt konto) loggar ut', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 403 }))
    renderaInloggad()

    await spolaTillRefresh()

    expect(status()).toBe('utloggad')
    expect(localStorage.getItem('si_refresh_token')).toBeNull()
  })

  it('429 behåller sessionen och försöker igen efter Retry-After', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '45' } }))
      .mockResolvedValueOnce(tokenSvar(skapaJwt(NU + 40 * 60_000), 'refresh-2'))
    renderaInloggad()

    await spolaTillRefresh()
    expect(status()).toBe('inloggad')
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-1')
    expect(refreshAnrop(fetchMock)).toHaveLength(1)

    // Retry-After 45 s > basbackoff 10 s: inget nytt försök före 45 s (1 s har redan gått) ...
    await act(async () => { await vi.advanceTimersByTimeAsync(43_000) })
    expect(refreshAnrop(fetchMock)).toHaveLength(1)
    // ... men ett efter.
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(refreshAnrop(fetchMock)).toHaveLength(2)
    expect(status()).toBe('inloggad')
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-2')
  })

  it('500 behåller sessionen och försöker igen med backoff', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response('{}', { status: 502 }))
      .mockResolvedValueOnce(tokenSvar(skapaJwt(NU + 40 * 60_000), 'refresh-2'))
    renderaInloggad()

    await spolaTillRefresh()
    expect(status()).toBe('inloggad')
    expect(refreshAnrop(fetchMock)).toHaveLength(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) }) // första omförsöket, backoff 10 s
    expect(refreshAnrop(fetchMock)).toHaveLength(2)
    expect(status()).toBe('inloggad')

    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) }) // andra omförsöket, backoff 20 s
    expect(refreshAnrop(fetchMock)).toHaveLength(3)
    expect(status()).toBe('inloggad')
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-2')
  })

  it('nätverksfel (fetch kastar) behåller sessionen och försöker igen', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(tokenSvar(skapaJwt(NU + 40 * 60_000), 'refresh-2'))
    renderaInloggad()

    await spolaTillRefresh()
    expect(status()).toBe('inloggad')
    expect(localStorage.getItem('si_token')).not.toBeNull()
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-1')

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(refreshAnrop(fetchMock)).toHaveLength(2)
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-2')
    expect(status()).toBe('inloggad')
  })

  it('ger upp efter max antal försök men behåller sessionen', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }))
    renderaInloggad()

    await spolaTillRefresh()
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 60_000) })

    expect(refreshAnrop(fetchMock)).toHaveLength(6)
    expect(status()).toBe('inloggad')
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-1')
  })

  it('lyckad refresh sparar de nya tokens', async () => {
    const nyAccess = skapaJwt(NU + 28 * 60_000)
    fetchMock.mockResolvedValue(tokenSvar(nyAccess, 'refresh-2'))
    renderaInloggad()

    await spolaTillRefresh()

    expect(status()).toBe('inloggad')
    expect(localStorage.getItem('si_token')).toBe(nyAccess)
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-2')
    const body = JSON.parse(String(refreshAnrop(fetchMock)[0][1]?.body))
    expect(body).toEqual({ refreshToken: 'refresh-1' })
  })

  it('utloggning under pågående refresh återupplivar inte sessionen', async () => {
    let svara!: (r: Response) => void
    fetchMock.mockImplementation((url: string) =>
      String(url).endsWith('/api/auth/refresh')
        ? new Promise<Response>(res => { svara = res })
        : Promise.resolve(new Response('{}')),
    )
    function MedLogout() {
      const { logout } = useAuth()
      return <button onClick={logout}>ut</button>
    }
    localStorage.setItem('si_token', skapaJwt(NU + 15 * 60_000))
    localStorage.setItem('si_refresh_token', 'refresh-1')
    render(<AuthProvider><Status /><MedLogout /></AuthProvider>)

    await spolaTillRefresh() // refresh är nu "på väg"
    act(() => { screen.getByText('ut').click() })
    expect(status()).toBe('utloggad')

    await act(async () => { svara(tokenSvar(skapaJwt(NU + 40 * 60_000), 'refresh-2')) })
    expect(status()).toBe('utloggad')
    expect(localStorage.getItem('si_refresh_token')).toBeNull()
  })
})

describe('AuthContext — schemaläggning (klockskillnad)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NU)
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('utgången token vid start (inläst ur localStorage) refreshas direkt, utan golv', async () => {
    fetchMock.mockResolvedValue(tokenSvar(skapaJwt(NU + 15 * 60_000), 'refresh-2'))
    localStorage.setItem('si_token', skapaJwt(NU - 5 * 60_000))
    localStorage.setItem('si_refresh_token', 'refresh-1')
    render(<AuthProvider><Status /></AuthProvider>)

    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    expect(refreshAnrop(fetchMock)).toHaveLength(1)
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-2')
  })

  it('nästan utgången token vid start (under marginalen) refreshas direkt', async () => {
    fetchMock.mockResolvedValue(tokenSvar(skapaJwt(NU + 15 * 60_000), 'refresh-2'))
    localStorage.setItem('si_token', skapaJwt(NU + 60_000))
    localStorage.setItem('si_refresh_token', 'refresh-1')
    render(<AuthProvider><Status /></AuthProvider>)

    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    expect(refreshAnrop(fetchMock)).toHaveLength(1)
  })

  it('färsk token från login med klockan 20 min före ger golv 30 s, inte omedelbar refresh', async () => {
    // Klockan går 20 min före servern: en färsk 15-min-token ser ut att ha gått ut för 5 min sedan.
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith('/api/auth/login')
          ? tokenSvar(skapaJwt(NU - 5 * 60_000), 'refresh-1')
          : new Response('{}', { status: 401 }),
      ),
    )
    function MedLogin() {
      const { login } = useAuth()
      return <button onClick={() => { void login('a@b.se', 'x') }}>in</button>
    }
    render(<AuthProvider><Status /><MedLogin /></AuthProvider>)

    await act(async () => { screen.getByText('in').click() })
    expect(status()).toBe('inloggad')

    await act(async () => { await vi.advanceTimersByTimeAsync(29_000) })
    expect(refreshAnrop(fetchMock)).toHaveLength(0)

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(refreshAnrop(fetchMock)).toHaveLength(1)
  })

  it('refresh vid klockskillnad blir ingen tät loop: första direkt, sedan högst ett anrop per 30 s', async () => {
    // Varje refresh ger en token som (p.g.a. klockskillnaden) ser utgången ut direkt.
    // (-6 min mot -5 min i localStorage: varje token måste skilja sig från den förra för att effekten ska köras om.)
    fetchMock.mockImplementation(() => Promise.resolve(tokenSvar(skapaJwt(Date.now() - 6 * 60_000), 'refresh-x')))
    localStorage.setItem('si_token', skapaJwt(NU - 5 * 60_000))
    localStorage.setItem('si_refresh_token', 'refresh-1')
    render(<AuthProvider><Status /></AuthProvider>)

    // En act per steg: React kör om effekten (och planerar nästa refresh) först när act avslutas.
    for (let i = 0; i < 10; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    }

    // Ett direkt (utgången token vid start) + 5 min / 30 s = högst 11 anrop (utan golv: tusentals).
    expect(refreshAnrop(fetchMock).length).toBeLessThanOrEqual(11)
    expect(refreshAnrop(fetchMock).length).toBeGreaterThan(1)
    expect(status()).toBe('inloggad')
  })
})
