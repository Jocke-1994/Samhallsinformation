import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { changePassword } from '../api/auth'

function svar(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status })
}

describe('changePassword (API-klient, V1-1)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    localStorage.setItem('si_token', 'access-token')
    localStorage.setItem('si_refresh_token', 'enhetens-refresh')
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('gör PUT mot /api/auth/me/password med båda lösenorden och enhetens refresh-token', async () => {
    fetchMock.mockResolvedValue(svar(200, { message: 'ok' }))

    await changePassword('gammalt', 'helt-nytt-losen')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/me/password')
    expect(init.method).toBe('PUT')
    expect(init.headers.Authorization).toBe('Bearer access-token')
    expect(JSON.parse(init.body)).toEqual({
      currentPassword: 'gammalt',
      newPassword: 'helt-nytt-losen',
      refreshToken: 'enhetens-refresh',
    })
  })

  it('kastar serverns svenska felmeddelande vid 400', async () => {
    fetchMock.mockResolvedValue(svar(400, { error: 'Nuvarande lösenord stämmer inte' }))
    await expect(changePassword('fel', 'helt-nytt-losen')).rejects.toThrow('Nuvarande lösenord stämmer inte')
  })

  it('ger begripliga texter för 401, 429, 5xx och nätverksfel', async () => {
    fetchMock.mockResolvedValueOnce(svar(401))
    await expect(changePassword('a', 'b')).rejects.toThrow(/session har gått ut/)

    fetchMock.mockResolvedValueOnce(svar(429))
    await expect(changePassword('a', 'b')).rejects.toThrow(/För många försök/)

    fetchMock.mockResolvedValueOnce(svar(500))
    await expect(changePassword('a', 'b')).rejects.toThrow(/Något gick fel/)

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(changePassword('a', 'b')).rejects.toThrow(/Kunde inte nå servern/)
  })
})
