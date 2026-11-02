import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CanonicalEvent, EventsResponse, Source } from '../types'

// V3-11 (beslut D2): Mitt flöde och Sparat filtreras på servern. Före fixen hämtade
// NewsFeed EN sida (50 senaste från ALLA källor) och filtrerade i klienten på
// användarens källor/bevakningar — en sällsynt källa eller snäv bevakning gav en tom
// eller ofullständig lista. Nu ska klienten visa exakt det servern svarar med.
vi.mock('../api/events')
vi.mock('../api/savedEvents')
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, email: 'a@b.se', accessToken: 't' }) }))
vi.mock('../context/FeatureFlagsContext', () => ({ useFlags: () => ({ flode_sparat: true, flode_olasta_badge: false }) }))
vi.mock('react-router', () => ({ useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams()], useLocation: () => ({ key: 'default' }) }))
vi.mock('../components/common/MobilTopBar', () => ({ default: () => null }))
vi.mock('../components/NewsFeed/NewsItem', () => ({
  default: ({ event }: { event: CanonicalEvent }) => <li data-testid="handelse">{event.title}</li>,
}))

const sparadeMock = vi.hoisted(() => ({ ids: new Set<string>(), lage: 'klar' as 'klar' | 'laddar' | 'fel' }))
vi.mock('../context/SavedEventsContext', () => ({
  useSavedEvents: () => ({ sparade: sparadeMock.ids, lage: sparadeMock.lage, forsokIgen: vi.fn(), toggleSparad: vi.fn() }),
}))

import * as eventsApi from '../api/events'
import * as savedApi from '../api/savedEvents'
import NewsFeed from '../components/NewsFeed/NewsFeed'
import { slaIhopSidor } from '../hooks/useServerFlode'
import { mittFlodeNyckel, sparatFlodeNyckel } from '../lib/queryNycklar'
import { rensaAnvandardata } from '../lib/queryRensning'

const api = vi.mocked(eventsApi)
const sparatApi = vi.mocked(savedApi)

function ev(id: string, sourceId = 1, publishedAt = '2026-09-20T10:00:00Z'): CanonicalEvent {
  return { id, sourceId, title: `Händelse ${id}`, content: 'x', publishedAt, url: 'https://x.se', geography: null, severity: 'Bra att veta', isNational: false }
}

function sida(events: CanonicalEvent[], page = 1, hasMore = false): EventsResponse {
  return { total: events.length, page, pageSize: 50, events, hasMore, totalExakt: true }
}

const KALLOR: Source[] = [
  { id: 1, name: 'Polisen', shortName: 'Polisen', isActive: true },
  { id: 9, name: 'Läkemedelsverket', shortName: 'Läkemedelsverket', isActive: true },
] as unknown as Source[]

function rendera(props: { viewMode?: 'Allt' | 'Mitt' } = {}) {
  const klient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const ui = render(
    <QueryClientProvider client={klient}>
      <NewsFeed
        shortName={null}
        sources={KALLOR}
        viewMode={props.viewMode ?? 'Mitt'}
        onViewModeChange={vi.fn()}
        onOpenSidebar={vi.fn()}
      />
    </QueryClientProvider>,
  )
  return { klient, ...ui }
}

const titlar = () => screen.queryAllByTestId('handelse').map(e => e.textContent)

beforeEach(() => {
  api.fetchEvents.mockReset().mockResolvedValue({ total: 0, page: 1, pageSize: 50, events: [] })
  api.fetchMittFlode.mockReset()
  sparatApi.fetchSparadeHandelser.mockReset()
  sparadeMock.ids = new Set()
  sparadeMock.lage = 'klar'
  localStorage.clear()
})

