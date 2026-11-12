import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import type { QueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { AuthMedQuery, skapaTestKlient } from './authMedQuery'
import { rensaAnvandardata } from '../lib/queryRensning'
import {
  anvandarKallorNyckel,
  kontoNotiserNyckel,
  meNyckel,
  minaArendenNyckel,
  mittArendeNyckel,
  supportNotiserNyckel,
} from '../lib/queryNycklar'

// Regressionstester för V3-12 (E5#3, E5#7): sessionen synkas mellan flikar via
// storage-händelser, refresh serialiseras mellan flikar med Web Locks, en 401 som
// beror på att en annan flik hann före rensar inte den delade lagringen, och
// react-query-cachen töms när sessionen tar slut. "Andra fliken" simuleras med
// syntetiska StorageEvent + direkta skrivningar till localStorage, "flera flikar"
// med flera providers som delar localStorage.

const NU = new Date('2026-09-25T12:00:00Z').getTime()
const EPOST_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'

// Minimal JWT (osignerad — klienten avkodar bara payloaden).
function skapaJwt(expMs: number, extra: Record<string, unknown> = {}): string {
  const payload = {
    role: 'Användare',
    exp: Math.floor(expMs / 1000),
    [EPOST_CLAIM]: 'a@b.se',
    ...extra,
  }
  return `x.${btoa(JSON.stringify(payload))}.x`
}

function tokenSvar(access: string, refresh: string): Response {
  return new Response(JSON.stringify({ accessToken: access, refreshToken: refresh }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function Sond({ id = 'sond' }: { id?: string }) {
  const { isLoggedIn, accessToken, logout, refreshSession } = useAuth()
  return (
    <div>
      <div data-testid={`${id}-status`}>{isLoggedIn ? 'inloggad' : 'utloggad'}</div>
      <div data-testid={`${id}-token`}>{accessToken ?? ''}</div>
      <button onClick={logout}>logga-ut</button>
      <button
        onClick={() => {
          void refreshSession()
        }}
      >
        refresha
      </button>
    </div>
  )
}

const status = (id = 'sond') => screen.getByTestId(`${id}-status`).textContent
const tokenText = (id = 'sond') => screen.getByTestId(`${id}-token`).textContent

const anrop = (fetchMock: ReturnType<typeof vi.fn>, slut: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith(slut))
const refreshAnrop = (fetchMock: ReturnType<typeof vi.fn>) => anrop(fetchMock, '/api/auth/refresh')
const refreshBody = (fetchMock: ReturnType<typeof vi.fn>, i: number) =>
  JSON.parse(String(refreshAnrop(fetchMock)[i][1]?.body)) as { refreshToken: string }

function seeda(minuter = 15, refresh = 'refresh-1') {
  localStorage.setItem('si_token', skapaJwt(NU + minuter * 60_000))
  localStorage.setItem('si_refresh_token', refresh)
  localStorage.setItem('si_logged_in', 'true')
}

// Det en annan flik gör mot den delade localStorage (skrivningar syns direkt här,
// själva storage-händelsen levereras av webbläsaren bara till OVRIGA flikar).
function annanFlikSkriver(access: string, refresh: string) {
  localStorage.setItem('si_token', access)
  localStorage.setItem('si_refresh_token', refresh)
  localStorage.setItem('si_logged_in', 'true')
}

function skickaStorageEvent(key: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }))
  })
}

async function spolaTillRefresh() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(13 * 60_000 + 1000)
  })
}

// Fejkade Web Locks: exklusiv kö per namn, som navigator.locks.request.
function installeraFejkadeLas() {
  let kedja: Promise<unknown> = Promise.resolve()
  const request = vi.fn((_namn: string, cb: () => Promise<unknown>) => {
    const kor = kedja.then(() => cb())
    kedja = kor.catch(() => {
      /* låset släpps även om callbacken kastar */
    })
    return kor
  })
  Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true })
  return request
}

