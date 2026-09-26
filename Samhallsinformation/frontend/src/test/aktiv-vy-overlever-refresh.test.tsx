import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useAuth } from '../context/AuthContext'
import { valjAktivVy } from '../lib/aktivVy'
import { AuthMedQuery } from './authMedQuery'

// Regressionstester för V4-2 (E5#6): en admins valda vy (aktivVy) får inte
// snäppa tillbaka till rollen när access-token förnyas (~var 13:e minut).
// Vyn sätts bara när den saknas/är ogiltig för rollen eller när en annan
// användare loggar in.

const NU = new Date('2026-09-25T12:00:00Z').getTime()
const EPOST = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'

function skapaJwt(roll: string, epost: string, expMs: number): string {
  const payload = { role: roll, [EPOST]: epost, exp: Math.floor(expMs / 1000) }
  return `x.${btoa(JSON.stringify(payload))}.x`
}

function tokenSvar(access: string, refresh: string): Response {
  return new Response(JSON.stringify({ accessToken: access, refreshToken: refresh }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function Visa() {
  const { aktivVy, roll, byttVy, login } = useAuth()
  return (
    <div>
      <div data-testid="vy">{aktivVy}</div>
      <div data-testid="roll">{roll}</div>
      <button onClick={() => byttVy('Support')}>till-support</button>
      <button onClick={() => { void login('annan@test.se', 'hemligt') }}>logga-in-annan</button>
    </div>
  )
}

const vy = () => screen.getByTestId('vy').textContent

function renderaSom(roll: string, lagradVy?: string, epost = 'admin@test.se') {
  localStorage.setItem('si_token', skapaJwt(roll, epost, NU + 15 * 60_000))
  localStorage.setItem('si_refresh_token', 'refresh-1')
  if (lagradVy) localStorage.setItem('si_aktiv_vy', lagradVy)
  return render(<AuthMedQuery><Visa /></AuthMedQuery>)
}

async function spolaTillRefresh() {
  await act(async () => { await vi.advanceTimersByTimeAsync(13 * 60_000 + 1000) })
}

describe('aktivVy vid tokenförnyelse (V4-2, E5#6)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NU)
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('en admin som valt Support-vyn behåller den efter förnyelse', async () => {
    fetchMock.mockResolvedValue(tokenSvar(skapaJwt('Admin', 'admin@test.se', NU + 40 * 60_000), 'refresh-2'))
    renderaSom('Admin')
    expect(vy()).toBe('Admin')

    act(() => { screen.getByText('till-support').click() })
    expect(vy()).toBe('Support')

    await spolaTillRefresh()

    expect(fetchMock).toHaveBeenCalled()
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-2') // förnyelsen gick igenom
    expect(vy()).toBe('Support')
    expect(localStorage.getItem('si_aktiv_vy')).toBe('Support')
  })

  it('saknad vy sätts till rollen vid förnyelsen', async () => {
    fetchMock.mockResolvedValue(tokenSvar(skapaJwt('Admin', 'admin@test.se', NU + 40 * 60_000), 'refresh-2'))
    renderaSom('Admin')
    localStorage.removeItem('si_aktiv_vy')

    await spolaTillRefresh()

    expect(vy()).toBe('Admin')
    expect(localStorage.getItem('si_aktiv_vy')).toBe('Admin')
  })

  it('en vy som blivit ogiltig för rollen (Admin -> Support-konto) ersätts av rollen', async () => {
    // Kontot är nu Support men den lagrade vyn är kvar från en tidigare admin-roll.
    fetchMock.mockResolvedValue(tokenSvar(skapaJwt('Support', 'admin@test.se', NU + 40 * 60_000), 'refresh-2'))
    renderaSom('Admin', 'Admin')
    expect(vy()).toBe('Admin')

    await spolaTillRefresh()

    expect(vy()).toBe('Support')
    expect(localStorage.getItem('si_aktiv_vy')).toBe('Support')
  })

  it('ett Support-konto med en gammal Admin-vy i lagringen hamnar aldrig på Admin-vyn', () => {
    renderaSom('Support', 'Admin', 'support@test.se')
    expect(vy()).toBe('Support')
  })

  it('en annan användare som loggar in får sin rolls startvy, inte den förras val', async () => {
    fetchMock.mockResolvedValue(tokenSvar(skapaJwt('Admin', 'annan@test.se', NU + 40 * 60_000), 'refresh-9'))
    renderaSom('Admin')
    act(() => { screen.getByText('till-support').click() })
    expect(vy()).toBe('Support')

    await act(async () => { screen.getByText('logga-in-annan').click() })

    expect(vy()).toBe('Admin')
  })
})

describe('valjAktivVy', () => {
  it('behåller giltig vy och faller annars tillbaka på rollen', () => {
    expect(valjAktivVy('Support', 'Admin')).toBe('Support')
    expect(valjAktivVy('Användare', 'Admin')).toBe('Användare')
    expect(valjAktivVy('Admin', 'Support')).toBe('Support')
    expect(valjAktivVy('Admin', 'Användare')).toBe('Användare')
    expect(valjAktivVy('Support', 'Användare')).toBe('Användare')
    expect(valjAktivVy(null, 'Admin')).toBe('Admin')
    expect(valjAktivVy('skräp', 'Support')).toBe('Support')
  })
})
