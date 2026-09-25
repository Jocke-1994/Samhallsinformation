import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PrenumerationsKlocka from '../components/NewsFeed/PrenumerationsKlocka'
import BevakningsToastHost from '../components/NewsFeed/BevakningsToastHost'
import { stängBevakningsToast } from '../components/NewsFeed/bevakningsToastStore'
import { PolisenBevakningarProvider } from '../context/PolisenBevakningarContext'
import * as api from '../api/polisenBevakningar'

// API-lagret mockas; kontexten (PolisenBevakningarProvider) är den riktiga, så
// att testerna fångar det verkliga beteendet: när en bevakning tas bort/skapas
// ändras context-state och klockan kan därefter avmonteras/returnera null —
// exakt det som gjorde att toasten aldrig syntes (E7#3).
vi.mock('../api/polisenBevakningar')
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true }) }))

const mockApi = vi.mocked(api)

const inbrott: api.BevakningDto = { id: 'b1', kategorier: ['Inbrott'], omraden: null }
const stold:   api.BevakningDto = { id: 'b2', kategorier: ['Stöld'],   omraden: null }

function renderaKlocka(props: { mode: 'allt' | 'mitt'; typ: string | null; omrade: string | null }) {
  // Färsk QueryClient per render: kontexten hämtar via react-query
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PolisenBevakningarProvider>
        <PrenumerationsKlocka polisenTyp={props.typ} polisenOmrade={props.omrade} mode={props.mode} />
        <BevakningsToastHost />
      </PolisenBevakningarProvider>
    </QueryClientProvider>,
  )
}

// Väntar tills bevakningarna hunnit hämtas (klockan är annars null i Mitt-läget)
async function väntaPåKlocka(namn: string) {
  return screen.findByRole('button', { name: namn })
}

beforeEach(() => {
  mockApi.fetchBevakningar.mockReset()
  mockApi.createBevakning.mockReset()
  mockApi.deleteBevakning.mockReset()
})

afterEach(() => {
  stängBevakningsToast()
})

