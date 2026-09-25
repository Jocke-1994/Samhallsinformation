import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PolisenBevakningarProvider, usePolisenBevakningar } from '../context/PolisenBevakningarContext'
import { SavedEventsProvider, useSavedEvents } from '../context/SavedEventsContext'
import * as bevakApi from '../api/polisenBevakningar'
import * as sparatApi from '../api/savedEvents'

// Regressionstester för V1-8 (E5#5): ett misslyckat anrop får aldrig tolkas som
// "tom lista". Kontexterna har lägena laddar | klar | fel, gör omförsök med
// backoff, hämtar om vid token-byte och behåller senast kända lista.

vi.mock('../api/polisenBevakningar')
vi.mock('../api/savedEvents')

let auth = { isLoggedIn: true, email: 'anna@example.se', accessToken: 'token-1' }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))

const mockBevak = vi.mocked(bevakApi)
const mockSparat = vi.mocked(sparatApi)

const uppsalaInbrott: bevakApi.BevakningDto = { id: 'b1', kategorier: ['Inbrott'], omraden: ['Uppsala'] }

function BevakProbe() {
  const { lage, bevakningar, matchar, forsokIgen } = usePolisenBevakningar()
  return (
    <div>
      <span data-testid="lage">{lage}</span>
      <span data-testid="antal">{bevakningar.length}</span>
      <span data-testid="stockholm">{String(matchar('Trafikolycka', 'Stockholm'))}</span>
      <span data-testid="uppsala">{String(matchar('Inbrott', 'Uppsala'))}</span>
      <button onClick={forsokIgen}>igen</button>
    </div>
  )
}

function SparatProbe() {
  const { lage, sparade, toggleSparad } = useSavedEvents()
  return (
    <div>
      <span data-testid="lage">{lage}</span>
      <span data-testid="ids">{[...sparade].join(',')}</span>
      <button onClick={() => toggleSparad('e1')}>toggla</button>
    </div>
  )
}

// ui är en fabrik: omrendera() måste ge NYA element, annars hoppar React över
// omrenderingen och den (mockade) useAuth läses inte om.
function renderaMed(ui: () => React.ReactElement) {
  const queryClient = new QueryClient()
  const helhet = () => (
    <QueryClientProvider client={queryClient}>{ui()}</QueryClientProvider>
  )
  const r = render(helhet())
  return { ...r, omrendera: () => r.rerender(helhet()) }
}

const lage = () => screen.getByTestId('lage').textContent
const text = (id: string) => screen.getByTestId(id).textContent

