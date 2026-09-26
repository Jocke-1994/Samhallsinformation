import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  FLAG_DEFINITIONER, effektivaFlaggor, ärMockFlagga, visaMockUi, type FlagKey, type FlagState,
} from '../lib/featureFlags'
import { searchIndex } from '../lib/profilSok'

// V3-20 (beslut D3): ingen riktig användare ska kunna se fabricerad data, även om en
// admin slår på en mock-flagga. Medborgarvyn läser effektiva flaggor, där mock-flaggor
// är avstängda om inte bygget har VITE_SHOW_MOCK_UI=true.

// Flaggor som är mock-UI utan backend (verifierade mot komponenterna: inga API-anrop).
const MOCK_FLAGGOR: FlagKey[] = [
  'kallor_rekommenderade',
  'notif_obligatoriska', 'notif_mottagare', 'notif_stor_ej', 'notif_leveranslage', 'notif_historik',
  'konto_tvafaktor', 'konto_sessioner', 'konto_aktivitetslogg', 'konto_samtycke',
  'uppdateringar_pagang', 'uppdateringar_kanda_problem',
  'support_systemstatus',
]

// Levande funktioner (riktig backend) — får aldrig märkas som mock.
const LEVANDE_FLAGGOR: FlagKey[] = [
  'flode_olasta_badge', 'flode_sparat', 'flode_dela',
  'kallor_lagg_till', 'kallor_aktiva', 'kallor_alla', 'kallor_polisen_filter',
  'notif_push',
  'konto_info', 'konto_losenord', 'konto_visningsnamn', 'konto_datahantering', 'konto_tema', 'konto_epost_paminnelse',
  'uppdateringar_senaste', 'uppdateringar_historik',
  'support_arenden', 'support_faq',
]

// defaultAktiv sådan den var före V3-20 för de levande flaggorna (får inte ändras här).
const LEVANDE_DEFAULT_PÅ: FlagKey[] = [
  'kallor_aktiva', 'kallor_alla', 'konto_info', 'konto_losenord', 'konto_visningsnamn',
  'konto_datahantering', 'konto_tema', 'konto_epost_paminnelse', 'support_faq',
]

const alla = (värde: boolean) =>
  Object.fromEntries(FLAG_DEFINITIONER.map(f => [f.key, värde])) as FlagState

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('flaggregistret', () => {
  it('varje mock-flagga är märkt mock och har defaultAktiv=false', () => {
    for (const key of MOCK_FLAGGOR) {
      const def = FLAG_DEFINITIONER.find(f => f.key === key)
      expect(def, key).toBeDefined()
      expect(def!.mock, `${key} ska vara märkt mock`).toBe(true)
      expect(def!.defaultAktiv, `${key} ska ha defaultAktiv=false`).toBe(false)
    }
  })

  it('ingen flagga är märkt mock utöver de verifierade, och ingen mock-flagga har defaultAktiv=true', () => {
    const märkta = FLAG_DEFINITIONER.filter(f => f.mock).map(f => f.key).sort()
    expect(märkta).toEqual([...MOCK_FLAGGOR].sort())
    expect(FLAG_DEFINITIONER.filter(f => f.mock && f.defaultAktiv)).toEqual([])
  })

  it('levande funktioner är inte märkta mock och behåller sitt defaultvärde', () => {
    for (const key of LEVANDE_FLAGGOR) {
      const def = FLAG_DEFINITIONER.find(f => f.key === key)!
      expect(def.mock, `${key} är levande`).toBeUndefined()
      expect(def.defaultAktiv, key).toBe(LEVANDE_DEFAULT_PÅ.includes(key))
    }
    // Alla flaggor är antingen mock eller levande.
    expect(FLAG_DEFINITIONER).toHaveLength(MOCK_FLAGGOR.length + LEVANDE_FLAGGOR.length)
  })
})

describe('effektivaFlaggor', () => {
  it('tvingar av alla mock-flaggor även när de är påslagna, utan att röra de levande', () => {
    const ut = effektivaFlaggor(alla(true), false)
    for (const key of MOCK_FLAGGOR) expect(ut[key], key).toBe(false)
    for (const key of LEVANDE_FLAGGOR) expect(ut[key], key).toBe(true)
  })

  it('släpper igenom mock-flaggor när mock-UI uttryckligen är på', () => {
    expect(effektivaFlaggor(alla(true), true)).toEqual(alla(true))
  })

  it('följer VITE_SHOW_MOCK_UI: bara strängen "true" slår på mock-UI', () => {
    expect(visaMockUi()).toBe(false)
    vi.stubEnv('VITE_SHOW_MOCK_UI', 'true')
    expect(visaMockUi()).toBe(true)
    expect(effektivaFlaggor(alla(true))[MOCK_FLAGGOR[0]]).toBe(true)
    vi.stubEnv('VITE_SHOW_MOCK_UI', 'false')
    expect(visaMockUi()).toBe(false)
    vi.stubEnv('VITE_SHOW_MOCK_UI', '1')
    expect(visaMockUi()).toBe(false)
    expect(ärMockFlagga('notif_stor_ej')).toBe(true)
    expect(ärMockFlagga('konto_info')).toBe(false)
  })
})

vi.mock('../api/featureFlags', () => ({
  fetchFeatureFlagOverrides: vi.fn(),
  setFeatureFlagOverride: vi.fn(),
  resetFeatureFlagOverrides: vi.fn(),
  fetchAdminFeatureFlags: vi.fn(),
  setFeatureFlagRedo: vi.fn(),
}))
vi.mock('../api/faq', () => ({ fetchFaq: async () => [] }))
vi.mock('../api/uppdateringar', () => ({
  fetchUppdateringar: async () => [],
  uppdateringarQueryKey: (i: boolean) => ['uppdateringar', i ? 'inloggad' : 'anonym'],
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, roll: 'Användare' }) }))

