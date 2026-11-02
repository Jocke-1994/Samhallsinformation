import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'

// Vad är nytt-rutan (Ideer/Vad ar nytt-modal.md). Backend avgör VAD som visas
// (testat i VadArNyttTests.cs) — här testas att frontend respekterar flaggan,
// inloggningen och vilka sidor den döljs på, och att stängning sparas.

const auth = { isLoggedIn: true, email: 'a@test.se' }
const flaggor = { uppdateringar_vad_ar_nytt: true }
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../context/FeatureFlagsContext', () => ({ useFlags: () => flaggor }))
vi.mock('../api/uppdateringar', async () => {
  const faktisk = await vi.importActual<typeof import('../api/uppdateringar')>('../api/uppdateringar')
  return { ...faktisk, fetchVadArNytt: vi.fn(), markeraVadArNyttSett: vi.fn().mockResolvedValue(undefined) }
})

const api = await import('../api/uppdateringar')
const { default: VadArNytt } = await import('../components/common/VadArNytt')

const RELEASE = {
  id: 'r1', titel: 'Logga in och skapa konto', datum: '2026-09-15T00:00:00Z',
  punkter: [{ id: 'p1', typ: 'ny-funktion' as const, plats: 'Allmänt', text: 'Fortsätt med Google', synlighet: 'alla' as const }],
}

function rendera(sökväg = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[sökväg]}><VadArNytt /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  auth.isLoggedIn = true
  flaggor.uppdateringar_vad_ar_nytt = true
  vi.mocked(api.fetchVadArNytt).mockReset().mockResolvedValue(RELEASE)
  vi.mocked(api.markeraVadArNyttSett).mockClear()
})

describe('VadArNytt', () => {
  it('visar releasen för en inloggad när flaggan är på', async () => {
    rendera()
    expect(await screen.findByRole('dialog', { name: 'Logga in och skapa konto' })).toBeInTheDocument()
    expect(screen.getByText('Fortsätt med Google')).toBeInTheDocument()
    expect(screen.getByText('Nytt')).toBeInTheDocument()
  })

  it('hämtar ingenting och visar ingenting när flaggan är av', async () => {
    flaggor.uppdateringar_vad_ar_nytt = false
    rendera()
    await new Promise(r => setTimeout(r, 20))
    expect(api.fetchVadArNytt).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hämtar ingenting för utloggade besökare', async () => {
    auth.isLoggedIn = false
    rendera()
    await new Promise(r => setTimeout(r, 20))
    expect(api.fetchVadArNytt).not.toHaveBeenCalled()
  })

  it('visar ingenting när backend säger att det inte finns något (204 → null)', async () => {
    vi.mocked(api.fetchVadArNytt).mockResolvedValue(null)
    rendera()
    await waitFor(() => expect(api.fetchVadArNytt).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('döljs i adminpanelen', async () => {
    rendera('/admin')
    await waitFor(() => expect(api.fetchVadArNytt).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Stäng döljer rutan direkt och sparar att den setts', async () => {
    rendera()
    await userEvent.click(await screen.findByRole('button', { name: 'Stäng' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(vi.mocked(api.markeraVadArNyttSett).mock.calls[0][0]).toBe('r1')
  })

  it('Esc stänger också och sparar', async () => {
    rendera()
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(vi.mocked(api.markeraVadArNyttSett).mock.calls[0][0]).toBe('r1')
  })

  it('"Se alla nyheter" räknas som sett', async () => {
    rendera()
    await userEvent.click(await screen.findByRole('link', { name: 'Se alla nyheter' }))
    expect(vi.mocked(api.markeraVadArNyttSett).mock.calls[0][0]).toBe('r1')
  })
})
