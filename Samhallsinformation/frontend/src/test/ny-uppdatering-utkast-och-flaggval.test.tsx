import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Uppdatering } from '../api/uppdateringar'

// 2026-11-02: användaren stängde "Ny uppdatering" av misstag och allt ifyllt
// försvann. Dessutom gick bara flaggor markerade "redo att lanseras" att välja,
// och checklistan varnade för en avstängd profilsida i just den lansering som
// slår på den.

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

const { createUppdatering } = await import('../api/uppdateringar')
const { default: AdminUppdateringar } = await import('../components/Admin/AdminUppdateringar')
const { UTKAST_NYCKEL } = await import('../lib/nyUppdateringUtkast')

function rendera() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><AdminUppdateringar /></QueryClientProvider>)
}

const titelFält = () => screen.getByPlaceholderText(/Logga in och skapa konto/) as HTMLInputElement

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('Ny uppdatering — osparat utkast', () => {
  it('finns kvar efter att panelen stängts och öppnats igen', async () => {
    rendera()
    await userEvent.click(await screen.findByText('+ Ny uppdatering'))
    await userEvent.type(titelFält(), 'Platsfilter')
    await userEvent.type(screen.getByPlaceholderText('Beskriv ändringen kort och tydligt...'), 'En rad')
    await userEvent.click(screen.getByRole('button', { name: 'Stäng formuläret' }))

    await userEvent.click(await screen.findByText('+ Ny uppdatering'))

    expect(titelFält().value).toBe('Platsfilter')
    expect(screen.getByDisplayValue('En rad')).toBeInTheDocument()
    expect(screen.getByText('Ditt osparade utkast är återställt.')).toBeInTheDocument()
  })

  it('"Börja om" tömmer formuläret och utkastet', async () => {
    localStorage.setItem(UTKAST_NYCKEL, JSON.stringify({
      titel: 'Gammalt', datum: '2026-11-03', punkter: [{ typ: 'ny-funktion', plats: 'Allmänt', text: 'x', synlighet: 'alla' }],
      schemalagd: false, schemaDatum: '', valdaFlaggor: [], skickaPush: false, pushVersion: '', pushMeddelande: '',
      visaBanderoll: false, visaVadArNytt: false, annonsera: false, annonseDatum: '', pushSkickaVid: 'Lansering',
    }))
    rendera()
    await userEvent.click(await screen.findByText('+ Ny uppdatering'))
    expect(titelFält().value).toBe('Gammalt')

    await userEvent.click(screen.getByRole('button', { name: 'Börja om' }))

    expect(titelFält().value).toBe('')
    expect(localStorage.getItem(UTKAST_NYCKEL)).toBeNull()
  })

  it('rensas när uppdateringen sparats', async () => {
    vi.mocked(createUppdatering).mockResolvedValue({ id: 'ny' } as Uppdatering)
    rendera()
    await userEvent.click(await screen.findByText('+ Ny uppdatering'))
    await userEvent.type(titelFält(), 'Klar')
    await userEvent.type(screen.getByPlaceholderText('Beskriv ändringen kort och tydligt...'), 'Text')
    expect(localStorage.getItem(UTKAST_NYCKEL)).not.toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Spara som utkast' }))

    await vi.waitFor(() => expect(createUppdatering).toHaveBeenCalled())
    await vi.waitFor(() => expect(localStorage.getItem(UTKAST_NYCKEL)).toBeNull())
  })
})

describe('Ny uppdatering — flaggval och checklista', () => {
  async function schemalägg() {
    rendera()
    await userEvent.click(await screen.findByText('+ Ny uppdatering'))
    await userEvent.type(titelFält(), 'Titel')
    await userEvent.click(screen.getByText('Schemalägg lansering'))
    const datumFält = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
    fireEvent.change(datumFält, { target: { value: '2026-11-03T09:00' } })
  }

  it('alla avstängda riktiga flaggor går att välja, även utan "redo"-markering — mock-flaggor inte', async () => {
    await schemalägg()

    expect(await screen.findByRole('button', { name: 'flode_dela' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'uppdateringar_vad_ar_nytt' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'konto_tvafaktor' })).not.toBeInTheDocument()
  })

  it('varnar inte för avstängd profilsida när lanseringen själv slår på den', async () => {
    await schemalägg()
    await userEvent.type(screen.getByPlaceholderText('Beskriv ändringen kort och tydligt...'), 'Bara för inloggade')
    await userEvent.click(screen.getByText('Endast inloggade'))
    const varning = /Profil → Uppdateringar är avstängd/
    expect(screen.getByText(varning)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'uppdateringar_senaste' }))

    expect(screen.queryByText(varning)).not.toBeInTheDocument()
  })

  it('fliken Profil visar även "Endast inloggade"-rader, när profilsidan slås på', async () => {
    await schemalägg()
    await userEvent.type(screen.getByPlaceholderText('Beskriv ändringen kort och tydligt...'), 'Bara för inloggade')
    await userEvent.click(screen.getByText('Endast inloggade'))
    await userEvent.click(screen.getByRole('tab', { name: 'Profil' }))
    await userEvent.click(screen.getByRole('button', { name: 'Inloggad' }))
    expect(screen.getByText(/Profil → Uppdateringar är avstängd för användarna/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'uppdateringar_senaste' }))

    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Bara för inloggade')).toBeInTheDocument()
  })

  it('varnar när Vad är nytt är ikryssad men rutan inte slås på', async () => {
    await schemalägg()
    await userEvent.type(screen.getByPlaceholderText('Beskriv ändringen kort och tydligt...'), 'Text')
    await userEvent.click(screen.getByText('Visa som Vad är nytt'))
    const varning = /själva rutan är avstängd för användarna/
    expect(screen.getByText(varning)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'uppdateringar_vad_ar_nytt' }))

    expect(screen.queryByText(varning)).not.toBeInTheDocument()
  })
})