const api = await import('../api/featureFlags')
const { FeatureFlagsProvider } = await import('../context/FeatureFlagsContext')
const { useFeatureFlags } = await import('../hooks/useFeatureFlags')
const { rensaKändaOverrides } = await import('../lib/flaggCache')
const { default: Notifieringar } = await import('../components/Profile/Notifieringar')
const { default: Support } = await import('../components/Profile/Support')
const { default: Uppdateringar } = await import('../components/Profile/Uppdateringar')

function nyKlient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

// Admin har slagit PÅ varje mock-flagga (och alla levande).
function allaFlaggorPå() {
  vi.mocked(api.fetchFeatureFlagOverrides).mockResolvedValue(alla(true))
}

function visaMedFlaggor(barn: ReactNode) {
  return render(
    <QueryClientProvider client={nyKlient()}>
      <MemoryRouter><FeatureFlagsProvider>{barn}</FeatureFlagsProvider></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  rensaKändaOverrides()
  vi.mocked(api.fetchFeatureFlagOverrides).mockReset()
  vi.mocked(api.fetchAdminFeatureFlags).mockReset().mockResolvedValue([])
})

describe('mock-sektioner i medborgarvyn (alla flaggor påslagna av admin)', () => {
  it('useFeatureFlags: UI-flaggorna har mock av, admin-vyns inställda visar påslaget', async () => {
    allaFlaggorPå()
    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: ({ children }) => <QueryClientProvider client={nyKlient()}>{children}</QueryClientProvider>,
    })
    await waitFor(() => expect(result.current.läge).toBe('klar'))
    for (const key of MOCK_FLAGGOR) {
      expect(result.current.flaggor[key], `${key} effektiv`).toBe(false)
      expect(result.current.inställda[key], `${key} inställd`).toBe(true)
    }
    expect(result.current.flaggor.konto_info).toBe(true)
  })

  it('Notifieringar renderar inga mock-kort utan VITE_SHOW_MOCK_UI', async () => {
    allaFlaggorPå()
    visaMedFlaggor(<Notifieringar />)
    await waitFor(() => expect(api.fetchFeatureFlagOverrides).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 30))
    for (const rubrik of ['Obligatoriska källor', 'Mottagare', 'Stör ej', 'Leveransläge', 'Notifieringshistorik']) {
      expect(screen.queryByRole('heading', { name: rubrik }), rubrik).toBeNull()
    }
    expect(screen.queryByText(/mamma@gmail\.com/)).toBeNull()
  })

  it('Notifieringar renderar mock-korten när VITE_SHOW_MOCK_UI=true (lokal utveckling)', async () => {
    vi.stubEnv('VITE_SHOW_MOCK_UI', 'true')
    allaFlaggorPå()
    visaMedFlaggor(<Notifieringar />)
    for (const rubrik of ['Obligatoriska källor', 'Mottagare', 'Stör ej', 'Leveransläge', 'Notifieringshistorik']) {
      expect(await screen.findByRole('heading', { name: rubrik }), rubrik).toBeInTheDocument()
    }
  })

  it('Support: Systemstatus (hårdkodad driftstatus) visas inte utan VITE_SHOW_MOCK_UI, men FAQ gör det', async () => {
    allaFlaggorPå()
    visaMedFlaggor(<Support />)
    await waitFor(() => expect(api.fetchFeatureFlagOverrides).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 30))
    expect(screen.queryByRole('heading', { name: 'Systemstatus' })).toBeNull()
    expect(screen.queryByText(/Planerat underhåll/)).toBeNull()
  })

  it('Support: Systemstatus visas när VITE_SHOW_MOCK_UI=true', async () => {
    vi.stubEnv('VITE_SHOW_MOCK_UI', 'true')
    allaFlaggorPå()
    visaMedFlaggor(<Support />)
    expect(await screen.findByRole('heading', { name: 'Systemstatus' })).toBeInTheDocument()
  })

  it('Uppdateringar: hårdkodade "Kända problem" och "Påväg" visas inte utan VITE_SHOW_MOCK_UI', async () => {
    allaFlaggorPå()
    visaMedFlaggor(<Uppdateringar />)
    await waitFor(() => expect(api.fetchFeatureFlagOverrides).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 30))
    expect(screen.queryByRole('heading', { name: 'Kända problem' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Påväg' })).toBeNull()
    expect(screen.queryByText(/Personliga konton med källprenumerationer/)).toBeNull()
  })

  it('Uppdateringar: korten visas när VITE_SHOW_MOCK_UI=true', async () => {
    vi.stubEnv('VITE_SHOW_MOCK_UI', 'true')
    allaFlaggorPå()
    visaMedFlaggor(<Uppdateringar />)
    expect(await screen.findByRole('heading', { name: 'Kända problem' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Påväg' })).toBeInTheDocument()
  })
})

describe('sökningen i Min profil', () => {
  it('lovar inga funktioner vars flagga är av (t.ex. Systemstatus, Obligatoriska källor)', () => {
    const effektiva = effektivaFlaggor(alla(true), false)
    const träffar = (q: string) => [...searchIndex(q, effektiva).values()].flat().map(i => i.label)
    expect(träffar('status')).not.toContain('Systemstatus')
    expect(träffar('msb')).not.toContain('Obligatoriska källor')
    expect(träffar('adress')).not.toContain('Hämta källor via SPAR')
    // Levande funktioner finns kvar.
    expect(träffar('lösenord')).toContain('Byt lösenord')
    expect(träffar('faq')).toContain('FAQ')
  })
})
