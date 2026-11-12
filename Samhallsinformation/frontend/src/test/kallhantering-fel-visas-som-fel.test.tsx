import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminSource } from '../types'

// V3-8 (E6#8 + E6#10): Källhantering. Hämtfel visas som fel (inte "0 källor"), och
// redigering stänger formuläret först vid lyckat svar och behåller inmatningen vid fel.

vi.mock('../api/sources', () => ({
  fetchAdminSources: vi.fn(),
  createAdminSource: vi.fn(),
  updateAdminSource: vi.fn(),
  deleteAdminSource: vi.fn(),
  resyncAdminSource: vi.fn(),
}))

const { fetchAdminSources, updateAdminSource, createAdminSource } = await import('../api/sources')
const { default: Kallhantering } = await import('../components/Admin/Kallhantering')

const KÄLLA: AdminSource = {
  id: 7,
  name: 'Testkällan',
  shortName: 'TK',
  baseUrl: 'https://kalla.example',
  url: 'https://kalla.example/rss',
  category: 'Nationell',
  type: 0,
  isActive: true,
  isPublished: false,
  eventCount: 12,
  lastFetchedAt: null,
  lastFetchError: null,
}

function rendera() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <Kallhantering />
    </QueryClientProvider>,
  )
}

async function öppnaRedigering() {
  const rad = (await screen.findByTitle('https://kalla.example/rss')).closest('tr')!
  await userEvent.click(within(rad).getByRole('button', { name: 'Redigera' }))
}
async function skrivNamn(text: string) {
  const fält = screen.getByDisplayValue('Testkällan')
  await userEvent.clear(fält)
  await userEvent.type(fält, text)
}

beforeEach(() => {
  vi.mocked(fetchAdminSources).mockReset().mockResolvedValue([KÄLLA])
  vi.mocked(updateAdminSource).mockReset().mockResolvedValue(KÄLLA)
  vi.mocked(createAdminSource).mockReset()
})

describe('Källhantering — hämtfel', () => {
  it('fel: felruta med Försök igen och "Antal okänt" — inte "0 källor registrerade"', async () => {
    // Komponenten har egen retry: 1 (1 s väntan) — därför längre timeout.
    vi.mocked(fetchAdminSources)
      .mockRejectedValueOnce(new Error('fetchAdminSources: 500'))
      .mockRejectedValueOnce(new Error('fetchAdminSources: 500'))
      .mockResolvedValue([KÄLLA])
    rendera()

    expect(
      await screen.findByText('Kunde inte hämta källista från backend', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Antal okänt/)).toBeInTheDocument()
    expect(screen.queryByText(/0 källor registrerade/)).not.toBeInTheDocument()
    expect(screen.queryByText('Inga källor matchar filtret.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Försök igen' }))
    expect(await screen.findByTitle('https://kalla.example/rss')).toBeInTheDocument()
    expect(screen.queryByText('Kunde inte hämta källista från backend')).not.toBeInTheDocument()
  })

  it('tomt svar: "Inga källor matchar filtret." och "0 källor registrerade"', async () => {
    vi.mocked(fetchAdminSources).mockResolvedValue([])
    rendera()

    expect(await screen.findByText('Inga källor matchar filtret.')).toBeInTheDocument()
    expect(screen.getByText(/0 källor registrerade/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Källhantering — redigering', () => {
  it('FEL: formuläret förblir öppet med inmatningen kvar och serverns text visas', async () => {
    vi.mocked(updateAdminSource).mockRejectedValue(
      new Error('En källa med den adressen finns redan.'),
    )
    rendera()
    await öppnaRedigering()
    await skrivNamn('Nytt namn')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'En källa med den adressen finns redan.',
    )
    expect(screen.getByDisplayValue('Nytt namn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Spara' })).not.toBeDisabled()
  })

  it('FEL utan serverns text: reservtext, inmatningen kvar', async () => {
    vi.mocked(updateAdminSource).mockRejectedValue(new Error('updateAdminSource: 500'))
    rendera()
    await öppnaRedigering()
    await skrivNamn('Nytt namn')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Din inmatning finns kvar')
    expect(screen.getByDisplayValue('Nytt namn')).toBeInTheDocument()
  })

  it('LYCKAT: formuläret stängs först när servern svarat', async () => {
    let lös: (s: AdminSource) => void = () => {}
    vi.mocked(updateAdminSource).mockImplementation(
      () =>
        new Promise<AdminSource>((res) => {
          lös = res
        }),
    )
    rendera()
    await öppnaRedigering()
    await skrivNamn('Nytt namn')
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    await waitFor(() => expect(updateAdminSource).toHaveBeenCalledTimes(1))
    expect(screen.getByDisplayValue('Nytt namn')).toBeInTheDocument() // fortfarande öppet under anropet

    lös(KÄLLA)
    await waitFor(() => expect(screen.queryByDisplayValue('Nytt namn')).not.toBeInTheDocument())
  })

  it('dubbelklick på Spara ger ETT anrop', async () => {
    vi.mocked(updateAdminSource).mockImplementation(() => new Promise<AdminSource>(() => {}))
    rendera()
    await öppnaRedigering()
    await skrivNamn('Nytt namn')
    await userEvent.dblClick(screen.getByRole('button', { name: 'Spara' }))

    await waitFor(() => expect(updateAdminSource).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(updateAdminSource).toHaveBeenCalledTimes(1)
  })
})

describe('Källhantering — snabbväxlar och "Aktivera"', () => {
  it('misslyckad Aktiv-växel visas som fel', async () => {
    vi.mocked(updateAdminSource).mockRejectedValue(new Error('updateAdminSource: 500'))
    rendera()
    const rad = (await screen.findByTitle('https://kalla.example/rss')).closest('tr')!
    await userEvent.click(within(rad).getAllByRole('button')[0])

    expect(await screen.findByText('Ändringen kunde inte sparas. Försök igen.')).toBeInTheDocument()
  })

  it('misslyckad "Aktivera" av en kuraterad källa visas vid källan', async () => {
    vi.mocked(createAdminSource).mockRejectedValue(new Error('Källan kunde inte nås.'))
    rendera()
    await screen.findByTitle('https://kalla.example/rss')
    await userEvent.click(screen.getByRole('button', { name: '+ Lägg till källa' }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Aktivera' })[0])

    expect(await screen.findByText('Källan kunde inte nås.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Aktivera' })[0]).not.toBeDisabled()
  })
})
