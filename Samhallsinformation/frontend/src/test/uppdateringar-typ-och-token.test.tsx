import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Uppdatering } from '../api/uppdateringar'

// Regressionstester för V2-7 (E4#1, E4#9, E6#9):
//  - en okänd punkt-`typ` (gammalt "nytt", tom sträng, versal) får aldrig ge en
//    vit skärm i någon av de tre komponenter som visar typ-etiketter,
//  - fetchUppdateringar skickar token när den finns, och query-nyckeln skiljer
//    inloggad från anonym (annars delar Nyheter-sidan och Profil-fliken cache).

const OKAND: Uppdatering = {
  id: 'u1',
  titel: 'Version med gammal punkt',
  datum: '2026-09-01T00:00:00Z',
  publicerad: true,
  schemalagdPubliceringUtc: null,
  schemalagdaFlaggor: [],
  punkter: [
    // @ts-expect-error — avsiktligt en typ utanför PunktTyp (backend returnerar gamla rader oförändrade)
    { id: 'p1', typ: 'nytt', plats: 'Allmänt', text: 'Gammal punkt', synlighet: 'alla' },
    // @ts-expect-error — tom typ
    { id: 'p2', typ: '', plats: 'Allmänt', text: 'Punkt utan typ', synlighet: 'alla' },
    { id: 'p3', typ: 'buggfix', plats: 'Allmänt', text: 'Normal punkt', synlighet: 'alla' },
  ],
}

const hämtaMock = vi.fn()
const hämtaAdminMock = vi.fn()
let inloggad = false

vi.mock('../api/uppdateringar', async () => {
  const faktisk =
    await vi.importActual<typeof import('../api/uppdateringar')>('../api/uppdateringar')
  return {
    ...faktisk,
    fetchUppdateringar: () => hämtaMock(),
    fetchAdminUppdateringar: () => hämtaAdminMock(),
  }
})
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: inloggad }) }))
vi.mock('../context/FeatureFlagsContext', () => ({
  useFlags: () => ({
    uppdateringar_senaste: true,
    uppdateringar_pagang: false,
    uppdateringar_historik: true,
  }),
}))
vi.mock('../components/Sidebar/Sidebar', () => ({ default: () => null }))
vi.mock('../components/common/MobilTopBar', () => ({ default: () => null }))
vi.mock('../api/featureFlags', () => ({ fetchAdminFeatureFlags: () => Promise.resolve([]) }))
vi.mock('../api/faq', () => ({ fetchAdminFaq: () => Promise.resolve([]) }))
vi.mock('../api/push', () => ({ sendNewVersionNotice: vi.fn() }))

const { getTypConfig, PUNKT_TYPER } = await import('../lib/uppdateringTyp')
// Den RIKTIGA fetchUppdateringar (modulen är mockad ovan för komponenttesterna).
const { fetchUppdateringar, uppdateringarQueryKey } =
  await vi.importActual<typeof import('../api/uppdateringar')>('../api/uppdateringar')
const { default: UppdateringarPage } = await import('../pages/UppdateringarPage')
const { default: ProfilUppdateringar } = await import('../components/Profile/Uppdateringar')
const { default: AdminUppdateringar } = await import('../components/Admin/AdminUppdateringar')

function renderaMedQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('getTypConfig', () => {
  it('ger fallback (ingen krasch) för okända, tomma och null-typer', () => {
    for (const typ of ['nytt', '', 'Buggfix', 'constructor', '__proto__', null, undefined]) {
      const cfg = getTypConfig(typ)
      expect(cfg.label).toBe('Övrigt')
      expect(cfg.adminLabel).toBe('Övrigt')
      expect(cfg.badge).toContain('slate')
    }
  })

  it('känner igen alla fem riktiga typer', () => {
    expect(PUNKT_TYPER).toEqual([
      'ny-funktion',
      'förbättring',
      'buggfix',
      'känt-problem',
      'kommer-snart',
    ])
    for (const typ of PUNKT_TYPER) expect(getTypConfig(typ).label).not.toBe('Övrigt')
  })
})

