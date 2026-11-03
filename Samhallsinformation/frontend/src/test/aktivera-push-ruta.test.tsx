import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Prova själv-målet "aktivera-push" (beslut 2026-11-03): en ruta med en
// Aktivera-knapp i nyheten i stället för en länk. Knappen slår på BÅDA
// kategorierna, och rutan säger det.

const auth = { isLoggedIn: true, email: 'a@b.se' }
const flaggor: Record<string, boolean> = {}
const push = vi.hoisted(() => ({ isSubscribed: false, loading: false, subscribe: vi.fn(), stöds: true }))
const api = vi.hoisted(() => ({
  fetchPushSettings: vi.fn(),
  savePushSettings: vi.fn(),
}))

vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../context/FeatureFlagsContext', () => ({ useFlags: () => flaggor }))
vi.mock('../api/push', () => api)
vi.mock('../hooks/usePushSubscription', () => ({
  isPushSupported: () => push.stöds,
  usePushSubscription: () => ({ isSubscribed: push.isSubscribed, loading: push.loading, subscribe: push.subscribe }),
}))

const { default: ProvaSjalvLank } = await import('../components/common/ProvaSjalvLank')

function rendera(förhandsvisning?: { inloggad: boolean; flaggor: Record<string, boolean> }) {
  const klient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={klient}>
      <MemoryRouter><ProvaSjalvLank mål="aktivera-push" förhandsvisning={förhandsvisning} /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  auth.isLoggedIn = true
  for (const k of Object.keys(flaggor)) delete flaggor[k]
  flaggor.notif_push = true
  push.isSubscribed = false
  push.loading = false
  push.stöds = true
  push.subscribe.mockReset().mockImplementation(async () => { push.isSubscribed = true })
  api.fetchPushSettings.mockReset().mockResolvedValue({ pushEnabled: true, pushNyaHandelser: false, pushNyVersion: false })
  api.savePushSettings.mockReset().mockResolvedValue(undefined)
})

describe('Aktivera push i nyheten', () => {
  it('frågar och säger att båda sorterna notiser slås på', async () => {
    rendera()
    expect(await screen.findByText('🔔 Vill du aktivera push-notiser?')).toBeTruthy()
    expect(screen.getByText(/nytt från dina källor och när appen får nya funktioner/)).toBeTruthy()
  })

  it('Aktivera registrerar enheten och slår på båda kategorierna, sedan visas bekräftelsen', async () => {
    rendera()
    await userEvent.click(await screen.findByRole('button', { name: 'Aktivera' }))
    expect(push.subscribe).toHaveBeenCalledOnce()
    expect(api.savePushSettings).toHaveBeenCalledWith({ pushNyaHandelser: true, pushNyVersion: true })
    await waitFor(() => expect(screen.getByText('✓ Push-notiser är på')).toBeTruthy())
  })

  it('nekar webbläsaren ändras inget på kontot och felet visas', async () => {
    push.subscribe.mockRejectedValue(new Error('Tillstånd nekades'))
    rendera()
    await userEvent.click(await screen.findByRole('button', { name: 'Aktivera' }))
    expect(api.savePushSettings).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('redan påslaget: bara bekräftelsen, ingen knapp', async () => {
    push.isSubscribed = true
    api.fetchPushSettings.mockResolvedValue({ pushEnabled: true, pushNyaHandelser: true, pushNyVersion: true })
    rendera()
    expect(await screen.findByText('✓ Push-notiser är på')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('besökare får den vanliga "kräver konto"-länken, ingen knapp', () => {
    auth.isLoggedIn = false
    rendera()
    expect(screen.getByRole('link', { name: /kräver konto/ })).toHaveAttribute('href', '/login?redirect=%2Fprofil%3Fsection%3Dkonto')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('webbläsare utan push får en förklaring i stället för knappen', () => {
    push.stöds = false
    rendera()
    expect(screen.getByText(/Push stöds inte i den här webbläsaren/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('adminens förhandsvisning visar rutan men gör ingenting', () => {
    rendera({ inloggad: true, flaggor: { notif_push: true } })
    expect(screen.getByText('🔔 Vill du aktivera push-notiser?')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(api.fetchPushSettings).not.toHaveBeenCalled()
  })
})
