import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SavedEventsProvider, useSavedEvents } from '../context/SavedEventsContext'
import { PolisenBevakningarProvider } from '../context/PolisenBevakningarContext'
import BevakningsToastHost from '../components/NewsFeed/BevakningsToastHost'
import { stängBevakningsToast } from '../components/NewsFeed/bevakningsToastStore'
import * as savedApi from '../api/savedEvents'
import * as bevakApi from '../api/polisenBevakningar'

// V3-9: en misslyckad Spara/Ta bort i Sparat ska rullas tillbaka (det gjorde den
// redan) OCH synas för användaren, och ett andra tryck under pågående anrop
// ska inte skicka ett andra anrop.
vi.mock('../api/savedEvents')
vi.mock('../api/polisenBevakningar')
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: true, email: 'a@b.se', accessToken: 't' }),
}))

const sparatApi = vi.mocked(savedApi)
const bevakningsApi = vi.mocked(bevakApi)

function SparaKnapp({ id }: { id: string }) {
  const { sparade, toggleSparad } = useSavedEvents()
  return (
    <button onClick={() => toggleSparad(id)}>{sparade.has(id) ? 'Sparad' : 'Ej sparad'}</button>
  )
}

function rendera() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PolisenBevakningarProvider>
        <SavedEventsProvider>
          <SparaKnapp id="e1" />
          <SparaKnapp id="e2" />
        </SavedEventsProvider>
        <BevakningsToastHost />
      </PolisenBevakningarProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  sparatApi.fetchSavedEventIds.mockReset().mockResolvedValue(['e2'])
  sparatApi.saveEvent.mockReset()
  sparatApi.unsaveEvent.mockReset()
  bevakningsApi.fetchBevakningar.mockReset().mockResolvedValue([])
})

afterEach(() => {
  stängBevakningsToast()
})

describe('Sparat (toggleSparad)', () => {
  it('lyckad spara: ikonen slår om och inget felmeddelande visas', async () => {
    const user = userEvent.setup()
    sparatApi.saveEvent.mockResolvedValue(undefined)
    rendera()

    await user.click(await screen.findByRole('button', { name: 'Ej sparad' }))

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Sparad' })).toHaveLength(2))
    expect(sparatApi.saveEvent).toHaveBeenCalledExactlyOnceWith('e1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('misslyckad spara: rullar tillbaka ikonen och visar ett felmeddelande', async () => {
    const user = userEvent.setup()
    sparatApi.saveEvent.mockRejectedValue(new Error('saveEvent: 500'))
    rendera()

    await user.click(await screen.findByRole('button', { name: 'Ej sparad' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte spara händelsen')
    expect(screen.getByRole('button', { name: 'Ej sparad' })).toBeInTheDocument()
  })

  it('misslyckad borttagning: händelsen står kvar som sparad och felet visas', async () => {
    const user = userEvent.setup()
    sparatApi.unsaveEvent.mockRejectedValue(new Error('unsaveEvent: 500'))
    rendera()

    // e2 är redan sparad; e1 är inte det
    const sparadKnapp = await screen.findByRole('button', { name: 'Sparad' })
    await user.click(sparadKnapp)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kunde inte ta bort händelsen ur Sparat',
    )
    expect(screen.getByRole('button', { name: 'Sparad' })).toBeInTheDocument()
  })

  it('skickar bara ett anrop när man trycker två gånger medan det första pågår', async () => {
    const user = userEvent.setup()
    let avsluta!: () => void
    sparatApi.saveEvent.mockReturnValue(
      new Promise<void>((resolve) => {
        avsluta = resolve
      }),
    )
    rendera()

    const knapp = await screen.findByRole('button', { name: 'Ej sparad' })
    await user.click(knapp)
    await user.click(screen.getAllByRole('button')[0])
    expect(sparatApi.saveEvent).toHaveBeenCalledTimes(1)
    expect(sparatApi.unsaveEvent).not.toHaveBeenCalled()

    avsluta()
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Sparad' })).toHaveLength(2))
  })
})
