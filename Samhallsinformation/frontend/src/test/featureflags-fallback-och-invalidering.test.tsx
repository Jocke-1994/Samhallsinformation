import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Uppdatering } from '../api/uppdateringar'
import { FLAG_GRUPPER, FLAG_DEFINITIONER, type FlagState } from '../lib/featureFlags'

// Regressionstester för V3-14 (E5#10): feature-flaggorna får inte tyst falla
// tillbaka på kodens defaultAktiv vid fel/laddning, och samtliga mutationsvägar
// ska uppdatera flagg-queryn direkt.

vi.mock('../api/featureFlags', () => ({
  fetchFeatureFlagOverrides: vi.fn(),
  setFeatureFlagOverride: vi.fn(),
  resetFeatureFlagOverrides: vi.fn(),
  fetchAdminFeatureFlags: vi.fn(),
  setFeatureFlagRedo: vi.fn(),
  setFeatureFlagEndastAdmin: vi.fn(),
}))
vi.mock('../api/push', () => ({ sendNewVersionNotice: vi.fn() }))
vi.mock('../api/uppdateringar', () => ({
  fetchAdminUppdateringar: vi.fn(),
  createUppdatering: vi.fn(),
  updateUppdatering: vi.fn(),
  deleteUppdatering: vi.fn(),
}))
vi.mock('../api/faq', () => ({ fetchAdminFaq: vi.fn() }))

const api = await import('../api/featureFlags')
const { fetchAdminUppdateringar, updateUppdatering } = await import('../api/uppdateringar')
const { fetchAdminFaq } = await import('../api/faq')
const { useFeatureFlags } = await import('../hooks/useFeatureFlags')
const { rensaKändaOverrides, FLAGG_QUERY_KEY } = await import('../lib/flaggCache')
const { default: FeatureFlagsAdmin } = await import('../components/Admin/FeatureFlagsAdmin')
const { default: AdminUppdateringar } = await import('../components/Admin/AdminUppdateringar')

// Flaggor som har defaultAktiv=true i koden men som en admin kan ha stängt av.
const PÅ_SOM_DEFAULT = ['support_faq', 'kallor_aktiva'] as const

function nyKlient() {
  return new QueryClient({
    // Hooken sätter sin egen retry/retryDelay — de här gäller övriga queries.
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  rensaKändaOverrides()
  vi.mocked(api.fetchFeatureFlagOverrides).mockReset()
  vi.mocked(api.setFeatureFlagOverride).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.resetFeatureFlagOverrides).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.fetchAdminFeatureFlags).mockReset().mockResolvedValue([])
  vi.mocked(api.setFeatureFlagRedo).mockReset().mockResolvedValue(undefined)
  vi.mocked(api.setFeatureFlagEndastAdmin).mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function släppMikrotasks() {
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
}

describe('Feature flags: normalfall och laddar-läge', () => {
  it('normalfall: overrides från API:t slår igenom över defaults och läget blir klar', async () => {
    vi.mocked(api.fetchFeatureFlagOverrides).mockResolvedValue({ support_faq: false })
    const { result } = renderHook(() => useFeatureFlags(), { wrapper: wrapper(nyKlient()) })

    await vi.waitFor(() => expect(result.current.läge).toBe('klar'))
    expect(result.current.laddat).toBe(true)
    expect(result.current.flaggor.support_faq).toBe(false)
    const kallorAktiva = FLAG_DEFINITIONER.find(f => f.key === 'kallor_aktiva')!.defaultAktiv
    expect(result.current.flaggor.kallor_aktiva).toBe(kallorAktiva)
  })

  it('exponerar läget "laddar" (laddat=false) under första hämtningen', () => {
    vi.mocked(api.fetchFeatureFlagOverrides).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useFeatureFlags(), { wrapper: wrapper(nyKlient()) })

    expect(result.current.läge).toBe('laddar')
    expect(result.current.laddat).toBe(false)
  })

  it('under laddning används senast kända overrides — en avstängd flagga blinkar inte fram som PÅ', async () => {
    // Session 1: hämtat, support_faq är avstängd via override.
    vi.mocked(api.fetchFeatureFlagOverrides).mockResolvedValue({ support_faq: false })
    const första = renderHook(() => useFeatureFlags(), { wrapper: wrapper(nyKlient()) })
    await vi.waitFor(() => expect(första.result.current.läge).toBe('klar'))
    första.unmount()

    // Ny hook-instans (t.ex. omladdning i samma flik) med en hämtning som inte svarat än.
    vi.mocked(api.fetchFeatureFlagOverrides).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useFeatureFlags(), { wrapper: wrapper(nyKlient()) })

    expect(result.current.läge).toBe('laddar')
    expect(result.current.flaggor.support_faq).toBe(false)
  })
})

