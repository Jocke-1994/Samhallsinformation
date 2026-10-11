import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Del 3 av Schemalagd lanserings "Ny version"-tillägg (Beslut 2026-10-08):
// "Annonsera i förväg" (eget, tidigare datum) + "Skicka vid"-väljaren för
// push. Skapas/körs av ScheduledReleaseBackgroundService i två faser — det
// här testar bara att formuläret samlar in och validerar rätt data.

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
  fireEvent.change(datumFält, { target: { value: '2026-11-15T10:00' } })
}

function knappSchemalägg() {
  return screen.getByRole('button', { name: /Schemalägg|Sparas, publiceras automatiskt/ })
}

function annonseringsFält() {
  const label = screen.getByText('Annonseringsdatum/tid (din lokala tid)')
  return label.parentElement!.querySelector('input[type="datetime-local"]') as HTMLInputElement
}

beforeEach(() => {
  vi.mocked(api.createUppdatering).mockReset()
  vi.mocked(api.updateUppdatering).mockReset()
})

describe('AdminUppdateringar — annonsering i förväg', () => {
  it('kryssrutan visar ett eget datumfält, och Schemalägg är disabled om annonseringen ligger EFTER lanseringen', async () => {
    rendera()
    await öppnaOchFyllGrunduppgifter() // lansering = 2026-11-15T10:00

    await userEvent.click(screen.getByText('Annonsera i förväg'))
    const annonseringFält = annonseringsFält()

    fireEvent.change(annonseringFält, { target: { value: '2026-11-20T10:00' } }) // efter lanseringen!
    expect(screen.getByText('Måste vara före lanseringsdatumet.')).toBeInTheDocument()
    expect(knappSchemalägg()).toBeDisabled()

    fireEvent.change(annonseringFält, { target: { value: '2026-11-10T10:00' } }) // före — giltigt
    expect(knappSchemalägg()).not.toBeDisabled()
  })

  it('"Skicka vid"-väljaren syns bara när både push och annonsering är ikryssade, standard är Lansering', async () => {
    rendera()
    await öppnaOchFyllGrunduppgifter()

    expect(screen.queryByText('Skicka vid')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Skicka push till inloggade'))
    expect(screen.queryByText('Skicka vid')).not.toBeInTheDocument() // bara push, ingen annonsering än

    await userEvent.click(screen.getByText('Annonsera i förväg'))
    expect(screen.getByText('Skicka vid')).toBeInTheDocument()
    expect(screen.getByText('Lansering')).toBeInTheDocument()
  })

  it('sparar annonseringUtc och pushSkickaVid korrekt', async () => {
    vi.mocked(api.createUppdatering).mockResolvedValue({} as never)
    rendera()
    await öppnaOchFyllGrunduppgifter()

    await userEvent.click(screen.getByText('Annonsera i förväg'))
    fireEvent.change(annonseringsFält(), { target: { value: '2026-11-10T10:00' } })

    await userEvent.click(screen.getByText('Skicka push till inloggade'))
    await userEvent.type(screen.getByPlaceholderText(/Version, t.ex/), '1.0.0')
    await userEvent.click(screen.getByText('Båda'))

    await userEvent.click(knappSchemalägg())

    const payload = vi.mocked(api.createUppdatering).mock.calls[0][0]
    expect(payload.annonseringUtc).toBe(new Date('2026-11-10T10:00').toISOString())
    expect(payload.pushSkickaVid).toBe('Båda')
  })

  it('utan "Annonsera i förväg" skickas annonseringUtc=null och pushSkickaVid="Lansering"', async () => {
    vi.mocked(api.createUppdatering).mockResolvedValue({} as never)
    rendera()
    await öppnaOchFyllGrunduppgifter()

    await userEvent.click(knappSchemalägg())

    const payload = vi.mocked(api.createUppdatering).mock.calls[0][0]
    expect(payload.annonseringUtc).toBeNull()
    expect(payload.pushSkickaVid).toBe('Lansering')
  })
})
