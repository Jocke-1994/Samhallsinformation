import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSourceOrder } from '../hooks/useSourceOrder'
import * as userSourcesApi from '../api/userSources'
import type { SourcePrefUpdate, UserSourcePref } from '../api/userSources'
import * as toastStore from '../components/NewsFeed/bevakningsToastStore'
import type { Source } from '../types'

// Regressionstester för V4-2 (E5#13): källordningen sparas optimistiskt, rullas
// tillbaka med ett felmeddelande om servern säger nej, och snabba omsorteringar
// ger rätt slutordning på servern (den senaste vinner).
vi.mock('../api/userSources')
vi.mock('../components/NewsFeed/bevakningsToastStore', () => ({
  visaBevakningsToast: vi.fn(),
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, email: 'a@b.se', accessToken: 't' }) }))

const api = vi.mocked(userSourcesApi)
const toast = vi.mocked(toastStore.visaBevakningsToast)

const KALLOR: Source[] = ['A', 'B', 'C'].map((namn, i) => ({
  id: i + 1, name: namn, shortName: namn, baseUrl: '', isActive: true, scope: 'nationell',
}))
const GRUPPER = new Map(KALLOR.map(s => [s.shortName, [s]]))
const NAMN = ['A', 'B', 'C']

// Låtsasserver: fetchUserSources speglar `server`, saveUserSources gör
// ändringen först när testet släpper anropet (eller kastar när det avvisas).
let server: UserSourcePref[]
let anrop: { uppdateringar: SourcePrefUpdate[]; lyckas: () => void; misslyckas: (fel: Error) => void }[]

function Harness() {
  const grupper = useMemo(() => GRUPPER, [])
  const namn = useMemo(() => NAMN, [])
  const [ordning, spara] = useSourceOrder(namn, grupper)
  return (
    <div>
      <div data-testid="ordning">{ordning.join(',')}</div>
      <button onClick={() => spara(['C', 'A', 'B'])}>cab</button>
      <button onClick={() => spara(['B', 'A', 'C'])}>bac</button>
      <button onClick={() => spara(['C', 'B', 'A'])}>cba</button>
      <button onClick={() => spara(['A', 'B', 'C'])}>abc</button>
    </div>
  )
}

function renderaHook() {
  const klient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={klient}><Harness /></QueryClientProvider>)
}

const ordning = () => screen.getByTestId('ordning').textContent
const klicka = (text: string) => act(() => { screen.getByText(text).click() })
const serverOrdning = () => [...server].sort((a, b) => a.sortOrder - b.sortOrder).map(p => p.shortName).join(',')

beforeEach(() => {
  server = KALLOR.map((s, i) => ({ sourceId: s.id, shortName: s.shortName, isActive: true, sortOrder: i }))
  anrop = []
  toast.mockReset()
  api.fetchUserSources.mockReset().mockImplementation(async () => server.map(p => ({ ...p })))
  api.saveUserSources.mockReset().mockImplementation(uppdateringar => new Promise<void>((klar, fel) => {
    anrop.push({
      uppdateringar,
      lyckas: () => {
        for (const u of uppdateringar) {
          const rad = server.find(p => p.sourceId === u.sourceId)
          if (rad) { rad.sortOrder = u.sortOrder; rad.isActive = u.isActive }
        }
        klar()
      },
      misslyckas: fel,
    })
  }))
})

async function vantaPaAnrop(antal: number) {
  await waitFor(() => expect(anrop.length).toBe(antal))
}

