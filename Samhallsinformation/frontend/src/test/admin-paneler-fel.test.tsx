import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FaqItem } from '../api/faq'
import type { MaintenanceBanner } from '../api/maintenanceBanners'
import type { Uppdatering } from '../api/uppdateringar'

// V3-8 (E6#8 + E6#10): FAQ, Driftmeddelanden och Uppdateringar. Hämtfel -> fel + Försök igen
// (inte tomt-läge, inte 0); spara stänger panelen FÖRST vid lyckat svar och behåller
// inmatningen (med serverns/reservtext) vid fel; knappen låses medan anropet pågår.

vi.mock('../api/faq', () => ({
  fetchAdminFaq: vi.fn(), createFaqItem: vi.fn(), updateFaqItem: vi.fn(), deleteFaqItem: vi.fn(),
}))
vi.mock('../api/maintenanceBanners', () => ({
  fetchAdminMaintenanceBanners: vi.fn(), createMaintenanceBanner: vi.fn(),
  updateMaintenanceBanner: vi.fn(), deleteMaintenanceBanner: vi.fn(),
}))
vi.mock('../api/uppdateringar', () => ({
  fetchAdminUppdateringar: vi.fn(), createUppdatering: vi.fn(), updateUppdatering: vi.fn(), deleteUppdatering: vi.fn(),
}))
vi.mock('../api/featureFlags', () => ({ fetchAdminFeatureFlags: vi.fn() }))
vi.mock('../api/push', () => ({ sendNewVersionNotice: vi.fn() }))
vi.mock('../context/FeatureFlagsContext', () => ({ useFeatureFlagsAdmin: () => ({ flaggor: {} }) }))

const faq = await import('../api/faq')
const banner = await import('../api/maintenanceBanners')
const uppd = await import('../api/uppdateringar')
const { fetchAdminFeatureFlags } = await import('../api/featureFlags')
const { default: AdminFaq } = await import('../components/Admin/AdminFaq')
const { default: MaintenanceBannerAdmin } = await import('../components/Admin/MaintenanceBannerAdmin')
const { default: AdminUppdateringar } = await import('../components/Admin/AdminUppdateringar')

function rendera(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}
const väntaLite = () => new Promise(r => setTimeout(r, 50))
const modalRuta = (rubrik: string) => screen.getByText(rubrik).closest('.fixed') as HTMLElement

const FRÅGA: FaqItem = { id: 'f1', kategori: 'Konto', publicerad: true, fraga: 'Hur byter jag lösenord?', svar: 'Under Konto.', flagKey: null }
const BANNER: MaintenanceBanner = { id: 'b1', message: 'Underhåll på lördag', startUtc: '2026-10-03T08:00:00Z', endUtc: '2026-10-03T12:00:00Z', audience: 'Alla', stil: 'Drift', rubrik: null, lankUrl: null }
const UPPD: Uppdatering = {
  id: 'u1', titel: 'Version 0.7', datum: '2026-09-20T00:00:00Z', publicerad: false, schemalagdPubliceringUtc: null,
  schemalagdaFlaggor: [], punkter: [{ id: 'p1', typ: 'buggfix', plats: 'Allmänt', text: 'Fixade en bugg', synlighet: 'alla' }],
  skickaPush: false, pushVersion: null, pushMeddelande: null, visaBanderoll: false,
  annonseringUtc: null, annonseradUtc: null, pushSkickaVid: 'Lansering', createdAt: '2026-09-20T00:00:00Z',
}

beforeEach(() => {
  for (const modul of [faq, banner, uppd]) for (const f of Object.values(modul)) (f as ReturnType<typeof vi.fn>).mockReset()
  vi.mocked(fetchAdminFeatureFlags).mockReset().mockResolvedValue([])
  vi.mocked(faq.fetchAdminFaq).mockResolvedValue([FRÅGA])
  vi.mocked(banner.fetchAdminMaintenanceBanners).mockResolvedValue([BANNER])
  vi.mocked(uppd.fetchAdminUppdateringar).mockResolvedValue([UPPD])
})