describe('Mitt flöde hämtas från servern', () => {
  it('visar exakt det servern svarar med — ingen klientfiltrering på källa eller Polisen — och hämtar inte "Alla"-fönstret', async () => {
    // Händelser från en källa som klienten tidigare filtrerat bort (id 9 är inte "aktiv" i något
    // klientläge längre finns inte ens) och Polisen-händelser utan att klienten känner bevakningarna.
    api.fetchMittFlode.mockResolvedValue(sida([ev('a', 9), ev('b', 1), ev('c', 1)]))

    rendera()

    await waitFor(() => expect(titlar()).toEqual(['Händelse a', 'Händelse b', 'Händelse c']))
    expect(api.fetchMittFlode).toHaveBeenCalledWith(1, 50)
    expect(api.fetchEvents).not.toHaveBeenCalled()
  })

  it('cache-nyckeln innehåller användaren och flödesläget (Mitt/Sparat skiljs åt)', async () => {
    api.fetchMittFlode.mockResolvedValue(sida([ev('a')]))
    sparatApi.fetchSparadeHandelser.mockResolvedValue(sida([ev('s1')]))
    sparadeMock.ids = new Set(['s1'])
    const user = userEvent.setup()
    const { klient } = rendera()

    await screen.findByText('Händelse a')
    expect(klient.getQueryData(mittFlodeNyckel('a@b.se'))).toBeDefined()
    expect(mittFlodeNyckel('a@b.se')).toEqual(['mitt-flode', 'a@b.se'])
    expect(mittFlodeNyckel('a@b.se')).not.toEqual(mittFlodeNyckel('annan@b.se'))
    // Användarspecifikt: rensas vid utloggning, läcker inte till nästa användare på enheten
    rensaAnvandardata(klient)
    expect(klient.getQueryData(mittFlodeNyckel('a@b.se'))).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'Sparat' }))
    await screen.findByText('Händelse s1')
    expect(klient.getQueryData(sparatFlodeNyckel('a@b.se'))).toBeDefined()
    expect(sparatFlodeNyckel('a@b.se')[0]).not.toBe(mittFlodeNyckel('a@b.se')[0])
  })

  it('fel är inte en tom lista: felmeddelande med "Försök igen", aldrig "Inget matchar"', async () => {
    api.fetchMittFlode.mockRejectedValue(new Error('fetchMittFlode: 500'))

    rendera()

    expect(await screen.findByRole('alert')).toHaveTextContent('Vi kunde inte hämta ditt flöde')
    expect(screen.queryByText(/Inget matchar dina prenumerationer/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Försök igen' })).toBeInTheDocument()
  })

  it('"Försök igen" hämtar om och visar listan när servern svarar', async () => {
    api.fetchMittFlode.mockRejectedValueOnce(new Error('fetchMittFlode: 500')).mockResolvedValue(sida([ev('a')]))
    const user = userEvent.setup()
    rendera()

    await user.click(await screen.findByRole('button', { name: 'Försök igen' }))

    expect(await screen.findByText('Händelse a')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('laddar: visar varken lista eller "inget matchar" innan servern svarat', async () => {
    api.fetchMittFlode.mockReturnValue(new Promise(() => {}))

    rendera()

    expect(await screen.findByText('Hämtar ditt flöde...')).toBeInTheDocument()
    expect(screen.queryByText(/Inget matchar dina prenumerationer/)).not.toBeInTheDocument()
  })

  it('tom lista visas bara när servern verkligen svarat tomt', async () => {
    api.fetchMittFlode.mockResolvedValue(sida([]))

    rendera()

    expect(await screen.findByText('Inget matchar dina prenumerationer just nu')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('"Ladda fler" hämtar nästa sida och lägger den efter den första; knappen försvinner när servern säger att det inte finns fler', async () => {
    api.fetchMittFlode
      .mockResolvedValueOnce(sida([ev('a'), ev('b')], 1, true))
      .mockResolvedValueOnce(sida([ev('c')], 2, false))
    const user = userEvent.setup()
    rendera()
    await screen.findByText('Händelse a')

    await user.click(screen.getByRole('button', { name: 'Ladda fler' }))

    await waitFor(() => expect(titlar()).toEqual(['Händelse a', 'Händelse b', 'Händelse c']))
    expect(api.fetchMittFlode).toHaveBeenNthCalledWith(2, 2, 50)
    expect(screen.queryByRole('button', { name: 'Ladda fler' })).not.toBeInTheDocument()
  })

  it('ingen "Ladda fler"-knapp när första sidan är hela svaret', async () => {
    api.fetchMittFlode.mockResolvedValue(sida([ev('a')], 1, false))

    rendera()

    await screen.findByText('Händelse a')
    expect(screen.queryByRole('button', { name: 'Ladda fler' })).not.toBeInTheDocument()
  })

  it('en händelse som förskjutits in på nästa sida visas inte två gånger', async () => {
    api.fetchMittFlode
      .mockResolvedValueOnce(sida([ev('a'), ev('b')], 1, true))
      .mockResolvedValueOnce(sida([ev('b'), ev('c')], 2, false))
    const user = userEvent.setup()
    rendera()
    await screen.findByText('Händelse a')

    await user.click(screen.getByRole('button', { name: 'Ladda fler' }))

    await waitFor(() => expect(titlar()).toEqual(['Händelse a', 'Händelse b', 'Händelse c']))
  })

  it('misslyckad "Ladda fler" behåller första sidan och erbjuder nytt försök', async () => {
    api.fetchMittFlode
      .mockResolvedValueOnce(sida([ev('a')], 1, true))
      .mockRejectedValueOnce(new Error('fetchMittFlode: 500'))
      .mockResolvedValueOnce(sida([ev('b')], 2, false))
    const user = userEvent.setup()
    rendera()
    await screen.findByText('Händelse a')

    await user.click(screen.getByRole('button', { name: 'Ladda fler' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Vi kunde inte hämta fler händelser')
    expect(titlar()).toEqual(['Händelse a'])
    await user.click(screen.getByRole('button', { name: 'Försök igen' }))
    await waitFor(() => expect(titlar()).toEqual(['Händelse a', 'Händelse b']))
  })
})

describe('"Alla" är oförändrat', () => {
  it('Alla-läget hämtar fortfarande fönstret via fetchEvents och rör inte Mitt flöde-endpointen', async () => {
    api.fetchEvents.mockResolvedValue({ total: 2, page: 1, pageSize: 50, events: [ev('x', 5, '2026-09-20T10:00:00Z'), ev('y', 6, '2026-09-21T10:00:00Z')] })

    rendera({ viewMode: 'Allt' })

    await waitFor(() => expect(titlar()).toEqual(['Händelse y', 'Händelse x'])) // sorterat nyast först som förut
    expect(api.fetchEvents).toHaveBeenCalledWith({ shortName: undefined, pageSize: 50 })
    expect(api.fetchMittFlode).not.toHaveBeenCalled()
  })
})

describe('Sparat hämtas från servern', () => {
  it('visar äldre sparade händelser som servern returnerar och paginerar', async () => {
    sparadeMock.ids = new Set(['gammal', 'g2'])
    sparatApi.fetchSparadeHandelser
      .mockResolvedValueOnce(sida([ev('gammal', 1, '2025-01-01T00:00:00Z')], 1, true))
      .mockResolvedValueOnce(sida([ev('g2', 1, '2024-01-01T00:00:00Z')], 2, false))
    api.fetchMittFlode.mockResolvedValue(sida([ev('nyare')]))
    const user = userEvent.setup()
    rendera()
    await user.click(await screen.findByRole('button', { name: 'Sparat' }))

    expect(await screen.findByText('Händelse gammal')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ladda fler' }))

    await waitFor(() => expect(titlar()).toEqual(['Händelse gammal', 'Händelse g2']))
    expect(sparatApi.fetchSparadeHandelser).toHaveBeenNthCalledWith(2, 2, 50)
  })

  it('en händelse vars bokmärke just tagits bort försvinner ur listan direkt', async () => {
    sparadeMock.ids = new Set(['kvar'])
    sparatApi.fetchSparadeHandelser.mockResolvedValue(sida([ev('kvar'), ev('borttagen')]))
    api.fetchMittFlode.mockResolvedValue(sida([]))
    const user = userEvent.setup()
    rendera()
    await user.click(await screen.findByRole('button', { name: 'Sparat' }))

    await screen.findByText('Händelse kvar')
    expect(screen.queryByText('Händelse borttagen')).not.toBeInTheDocument()
  })

  it('fel är inte "Inget sparat än"', async () => {
    sparatApi.fetchSparadeHandelser.mockRejectedValue(new Error('fetchSparadeHandelser: 500'))
    api.fetchMittFlode.mockResolvedValue(sida([]))
    const user = userEvent.setup()
    rendera()
    await user.click(await screen.findByRole('button', { name: 'Sparat' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Vi kunde inte hämta dina sparade händelser')
    expect(screen.queryByText('Inget sparat än')).not.toBeInTheDocument()
  })

  it('tomt serversvar ger "Inget sparat än"', async () => {
    sparatApi.fetchSparadeHandelser.mockResolvedValue(sida([]))
    api.fetchMittFlode.mockResolvedValue(sida([]))
    const user = userEvent.setup()
    rendera()
    await user.click(await screen.findByRole('button', { name: 'Sparat' }))

    expect(await screen.findByText('Inget sparat än')).toBeInTheDocument()
  })
})

describe('slaIhopSidor', () => {
  it('tom/odefinierad data ger tom lista och dubbletter tas bort i sidordning', () => {
    expect(slaIhopSidor(undefined)).toEqual([])
    const data = { pages: [sida([ev('a'), ev('b')]), sida([ev('b'), ev('c')], 2)], pageParams: [1, 2] }
    expect(slaIhopSidor(data).map(e => e.id)).toEqual(['a', 'b', 'c'])
  })
})
