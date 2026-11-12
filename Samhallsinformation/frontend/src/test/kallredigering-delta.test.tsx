import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AdminSource } from '../types'

// Regressionstester för V3-21 (E6#15): redigeringsformuläret skickar bara det användaren ändrat
// (aldrig isActive, aldrig en gammal isPublished), och publicera/aktivera skickar bara sitt eget fält.

vi.mock('../api/sources', () => ({
  fetchAdminSources: vi.fn(),
  createAdminSource: vi.fn(),
  updateAdminSource: vi.fn(),
  deleteAdminSource: vi.fn(),
  resyncAdminSource: vi.fn(),
}))

const { fetchAdminSources, updateAdminSource } = await import('../api/sources')
const { default: Kallhantering, beräknaKällDelta } =
  await import('../components/Admin/Kallhantering')

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

function renderaMedQuery() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <Kallhantering />
    </QueryClientProvider>,
  )
  return queryClient
}

async function öppnaRedigering() {
  const rad = (await screen.findByTitle('https://kalla.example/rss')).closest('tr')!
  await userEvent.click(within(rad).getByRole('button', { name: 'Redigera' }))
  return rad
}

const sparaKnapp = () => screen.getByRole('button', { name: 'Spara' })
async function skrivNamn(text: string) {
  const fält = screen.getByDisplayValue('Testkällan')
  await userEvent.clear(fält)
  await userEvent.type(fält, text)
}

describe('Källredigering skickar delta (V3-21, E6#15)', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminSources).mockReset().mockResolvedValue([KÄLLA])
    vi.mocked(updateAdminSource).mockReset().mockResolvedValue(KÄLLA)
  })

  it('skickar bara ändrat namn — inte url, kategori, isPublished eller isActive', async () => {
    renderaMedQuery()
    await öppnaRedigering()
    await skrivNamn('Nytt namn')
    await userEvent.click(sparaKnapp())

    await waitFor(() => expect(updateAdminSource).toHaveBeenCalledTimes(1))
    expect(updateAdminSource).toHaveBeenCalledWith(7, { name: 'Nytt namn' })
  })

  it('skickar isPublished bara när formulärets publicera-växel rörts', async () => {
    renderaMedQuery()
    await öppnaRedigering()
    // Växeln är en ren knapp (ingen etikett); hitta den via statustexten bredvid.
    const växel = screen.getByText(/Opublicerad — osynlig/).parentElement!
      .previousElementSibling as HTMLElement
    await userEvent.click(växel)
    await userEvent.click(sparaKnapp())

    await waitFor(() => expect(updateAdminSource).toHaveBeenCalledTimes(1))
    expect(updateAdminSource).toHaveBeenCalledWith(7, { isPublished: true })
  })

  it('rör man inget skickas inget anrop', async () => {
    renderaMedQuery()
    await öppnaRedigering()
    await userEvent.click(sparaKnapp())

    expect(updateAdminSource).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Spara' })).toBeNull()
  })

  it('en isPublished-ändring i cachen mellan öppna och spara skrivs inte över', async () => {
    const queryClient = renderaMedQuery()
    await öppnaRedigering()

    // Någon annan (snabbknapp, annan flik/admin) publicerar och pausar medan formuläret är öppet.
    queryClient.setQueryData<AdminSource[]>(
      ['admin-sources'],
      [{ ...KÄLLA, isPublished: true, isActive: false }],
    )
    await screen.findByText(/Publicerad — synlig/)

    await skrivNamn('Nytt namn')
    await userEvent.click(sparaKnapp())

    await waitFor(() => expect(updateAdminSource).toHaveBeenCalledTimes(1))
    const [, req] = vi.mocked(updateAdminSource).mock.calls[0]
    expect(req).toEqual({ name: 'Nytt namn' })
    expect(req).not.toHaveProperty('isPublished')
    expect(req).not.toHaveProperty('isActive')
  })

  it('hämtar om källistan från servern efter lyckad sparning', async () => {
    renderaMedQuery()
    await öppnaRedigering()
    await skrivNamn('Nytt namn')
    vi.mocked(fetchAdminSources).mockClear()
    await userEvent.click(sparaKnapp())

    await waitFor(() => expect(fetchAdminSources).toHaveBeenCalled())
  })
})

describe('Snabbknappar skickar bara sitt eget fält (V3-21)', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminSources).mockReset().mockResolvedValue([KÄLLA])
    vi.mocked(updateAdminSource).mockReset().mockResolvedValue(KÄLLA)
  })

  it('Publicera-växeln i raden skickar bara isPublished', async () => {
    renderaMedQuery()
    const rad = (await screen.findByTitle('https://kalla.example/rss')).closest('tr')!
    const knappar = within(rad).getAllByRole('button')
    // Raden har två växlar (Publicerad, Aktiv) före Synka om/Redigera/Ta bort.
    const publicera = knappar.find((b) => b.getAttribute('title')?.match(/publicer/i))
    expect(publicera).toBeTruthy()
    await userEvent.click(publicera!)

    await waitFor(() => expect(updateAdminSource).toHaveBeenCalledTimes(1))
    expect(updateAdminSource).toHaveBeenCalledWith(7, { isPublished: true })
  })
})

describe('Aktiv-växeln (V3-21)', () => {
  it('skickar bara isActive', async () => {
    vi.mocked(fetchAdminSources).mockReset().mockResolvedValue([KÄLLA])
    vi.mocked(updateAdminSource).mockReset().mockResolvedValue(KÄLLA)
    renderaMedQuery()
    const rad = (await screen.findByTitle('https://kalla.example/rss')).closest('tr')!
    // Första knappen i raden är Aktiv-växeln (saknar titel/etikett).
    await userEvent.click(within(rad).getAllByRole('button')[0])

    await waitFor(() => expect(updateAdminSource).toHaveBeenCalledTimes(1))
    expect(updateAdminSource).toHaveBeenCalledWith(7, { isActive: false })
  })
})

describe('beräknaKällDelta', () => {
  const aktuell = {
    id: 1,
    namn: 'A',
    url: 'https://a',
    kategori: 'Nationell' as const,
    status: 'OK' as const,
    aktiv: true,
    publicerad: true,
    senastKontroll: '—',
    fetchError: null,
    händelser: 0,
  }

  it('utelämnar fält som är lika med aktuellt läge och aldrig isActive', () => {
    expect(beräknaKällDelta(aktuell, { namn: 'A', url: 'https://b', publicerad: true })).toEqual({
      url: 'https://b',
    })
    expect(beräknaKällDelta(aktuell, {})).toEqual({})
  })
})