describe('Feature flags: fel vid hämtning', () => {
  it('behåller senast kända override (avstängd förblir avstängd) i stället för defaultAktiv', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(api.fetchFeatureFlagOverrides).mockResolvedValue({ support_faq: false, kallor_aktiva: false })
    const första = renderHook(() => useFeatureFlags(), { wrapper: wrapper(nyKlient()) })
    await vi.waitFor(() => expect(första.result.current.läge).toBe('klar'))
    första.unmount()

    // Ny query-cache (omladdning) och nu svarar API:t med fel.
    vi.useFakeTimers()
    vi.mocked(api.fetchFeatureFlagOverrides).mockRejectedValue(new Error('500'))
    const { result } = renderHook(() => useFeatureFlags(), { wrapper: wrapper(nyKlient()) })
    await släppMikrotasks()
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })

    expect(result.current.läge).toBe('fel')
    for (const k of PÅ_SOM_DEFAULT) {
      expect(FLAG_DEFINITIONER.find(f => f.key === k)!.defaultAktiv).toBe(true)
      expect(result.current.flaggor[k]).toBe(false)
    }
    expect(warn).toHaveBeenCalled()
  })

  it('ett fel vid omhämtning behåller redan hämtade overrides i samma session', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const klient = nyKlient()
    vi.mocked(api.fetchFeatureFlagOverrides).mockResolvedValue({ support_faq: false })
    const { result } = renderHook(() => useFeatureFlags(), { wrapper: wrapper(klient) })
    await vi.waitFor(() => expect(result.current.läge).toBe('klar'))

    vi.useFakeTimers()
    vi.mocked(api.fetchFeatureFlagOverrides).mockRejectedValue(new Error('nätverksfel'))
    void klient.invalidateQueries({ queryKey: FLAGG_QUERY_KEY })
    await släppMikrotasks()
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })

    expect(result.current.flaggor.support_faq).toBe(false)
    expect(result.current.läge).toBe('fel')
  })

  it('gör omförsök med backoff (1 s, 2 s, 4 s) och återhämtar sig när API:t svarar igen', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.useFakeTimers()
    vi.mocked(api.fetchFeatureFlagOverrides)
      .mockRejectedValueOnce(new Error('503'))
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce({ support_faq: false })
    const { result } = renderHook(() => useFeatureFlags(), { wrapper: wrapper(nyKlient()) })

    await släppMikrotasks()
    expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(1)
    expect(result.current.läge).toBe('laddar')

    await act(async () => { await vi.advanceTimersByTimeAsync(999) })
    expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(2)

    await act(async () => { await vi.advanceTimersByTimeAsync(1999) })
    expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(3)

    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    expect(result.current.läge).toBe('klar')
    expect(result.current.flaggor.support_faq).toBe(false)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('ger upp efter begränsat antal omförsök (1 + 3) och rapporterar läget "fel"', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.useFakeTimers()
    vi.mocked(api.fetchFeatureFlagOverrides).mockRejectedValue(new Error('500'))
    const { result } = renderHook(() => useFeatureFlags(), { wrapper: wrapper(nyKlient()) })

    await släppMikrotasks()
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })

    expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(4)
    expect(result.current.läge).toBe('fel')
    expect(result.current.laddat).toBe(true)
  })
})

