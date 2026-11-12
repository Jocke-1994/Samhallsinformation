import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FaqItem } from '../api/faq'
import type { AdminFeatureFlagOverride } from '../api/featureFlags'

// Del 4 av Schemalagd lanserings "Ny version"-tillägg (Beslut 2026-10-08):
// kopplade FAQ-frågor listas i formuläret (fråga + vad som händer med den),
// inte bara ett antal. Inget nytt beteende — FaqItem.FlagKey styr redan
// visningen (session 42), det här bara synliggör den.

const FLAGGA: AdminFeatureFlagOverride = {
  key: 'kallor_lan_filter',
  value: false,
  redoAttLanseras: true,
  endastAdmin: false,
}
const FAQ_PUBLICERAD: FaqItem = {
  id: 'f1',
  kategori: 'Mina källor',
  publicerad: true,
  fraga: 'Hur filtrerar jag på län?',
  svar: '...',
  flagKey: 'kallor_lan_filter',
}
const FAQ_UTKAST: FaqItem = {
  id: 'f2',
  kategori: 'Mina källor',
  publicerad: false,
  fraga: 'Vad är ett länsfilter?',
  svar: '...',
  flagKey: 'kallor_lan_filter',
}

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
  fetchAdminFeatureFlags: vi.fn().mockResolvedValue([FLAGGA]),
}))
vi.mock('../api/faq', () => ({
  fetchAdminFaq: vi.fn().mockResolvedValue([FAQ_PUBLICERAD, FAQ_UTKAST]),
}))
vi.mock('../api/push', () => ({ sendNewVersionNotice: vi.fn() }))

const { default: AdminUppdateringar } = await import('../components/Admin/AdminUppdateringar')

function rendera() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <AdminUppdateringar />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('AdminUppdateringar — kopplade FAQ-frågor', () => {
  it('listar varje kopplad fråga med vad som händer med den vid lansering', async () => {
    rendera()
    await userEvent.click(await screen.findByText('+ Ny uppdatering'))
    await userEvent.type(screen.getByPlaceholderText(/Logga in och skapa konto/), 'Titel')
    await userEvent.type(
      screen.getByPlaceholderText('Beskriv ändringen kort och tydligt...'),
      'En rad text',
    )
    await userEvent.click(screen.getByText('Schemalägg lansering'))
    const datumFält = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
    fireEvent.change(datumFält, { target: { value: '2026-11-01T10:00' } })

    await userEvent.click(await screen.findByText('kallor_lan_filter'))

    expect(screen.getByText('2 FAQ-frågor kopplade till valda flaggor:')).toBeInTheDocument()
    expect(screen.getByText('Hur filtrerar jag på län?')).toBeInTheDocument()
    expect(screen.getByText('Vad är ett länsfilter?')).toBeInTheDocument()
    expect(screen.getByText('Syns vid lansering')).toBeInTheDocument()
    expect(screen.getByText('Förblir dold')).toBeInTheDocument()
  })

  it('visar ingen FAQ-sektion när inga flaggor är valda', async () => {
    rendera()
    await userEvent.click(await screen.findByText('+ Ny uppdatering'))
    await userEvent.click(screen.getByText('Schemalägg lansering'))

    expect(screen.queryByText('Hur filtrerar jag på län?')).not.toBeInTheDocument()
  })
})