describe('okänd punkt-typ kraschar inte någon vy', () => {
  beforeEach(() => {
    inloggad = false
    hämtaMock.mockReset().mockResolvedValue([OKAND])
    hämtaAdminMock.mockReset().mockResolvedValue([OKAND])
  })

  it('Nyheter-sidan renderar alla punkter, okänd typ får neutral etikett', async () => {
    renderaMedQuery(<UppdateringarPage />)

    expect(await screen.findByText('Gammal punkt')).toBeInTheDocument()
    expect(screen.getByText('Punkt utan typ')).toBeInTheDocument()
    expect(screen.getByText('Normal punkt')).toBeInTheDocument()
    expect(screen.getAllByText('Övrigt')).toHaveLength(2)
    expect(screen.getByText('Fixat')).toBeInTheDocument()
  })

  it('Profil → Uppdateringar renderar senaste-kortet och den expanderade historiken', async () => {
    inloggad = true
    hämtaMock.mockResolvedValue([OKAND, { ...OKAND, id: 'u0', titel: 'Äldre version' }])
    renderaMedQuery(<ProfilUppdateringar />)

    expect(await screen.findByText('Gammal punkt')).toBeInTheDocument()
    expect(screen.getAllByText('Övrigt').length).toBeGreaterThanOrEqual(2)

    // Historik-raden (plats-badges använder också typens stil) + expanderat läge.
    fireEvent.click(await screen.findByText('Äldre version'))
    expect(screen.getAllByText('Gammal punkt').length).toBeGreaterThanOrEqual(2)
  })

  it('Admin → Uppdateringar renderar listan (typ-sammanfattning) utan vit skärm', async () => {
    renderaMedQuery(<AdminUppdateringar />)

    expect(await screen.findByText('Version med gammal punkt')).toBeInTheDocument()
    // "nytt" och "" grupperas var för sig men visas båda med fallback-etiketten.
    expect(screen.getAllByText('Övrigt').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Buggfix').length).toBeGreaterThanOrEqual(1)
  })
})

describe('fetchUppdateringar + queryKey (token och cache)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset().mockResolvedValue(new Response('[]', { status: 200 }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('skickar Authorization när användaren är inloggad', async () => {
    localStorage.setItem('si_token', 'jwt-123')
    await fetchUppdateringar()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/uppdateringar')
    expect(init.headers.Authorization).toBe('Bearer jwt-123')
  })

  it('skickar ingen Authorization-header för anonyma besökare', async () => {
    await fetchUppdateringar()

    const [, init] = fetchMock.mock.calls[0]
    expect(init?.headers?.Authorization).toBeUndefined()
  })

  it('query-nyckeln skiljer inloggad från anonym men delar prefix med admins invalidering', () => {
    expect(uppdateringarQueryKey(true)).not.toEqual(uppdateringarQueryKey(false))
    expect(uppdateringarQueryKey(true)[0]).toBe('uppdateringar')
    expect(uppdateringarQueryKey(false)[0]).toBe('uppdateringar')
  })

  it('Nyheter-sidan och Profil-fliken delar inte cache-post mellan anonym och inloggad', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const anonymSvar = [{ ...OKAND, id: 'anon', titel: 'Bara publikt' }]
    const inloggadSvar = [{ ...OKAND, id: 'inl', titel: 'Med inloggade punkter' }]
    hämtaMock.mockReset().mockResolvedValueOnce(anonymSvar).mockResolvedValueOnce(inloggadSvar)

    inloggad = false
    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <UppdateringarPage />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Bara publikt')).toBeInTheDocument()
    unmount()

    // Samma QueryClient (t.ex. användaren loggar in i samma flik): ny nyckel → ny hämtning,
    // inte det cachade anonyma svaret.
    inloggad = true
    render(
      <QueryClientProvider client={qc}>
        <ProfilUppdateringar />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Med inloggade punkter')).toBeInTheDocument()
    expect(hämtaMock).toHaveBeenCalledTimes(2)
  })
})