describe('flikar — storage-synk av sessionen', () => {
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

  it('nya tokens från en annan flik adopteras utan nätanrop, och nästa refresh använder den nya refresh-token', async () => {
    seeda()
    render(
      <AuthMedQuery>
        <Sond />
      </AuthMedQuery>,
    )
    const nyAccess = skapaJwt(NU + 28 * 60_000)

    annanFlikSkriver(nyAccess, 'refresh-2')
    skickaStorageEvent('si_token')

    expect(tokenText()).toBe(nyAccess)
    expect(status()).toBe('inloggad')
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockResolvedValue(tokenSvar(skapaJwt(NU + 40 * 60_000), 'refresh-3'))
    await act(async () => {
      screen.getByText('refresha').click()
    })
    expect(refreshAnrop(fetchMock)).toHaveLength(1)
    expect(refreshBody(fetchMock, 0)).toEqual({ refreshToken: 'refresh-2' })
  })

  it('adoption schemalägger nästa refresh utifrån den nya token (inte den gamla)', async () => {
    seeda(15)
    fetchMock.mockResolvedValue(tokenSvar(skapaJwt(NU + 60 * 60_000), 'refresh-9'))
    render(
      <AuthMedQuery>
        <Sond />
      </AuthMedQuery>,
    )

    annanFlikSkriver(skapaJwt(NU + 60 * 60_000), 'refresh-2')
    skickaStorageEvent('si_refresh_token')

    // Den gamla token (15 min) hade refreshats efter 13 min — den nya (60 min) först efter 58 min.
    await spolaTillRefresh()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('adoption nollställer ett väntande omförsök', async () => {
    seeda()
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }))
    render(
      <AuthMedQuery>
        <Sond />
      </AuthMedQuery>,
    )

    await spolaTillRefresh() // refresh -> 500 -> omförsök om 10 s
    expect(refreshAnrop(fetchMock)).toHaveLength(1)

    annanFlikSkriver(skapaJwt(NU + 60 * 60_000), 'refresh-2')
    skickaStorageEvent('si_token')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(refreshAnrop(fetchMock)).toHaveLength(1)
    expect(status()).toBe('inloggad')
  })

  it('när en annan flik loggar ut (nycklarna raderas) loggas den här ut lokalt utan /logout-anrop', async () => {
    seeda()
    const klient = skapaTestKlient()
    klient.setQueryData(['user-sources', 'a@b.se'], [{ sourceId: 1 }])
    render(
      <AuthMedQuery klient={klient}>
        <Sond />
      </AuthMedQuery>,
    )
    expect(status()).toBe('inloggad')

    localStorage.removeItem('si_token')
    localStorage.removeItem('si_refresh_token')
    localStorage.removeItem('si_logged_in')
    skickaStorageEvent('si_token')

    expect(status()).toBe('utloggad')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(klient.getQueryData(['user-sources', 'a@b.se'])).toBeUndefined()

    // Ingen refresh-timer lever kvar för den avslutade sessionen.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60_000)
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('localStorage.clear() i en annan flik (key === null) loggar också ut lokalt', () => {
    seeda()
    render(
      <AuthMedQuery>
        <Sond />
      </AuthMedQuery>,
    )

    localStorage.clear()
    skickaStorageEvent(null)

    expect(status()).toBe('utloggad')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('orelaterade localStorage-nycklar påverkar inte sessionen', () => {
    seeda()
    render(
      <AuthMedQuery>
        <Sond />
      </AuthMedQuery>,
    )
    const fore = tokenText()

    localStorage.setItem('theme', 'dark')
    skickaStorageEvent('theme')

    expect(tokenText()).toBe(fore)
    expect(status()).toBe('inloggad')
  })
})

describe('flikar — 401 när en annan flik hann före', () => {
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

  it('401 men lagringen har en nyare refresh-token: adopterar den och försöker en gång till, ingen utloggning', async () => {
    const tokenFranAnnanFlik = skapaJwt(NU + 30 * 60_000)
    const slutligAccess = skapaJwt(NU + 50 * 60_000)
    let n = 0
    fetchMock.mockImplementation(() => {
      n++
      if (n === 1) {
        // Medan vårt anrop var på väg roterade en annan flik och skrev nya tokens.
        annanFlikSkriver(tokenFranAnnanFlik, 'refresh-2')
        return Promise.resolve(new Response('{}', { status: 401 }))
      }
      return Promise.resolve(tokenSvar(slutligAccess, 'refresh-3'))
    })
    seeda()
    render(
      <AuthMedQuery>
        <Sond />
      </AuthMedQuery>,
    )

    await spolaTillRefresh()

    expect(status()).toBe('inloggad')
    expect(refreshAnrop(fetchMock)).toHaveLength(2)
    expect(refreshBody(fetchMock, 0)).toEqual({ refreshToken: 'refresh-1' })
    expect(refreshBody(fetchMock, 1)).toEqual({ refreshToken: 'refresh-2' })
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-3')
    expect(localStorage.getItem('si_token')).toBe(slutligAccess)
    expect(tokenText()).toBe(slutligAccess)
  })

  it('bara ETT nytt försök: avvisas även den adopterade token loggas användaren ut', async () => {
    let n = 0
    fetchMock.mockImplementation(() => {
      n++
      if (n === 1) annanFlikSkriver(skapaJwt(NU + 30 * 60_000), 'refresh-2')
      return Promise.resolve(new Response('{}', { status: 401 }))
    })
    seeda()
    render(
      <AuthMedQuery>
        <Sond />
      </AuthMedQuery>,
    )

    await spolaTillRefresh()

    expect(refreshAnrop(fetchMock)).toHaveLength(2)
    expect(status()).toBe('utloggad')
    expect(localStorage.getItem('si_refresh_token')).toBeNull()
  })

  it('401 utan nyare token i lagringen loggar fortfarande ut och tömmer cachen (V1-4 oförändrat)', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }))
    seeda()
    const klient = skapaTestKlient()
    klient.setQueryData(['my-tickets', 'a@b.se'], [{ id: 1 }])
    render(
      <AuthMedQuery klient={klient}>
        <Sond />
      </AuthMedQuery>,
    )

    await spolaTillRefresh()

    expect(status()).toBe('utloggad')
    expect(localStorage.getItem('si_refresh_token')).toBeNull()
    expect(refreshAnrop(fetchMock)).toHaveLength(1)
    expect(klient.getQueryData(['my-tickets', 'a@b.se'])).toBeUndefined()
  })
})

