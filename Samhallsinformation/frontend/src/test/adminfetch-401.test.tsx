import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { adminFetch } from '../api/adminFetch'
import { registerAuthBridge } from '../api/authBridge'
import { changePassword } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { AuthMedQuery } from './authMedQuery'

// Regressionstester för V1-8 (E5#4): adminFetch förnyar sessionen EN gång vid
// 401 (delad single-flight-refresh) och gör om anropet EN gång. Ingen loop, ingen
// utloggning här, andra fel opåverkade.

const svar = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status })
const auth = (init: RequestInit | undefined) => (init?.headers as Record<string, string>).Authorization

describe('adminFetch — 401-hantering med brobaserad refresh', () => {
  const fetchMock = vi.fn()
  let token: string | null
  const refresh = vi.fn()
  let avregistrera: () => void

  beforeEach(() => {
    fetchMock.mockReset()
    refresh.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    token = 'gammal'
    avregistrera = registerAuthBridge({ getToken: () => token, refresh })
  })
  afterEach(() => {
    avregistrera()
    vi.unstubAllGlobals()
  })

  it('401 -> refresh -> omförsök med den nya token lyckas', async () => {
    refresh.mockImplementation(async () => { token = 'ny' })
    fetchMock
      .mockResolvedValueOnce(svar(401))
      .mockResolvedValueOnce(svar(200, { ok: true }))

    const res = await adminFetch('/api/x', { method: 'POST', body: '{"a":1}' })

    expect(res.status).toBe(200)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(auth(fetchMock.mock.calls[0][1])).toBe('Bearer gammal')
    expect(auth(fetchMock.mock.calls[1][1])).toBe('Bearer ny')
    expect(fetchMock.mock.calls[1][1].body).toBe('{"a":1}')
  })

  it('401 -> refresh misslyckas (ingen ny token) -> 401 returneras, inget omförsök', async () => {
    refresh.mockImplementation(async () => { token = null }) // t.ex. sessionen avslutad av AuthProvider
    fetchMock.mockResolvedValue(svar(401))

    const res = await adminFetch('/api/x')

    expect(res.status).toBe(401)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refresh som kastar eller lämnar token oförändrad -> 401 returneras, ingen loop', async () => {
    refresh.mockRejectedValue(new Error('nätverk'))
    fetchMock.mockResolvedValue(svar(401))

    const res = await adminFetch('/api/x')

    expect(res.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('401 även efter omförsöket -> returneras, exakt ett omförsök och en refresh', async () => {
    refresh.mockImplementation(async () => { token = 'ny' })
    fetchMock.mockResolvedValue(svar(401))

    const res = await adminFetch('/api/x')

    expect(res.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('två parallella 401 ger EN refresh (single-flight) och båda anropen lyckas', async () => {
    let klar!: () => void
    refresh.mockImplementation(() => new Promise<void>(r => { klar = () => { token = 'ny'; r() } }))
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) =>
      auth(init) === 'Bearer ny' ? svar(200) : svar(401))

    const a = adminFetch('/api/a')
    const b = adminFetch('/api/b')
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    klar()
    const [ra, rb] = await Promise.all([a, b])

    expect([ra.status, rb.status]).toEqual([200, 200])
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('token redan förnyad av annan (timer) när 401 kommer -> omförsök utan ny refresh', async () => {
    fetchMock.mockImplementationOnce(async () => { token = 'ny'; return svar(401) })
    fetchMock.mockResolvedValueOnce(svar(200))

    const res = await adminFetch('/api/x')

    expect(res.status).toBe(200)
    expect(refresh).not.toHaveBeenCalled()
    expect(auth(fetchMock.mock.calls[1][1])).toBe('Bearer ny')
  })

  it('icke-401-fel (403, 404, 500) och lyckade svar påverkas inte', async () => {
    for (const status of [200, 403, 404, 500]) {
      fetchMock.mockResolvedValueOnce(svar(status))
      const res = await adminFetch('/api/x')
      expect(res.status).toBe(status)
    }
    expect(refresh).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('401 utan skickad token (ej inloggad) förnyar inget', async () => {
    token = null
    fetchMock.mockResolvedValue(svar(401))

    const res = await adminFetch('/api/x')

    expect(res.status).toBe(401)
    expect(refresh).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('changePassword skickar den NYA refresh-token i omförsöket (body byggs om)', async () => {
    localStorage.setItem('si_refresh_token', 'refresh-1')
    refresh.mockImplementation(async () => { token = 'ny'; localStorage.setItem('si_refresh_token', 'refresh-2') })
    fetchMock
      .mockResolvedValueOnce(svar(401))
      .mockResolvedValueOnce(svar(200))

    await changePassword('gammalt', 'helt-nytt-losen')

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).refreshToken).toBe('refresh-1')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).refreshToken).toBe('refresh-2')
  })
})

// Med den riktiga AuthProvider: bron ska dela providerns single-flight-refresh.
describe('adminFetch + AuthProvider — en gemensam refresh', () => {
  const fetchMock = vi.fn()

  function jwt(): string {
    return `x.${btoa(JSON.stringify({ role: 'Användare', exp: Math.floor(Date.now() / 1000) + 3600 }))}.x`
  }

  function Sond({ onAuth }: { onAuth: (a: ReturnType<typeof useAuth>) => void }) {
    onAuth(useAuth())
    return <div>ok</div>
  }

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('parallella 401 + providerns egen refresh ger exakt ett /api/auth/refresh-anrop', async () => {
    const fornyad = jwt()
    // Utgången token: providerns startrefresh (delay 0) körs samtidigt som anropen
    localStorage.setItem('si_token', `x.${btoa(JSON.stringify({ role: 'Användare', exp: 1 }))}.x`)
    localStorage.setItem('si_refresh_token', 'refresh-1')

    let refreshAnrop = 0
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (String(url).endsWith('/api/auth/refresh')) {
        refreshAnrop++
        await new Promise(r => setTimeout(r, 20))
        return svar(200, { accessToken: fornyad, refreshToken: 'refresh-2' })
      }
      return auth(init) === `Bearer ${fornyad}` ? svar(200) : svar(401)
    })

    render(<AuthMedQuery><Sond onAuth={() => {}} /></AuthMedQuery>)
    await screen.findByText('ok')

    const [a, b, c] = await act(async () =>
      Promise.all([adminFetch('/api/a'), adminFetch('/api/b'), adminFetch('/api/c')]))

    expect([a.status, b.status, c.status]).toEqual([200, 200, 200])
    // Providerns startrefresh och 401-vägen delar en och samma refresh.
    expect(refreshAnrop).toBe(1)
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-2')
  })
})