// ---------------------------------------------------------------------------
describe('FAQ (admin)', () => {
  it('hämtfel: felmeddelande + Försök igen, "—" i korten, aldrig "Inga frågor i den här kategorin"', async () => {
    vi.mocked(faq.fetchAdminFaq).mockRejectedValueOnce(new Error('fetchAdminFaq: 500')).mockResolvedValue([FRÅGA])
    rendera(<AdminFaq />)

    const fel = await screen.findByRole('alert')
    expect(fel).toHaveTextContent('Kunde inte hämta frågorna')
    expect(screen.queryByText('Inga frågor i den här kategorin.')).not.toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(6)

    await userEvent.click(screen.getByRole('button', { name: 'Försök igen' }))
    expect(await screen.findByText('Hur byter jag lösenord?')).toBeInTheDocument()
  })

  it('tomt svar: "Inga frågor i den här kategorin." och nollor', async () => {
    vi.mocked(faq.fetchAdminFaq).mockResolvedValue([])
    rendera(<AdminFaq />)

    expect(await screen.findByText('Inga frågor i den här kategorin.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  async function fyllINyFråga() {
    await userEvent.click(await screen.findByRole('button', { name: '+ Ny fråga' }))
    await userEvent.type(screen.getByPlaceholderText(/Varför fick jag ingen notis/), 'Ny fråga?')
    await userEvent.type(screen.getByPlaceholderText(/Beskriv svaret tydligt/), 'Ett långt svar')
  }

  it('spara misslyckas: panelen och texten kvar, felet visas', async () => {
    vi.mocked(faq.createFaqItem).mockRejectedValue(new Error('Frågan finns redan.'))
    rendera(<AdminFaq />)
    await fyllINyFråga()
    await userEvent.click(screen.getByRole('button', { name: 'Skapa fråga' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Frågan finns redan.')
    expect(screen.getByPlaceholderText(/Beskriv svaret tydligt/)).toHaveValue('Ett långt svar')
  })

  it('spara lyckas: panelen stänger först när servern svarat', async () => {
    let lös: (f: FaqItem) => void = () => {}
    vi.mocked(faq.createFaqItem).mockImplementation(() => new Promise<FaqItem>(res => { lös = res }))
    rendera(<AdminFaq />)
    await fyllINyFråga()
    await userEvent.click(screen.getByRole('button', { name: 'Skapa fråga' }))

    await waitFor(() => expect(faq.createFaqItem).toHaveBeenCalledTimes(1))
    expect(screen.getByPlaceholderText(/Beskriv svaret tydligt/)).toBeInTheDocument() // fortfarande öppen
    expect(screen.getByRole('button', { name: 'Sparar...' })).toBeDisabled()

    lös(FRÅGA)
    await waitFor(() => expect(screen.queryByPlaceholderText(/Beskriv svaret tydligt/)).not.toBeInTheDocument())
  })

  it('dubbelklick på Skapa fråga ger ETT anrop', async () => {
    vi.mocked(faq.createFaqItem).mockImplementation(() => new Promise<FaqItem>(() => {}))
    rendera(<AdminFaq />)
    await fyllINyFråga()
    fireEvent.click(screen.getByRole('button', { name: 'Skapa fråga' }))
    fireEvent.click(screen.getByRole('button', { name: /Skapa fråga|Sparar/ }))

    await waitFor(() => expect(faq.createFaqItem).toHaveBeenCalledTimes(1))
    await väntaLite()
    expect(faq.createFaqItem).toHaveBeenCalledTimes(1)
  })

  it('publicera/dölj som misslyckas visas som fel', async () => {
    vi.mocked(faq.updateFaqItem).mockRejectedValue(new Error('updateFaqItem: 500'))
    rendera(<AdminFaq />)
    await userEvent.click(await screen.findByRole('button', { name: 'Publicerad' }))

    expect(await screen.findByText('Ändringen kunde inte sparas. Försök igen.')).toBeInTheDocument()
  })

  it('borttagning som misslyckas: modalen kvar med felet', async () => {
    vi.mocked(faq.deleteFaqItem).mockRejectedValue(new Error('Frågan används av en flagga.'))
    rendera(<AdminFaq />)
    await userEvent.click(await screen.findByRole('button', { name: 'Ta bort' }))
    await userEvent.click(within(modalRuta('Ta bort fråga')).getByRole('button', { name: 'Ta bort' }))

    expect(await screen.findByText('Frågan används av en flagga.')).toBeInTheDocument()
    expect(screen.getByText('Ta bort fråga')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('Driftmeddelanden (admin)', () => {
  it('hämtfel: felmeddelande + Försök igen, inte "Inga driftmeddelanden skapade"', async () => {
    vi.mocked(banner.fetchAdminMaintenanceBanners).mockRejectedValueOnce(new Error('fetchAdminMaintenanceBanners: 500')).mockResolvedValue([BANNER])
    rendera(<MaintenanceBannerAdmin />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Kunde inte hämta driftmeddelandena')
    expect(screen.queryByText('Inga driftmeddelanden skapade.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Försök igen' }))
    expect(await screen.findByText('Underhåll på lördag')).toBeInTheDocument()
  })

  it('tomt svar: "Inga driftmeddelanden skapade."', async () => {
    vi.mocked(banner.fetchAdminMaintenanceBanners).mockResolvedValue([])
    rendera(<MaintenanceBannerAdmin />)

    expect(await screen.findByText('Inga driftmeddelanden skapade.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  async function fyllINyttMeddelande() {
    await userEvent.click(await screen.findByRole('button', { name: '+ Nytt meddelande' }))
    await userEvent.type(screen.getByPlaceholderText(/Vi gör en planerad tjänsteuppdatering/), 'Nytt underhåll')
    const [, , start, slut] = Array.from(document.querySelectorAll('input[type="datetime-local"]')) as HTMLInputElement[]
    // De två första är UTC-hjälpfälten; de lokala start/slut följer.
    fireEvent.change(start, { target: { value: '2030-01-01T10:00' } })
    fireEvent.change(slut, { target: { value: '2030-01-01T12:00' } })
  }

  it('spara misslyckas: modalen och meddelandet kvar, felet visas', async () => {
    vi.mocked(banner.createMaintenanceBanner).mockRejectedValue(new Error('createMaintenanceBanner: 500'))
    rendera(<MaintenanceBannerAdmin />)
    await fyllINyttMeddelande()
    await userEvent.click(screen.getByRole('button', { name: 'Skapa meddelande' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Din inmatning finns kvar')
    expect(screen.getByPlaceholderText(/Vi gör en planerad tjänsteuppdatering/)).toHaveValue('Nytt underhåll')
  })

  it('spara lyckas: modalen stänger först när servern svarat, dubbelklick ger ETT anrop', async () => {
    let lös: (b: MaintenanceBanner) => void = () => {}
    vi.mocked(banner.createMaintenanceBanner).mockImplementation(() => new Promise<MaintenanceBanner>(res => { lös = res }))
    rendera(<MaintenanceBannerAdmin />)
    await fyllINyttMeddelande()
    await userEvent.dblClick(screen.getByRole('button', { name: 'Skapa meddelande' }))

    await waitFor(() => expect(banner.createMaintenanceBanner).toHaveBeenCalledTimes(1))
    await väntaLite()
    expect(banner.createMaintenanceBanner).toHaveBeenCalledTimes(1)
    expect(screen.getByPlaceholderText(/Vi gör en planerad tjänsteuppdatering/)).toBeInTheDocument()

    lös(BANNER)
    await waitFor(() => expect(screen.queryByPlaceholderText(/Vi gör en planerad tjänsteuppdatering/)).not.toBeInTheDocument())
  })

  it('borttagning som misslyckas: modalen kvar med felet', async () => {
    vi.mocked(banner.deleteMaintenanceBanner).mockRejectedValue(new Error('deleteMaintenanceBanner: 500'))
    rendera(<MaintenanceBannerAdmin />)
    await userEvent.click(await screen.findByRole('button', { name: 'Ta bort' }))
    await userEvent.click(within(modalRuta('Ta bort driftmeddelande')).getByRole('button', { name: 'Ta bort' }))

    expect(await screen.findByText('Meddelandet kunde inte tas bort. Försök igen.')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('Uppdateringar (admin)', () => {
  it('hämtfel: felmeddelande + Försök igen, "—" i korten, inte "Inga uppdateringar matchar filtret"', async () => {
    vi.mocked(uppd.fetchAdminUppdateringar).mockRejectedValueOnce(new Error('fetchAdminUppdateringar: 500')).mockResolvedValue([UPPD])
    rendera(<AdminUppdateringar />)

    expect(await screen.findByText(/Kunde inte hämta uppdateringarna/)).toBeInTheDocument()
    expect(screen.queryByText('Inga uppdateringar matchar filtret.')).not.toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(3)

    await userEvent.click(screen.getByRole('button', { name: 'Försök igen' }))
    expect(await screen.findByText('Version 0.7')).toBeInTheDocument()
  })

  it('tomt svar: "Inga uppdateringar matchar filtret."', async () => {
    vi.mocked(uppd.fetchAdminUppdateringar).mockResolvedValue([])
    rendera(<AdminUppdateringar />)

    expect(await screen.findByText('Inga uppdateringar matchar filtret.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  async function fyllINyUppdatering() {
    await userEvent.click(await screen.findByRole('button', { name: '+ Ny uppdatering' }))
    await userEvent.type(screen.getByPlaceholderText(/Logga in och skapa konto/), 'Version 0.8')
    await userEvent.type(screen.getByPlaceholderText(/Beskriv ändringen kort och tydligt/), 'Tre rader text')
  }

  it('spara misslyckas: panelen och alla rader kvar, felet visas (serverns text)', async () => {
    vi.mocked(uppd.createUppdatering).mockRejectedValue(new Error('Du saknar behörighet.'))
    rendera(<AdminUppdateringar />)
    await fyllINyUppdatering()
    await userEvent.click(screen.getByRole('button', { name: 'Spara som utkast' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Du saknar behörighet.')
    expect(screen.getByPlaceholderText(/Logga in och skapa konto/)).toHaveValue('Version 0.8')
    expect(screen.getByPlaceholderText(/Beskriv ändringen kort och tydligt/)).toHaveValue('Tre rader text')
  })

  it('spara lyckas: panelen stänger först när servern svarat', async () => {
    let lös: (u: Uppdatering) => void = () => {}
    vi.mocked(uppd.createUppdatering).mockImplementation(() => new Promise<Uppdatering>(res => { lös = res }))
    rendera(<AdminUppdateringar />)
    await fyllINyUppdatering()
    await userEvent.click(screen.getByRole('button', { name: 'Spara som utkast' }))

    await waitFor(() => expect(uppd.createUppdatering).toHaveBeenCalledTimes(1))
    expect(screen.getByPlaceholderText(/Logga in och skapa konto/)).toBeInTheDocument()

    lös(UPPD)
    await waitFor(() => expect(screen.queryByPlaceholderText(/Logga in och skapa konto/)).not.toBeInTheDocument())
  })

  it('dubbelklick på Publicera ger ETT anrop', async () => {
    vi.mocked(uppd.createUppdatering).mockImplementation(() => new Promise<Uppdatering>(() => {}))
    rendera(<AdminUppdateringar />)
    await fyllINyUppdatering()
    const panel = modalRuta('Ny uppdatering')
    fireEvent.click(within(panel).getByRole('button', { name: 'Publicera' }))
    fireEvent.click(within(panel).getByRole('button', { name: 'Publicera' }))

    await waitFor(() => expect(uppd.createUppdatering).toHaveBeenCalledTimes(1))
    await väntaLite()
    expect(uppd.createUppdatering).toHaveBeenCalledTimes(1)
  })

  it('publicera-växling som misslyckas visas som fel', async () => {
    vi.mocked(uppd.updateUppdatering).mockRejectedValue(new Error('updateUppdatering: 500'))
    rendera(<AdminUppdateringar />)
    await userEvent.click(await screen.findByRole('button', { name: 'Publicera' }))

    expect(await screen.findByText('Ändringen kunde inte sparas. Försök igen.')).toBeInTheDocument()
  })

  it('borttagning som misslyckas: modalen kvar med felet', async () => {
    vi.mocked(uppd.deleteUppdatering).mockRejectedValue(new Error('deleteUppdatering: 500'))
    rendera(<AdminUppdateringar />)
    await userEvent.click(await screen.findByRole('button', { name: 'Ta bort' }))
    await userEvent.click(within(modalRuta('Ta bort uppdatering')).getByRole('button', { name: 'Ta bort' }))

    expect(await screen.findByText('Uppdateringen kunde inte tas bort. Försök igen.')).toBeInTheDocument()
  })
})
