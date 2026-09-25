import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MinaKallor from '../components/Profile/MinaKallor'
import PolisenBevakningarLista from '../components/Profile/MinaKallor/PolisenBevakningarLista'
import { PolisenBevakningarProvider } from '../context/PolisenBevakningarContext'
import * as sourcesApi from '../api/sources'
import * as userSourcesApi from '../api/userSources'
import * as bevakApi from '../api/polisenBevakningar'

// V3-9: Mina källor (lägg till/ta bort/radera alla) och Polisen-bevakningarna
// ska visa ett fel när servern sagt nej, låsa under pågående anrop och inte
// ändra listan om anropet misslyckats.
vi.mock('../api/sources')
vi.mock('../api/userSources')
vi.mock('../api/polisenBevakningar')
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, email: 'a@b.se', accessToken: 't' }) }))
vi.mock('../context/FeatureFlagsContext', () => ({
  useFlags: () => ({ kallor_lagg_till: false, kallor_aktiva: true, kallor_rekommenderade: false, kallor_alla: true, kallor_polisen_filter: false }),
}))

const kallorApi = vi.mocked(sourcesApi)
const anvKallorApi = vi.mocked(userSourcesApi)
const bevakningsApi = vi.mocked(bevakApi)

const KALLOR = [
  { id: 1, name: 'Krisinformation', shortName: 'Krisinformation' },
  { id: 2, name: 'Trafikverket', shortName: 'Trafikverket' },
] as unknown as Awaited<ReturnType<typeof sourcesApi.fetchSources>>

function renderaMinaKallor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MinaKallor />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  kallorApi.fetchSources.mockReset().mockResolvedValue(KALLOR)
  anvKallorApi.fetchUserSources.mockReset().mockResolvedValue([
    { sourceId: 1, shortName: 'Krisinformation', isActive: true, sortOrder: 0 },
  ])
  anvKallorApi.saveUserSources.mockReset()
  bevakningsApi.fetchBevakningar.mockReset()
  bevakningsApi.createBevakning.mockReset()
  bevakningsApi.updateBevakning.mockReset()
  bevakningsApi.deleteBevakning.mockReset()
})

