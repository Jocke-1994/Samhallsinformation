import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { CanonicalEvent } from '../types'

// Regressionstester för V1-6 (E7#2): "Läs mer hos källan" ska ALLTID nå källan
// (synkron <a target="_blank">, ingen await före), och länkkollen får bara
// varna vid ett entydigt 'dead' — aldrig vid timeout/403/5xx/nätverksfel.

const kollaLänk = vi.fn()

vi.mock('../api/events', () => ({
  checkEventLinkStatus: (id: string) => kollaLänk(id),
  logEventShare: vi.fn(),
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: false }) }))
vi.mock('../context/SavedEventsContext', () => ({
  useSavedEvents: () => ({ sparade: new Set<string>(), lage: 'klar', toggleSparad: vi.fn() }),
}))
vi.mock('../context/FeatureFlagsContext', () => ({ useFlags: () => ({ flode_dela: false }) }))
vi.mock('../services/readState', () => ({ markAsRead: vi.fn() }))

const { default: NewsItem } = await import('../components/NewsFeed/NewsItem')

const HÄNDELSE: CanonicalEvent = {
  id: 'evt-1',
  sourceId: 2,
  title: 'Vägarbete, E6',
  content: 'Körfält avstängt.',
  publishedAt: '2026-09-25T10:00:00Z',
  url: 'https://kalla.example/handelse/1',
  geography: 'Göteborg',
  severity: 'Bra att veta',
  isNational: false,
}

async function visaExpanderad() {
  render(<NewsItem event={HÄNDELSE} isRead={false} sourceName="Trafikverket" />)
  // Kortets rubrikrad är en role=button som expanderar innehållet.
  fireEvent.click(screen.getByText('Vägarbete, E6'))
  return await screen.findByRole('link', { name: /Läs mer hos källan/ })
}

const DÖD_TEXT = /finns inte längre/

describe('NewsItem "Läs mer hos källan"', () => {
  beforeEach(() => {
    kollaLänk.mockReset()
  })

  it('är en riktig länk som öppnas i ny flik utan att vänta på länkkollen', async () => {
    kollaLänk.mockReturnValue(new Promise(() => {})) // kollen hänger för evigt
    const länk = await visaExpanderad()

    expect(länk).toHaveAttribute('href', HÄNDELSE.url)
    expect(länk).toHaveAttribute('target', '_blank')
    expect(länk).toHaveAttribute('rel', expect.stringContaining('noopener'))

    // fireEvent.click returnerar false om någon anropat preventDefault — då hade
    // webbläsaren inte öppnat länken. Här ska klicket lämnas orört.
    expect(fireEvent.click(länk)).toBe(true)
    // Länken är fortfarande klickbar (inte disabled/utbytt) medan kollen pågår.
    expect(screen.getByRole('link', { name: /Läs mer hos källan/ })).toBeInTheDocument()
    expect(screen.queryByText(DÖD_TEXT)).not.toBeInTheDocument()
  })

  it('öppnar länken även när länkkollen misslyckas (avvisas)', async () => {
    kollaLänk.mockRejectedValue(new Error('nätverk'))
    const länk = await visaExpanderad()

    expect(fireEvent.click(länk)).toBe(true)
    // Ge avvisningen en chans att slå igenom — inget får krascha eller ändra UI:t.
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.getByRole('link', { name: /Läs mer hos källan/ })).toHaveAttribute(
      'href',
      HÄNDELSE.url,
    )
    expect(screen.queryByText(DÖD_TEXT)).not.toBeInTheDocument()
  })

  it.each(['unknown', 'alive'] as const)('visar ingen varning vid %s', async (status) => {
    kollaLänk.mockResolvedValue(status)
    const länk = await visaExpanderad()

    fireEvent.click(länk)
    await waitFor(() => expect(kollaLänk).toHaveBeenCalledWith('evt-1'))
    await new Promise((r) => setTimeout(r, 0))

    expect(screen.queryByText(DÖD_TEXT)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Läs mer hos källan/ })).toBeInTheDocument()
  })

  it('visar "finns inte längre" bara vid ett entydigt dead — och behåller länken', async () => {
    kollaLänk.mockResolvedValue('dead')
    const länk = await visaExpanderad()

    fireEvent.click(länk)

    expect(await screen.findByText(DÖD_TEXT)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Läs mer hos källan/ })).toHaveAttribute(
      'href',
      HÄNDELSE.url,
    )
  })
})

describe('checkEventLinkStatus (klienten)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  async function kolla() {
    // Riktiga modulen (den ovan är mockad) — hämtas förbi mocken.
    const { checkEventLinkStatus } =
      await vi.importActual<typeof import('../api/events')>('../api/events')
    return checkEventLinkStatus('evt-1')
  }

  const svar = (ok: boolean, body: unknown) => ({ ok, json: async () => body })

  it.each(['alive', 'dead'] as const)('vidarebefordrar %s', async (status) => {
    fetchMock.mockResolvedValue(svar(true, { status, alive: status === 'alive' }))
    expect(await kolla()).toBe(status)
  })

  it('tolkar status unknown som unknown', async () => {
    fetchMock.mockResolvedValue(svar(true, { status: 'unknown', alive: true }))
    expect(await kolla()).toBe('unknown')
  })

  it('ger unknown (inte dead) vid HTTP-fel, nätverksfel och okänt/saknat fält', async () => {
    fetchMock.mockResolvedValueOnce(svar(false, {}))
    expect(await kolla()).toBe('unknown')

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await kolla()).toBe('unknown')

    // Äldre backend utan status-fältet får aldrig läsas som dead, inte ens med alive:false.
    fetchMock.mockResolvedValueOnce(svar(true, { alive: false }))
    expect(await kolla()).toBe('unknown')
  })
})