describe('Feature flags: mutationsvägarna invaliderar flagg-queryn', () => {
  // Probe som håller ['feature-flags'] aktiv så att en invalidering syns som en ny hämtning.
  function FlaggProbe() {
    useQuery({ queryKey: FLAGG_QUERY_KEY, queryFn: api.fetchFeatureFlagOverrides })
    return null
  }

  it('växlaFlagg (adminens toggle) uppdaterar både publik och admin-vy', async () => {
    vi.mocked(api.fetchFeatureFlagOverrides).mockResolvedValueOnce({}).mockResolvedValue({ support_faq: false })
    const klient = nyKlient()
    const { result } = renderHook(() => {
      const f = useFeatureFlags()
      useQuery({ queryKey: ['admin-feature-flags'], queryFn: api.fetchAdminFeatureFlags })
      return f
    }, { wrapper: wrapper(klient) })
    await vi.waitFor(() => expect(result.current.läge).toBe('klar'))
    expect(result.current.flaggor.support_faq).toBe(true)
    expect(api.fetchAdminFeatureFlags).toHaveBeenCalledTimes(1)

    act(() => result.current.växlaFlagg('support_faq'))

    await vi.waitFor(() => expect(result.current.flaggor.support_faq).toBe(false))
    expect(api.setFeatureFlagOverride).toHaveBeenCalledWith('support_faq', false)
    await vi.waitFor(() => expect(api.fetchAdminFeatureFlags).toHaveBeenCalledTimes(2))
  })

  it('återställ uppdaterar både publik och admin-vy (redo-markeringarna rensas)', async () => {
    vi.mocked(api.fetchFeatureFlagOverrides).mockResolvedValueOnce({ support_faq: false }).mockResolvedValue({})
    const klient = nyKlient()
    const { result } = renderHook(() => {
      const f = useFeatureFlags()
      useQuery({ queryKey: ['admin-feature-flags'], queryFn: api.fetchAdminFeatureFlags })
      return f
    }, { wrapper: wrapper(klient) })
    await vi.waitFor(() => expect(result.current.flaggor.support_faq).toBe(false))

    act(() => result.current.återställ())

    await vi.waitFor(() => expect(result.current.flaggor.support_faq).toBe(true))
    await vi.waitFor(() => expect(api.fetchAdminFeatureFlags).toHaveBeenCalledTimes(2))
  })

  it('"Redo att lanseras" i FeatureFlagsAdmin uppdaterar även den publika flagg-queryn', async () => {
    vi.mocked(api.fetchFeatureFlagOverrides).mockResolvedValue({})
    const flaggor = Object.fromEntries(FLAG_DEFINITIONER.map(f => [f.key, false])) as FlagState
    render(
      <QueryClientProvider client={nyKlient()}>
        <FlaggProbe />
        <FeatureFlagsAdmin flaggor={flaggor} onVäxla={vi.fn()} onÅterställ={vi.fn()} />
      </QueryClientProvider>
    )
    await vi.waitFor(() => expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByText(FLAG_GRUPPER[0].label))
    await userEvent.click((await screen.findAllByRole('button', { name: 'Redo att lanseras?' }))[0])

    await vi.waitFor(() => expect(api.setFeatureFlagRedo).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(api.fetchAdminFeatureFlags).toHaveBeenCalledTimes(2))
  })

  // Testmiljö-läget (Beslut 2026-10-19) — en admin kan begränsa en REDAN
  // aktiv flagga till bara sig själv, utan att röra på/av-brytaren.
  it('"Begränsa till Admin?" i FeatureFlagsAdmin uppdaterar både admin- och publika flagg-queryn', async () => {
    vi.mocked(api.fetchFeatureFlagOverrides).mockResolvedValue({})
    const förstaFlagga = FLAG_GRUPPER[0].flaggor[0].key
    const flaggor = Object.fromEntries(
      FLAG_DEFINITIONER.map(f => [f.key, f.key === förstaFlagga])
    ) as FlagState
    vi.mocked(api.fetchAdminFeatureFlags).mockResolvedValue([
      { key: förstaFlagga, value: true, redoAttLanseras: false, endastAdmin: false },
    ])
    render(
      <QueryClientProvider client={nyKlient()}>
        <FlaggProbe />
        <FeatureFlagsAdmin flaggor={flaggor} onVäxla={vi.fn()} onÅterställ={vi.fn()} />
      </QueryClientProvider>
    )
    await vi.waitFor(() => expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByText(FLAG_GRUPPER[0].label))
    await userEvent.click(await screen.findByRole('button', { name: 'Begränsa till Admin?' }))

    await vi.waitFor(() => expect(api.setFeatureFlagEndastAdmin).toHaveBeenCalledWith(förstaFlagga, true))
    await vi.waitFor(() => expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(api.fetchAdminFeatureFlags).toHaveBeenCalledTimes(2))
  })

  it('publicering av en Uppdatering (aktiverar flaggor server-side) uppdaterar flagg-queryn direkt', async () => {
    vi.mocked(api.fetchFeatureFlagOverrides).mockResolvedValue({})
    const utkast: Uppdatering = {
      id: 'u1', titel: 'Version 9.9.9', datum: '2026-09-25T00:00:00Z', publicerad: false,
      punkter: [], schemalagdPubliceringUtc: null, schemalagdaFlaggor: ['support_faq'],
      skickaPush: false, pushVersion: null, pushMeddelande: null, visaBanderoll: false,
      annonseringUtc: null, annonseradUtc: null, pushSkickaVid: 'Lansering', createdAt: '2026-09-25T00:00:00Z', visaVadArNytt: false,
    }
    vi.mocked(fetchAdminUppdateringar).mockReset().mockResolvedValue([utkast])
    vi.mocked(updateUppdatering).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(fetchAdminFaq).mockReset().mockResolvedValue([])
    render(
      <QueryClientProvider client={nyKlient()}>
        <FlaggProbe />
        <AdminUppdateringar />
      </QueryClientProvider>
    )
    await vi.waitFor(() => expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(1))

    await userEvent.click(await screen.findByRole('button', { name: 'Publicera' }))

    await vi.waitFor(() => expect(updateUppdatering).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(api.fetchFeatureFlagOverrides).toHaveBeenCalledTimes(2))
  })
})