describe('flikar — korsflik-lås för refresh', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NU)
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'locks')
  })

  it('två flikar som refreshar samtidigt ger EN /refresh-request; den andra adopterar resultatet', async () => {
    const lasRequest = installeraFejkadeLas()
    const nyAccess = skapaJwt(NU + 40 * 60_000)
    fetchMock.mockResolvedValue(tokenSvar(nyAccess, 'refresh-2'))
    seeda()
    // Två providers mot samma localStorage = två flikar (båda laddade samma token, samma timer).
    render(
      <>
        <AuthMedQuery>
          <Sond id="a" />
        </AuthMedQuery>
        <AuthMedQuery>
          <Sond id="b" />
        </AuthMedQuery>
      </>,
    )

    await spolaTillRefresh()

    expect(lasRequest).toHaveBeenCalledTimes(2)
    expect(lasRequest.mock.calls.every(([namn]) => namn === 'si-refresh')).toBe(true)
    expect(refreshAnrop(fetchMock)).toHaveLength(1)
    expect(refreshBody(fetchMock, 0)).toEqual({ refreshToken: 'refresh-1' })
    expect(status('a')).toBe('inloggad')
    expect(status('b')).toBe('inloggad')
    expect(tokenText('a')).toBe(nyAccess)
    expect(tokenText('b')).toBe(nyAccess)
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-2')
  })

  it('utan navigator.locks fungerar refresh som förut (fallback utan lås)', async () => {
    expect((navigator as { locks?: unknown }).locks).toBeUndefined()
    const nyAccess = skapaJwt(NU + 40 * 60_000)
    fetchMock.mockResolvedValue(tokenSvar(nyAccess, 'refresh-2'))
    seeda()
    render(
      <AuthMedQuery>
        <Sond />
      </AuthMedQuery>,
    )

    await spolaTillRefresh()

    expect(refreshAnrop(fetchMock)).toHaveLength(1)
    expect(tokenText()).toBe(nyAccess)
    expect(localStorage.getItem('si_refresh_token')).toBe('refresh-2')
  })

  it('en annan flik loggade ut medan vi väntade på låset: ingen /refresh, lokal utloggning', async () => {
    // Låset hålls av "andra fliken" tills vi släpper det.
    let slappLas!: () => void
    const hallet = new Promise<void>((res) => {
      slappLas = res
    })
    Object.defineProperty(navigator, 'locks', {
      value: { request: (_n: string, cb: () => Promise<unknown>) => hallet.then(() => cb()) },
      configurable: true,
    })
    seeda()
    render(
      <AuthMedQuery>
        <Sond />
      </AuthMedQuery>,
    )

    await spolaTillRefresh() // vi väntar nu på låset
    localStorage.removeItem('si_token')
    localStorage.removeItem('si_refresh_token')
    await act(async () => {
      slappLas()
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(status()).toBe('utloggad')
  })
})

