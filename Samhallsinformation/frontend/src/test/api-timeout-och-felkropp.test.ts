import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminFetch } from '../api/adminFetch'
import { LANG_TIMEOUT_MS, STANDARD_TIMEOUT_MS, fetchMedTimeout } from '../api/hamta'
import { fetchSources, resyncAdminSource } from '../api/sources'
import { fetchEvents } from '../api/events'
import { dryRunSource } from '../api/testing'
import { saveUserSources } from '../api/userSources'
import { TIDSGRANS_TEXT, visaFel } from '../lib/felmeddelande'

// Regressionstester för V4-2 (E5#14): standardtimeout (med per-anrop-override)
// i API-lagret och bevarad felkropp i det kastade felet.

const RESERV = 'Något gick fel. Försök igen.'
const fetchMock = vi.fn()

// Ett anrop som aldrig svarar men avvisas när det avbryts (som riktig fetch).
function hangande(_url: string, init?: RequestInit): Promise<Response> {
  return new Promise((_ok, fel) => {
    init?.signal?.addEventListener('abort', () => fel(init.signal!.reason))
  })
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
const text = (status: number, body: string) => new Response(body, { status })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('timeout i API-lagret', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('adminFetch avbryts efter standardgränsen med ett tydligt TimeoutError', async () => {
    fetchMock.mockImplementation(hangande)
    const utfall = adminFetch('/api/x').catch((e: unknown) => e)

    await vi.advanceTimersByTimeAsync(STANDARD_TIMEOUT_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2)

    const fel = await utfall
    expect(fel).toBeInstanceOf(Error)
    expect((fel as Error).name).toBe('TimeoutError')
    expect((fel as Error).message).toBe(TIDSGRANS_TEXT)
    expect(visaFel(fel, RESERV)).toBe('Servern svarade inte i tid. Försök igen.')
  })

  it('ett anrop som svarar under gränsen påverkas inte, inte ens efter att gränsen passerat', async () => {
    fetchMock.mockImplementation(
      () => new Promise((ok) => setTimeout(() => ok(json(200, { ok: true })), 10_000)),
    )
    const utfall = adminFetch('/api/x')

    await vi.advanceTimersByTimeAsync(10_000)
    const res = await utfall
    await vi.advanceTimersByTimeAsync(STANDARD_TIMEOUT_MS * 2)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('per-anrop-override: en längre gräns avbryter inte förrän den passerat', async () => {
    fetchMock.mockImplementation(hangande)
    const utfall = adminFetch('/api/x', { timeoutMs: LANG_TIMEOUT_MS }).catch((e: unknown) => e)

    await vi.advanceTimersByTimeAsync(STANDARD_TIMEOUT_MS + 60_000)
    let klart = false
    void utfall.then(() => {
      klart = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(klart).toBe(false) // 90 s: standardgränsen är passerad men anropet lever

    await vi.advanceTimersByTimeAsync(LANG_TIMEOUT_MS)
    expect(((await utfall) as Error).name).toBe('TimeoutError')
  })

  it('timeoutMs: 0 stänger av timeouten', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeUndefined()
      return new Promise((ok) => setTimeout(() => ok(json(200, {})), 10 * 60_000))
    })
    const utfall = adminFetch('/api/x', { timeoutMs: 0 })
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect((await utfall).status).toBe(200)
  })

  it('en medskickad signal avbryter fortfarande anropet', async () => {
    fetchMock.mockImplementation(hangande)
    const styr = new AbortController()
    const utfall = fetchMedTimeout('/api/x', { signal: styr.signal }).catch((e: unknown) => e)
    styr.abort(new DOMException('avbrutet', 'AbortError'))
    expect(((await utfall) as Error).name).toBe('AbortError')
  })

  it('de publika hjälparna (fetchSources, fetchEvents) har samma standardtimeout', async () => {
    fetchMock.mockImplementation(hangande)
    const kallor = fetchSources().catch((e: unknown) => e)
    const handelser = fetchEvents({ pageSize: 5 }).catch((e: unknown) => e)

    await vi.advanceTimersByTimeAsync(STANDARD_TIMEOUT_MS)

    expect(((await kallor) as Error).name).toBe('TimeoutError')
    expect(((await handelser) as Error).name).toBe('TimeoutError')
  })

  it('kända långa admin-anrop (resync av källa) får 120 s', async () => {
    fetchMock.mockImplementation(hangande)
    const utfall = resyncAdminSource(1).catch((e: unknown) => e)

    await vi.advanceTimersByTimeAsync(STANDARD_TIMEOUT_MS + 30_000)
    let klart = false
    void utfall.then(() => {
      klart = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(klart).toBe(false)

    await vi.advanceTimersByTimeAsync(LANG_TIMEOUT_MS)
    expect(((await utfall) as Error).message).toBe(TIDSGRANS_TEXT)
  })
})

describe('felkroppen bevaras i det kastade felet', () => {
  it('JSON { error } från servern blir felets meddelande och visas av visaFel', async () => {
    fetchMock.mockResolvedValue(json(400, { error: 'Max 5 bevakningar per användare.' }))

    const fel = await saveUserSources([]).catch((e: unknown) => e)

    expect((fel as Error).message).toBe('Max 5 bevakningar per användare.')
    expect(visaFel(fel, RESERV)).toBe('Max 5 bevakningar per användare.')
  })

  it('ren text från servern (4xx) bevaras', async () => {
    fetchMock.mockResolvedValue(text(403, 'Kontot är avstängt.'))

    const fel = await saveUserSources([]).catch((e: unknown) => e)

    expect((fel as Error).message).toBe('Kontot är avstängt.')
    expect(visaFel(fel, RESERV)).toBe('Kontot är avstängt.')
  })

  it('publika anrop (fetchSources) bevarar också felkroppen', async () => {
    fetchMock.mockResolvedValue(json(503, { error: 'Underhåll pågår, försök om en stund.' }))

    const fel = await fetchSources().catch((e: unknown) => e)

    expect(visaFel(fel, RESERV)).toBe('Underhåll pågår, försök om en stund.')
  })

  it('tom kropp ger som förut det tekniska namn: status, som visaFel byter mot reservtexten', async () => {
    fetchMock.mockResolvedValue(text(500, ''))

    const fel = await saveUserSources([]).catch((e: unknown) => e)

    expect((fel as Error).message).toBe('saveUserSources: 500')
    expect(visaFel(fel, RESERV)).toBe(RESERV)
  })

  it('HTML-felsidor och text från 5xx visas aldrig för användaren', async () => {
    fetchMock.mockResolvedValueOnce(text(502, '<html><body>Bad Gateway</body></html>'))
    fetchMock.mockResolvedValueOnce(text(500, 'System.NullReferenceException at ...'))

    const html = await saveUserSources([]).catch((e: unknown) => e)
    const teknisk = await saveUserSources([]).catch((e: unknown) => e)

    expect(visaFel(html, RESERV)).toBe(RESERV)
    expect(visaFel(teknisk, RESERV)).toBe(RESERV)
  })

  it('429 utan kropp ger en läsbar svensk text i stället för reservtexten', async () => {
    fetchMock.mockResolvedValue(text(429, ''))

    const fel = await saveUserSources([]).catch((e: unknown) => e)

    expect(visaFel(fel, RESERV)).toBe(
      'För många försök på kort tid. Vänta en stund och försök igen.',
    )
  })

  it('dryRunSource ger statusfelet vid 5xx utan JSON-kropp, inte ett SyntaxError', async () => {
    fetchMock.mockResolvedValue(text(502, ''))

    const fel = await dryRunSource('https://x.se/rss', 'Test').catch((e: unknown) => e)

    expect(fel).not.toBeInstanceOf(SyntaxError)
    expect((fel as Error).message).toBe('dryRunSource: 502')
  })

  it('dryRunSource behåller serverns { error } vid 400', async () => {
    fetchMock.mockResolvedValue(json(400, { error: 'Ogiltig URL.' }))

    const fel = await dryRunSource('x', 'Test').catch((e: unknown) => e)

    expect((fel as Error).message).toBe('Ogiltig URL.')
  })

  it('publika signaturer och returvärden är oförändrade vid lyckat svar', async () => {
    fetchMock.mockResolvedValue(json(200, [{ id: 1, shortName: 'A' }]))
    expect(await fetchSources()).toEqual([{ id: 1, shortName: 'A' }])
  })
})
