import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminSearchEvent } from '../api/eventSearch'
import type { AdminUserDto } from '../api/adminUsers'

// V3-8 (E6#20 + E6#8): Händelsesök. "Spara till användare" ger per-rad-resultat
// (allSettled, "N av M ..."), avmarkerar bara de lyckade och hämtar om; hämtfel visas
// som fel (sökresultat, användarlista) i stället för tomt / "Inga användare hittades".

vi.mock('../api/eventSearch', () => ({
  fetchSearchableSources: vi.fn(),
  fetchEventTypes: vi.fn(),
  searchEvents: vi.fn(),
}))
vi.mock('../api/adminUsers', () => ({
  fetchAdminUsers: vi.fn(),
  saveAdminUserEvent: vi.fn(),
  fetchSavedEventsByEvent: vi.fn(),
}))
vi.mock('../api/activityLog', () => ({ createActivityLogEntry: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ roll: 'Admin', aktivVy: 'Admin' }) }))
// NewsItem drar in flera kontexter som inte är relevanta här — en enkel stand-in räcker.
vi.mock('../components/NewsFeed/NewsItem', () => ({
  default: ({ event, checkbox }: { event: AdminSearchEvent; checkbox?: { checked: boolean; onChange: () => void } }) => (
    <div>
      {checkbox && <input type="checkbox" aria-label={`Markera ${event.title}`} checked={checkbox.checked} onChange={checkbox.onChange} />}
      <span>{event.title}</span>
    </div>
  ),
}))

const { fetchSearchableSources, fetchEventTypes, searchEvents } = await import('../api/eventSearch')
const { fetchAdminUsers, saveAdminUserEvent, fetchSavedEventsByEvent } = await import('../api/adminUsers')
const { createActivityLogEntry } = await import('../api/activityLog')
const { default: Handelsesok } = await import('../components/Admin/Handelsesok')

const händelse = (id: string, title: string): AdminSearchEvent => ({
  id, title, content: '', url: 'https://x.se', geography: null, severity: 'Bra att veta',
  eventType: null, isNational: true, publishedAt: '2026-09-01T10:00:00Z', sourceId: 1, sourceName: 'Polisen',
})
const ANNA = { id: 'u-anna', name: 'Anna', email: 'anna@example.se' } as AdminUserDto

const A = händelse('e1', 'Brand i Uppsala')
const B = händelse('e2', 'Inbrott i Malmö')
const C = händelse('e3', 'Trafikolycka E4')

function rendera() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><Handelsesok /></QueryClientProvider>)
}

async function markeraOchÖppnaVäljaren(titlar: string[]) {
  for (const t of titlar) await userEvent.click(await screen.findByRole('checkbox', { name: `Markera ${t}` }))
  await userEvent.click(screen.getByRole('button', { name: /Spara till användare/ }))
}

beforeEach(() => {
  vi.mocked(fetchSearchableSources).mockReset().mockResolvedValue([])
  vi.mocked(fetchEventTypes).mockReset().mockResolvedValue([])
  vi.mocked(searchEvents).mockReset().mockResolvedValue({ total: 3, page: 1, pageSize: 20, events: [A, B, C] })
  vi.mocked(fetchAdminUsers).mockReset().mockResolvedValue([ANNA])
  vi.mocked(saveAdminUserEvent).mockReset().mockResolvedValue()
  vi.mocked(fetchSavedEventsByEvent).mockReset().mockResolvedValue({})
  vi.mocked(createActivityLogEntry).mockReset().mockResolvedValue()
})