describe('useSourceOrder — optimistisk sparning (E5#13)', () => {
  it('den nya ordningen syns direkt, innan servern svarat', async () => {
    renderaHook()
    await waitFor(() => expect(ordning()).toBe('A,B,C'))

    klicka('cab')

    await waitFor(() => expect(ordning()).toBe('C,A,B'))
    await vantaPaAnrop(1)
    expect(serverOrdning()).toBe('A,B,C') // servern har inte svarat, men listan ligger redan rätt
    expect(ordning()).toBe('C,A,B')
  })

  it('servern får ändringen och listan ligger kvar efter bekräftelsen', async () => {
    renderaHook()
    await waitFor(() => expect(ordning()).toBe('A,B,C'))
    klicka('cab')
    await vantaPaAnrop(1)

    await act(async () => { anrop[0].lyckas() })

    await waitFor(() => expect(serverOrdning()).toBe('C,A,B'))
    expect(ordning()).toBe('C,A,B')
    expect(toast).not.toHaveBeenCalled()
  })

  it('misslyckas anropet rullas listan tillbaka och serverns svenska text visas', async () => {
    renderaHook()
    await waitFor(() => expect(ordning()).toBe('A,B,C'))
    klicka('cab')
    await vantaPaAnrop(1)

    await act(async () => { anrop[0].misslyckas(new Error('Du har gjort för många ändringar. Vänta en stund.')) })

    await waitFor(() => expect(ordning()).toBe('A,B,C'))
    expect(toast).toHaveBeenCalledWith({ typ: 'fel', text: 'Du har gjort för många ändringar. Vänta en stund.' })
  })

  it('tekniskt statusfel ger den reservtext som visaFel väljer', async () => {
    renderaHook()
    await waitFor(() => expect(ordning()).toBe('A,B,C'))
    klicka('cab')
    await vantaPaAnrop(1)

    await act(async () => { anrop[0].misslyckas(new Error('saveUserSources: 500')) })

    await waitFor(() => expect(ordning()).toBe('A,B,C'))
    expect(toast).toHaveBeenCalledWith({ typ: 'fel', text: 'Kunde inte spara källordningen. Försök igen.' })
  })

  it('snabb dubbel-omsortering: bara det senaste önskemålet skickas efter det pågående, slutordningen blir rätt', async () => {
    renderaHook()
    await waitFor(() => expect(ordning()).toBe('A,B,C'))

    klicka('bac')
    await vantaPaAnrop(1)
    klicka('cba') // innan första svaret
    await waitFor(() => expect(ordning()).toBe('C,B,A'))
    expect(anrop.length).toBe(1) // serialiserat: inget parallellt anrop

    await act(async () => { anrop[0].lyckas() })
    await vantaPaAnrop(2)
    // Diffat mot serverns bekräftade läge (B,A,C efter första anropet), inte mot startläget.
    expect(anrop[1].uppdateringar).toEqual([
      { sourceId: 3, isActive: true, sortOrder: 0 },
      { sourceId: 2, isActive: true, sortOrder: 1 },
      { sourceId: 1, isActive: true, sortOrder: 2 },
    ])
    await act(async () => { anrop[1].lyckas() })

    await waitFor(() => expect(serverOrdning()).toBe('C,B,A'))
    await waitFor(() => expect(ordning()).toBe('C,B,A'))
  })

  it('omsortering tillbaka till startordningen medan första anropet pågår når också servern', async () => {
    // Före fixen jämfördes mot föråldrad prefs: rader som återgick till sitt
    // ursprungsvärde hoppades över trots att servern redan fått det nya värdet.
    renderaHook()
    await waitFor(() => expect(ordning()).toBe('A,B,C'))

    klicka('bac')
    await vantaPaAnrop(1)
    klicka('abc') // tillbaka till start medan B,A,C är på väg
    await act(async () => { anrop[0].lyckas() })

    await vantaPaAnrop(2)
    await act(async () => { anrop[1].lyckas() })

    await waitFor(() => expect(serverOrdning()).toBe('A,B,C'))
    expect(ordning()).toBe('A,B,C')
  })

  it('första anropet misslyckas men en nyare ordning väntar: den skickas i stället och inget fel visas', async () => {
    renderaHook()
    await waitFor(() => expect(ordning()).toBe('A,B,C'))

    klicka('bac')
    await vantaPaAnrop(1)
    klicka('cba')
    await act(async () => { anrop[0].misslyckas(new Error('nät')) })

    await vantaPaAnrop(2)
    await act(async () => { anrop[1].lyckas() })

    await waitFor(() => expect(serverOrdning()).toBe('C,B,A'))
    expect(ordning()).toBe('C,B,A')
    expect(toast).not.toHaveBeenCalled()
  })
})
