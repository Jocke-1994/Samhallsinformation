import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminSource } from '../types'
import { FLAG_DEFINITIONER, type FlagState } from '../lib/featureFlags'

// Regressionstester för V2-15 (E6#4, #5, #17, #21): destruktiva/globala
// admin-åtgärder ska kräva bekräftelse — Avbryt/Esc = inget API-anrop,
// Bekräfta = exakt ett — och SiteSettings får aldrig skicka en gissning.

vi.mock('../api/sources', () => ({
  fetchAdminSources: vi.fn(),
  createAdminSource: vi.fn(),
  updateAdminSource: vi.fn(),
  deleteAdminSource: vi.fn(),
  resyncAdminSource: vi.fn(),
}))
vi.mock('../api/push', () => ({ sendNewVersionNotice: vi.fn() }))
vi.mock('../api/featureFlags', () => ({
  fetchAdminFeatureFlags: vi.fn(),
  setFeatureFlagRedo: vi.fn(),
}))
vi.mock('../api/uppdateringar', () => ({
  fetchAdminUppdateringar: vi.fn(),
  createUppdatering: vi.fn(),
  updateUppdatering: vi.fn(),
  deleteUppdatering: vi.fn(),
}))
vi.mock('../api/faq', () => ({ fetchAdminFaq: vi.fn() }))
vi.mock('../api/siteSettings', () => ({
  getSiteSettings: vi.fn(),
  updateSiteSettings: vi.fn(),
}))

const { fetchAdminSources, deleteAdminSource } = await import('../api/sources')
const { sendNewVersionNotice } = await import('../api/push')
const { fetchAdminFeatureFlags } = await import('../api/featureFlags')
const { fetchAdminUppdateringar } = await import('../api/uppdateringar')
const { fetchAdminFaq } = await import('../api/faq')
const { getSiteSettings, updateSiteSettings } = await import('../api/siteSettings')

const { default: Kallhantering } = await import('../components/Admin/Kallhantering')
const { default: FeatureFlagsAdmin } = await import('../components/Admin/FeatureFlagsAdmin')
const { default: AdminUppdateringar } = await import('../components/Admin/AdminUppdateringar')
const { default: SiteSettingsAdmin } = await import('../components/Admin/SiteSettingsAdmin')