async function spola(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

beforeEach(() => {
  vi.useFakeTimers()
  auth = { isLoggedIn: true, email: 'anna@example.se', accessToken: 'token-1' }
  mockBevak.fetchBevakningar.mockReset()
  mockSparat.fetchSavedEventIds.mockReset()
  mockSparat.saveEvent.mockReset()
  mockSparat.unsaveEvent.mockReset()
})
afterEach(() => { vi.useRealTimers() })

describe('PolisenBevakningarContext — fel är inte "tom lista"', () => {
  it('misslyckad hämtning ger lage=fel, och Polisen-filtret faller INTE tillbaka på "visa allt"', async () => {
    mockBevak.fetchBevakningar.mockRejectedValue(new Error('fetchBevakningar: 401'))
    renderaMed(() => <PolisenBevakningarProvider><BevakProbe /></PolisenBevakningarProvider>)

    await spola(60_000) // alla omförsök förbrukade

    expect(lage()).toBe('fel')
    expect(text('antal')).toBe('0')
    expect(text('stockholm')).toBe('false') // gamla buggen: true (visa allt)
    expect(text('uppsala')).toBe('false')
  })

  it('laddar medan omförsök pågår och matchar inte alla under tiden', async () => {
    mockBevak.fetchBevakningar.mockRejectedValue(new Error('nätverk'))
    renderaMed(() => <PolisenBevakningarProvider><BevakProbe /></PolisenBevakningarProvider>)

    await spola(500)

    expect(lage()).toBe('laddar')
    expect(text('stockholm')).toBe('false')
  })

  it('omförsök med exponentiell backoff (1 s, 2 s, 4 s) och sedan stopp', async () => {
    mockBevak.fetchBevakningar.mockRejectedValue(new Error('nätverk'))
    renderaMed(() => <PolisenBevakningarProvider><BevakProbe /></PolisenBevakningarProvider>)

    await spola(0)
    expect(mockBevak.fetchBevakningar).toHaveBeenCalledTimes(1)
    await spola(999)
    expect(mockBevak.fetchBevakningar).toHaveBeenCalledTimes(1)
    await spola(1)
    expect(mockBevak.fetchBevakningar).toHaveBeenCalledTimes(2) // +1 s
    await spola(1999)
    expect(mockBevak.fetchBevakningar).toHaveBeenCalledTimes(2)
    await spola(1)
    expect(mockBevak.fetchBevakningar).toHaveBeenCalledTimes(3) // +2 s
    await spola(4000)
    expect(mockBevak.fetchBevakningar).toHaveBeenCalledTimes(4) // +4 s
    await spola(120_000)
    expect(mockBevak.fetchBevakningar).toHaveBeenCalledTimes(4) // inga fler
    expect(lage()).toBe('fel')
  })

  it('ett omförsök som lyckar fyller listan och ger lage=klar', async () => {
    mockBevak.fetchBevakningar
      .mockRejectedValueOnce(new Error('tillfälligt'))
      .mockResolvedValueOnce([uppsalaInbrott])
    renderaMed(() => <PolisenBevakningarProvider><BevakProbe /></PolisenBevakningarProvider>)

    await spola(1500)

    expect(lage()).toBe('klar')
    expect(text('antal')).toBe('1')
    expect(text('uppsala')).toBe('true')
    expect(text('stockholm')).toBe('false')
  })

  it('omhämtning efter token-byte (lyckad refresh/inloggning) fyller listan direkt', async () => {
    mockBevak.fetchBevakningar.mockRejectedValue(new Error('fetchBevakningar: 401'))
    const { omrendera } = renderaMed(() => <PolisenBevakningarProvider><BevakProbe /></PolisenBevakningarProvider>)
    await spola(60_000)
    expect(lage()).toBe('fel')

    mockBevak.fetchBevakningar.mockResolvedValue([uppsalaInbrott])
    auth = { ...auth, accessToken: 'token-2' } // sessionen förnyad
    omrendera()
    await spola(0)

    expect(lage()).toBe('klar')
    expect(text('antal')).toBe('1')
    expect(text('stockholm')).toBe('false')
  })

  it('"Försök igen" hämtar om', async () => {
    mockBevak.fetchBevakningar.mockRejectedValue(new Error('x'))
    renderaMed(() => <PolisenBevakningarProvider><BevakProbe /></PolisenBevakningarProvider>)
    await spola(60_000)
    expect(lage()).toBe('fel')

    mockBevak.fetchBevakningar.mockResolvedValue([])
    fireEvent.click(screen.getByText('igen'))
    await spola(0)

    expect(lage()).toBe('klar')
    expect(text('stockholm')).toBe('true') // riktigt tom, bekräftad lista = allt syns
  })

  it('en lyckad tom lista (bekräftat "inga bevakningar") visar fortfarande allt', async () => {
    mockBevak.fetchBevakningar.mockResolvedValue([])
    renderaMed(() => <PolisenBevakningarProvider><BevakProbe /></PolisenBevakningarProvider>)
    await spola(0)

    expect(lage()).toBe('klar')
    expect(text('stockholm')).toBe('true')
  })

  it('misslyckad omhämtning efter lyckad hämtning behåller senast kända lista', async () => {
    mockBevak.fetchBevakningar.mockResolvedValueOnce([uppsalaInbrott])
    renderaMed(() => <PolisenBevakningarProvider><BevakProbe /></PolisenBevakningarProvider>)
    await spola(0)
    expect(text('antal')).toBe('1')

    mockBevak.fetchBevakningar.mockRejectedValue(new Error('x'))
    fireEvent.click(screen.getByText('igen'))
    await spola(60_000)

    expect(lage()).toBe('klar')
    expect(text('antal')).toBe('1')
    expect(text('stockholm')).toBe('false')
  })
})

describe('SavedEventsContext — fel är inte "inget sparat"', () => {
  it('misslyckad hämtning ger lage=fel, och toggle gör inget anrop (ingen gissning)', async () => {
    mockSparat.fetchSavedEventIds.mockRejectedValue(new Error('fetchSavedEventIds: 401'))
    renderaMed(() => <SavedEventsProvider><SparatProbe /></SavedEventsProvider>)

    await spola(60_000)
    expect(lage()).toBe('fel')

    fireEvent.click(screen.getByText('toggla'))
    expect(mockSparat.saveEvent).not.toHaveBeenCalled()
    expect(text('ids')).toBe('')
  })

  it('omhämtning efter token-byte fyller listan', async () => {
    mockSparat.fetchSavedEventIds.mockRejectedValue(new Error('401'))
    const { omrendera } = renderaMed(() => <SavedEventsProvider><SparatProbe /></SavedEventsProvider>)
    await spola(60_000)
    expect(lage()).toBe('fel')

    mockSparat.fetchSavedEventIds.mockResolvedValue(['e1', 'e2'])
    auth = { ...auth, accessToken: 'token-2' }
    omrendera()
    await spola(0)

    expect(lage()).toBe('klar')
    expect(text('ids')).toBe('e1,e2')
  })

  it('toggle på känd lista är optimistisk och rullas tillbaka vid fel', async () => {
    mockSparat.fetchSavedEventIds.mockResolvedValue([])
    mockSparat.saveEvent.mockImplementation(
      () => new Promise<void>((_, avvisa) => setTimeout(() => avvisa(new Error('500')), 1000)))
    renderaMed(() => <SavedEventsProvider><SparatProbe /></SavedEventsProvider>)
    await spola(0)

    fireEvent.click(screen.getByText('toggla'))
    await spola(0)
    expect(text('ids')).toBe('e1') // optimistiskt
    await spola(1000)
    await spola(0) // låt react-querys notifiering av tillbakarullningen köras
    await spola(5000)

    expect(mockSparat.saveEvent).toHaveBeenCalledWith('e1')
    expect(text('ids')).toBe('')
  })
})
