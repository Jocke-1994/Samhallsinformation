import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Del 2 av Schemalagd lanserings "Ny version"-tillägg (Beslut 2026-10-08):
// de två kryssrutorna "Skicka push till inloggade" och "Visa banderoll på
// sajten" i FormPanel. Skapas av ScheduledReleaseBackgroundService vid
// lanseringstidpunkten — det här testar bara att formuläret samlar in och
// validerar rätt data innan det skickas vidare.

vi.mock('../api/uppdateringar', async () => {
  const faktisk = await vi.importActual<typeof import('../api/uppdateringar')>('../api/uppdateringar')
  return {
    ...faktisk,
    fetchAdminUppdateringar: vi.fn().mockResolvedValue([]),
    createUppdatering: vi.fn(),
    updateUppdatering: vi.fn(),
    deleteUppdatering: vi.fn(),
  }
})
vi.mock('../api/featureFlags', () => ({ fetchAdminFeatureFlags: vi.fn().mockResolvedValue([]) }))
vi.mock('../api/faq', () => ({ fetchAdminFaq: vi.fn().mockResolvedValue([]) }))
vi.mock('../api/push', () => ({ sendNewVersionNotice: vi.fn() }))

const api = await import('../api/uppdateringar')
const { default: AdminUppdateringar } = await import('../components/Admin/AdminUppdateringar')

function rendera() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><AdminUppdateringar /></QueryClientProvider>)
}

async function öppnaOchFyllGrunduppgifter() {
  await userEvent.click(await screen.findByText('+ Ny uppdatering'))
  await userEvent.type(screen.getByPlaceholderText(/Logga in och skapa konto/), 'Titel')
  await userEvent.type(screen.getByPlaceholderText('Beskriv ändringen kort och tydligt...'), 'En rad text')
  await userEvent.click(screen.getByText('Schemalägg lansering'))
  const datumFält = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
  fireEvent.change(datumFält, { target: { value: '2026-11-01T10:00' } })
}

beforeEach(() => {
  vi.mocked(api.createUppdatering).mockReset()
  vi.mocked(api.updateUppdatering).mockReset()
})

describe('AdminUppdateringar — push vid lansering', () => {
  it('kryssrutan förifyller meddelandet från titeln, och Schemalägg är disabled utan version', async () => {
    rendera()
    await öppnaOchFyllGrunduppgifter()

    await userEvent.click(screen.getByText('Skicka push till inloggade'))
    const meddelandeFält = screen.getByPlaceholderText('Pushens meddelande') as HTMLInputElement
    expect(meddelandeFält.value).toBe('Titel')

    const knapp = screen.getByRole('button', { name: /Schemalägg|Sparas, publiceras automatiskt/ })
    expect(knapp).toBeDisabled() // Version saknas fortfarande

    await userEvent.type(screen.getByPlaceholderText(/Version, t.ex/), '0.9.0')
    expect(knapp).not.toBeDisabled()
  })

  it('sparar skickaPush/pushVersion/pushMeddelande när kryssrutan är ikryssad', async () => {
    vi.mocked(api.createUppdatering).mockResolvedValue({} as never)
    rendera()
    await öppnaOchFyllGrunduppgifter()

    await userEvent.click(screen.getByText('Skicka push till inloggade'))
    await userEvent.type(screen.getByPlaceholderText(/Version, t.ex/), '0.9.0')
    await userEvent.clear(screen.getByPlaceholderText('Pushens meddelande'))
    await userEvent.type(screen.getByPlaceholderText('Pushens meddelande'), 'Ett eget meddelande')

    await userEvent.click(screen.getByRole('button', { name: /Schemalägg|Sparas, publiceras automatiskt/ }))

    expect(vi.mocked(api.createUppdatering).mock.calls[0][0]).toMatchObject({
      skickaPush: true, pushVersion: '0.9.0', pushMeddelande: 'Ett eget meddelande',
    })
  })
})

describe('AdminUppdateringar — banderoll vid lansering', () => {
  it('kryssrutan är disabled tills minst en innehållsrad är ifylld', async () => {
    rendera()
    await userEvent.click(await screen.findByText('+ Ny uppdatering'))
    await userEvent.type(screen.getByPlaceholderText(/Logga in och skapa konto/), 'Titel')
    await userEvent.click(screen.getByText('Schemalägg lansering'))

    // Ingen text i raden ännu — harInnehåll är false.
    const banderollRuta = screen.getByText('Visa banderoll på sajten').closest('label')!.querySelector('input') as HTMLInputElement
    expect(banderollRuta).toBeDisabled()
    expect(screen.getByText('Kräver minst en ifylld innehållsrad.')).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Beskriv ändringen kort och tydligt...'), 'En rad text')
    expect(banderollRuta).not.toBeDisabled()
  })

  it('visar härledd målgrupp "bara inloggade" när ingen punkt syns för besökare', async () => {
    rendera()
    await öppnaOchFyllGrunduppgifter()

    // Standardpunkten är "alla" — byt till "Endast inloggade" först.
    await userEvent.click(screen.getByText('Endast inloggade'))
    await userEvent.click(screen.getByText('Visa banderoll på sajten'))

    expect(screen.getByText('Visas för: bara inloggade')).toBeInTheDocument()
  })

  it('visar härledd målgrupp "alla (även besökare)" när minst en punkt syns för besökare', async () => {
    rendera()
    await öppnaOchFyllGrunduppgifter()

    await userEvent.click(screen.getByText('Visa banderoll på sajten'))

    expect(screen.getByText('Visas för: alla (även besökare)')).toBeInTheDocument()
  })

  it('sparar visaBanderoll=true när ikryssad och innehåll finns', async () => {
    vi.mocked(api.createUppdatering).mockResolvedValue({} as never)
    rendera()
    await öppnaOchFyllGrunduppgifter()

    await userEvent.click(screen.getByText('Visa banderoll på sajten'))
    await userEvent.click(screen.getByRole('button', { name: /Schemalägg|Sparas, publiceras automatiskt/ }))

    expect(vi.mocked(api.createUppdatering).mock.calls[0][0]).toMatchObject({ visaBanderoll: true })
  })
})