function renderaMedQuery(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const dialog = () => screen.queryByRole('alertdialog')

// ---------------------------------------------------------------------------
// Ta bort källa (E6#4)
// ---------------------------------------------------------------------------

const KÄLLA: AdminSource = {
  id: 7,
  name: 'Testkällan',
  shortName: 'TK',
  baseUrl: 'https://kalla.example',
  url: 'https://kalla.example/rss',
  category: 'Nationell',
  type: 0,
  isActive: true,
  isPublished: true,
  eventCount: 12,
  lastFetchedAt: null,
  lastFetchError: null,
}

describe('Källhantering: Ta bort källa (V2-15, E6#4)', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminSources).mockReset().mockResolvedValue([KÄLLA])
    vi.mocked(deleteAdminSource).mockReset().mockResolvedValue(undefined)
  })

  async function klickaTaBort() {
    renderaMedQuery(<Kallhantering />)
    // Knappen ska finnas i DOM utan att hovra över raden.
    const rad = (await screen.findByTitle('https://kalla.example/rss')).closest('tr')!
    await userEvent.click(within(rad).getByRole('button', { name: 'Ta bort' }))
  }

  it('visar en bekräftelsedialog som namnger källan och konsekvensen, utan att radera', async () => {
    await klickaTaBort()

    const d = await screen.findByRole('alertdialog')
    expect(d).toHaveTextContent('Testkällan')
    expect(d).toHaveTextContent(/alla användares prenumerationer/i)
    expect(d).toHaveTextContent(/kan inte ångras/i)
    expect(deleteAdminSource).not.toHaveBeenCalled()
  })

  it('har Avbryt som förvalt fokus', async () => {
    await klickaTaBort()
    expect(await screen.findByRole('button', { name: 'Avbryt' })).toHaveFocus()
  })

  it('Avbryt stänger dialogen utan API-anrop', async () => {
    await klickaTaBort()
    await userEvent.click(await screen.findByRole('button', { name: 'Avbryt' }))
    expect(dialog()).toBeNull()
    expect(deleteAdminSource).not.toHaveBeenCalled()
  })

  it('Esc stänger dialogen utan API-anrop', async () => {
    await klickaTaBort()
    await screen.findByRole('alertdialog')
    await userEvent.keyboard('{Escape}')
    expect(dialog()).toBeNull()
    expect(deleteAdminSource).not.toHaveBeenCalled()
  })

  it('klick på bakgrunden stänger inte dialogen och raderar inget', async () => {
    await klickaTaBort()
    const d = await screen.findByRole('alertdialog')
    await userEvent.click(d.parentElement!)
    expect(dialog()).not.toBeNull()
    expect(deleteAdminSource).not.toHaveBeenCalled()
  })

  it('Bekräfta raderar exakt en gång med rätt id', async () => {
    await klickaTaBort()
    await userEvent.click(await screen.findByRole('button', { name: 'Ta bort källan' }))
    await waitFor(() => expect(deleteAdminSource).toHaveBeenCalledTimes(1))
    expect(vi.mocked(deleteAdminSource).mock.calls[0][0]).toBe(7)
    expect(dialog()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Återställ standardvärden för feature flags (E6#5)
// ---------------------------------------------------------------------------

function flaggorMedEnAvvikelse(): { flaggor: FlagState; avvikande: string } {
  const flaggor = Object.fromEntries(
    FLAG_DEFINITIONER.map((f) => [f.key, f.defaultAktiv]),
  ) as FlagState
  const f = FLAG_DEFINITIONER[0]
  flaggor[f.key] = !f.defaultAktiv
  return { flaggor, avvikande: f.label }
}

describe('Feature flags: Återställ standardvärden (V2-15, E6#5)', () => {
  const onÅterställ = vi.fn()

  beforeEach(() => {
    onÅterställ.mockReset()
    vi.mocked(fetchAdminFeatureFlags).mockReset().mockResolvedValue([])
  })

  function rendera() {
    const { flaggor, avvikande } = flaggorMedEnAvvikelse()
    renderaMedQuery(
      <FeatureFlagsAdmin flaggor={flaggor} onVäxla={vi.fn()} onÅterställ={onÅterställ} />,
    )
    return avvikande
  }
  const öppnaDialog = () =>
    userEvent.click(screen.getByRole('button', { name: /Återställ standardvärden/ }))

  it('visar en dialog om att alla overrides tas bort, globalt, med antal berörda flaggor', async () => {
    const avvikande = rendera()
    await öppnaDialog()

    const d = await screen.findByRole('alertdialog')
    expect(d).toHaveTextContent(/alla flaggors overrides tas bort/i)
    expect(d).toHaveTextContent(/alla användare/i)
    expect(d).toHaveTextContent(/1 flagga ändras/)
    expect(d).toHaveTextContent(avvikande)
    expect(onÅterställ).not.toHaveBeenCalled()
  })

  it('Avbryt och Esc gör inget anrop', async () => {
    rendera()
    await öppnaDialog()
    expect(await screen.findByRole('button', { name: 'Avbryt' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Avbryt' }))
    expect(dialog()).toBeNull()

    await öppnaDialog()
    await screen.findByRole('alertdialog')
    await userEvent.keyboard('{Escape}')
    expect(dialog()).toBeNull()
    expect(onÅterställ).not.toHaveBeenCalled()
  })

  it('Bekräfta anropar återställ exakt en gång', async () => {
    rendera()
    await öppnaDialog()
    await userEvent.click(await screen.findByRole('button', { name: 'Återställ för alla' }))
    expect(onÅterställ).toHaveBeenCalledTimes(1)
    expect(dialog()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Skicka "Ny version"-notis (E6#17)
// ---------------------------------------------------------------------------

describe('Uppdateringar: Skicka "Ny version"-notis (V2-15, E6#17)', () => {
  beforeEach(() => {
    vi.mocked(sendNewVersionNotice).mockReset().mockResolvedValue({ sent: 3 })
    vi.mocked(fetchAdminUppdateringar).mockReset().mockResolvedValue([])
    vi.mocked(fetchAdminFeatureFlags).mockReset().mockResolvedValue([])
    vi.mocked(fetchAdminFaq).mockReset().mockResolvedValue([])
  })

  async function fylIFormuläretOchKlickaSkicka() {
    renderaMedQuery(<AdminUppdateringar />)
    await userEvent.type(await screen.findByPlaceholderText('T.ex. 0.6.0'), '9.9.9')
    await userEvent.type(
      screen.getByPlaceholderText(/Nya källor och en snabbare/),
      'Testmeddelande',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Skicka nu' }))
  }

  it('visar en dialog med tydlig text om riktig notis till alla, utan att skicka', async () => {
    await fylIFormuläretOchKlickaSkicka()

    const d = await screen.findByRole('alertdialog')
    expect(d).toHaveTextContent(/riktig push-notis/i)
    expect(d).toHaveTextContent(/alla\s+prenumeranter/i)
    expect(d).toHaveTextContent('9.9.9')
    expect(d).toHaveTextContent('Testmeddelande')
    expect(sendNewVersionNotice).not.toHaveBeenCalled()
  })

  it('Avbryt och Esc skickar ingenting', async () => {
    await fylIFormuläretOchKlickaSkicka()
    expect(await screen.findByRole('button', { name: 'Avbryt' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Avbryt' }))
    expect(dialog()).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Skicka nu' }))
    await screen.findByRole('alertdialog')
    await userEvent.keyboard('{Escape}')
    expect(dialog()).toBeNull()
    expect(sendNewVersionNotice).not.toHaveBeenCalled()
  })

  it('Bekräfta skickar exakt en gång med rätt version och text', async () => {
    await fylIFormuläretOchKlickaSkicka()
    await userEvent.click(await screen.findByRole('button', { name: 'Skicka till alla' }))
    await waitFor(() => expect(sendNewVersionNotice).toHaveBeenCalledTimes(1))
    expect(sendNewVersionNotice).toHaveBeenCalledWith('9.9.9', 'Testmeddelande')
    expect(await screen.findByText(/Skickat till 3 enheter/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// SiteSettingsAdmin (E6#21)
// ---------------------------------------------------------------------------

describe('SiteSettingsAdmin (V2-15, E6#21)', () => {
  beforeEach(() => {
    vi.mocked(getSiteSettings).mockReset()
    vi.mocked(updateSiteSettings).mockReset()
  })

  it('vid laddfel är reglagen inaktiverade, felet visas med "Försök igen" och inget skickas', async () => {
    vi.mocked(getSiteSettings).mockRejectedValue(new Error('500'))
    renderaMedQuery(<SiteSettingsAdmin />)

    expect(await screen.findByText(/Kunde inte läsa inställningen/)).toBeInTheDocument()
    const reglage = screen.getAllByRole('switch')
    expect(reglage).toHaveLength(2)
    for (const r of reglage) expect(r).toBeDisabled()

    await userEvent.click(reglage[0])
    expect(dialog()).toBeNull()
    expect(updateSiteSettings).not.toHaveBeenCalled()
  })

  it('"Försök igen" hämtar om och aktiverar reglagen när läget blivit känt', async () => {
    vi.mocked(getSiteSettings)
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValue({ showLoginButton: false, showRegisterButton: true })
    renderaMedQuery(<SiteSettingsAdmin />)

    await userEvent.click(await screen.findByRole('button', { name: 'Försök igen' }))
    await waitFor(() => expect(screen.getAllByRole('switch')[0]).toBeEnabled())
    // Läget är nu det verkliga (av), inte en gissning.
    expect(screen.getByRole('switch', { name: 'Visa Logga in-knappen' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  async function renderaMedKäntLäge() {
    vi.mocked(getSiteSettings).mockResolvedValue({
      showLoginButton: true,
      showRegisterButton: true,
    })
    vi.mocked(updateSiteSettings).mockResolvedValue({
      showLoginButton: false,
      showRegisterButton: true,
    })
    renderaMedQuery(<SiteSettingsAdmin />)
    const knapp = await screen.findByRole('switch', { name: 'Dölj Logga in-knappen' })
    await waitFor(() => expect(knapp).toBeEnabled())
    await userEvent.click(knapp)
  }

  it('en ändring kräver bekräftelse: dialog visas och inget skickas förrän Bekräfta', async () => {
    await renderaMedKäntLäge()
    const d = await screen.findByRole('alertdialog')
    expect(d).toHaveTextContent(/alla besökare/i)
    expect(updateSiteSettings).not.toHaveBeenCalled()
  })

  it('Avbryt och Esc skickar ingenting', async () => {
    await renderaMedKäntLäge()
    expect(await screen.findByRole('button', { name: 'Avbryt' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Avbryt' }))
    expect(dialog()).toBeNull()

    await userEvent.click(screen.getByRole('switch', { name: 'Dölj Logga in-knappen' }))
    await screen.findByRole('alertdialog')
    await userEvent.keyboard('{Escape}')
    expect(dialog()).toBeNull()
    expect(updateSiteSettings).not.toHaveBeenCalled()
  })

  it('Bekräfta skickar exakt ett anrop med det ändrade fältet', async () => {
    await renderaMedKäntLäge()
    await userEvent.click(await screen.findByRole('button', { name: 'Dölj för alla' }))
    await waitFor(() => expect(updateSiteSettings).toHaveBeenCalledTimes(1))
    expect(vi.mocked(updateSiteSettings).mock.calls[0][0]).toEqual({ showLoginButton: false })
  })
})
