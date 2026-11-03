import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CanonicalEvent, Source } from '../types'

// Push-djuplänk (2026-11-03): en push om exakt en händelse länkar till
// /?shortName=…&handelse=<id>. Flödet ska markera just den händelsen, och
// hämta den separat om den inte finns bland de 50 som flödet hämtat.
// Upptäckt när en riktig Efterlysningar-notis bara landade på startsidan.
vi.mock('../api/events')
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: false }) }))
vi.mock('../context/FeatureFlagsContext', () => ({ useFlags: () => ({}) }))
vi.mock('react-router', () => ({ useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams()], useLocation: () => ({ key: 'default' }) }))
vi.mock('../components/common/MobilTopBar', () => ({ default: () => null }))
vi.mock('../context/SavedEventsContext', () => ({
  useSavedEvents: () => ({ sparade: new Set(), lage: 'klar', forsokIgen: vi.fn(), toggleSparad: vi.fn() }),
}))
vi.mock('../components/NewsFeed/NewsItem', () => ({
  default: ({ event, markerad }: { event: CanonicalEvent; markerad?: boolean }) =>
    <li data-testid="handelse" data-markerad={markerad ? 'ja' : 'nej'}>{event.title}</li>,
}))

import * as eventsApi from '../api/events'
import NewsFeed from '../components/NewsFeed/NewsFeed'

const api = vi.mocked(eventsApi)

function ev(id: string): CanonicalEvent {
  return { id, sourceId: 12, title: `Händelse ${id}`, content: 'x', publishedAt: '2026-11-03T10:00:00Z', url: 'https://x.se', geography: null, severity: 'Bra att veta', isNational: false }
}

const KALLOR = [{ id: 12, name: 'Polisen Efterlysningar', shortName: 'Polisen', isActive: true }] as unknown as Source[]

function rendera(markeradHandelseId: string | null) {
  const klient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={klient}>
      <NewsFeed shortName="Polisen" sources={KALLOR} viewMode="Allt" onViewModeChange={vi.fn()} onOpenSidebar={vi.fn()} markeradHandelseId={markeradHandelseId} />
    </QueryClientProvider>,
  )
}

const markerade = () => screen.queryAllByTestId('handelse').filter(e => e.dataset.markerad === 'ja').map(e => e.textContent)

beforeEach(() => {
  api.fetchEvents.mockReset().mockResolvedValue({ total: 2, page: 1, pageSize: 50, events: [ev('a'), ev('b')] })
  api.fetchEvent.mockReset()
})

describe('push-djuplänk till en händelse', () => {
  it('markerar händelsen i listan och hämtar den inte separat', async () => {
    rendera('b')
    await waitFor(() => expect(markerade()).toEqual(['Händelse b']))
    expect(api.fetchEvent).not.toHaveBeenCalled()
  })

  it('hämtar och visar händelsen överst när den inte finns bland de hämtade', async () => {
    api.fetchEvent.mockResolvedValue(ev('gammal'))
    rendera('gammal')
    await waitFor(() => expect(markerade()).toEqual(['Händelse gammal']))
    expect(api.fetchEvent).toHaveBeenCalledWith('gammal')
    expect(screen.getByText('Från din notis')).toBeTruthy()
    expect(screen.getAllByTestId('handelse')[0].textContent).toBe('Händelse gammal')
  })

  it('utan djuplänk markeras ingenting', async () => {
    rendera(null)
    await waitFor(() => expect(screen.getAllByTestId('handelse')).toHaveLength(2))
    expect(markerade()).toEqual([])
    expect(api.fetchEvent).not.toHaveBeenCalled()
  })
})