describe('react-query-cachen töms vid sessionsslut', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NU)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function seedaCache(klient: QueryClient) {
    klient.setQueryData(anvandarKallorNyckel('a@b.se'), [{ sourceId: 7, isActive: true }])
    klient.setQueryData(['admin-users'], [{ email: 'x@y.se' }])
    klient.setQueryData(['sources'], [{ id: 1 }])
  }

  it('logout tömmer användarspecifika queries men behåller publika (källistan)', () => {
    seeda()
    const klient = skapaTestKlient()
    seedaCache(klient)
    render(
      <AuthMedQuery klient={klient}>
        <Sond />
      </AuthMedQuery>,
    )

    act(() => {
      screen.getByText('logga-ut').click()
    })

    expect(status()).toBe('utloggad')
    expect(klient.getQueryData(anvandarKallorNyckel('a@b.se'))).toBeUndefined()
    expect(klient.getQueryData(['admin-users'])).toBeUndefined()
    expect(klient.getQueryData(['sources'])).toEqual([{ id: 1 }])
  })

  it('en avvisad refresh (401) tömmer användarspecifika queries', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }))
    seeda()
    const klient = skapaTestKlient()
    seedaCache(klient)
    render(
      <AuthMedQuery klient={klient}>
        <Sond />
      </AuthMedQuery>,
    )

    await spolaTillRefresh()

    expect(status()).toBe('utloggad')
    expect(klient.getQueryData(anvandarKallorNyckel('a@b.se'))).toBeUndefined()
    expect(klient.getQueryData(['sources'])).toEqual([{ id: 1 }])
  })

  it('en annan användare som loggas in via en annan flik (utan utloggning däremellan) ser inte förra användarens cache', () => {
    seeda()
    const klient = skapaTestKlient()
    seedaCache(klient)
    render(
      <AuthMedQuery klient={klient}>
        <Sond />
      </AuthMedQuery>,
    )

    annanFlikSkriver(skapaJwt(NU + 30 * 60_000, { [EPOST_CLAIM]: 'c@d.se' }), 'refresh-c')
    skickaStorageEvent('si_token')

    expect(status()).toBe('inloggad')
    expect(klient.getQueryData(anvandarKallorNyckel('a@b.se'))).toBeUndefined()
  })

  it('samma användare via en annan flik behåller cachen (bara tokenbyte)', () => {
    seeda()
    const klient = skapaTestKlient()
    seedaCache(klient)
    render(
      <AuthMedQuery klient={klient}>
        <Sond />
      </AuthMedQuery>,
    )

    annanFlikSkriver(skapaJwt(NU + 30 * 60_000), 'refresh-2')
    skickaStorageEvent('si_token')

    expect(klient.getQueryData(anvandarKallorNyckel('a@b.se'))).toBeDefined()
  })
})

describe('användar-id i query-nycklar', () => {
  it('två användare delar aldrig cache-post: nycklarna skiljer sig men har samma prefix', () => {
    const byggare: Array<[string, (a: string | null) => readonly unknown[]]> = [
      ['user-sources', anvandarKallorNyckel],
      ['me', meNyckel],
      ['my-tickets', minaArendenNyckel],
      ['my-ticket', (a) => mittArendeNyckel(a, 'ticket-1')],
      ['user-notifications', kontoNotiserNyckel],
      ['support-notifications', supportNotiserNyckel],
    ]
    for (const [prefix, bygg] of byggare) {
      expect(bygg('a@b.se')).not.toEqual(bygg('c@d.se'))
      expect(bygg('a@b.se')).not.toEqual(bygg(null))
      expect(bygg('a@b.se')[0]).toBe(prefix)
    }
  })

  it('cache-posten för användare A hittas inte av användare B (samma queryClient)', () => {
    const klient = skapaTestKlient()
    klient.setQueryData(anvandarKallorNyckel('a@b.se'), [{ sourceId: 7 }])
    expect(klient.getQueryData(anvandarKallorNyckel('c@d.se'))).toBeUndefined()
    // ...men en prefix-invalidering (som mutationerna gör) träffar fortfarande båda.
    klient.setQueryData(anvandarKallorNyckel('c@d.se'), [])
    const traffar = klient.getQueryCache().findAll({ queryKey: ['user-sources'] })
    expect(traffar).toHaveLength(2)
  })

  it('rensaAnvandardata tar bort okända/användarspecifika nycklar men behåller publika', () => {
    const klient = skapaTestKlient()
    klient.setQueryData(['sources'], 1)
    klient.setQueryData(['faq'], 2)
    klient.setQueryData(['feature-flags'], 3)
    klient.setQueryData(['uppdateringar', 'anonym'], 4)
    klient.setQueryData(['uppdateringar', 'inloggad'], 5)
    klient.setQueryData(['ny-nyckel-som-ingen-listat'], 6)
    klient.setQueryData(['admin-tickets'], 7)

    rensaAnvandardata(klient)

    expect(klient.getQueryData(['sources'])).toBe(1)
    expect(klient.getQueryData(['faq'])).toBe(2)
    expect(klient.getQueryData(['feature-flags'])).toBe(3)
    expect(klient.getQueryData(['uppdateringar', 'anonym'])).toBe(4)
    expect(klient.getQueryData(['uppdateringar', 'inloggad'])).toBeUndefined()
    expect(klient.getQueryData(['ny-nyckel-som-ingen-listat'])).toBeUndefined()
    expect(klient.getQueryData(['admin-tickets'])).toBeUndefined()
  })
})