describe('Mina källor', () => {
  it('misslyckad borttagning: felmeddelande syns och källan står kvar', async () => {
    const user = userEvent.setup()
    anvKallorApi.saveUserSources.mockRejectedValue(new Error('saveUserSources: 500'))
    renderaMinaKallor()

    await user.click(await screen.findByRole('button', { name: /Ta bort/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ändringen kunde inte sparas')
    expect(anvKallorApi.saveUserSources).toHaveBeenCalledTimes(1)
    // Cachen skrevs inte: källan är fortfarande aktiv
    expect(screen.getByRole('button', { name: /Ta bort/ })).toBeInTheDocument()
    expect(screen.queryByText('Inga aktiva källor')).not.toBeInTheDocument()
  })

  it('lyckad borttagning: källan försvinner ur listan, inget felmeddelande', async () => {
    const user = userEvent.setup()
    anvKallorApi.saveUserSources.mockResolvedValue(undefined)
    renderaMinaKallor()

    await user.click(await screen.findByRole('button', { name: /Ta bort/ }))

    expect(await screen.findByText('Inga aktiva källor')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('misslyckad tillägg: felmeddelande syns och källan blir inte aktiv', async () => {
    const user = userEvent.setup()
    anvKallorApi.saveUserSources.mockRejectedValue(new Error('saveUserSources: 500'))
    renderaMinaKallor()

    await user.click(await screen.findByRole('button', { name: /\+ Lägg till/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ändringen kunde inte sparas')
    expect(screen.getAllByRole('button', { name: /Ta bort/ })).toHaveLength(1)
  })

  it('låser kortet under pågående anrop så det inte skickas två gånger', async () => {
    const user = userEvent.setup()
    let avsluta!: () => void
    anvKallorApi.saveUserSources.mockReturnValue(new Promise<void>(resolve => { avsluta = resolve }))
    renderaMinaKallor()

    const knapp = await screen.findByRole('button', { name: /Ta bort/ })
    await user.click(knapp)
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).not.toBeNull())
    // Ett andra klick (t.ex. via tangentbord) går inte att skicka in
    knapp.click()
    expect(anvKallorApi.saveUserSources).toHaveBeenCalledTimes(1)

    avsluta()
    expect(await screen.findByText('Inga aktiva källor')).toBeInTheDocument()
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })
})

function renderaBevakningar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PolisenBevakningarProvider>
        <PolisenBevakningarLista kallNamn="Polisen" />
      </PolisenBevakningarProvider>
    </QueryClientProvider>,
  )
}

const bevakning: bevakApi.BevakningDto = { id: 'b1', kategorier: ['Inbrott'], omraden: null }

describe('Polisen-bevakningar (Mina källor)', () => {
  it('misslyckad ny bevakning: modalen står kvar med felmeddelande och Spara är aktiv igen', async () => {
    const user = userEvent.setup()
    bevakningsApi.fetchBevakningar.mockResolvedValue([])
    bevakningsApi.createBevakning.mockRejectedValue(new Error('createBevakning: 500'))
    renderaBevakningar()

    await user.click(await screen.findByRole('button', { name: '+ Ny bevakning' }))
    await user.click(screen.getByRole('button', { name: 'Spara' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bevakningen kunde inte sparas')
    // Modalen är kvar (användarens val bevaras) och knappen går att trycka på igen
    expect(screen.getByRole('button', { name: 'Spara' })).toBeEnabled()
    expect(screen.getByText(/Vad ska den här bevakningen visa/)).toBeInTheDocument()
  })

  it('lyckad ny bevakning: modalen stängs och bevakningen listas', async () => {
    const user = userEvent.setup()
    bevakningsApi.fetchBevakningar.mockResolvedValue([])
    bevakningsApi.createBevakning.mockResolvedValue({ id: 'b9', kategorier: null, omraden: null })
    renderaBevakningar()

    await user.click(await screen.findByRole('button', { name: '+ Ny bevakning' }))
    await user.click(screen.getByRole('button', { name: 'Spara' }))

    await waitFor(() => expect(screen.queryByText(/Vad ska den här bevakningen visa/)).not.toBeInTheDocument())
    expect(screen.getByText(/Alla typer · Alla områden/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('låser Spara under pågående anrop (ingen dubbel-submit)', async () => {
    const user = userEvent.setup()
    let avsluta!: (b: bevakApi.BevakningDto) => void
    bevakningsApi.fetchBevakningar.mockResolvedValue([])
    bevakningsApi.createBevakning.mockReturnValue(new Promise(resolve => { avsluta = resolve }))
    renderaBevakningar()

    await user.click(await screen.findByRole('button', { name: '+ Ny bevakning' }))
    await user.click(screen.getByRole('button', { name: 'Spara' }))

    const sparar = await screen.findByRole('button', { name: 'Sparar…' })
    expect(sparar).toBeDisabled()
    await user.click(sparar)
    expect(bevakningsApi.createBevakning).toHaveBeenCalledTimes(1)

    avsluta({ id: 'b9', kategorier: null, omraden: null })
    await waitFor(() => expect(screen.queryByText(/Vad ska den här bevakningen visa/)).not.toBeInTheDocument())
  })

  it('misslyckad borttagning: felmeddelande syns och bevakningen står kvar', async () => {
    const user = userEvent.setup()
    bevakningsApi.fetchBevakningar.mockResolvedValue([bevakning])
    bevakningsApi.deleteBevakning.mockRejectedValue(new Error('deleteBevakning: 500'))
    renderaBevakningar()

    await user.click(await screen.findByRole('button', { name: 'Ta bort' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bevakningen kunde inte tas bort')
    expect(screen.getByRole('button', { name: 'Ta bort' })).toBeEnabled()
    expect(screen.getByText(/Inbrott/)).toBeInTheDocument()
  })
})