describe('Händelsesök — Spara till användare (mass)', () => {
  it('delvis lyckat: "N av M sparades", felet namnges, bara de lyckade avmarkeras, listan hämtas om', async () => {
    vi.mocked(saveAdminUserEvent).mockImplementation(async (_u, eventId) => {
      if (eventId === 'e2') throw new Error('Händelsen finns redan sparad hos användaren.')
    })
    rendera()

    await markeraOchÖppnaVäljaren(['Brand i Uppsala', 'Inbrott i Malmö', 'Trafikolycka E4'])
    const anropFöre = vi.mocked(fetchSavedEventsByEvent).mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: /Anna/ }))

    const sammanfattning = await screen.findByRole('alert')
    expect(sammanfattning).toHaveTextContent('2 av 3 händelser sparades till Anna.')
    expect(sammanfattning).toHaveTextContent('Misslyckades: "Inbrott i Malmö" (Händelsen finns redan sparad hos användaren.)')
    // Bara den misslyckade förblir markerad — så att den går att försöka igen.
    expect(screen.getByRole('checkbox', { name: 'Markera Brand i Uppsala' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Markera Inbrott i Malmö' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Markera Trafikolycka E4' })).not.toBeChecked()
    expect(screen.getByText('1 markerade')).toBeInTheDocument()
    // Bara de två lyckade loggades, och "sparade till"-uppslaget hämtades om.
    expect(createActivityLogEntry).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(vi.mocked(fetchSavedEventsByEvent).mock.calls.length).toBeGreaterThan(anropFöre))
  })

  it('alla misslyckas: ingen händelse avmarkeras, ingen loggning, tydligt fel (tidigare: obehandlat avslag)', async () => {
    vi.mocked(saveAdminUserEvent).mockRejectedValue(new Error('saveAdminUserEvent: 500'))
    rendera()

    await markeraOchÖppnaVäljaren(['Brand i Uppsala', 'Inbrott i Malmö'])
    await userEvent.click(screen.getByRole('button', { name: /Anna/ }))

    const sammanfattning = await screen.findByRole('alert')
    expect(sammanfattning).toHaveTextContent('0 av 2 händelser sparades till Anna.')
    expect(sammanfattning).toHaveTextContent('okänt fel')
    expect(screen.getByText('2 markerade')).toBeInTheDocument()
    expect(createActivityLogEntry).not.toHaveBeenCalled()
    // Knappen är inte kvar i "Sparar…"-läge.
    expect(screen.getByRole('button', { name: /Spara till användare/ })).not.toBeDisabled()
  })

  it('allt lyckas: statusmeddelande "2 av 2", alla avmarkerade', async () => {
    rendera()

    await markeraOchÖppnaVäljaren(['Brand i Uppsala', 'Inbrott i Malmö'])
    await userEvent.click(screen.getByRole('button', { name: /Anna/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('2 av 2 händelser sparades till Anna.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Markera Brand i Uppsala' })).not.toBeChecked()
    expect(screen.getByText('3 träffar')).toBeInTheDocument()
  })

  it('sparat men loggen misslyckas: räknas som sparad, men loggfelet sägs', async () => {
    vi.mocked(createActivityLogEntry).mockRejectedValue(new Error('createActivityLogEntry: 500'))
    rendera()

    await markeraOchÖppnaVäljaren(['Brand i Uppsala'])
    await userEvent.click(screen.getByRole('button', { name: /Anna/ }))

    const sammanfattning = await screen.findByRole('alert')
    expect(sammanfattning).toHaveTextContent('1 av 1 händelser sparades till Anna.')
    expect(sammanfattning).toHaveTextContent('1 sparades men kunde inte loggas')
    expect(screen.getByRole('checkbox', { name: 'Markera Brand i Uppsala' })).not.toBeChecked()
  })

  it('användarlistan går inte att hämta: fel + Försök igen i väljaren, inte "Inga användare hittades"', async () => {
    vi.mocked(fetchAdminUsers).mockRejectedValueOnce(new Error('fetchAdminUsers: 500')).mockResolvedValue([ANNA])
    rendera()

    await markeraOchÖppnaVäljaren(['Brand i Uppsala'])

    expect(await screen.findByText('Kunde inte hämta användarlistan.')).toBeInTheDocument()
    expect(screen.queryByText('Inga användare hittades')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Försök igen' }))
    expect(await screen.findByRole('button', { name: /Anna/ })).toBeInTheDocument()
  })

  it('bekräftat tom användarlista visar "Inga användare hittades"', async () => {
    vi.mocked(fetchAdminUsers).mockResolvedValue([])
    rendera()

    await markeraOchÖppnaVäljaren(['Brand i Uppsala'])

    expect(await screen.findByText('Inga användare hittades')).toBeInTheDocument()
  })
})

describe('Händelsesök — sökresultat', () => {
  it('sökfel: felmeddelande + Försök igen (inte "Inga händelser matchade")', async () => {
    vi.mocked(searchEvents).mockRejectedValueOnce(new Error('searchEvents: 500')).mockResolvedValue({ total: 1, page: 1, pageSize: 20, events: [A] })
    rendera()

    const fel = await screen.findByRole('alert')
    expect(fel).toHaveTextContent('Kunde inte hämta sökresultat')
    expect(screen.queryByText('Inga händelser matchade sökningen')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Försök igen' }))
    expect(await screen.findByText('Brand i Uppsala')).toBeInTheDocument()
  })

  it('tomt svar: "Inga händelser matchade sökningen"', async () => {
    vi.mocked(searchEvents).mockResolvedValue({ total: 0, page: 1, pageSize: 20, events: [] })
    rendera()

    expect(await screen.findByText('Inga händelser matchade sökningen')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