describe('PrenumerationsKlocka — Mitt-läget, borttagning', () => {
  it('visar toast med Ångra efter borttagning, och Ångra återskapar bevakningen', async () => {
    const user = userEvent.setup()
    mockApi.fetchBevakningar.mockResolvedValue([inbrott, stold])
    mockApi.deleteBevakning.mockResolvedValue(undefined)
    mockApi.createBevakning.mockResolvedValue({ id: 'b3', kategorier: ['Inbrott'], omraden: null })

    renderaKlocka({ mode: 'mitt', typ: 'Inbrott', omrade: null })

    await user.click(await väntaPåKlocka('Hantera bevakning'))
    await user.click(screen.getByRole('button', { name: 'Ta bort den här bevakningen' }))

    // Klockan själv avmonteras nu (ingen bevakning matchar kvar) — toasten ska ändå synas
    expect(await screen.findByRole('status')).toHaveTextContent('Bevakning borttagen')
    expect(screen.queryByRole('button', { name: 'Hantera bevakning' })).not.toBeInTheDocument()
    expect(mockApi.deleteBevakning).toHaveBeenCalledExactlyOnceWith('b1')

    await user.click(screen.getByRole('button', { name: 'Ångra' }))

    await waitFor(() => expect(mockApi.createBevakning).toHaveBeenCalledExactlyOnceWith({ kategorier: ['Inbrott'], omraden: null }))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    // Bevakningen är tillbaka i kontexten, så klockan matchar och visas igen
    expect(await väntaPåKlocka('Hantera bevakning')).toBeInTheDocument()
  })

  it('visar serverfel vid borttagning och lämnar bevakningen kvar', async () => {
    const user = userEvent.setup()
    mockApi.fetchBevakningar.mockResolvedValue([inbrott, stold])
    mockApi.deleteBevakning.mockRejectedValue(new Error('deleteBevakning: 500'))

    renderaKlocka({ mode: 'mitt', typ: 'Inbrott', omrade: null })

    await user.click(await väntaPåKlocka('Hantera bevakning'))
    await user.click(screen.getByRole('button', { name: 'Ta bort den här bevakningen' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte ta bort bevakningen')
    // UI-tillståndet är återställt: menyn stängd, bevakningen kvar, klockan kvar
    expect(screen.queryByRole('button', { name: 'Ta bort den här bevakningen' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hantera bevakning' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ångra' })).not.toBeInTheDocument()
  })

  it('visar fel om Ångra misslyckas', async () => {
    const user = userEvent.setup()
    mockApi.fetchBevakningar.mockResolvedValue([inbrott, stold])
    mockApi.deleteBevakning.mockResolvedValue(undefined)
    mockApi.createBevakning.mockRejectedValue(new Error('createBevakning: 500'))

    renderaKlocka({ mode: 'mitt', typ: 'Inbrott', omrade: null })

    await user.click(await väntaPåKlocka('Hantera bevakning'))
    await user.click(screen.getByRole('button', { name: 'Ta bort den här bevakningen' }))
    await user.click(await screen.findByRole('button', { name: 'Ångra' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte återskapa bevakningen')
  })
})

describe('PrenumerationsKlocka — Mitt-läget, sista bevakningen', () => {
  async function öppnaVarning(user: ReturnType<typeof userEvent.setup>) {
    mockApi.fetchBevakningar.mockResolvedValue([inbrott])
    renderaKlocka({ mode: 'mitt', typ: 'Inbrott', omrade: null })
    await user.click(await väntaPåKlocka('Hantera bevakning'))
    await user.click(screen.getByRole('button', { name: 'Ta bort den här bevakningen' }))
  }

  it('varnar innan den sista bevakningen tas bort, och Avbryt gör ingenting', async () => {
    const user = userEvent.setup()
    await öppnaVarning(user)

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Mitt flöde')
    expect(dialog).toHaveTextContent('hela landet')
    expect(mockApi.deleteBevakning).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Avbryt' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(mockApi.deleteBevakning).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hantera bevakning' })).toBeInTheDocument()
  })

  it('tar bort den sista bevakningen efter bekräftelse och visar Ångra', async () => {
    const user = userEvent.setup()
    mockApi.deleteBevakning.mockResolvedValue(undefined)
    await öppnaVarning(user)

    await user.click(await screen.findByRole('button', { name: 'Ta bort ändå' }))

    expect(mockApi.deleteBevakning).toHaveBeenCalledExactlyOnceWith('b1')
    const toast = await screen.findByRole('status')
    expect(toast).toHaveTextContent('Bevakning borttagen')
    expect(toast).toHaveTextContent('hela landet')
    expect(screen.getByRole('button', { name: 'Ångra' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('frågar inte om bekräftelse när det finns fler bevakningar', async () => {
    const user = userEvent.setup()
    mockApi.fetchBevakningar.mockResolvedValue([inbrott, stold])
    mockApi.deleteBevakning.mockResolvedValue(undefined)
    renderaKlocka({ mode: 'mitt', typ: 'Inbrott', omrade: null })

    await user.click(await väntaPåKlocka('Hantera bevakning'))
    await user.click(screen.getByRole('button', { name: 'Ta bort den här bevakningen' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(mockApi.deleteBevakning).toHaveBeenCalledExactlyOnceWith('b1'))
  })
})

describe('PrenumerationsKlocka — Allt-läget, skapande', () => {
  it('visar bekräftelse även när båda raderna blir täckta och klockan försvinner', async () => {
    const user = userEvent.setup()
    mockApi.fetchBevakningar.mockResolvedValue([])
    mockApi.createBevakning.mockResolvedValue({ id: 'n1', kategorier: ['Inbrott'], omraden: ['Uppsala'] })

    renderaKlocka({ mode: 'allt', typ: 'Inbrott', omrade: 'Uppsala' })

    await user.click(await väntaPåKlocka('Skapa bevakning'))
    await user.click(screen.getByRole('button', { name: /båda/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Ny bevakning: Inbrott i Uppsala')
    expect(mockApi.createBevakning).toHaveBeenCalledExactlyOnceWith({ kategorier: ['Inbrott'], omraden: ['Uppsala'] })
    // Både typ och område täcks nu, så klockan har avmonterats
    expect(screen.queryByRole('button', { name: 'Skapa bevakning' })).not.toBeInTheDocument()
  })

  it('visar serverfel vid skapande i stället för att svälja det', async () => {
    const user = userEvent.setup()
    mockApi.fetchBevakningar.mockResolvedValue([])
    mockApi.createBevakning.mockRejectedValue(new Error('createBevakning: 500'))

    renderaKlocka({ mode: 'allt', typ: 'Inbrott', omrade: 'Uppsala' })

    await user.click(await väntaPåKlocka('Skapa bevakning'))
    await user.click(screen.getByRole('button', { name: /båda/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte skapa bevakningen')
    // Inget skapades, så klockan finns kvar och kan användas igen
    expect(screen.getByRole('button', { name: 'Skapa bevakning' })).toBeInTheDocument()
  })
})
