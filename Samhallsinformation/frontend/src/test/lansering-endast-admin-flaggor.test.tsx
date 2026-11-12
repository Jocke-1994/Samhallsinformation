import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminFeatureFlagOverride } from '../api/featureFlags'
import { FLAG_GRUPPER, FLAG_DEFINITIONER, type FlagState } from '../lib/featureFlags'

// En flagga som är på men bara för Admin (Testmiljö-läget) är inte lanserad.
// Den ska gå att markera "redo att lanseras" och välja i en schemalagd
// lansering — lanseringen öppnar den för alla (FeatureFlagActivation).
// Tidigare dolde båda vyerna den, eftersom de bara tittade på value.

const TESTAS = 'test_endast_admin'
const LIVE = 'test_redan_live'
const AV = 'test_av_och_redo'

const FLAGGOR: AdminFeatureFlagOverride[] = [
  { key: TESTAS, value: true, redoAttLanseras: true, endastAdmin: true },
  { key: LIVE, value: true, redoAttLanseras: true, endastAdmin: false },
  { key: AV, value: false, redoAttLanseras: true, endastAdmin: false },
]

vi.mock('../api/uppdateringar', async () => {
  const faktisk =
    await vi.importActual<typeof import('../api/uppdateringar')>('../api/uppdateringar')
  return {
    ...faktisk,
    fetchAdminUppdateringar: vi.fn().mockResolvedValue([]),
    createUppdatering: vi.fn(),
    updateUppdatering: vi.fn(),
    deleteUppdatering: vi.fn(),
  }
})
vi.mock('../api/featureFlags', () => ({
  fetchFeatureFlagOverrides: vi.fn().mockResolvedValue({}),
  fetchAdminFeatureFlags: vi.fn(),
  setFeatureFlagRedo: vi.fn().mockResolvedValue(undefined),
  setFeatureFlagEndastAdmin: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../api/faq', () => ({ fetchAdminFaq: vi.fn().mockResolvedValue([]) }))
vi.mock('../api/push', () => ({ sendNewVersionNotice: vi.fn() }))

const api = await import('../api/featureFlags')
const { default: AdminUppdateringar } = await import('../components/Admin/AdminUppdateringar')
const { default: FeatureFlagsAdmin } = await import('../components/Admin/FeatureFlagsAdmin')

function nyKlient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

beforeEach(() => {
  vi.mocked(api.fetchAdminFeatureFlags).mockReset().mockResolvedValue(FLAGGOR)
})

describe('Schemalagd lansering — flaggor som bara är på för Admin', () => {
  it('listar en Endast Admin-flagga som valbar, men inte en som redan är live för alla', async () => {
    render(
      <QueryClientProvider client={nyKlient()}>
        <AdminUppdateringar />
      </QueryClientProvider>,
    )
    await userEvent.click(await screen.findByText('+ Ny uppdatering'))
    await userEvent.click(screen.getByText('Schemalägg lansering'))

    expect(await screen.findByRole('button', { name: TESTAS })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: AV })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: LIVE })).not.toBeInTheDocument()
  })
})

describe('Feature flags — "Redo att lanseras" på en Endast Admin-flagga', () => {
  it('visar redo-knappen på en påslagen flagga som bara är på för Admin', async () => {
    const förstaFlagga = FLAG_GRUPPER[0].flaggor.find((f) => !f.mock)!.key
    const andraFlagga = FLAG_GRUPPER[0].flaggor.filter((f) => !f.mock)[1]?.key
    vi.mocked(api.fetchAdminFeatureFlags).mockResolvedValue([
      { key: förstaFlagga, value: true, redoAttLanseras: false, endastAdmin: true },
      ...(andraFlagga
        ? [{ key: andraFlagga, value: true, redoAttLanseras: false, endastAdmin: false }]
        : []),
    ])
    const flaggor = Object.fromEntries(
      FLAG_DEFINITIONER.map((f) => [f.key, f.key === förstaFlagga || f.key === andraFlagga]),
    ) as FlagState
    render(
      <QueryClientProvider client={nyKlient()}>
        <FeatureFlagsAdmin flaggor={flaggor} onVäxla={vi.fn()} onÅterställ={vi.fn()} />
      </QueryClientProvider>,
    )
    await userEvent.click(screen.getByText(FLAG_GRUPPER[0].label))

    // Raden med 🔒-pillen har redo-knappen; en flagga som är live för alla har den inte.
    const låsKnapp = await screen.findByRole('button', { name: '🔒 Endast Admin' })
    const rad = låsKnapp.closest('div.flex.items-center.justify-between') as HTMLElement
    expect(within(rad).getByRole('button', { name: 'Redo att lanseras?' })).toBeInTheDocument()

    if (andraFlagga) {
      const label = FLAG_DEFINITIONER.find((f) => f.key === andraFlagga)!.label
      const liveRad = screen
        .getByText(label)
        .closest('div.flex.items-center.justify-between') as HTMLElement
      expect(
        within(liveRad).queryByRole('button', { name: 'Redo att lanseras?' }),
      ).not.toBeInTheDocument()
    }
  })
})
