import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FeatureIdeaDetailDto } from '../api/featureIdeas'

// V4-3 (E6#22): (a) triage-motiveringen ska gå att RENSA till en tom sträng —
// tidigare föll ett tomt fält tillbaka på det gamla värdet, så motiveringen kunde
// aldrig tas bort. (b) flagKey ska vara en <select> över riktiga flaggnycklar,
// inte fri text — en felstavad nyckel kunde tidigare skapa en override-rad för
// en flagga som inte finns.

vi.mock('../api/featureIdeas', () => ({
  fetchFeatureIdea: vi.fn(),
  updateFeatureIdea: vi.fn(),
  setIdeaStage: vi.fn(),
  setIdeaTriage: vi.fn(),
  addIdeaTester: vi.fn(),
  removeIdeaTester: vi.fn(),
  addChecklistItem: vi.fn(),
  toggleChecklistItem: vi.fn(),
  removeChecklistItem: vi.fn(),
  deleteFeatureIdea: vi.fn(),
}))

const api = await import('../api/featureIdeas')
const { default: IdeDetaljModal } = await import('../components/Admin/IdeDetaljModal')

const detalj = (over: Partial<FeatureIdeaDetailDto['idea']> = {}): FeatureIdeaDetailDto => ({
  idea: {
    id: 'i1', ideaNumber: 12, title: 'Dela händelse', stage: 'triage', källaTyp: 'admin',
    flagKey: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
    description: 'En bra idé', triageKanGoras: true, triageBorGoras: true,
    triageMotivering: 'Redan efterfrågat av flera användare', createdByName: 'Admin',
    ...over,
  },
  testers: [],
  checklist: [],
})

function rendera() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><IdeDetaljModal ideaId="i1" onClose={() => {}} /></QueryClientProvider>)
}

beforeEach(() => {
  for (const f of Object.values(api)) (f as ReturnType<typeof vi.fn>).mockReset()
  vi.mocked(api.setIdeaTriage).mockResolvedValue(undefined)
  vi.mocked(api.updateFeatureIdea).mockResolvedValue(undefined)
})

describe('IdeDetaljModal — triage-motivering går att tömma (E6#22a)', () => {
  it('rensat fält + blur skickar motivering: null (inte det gamla värdet)', async () => {
    vi.mocked(api.fetchFeatureIdea).mockResolvedValue(detalj())
    rendera()

    const fält = await screen.findByDisplayValue('Redan efterfrågat av flera användare')
    await userEvent.clear(fält)
    fält.blur()

    await waitFor(() => expect(api.setIdeaTriage).toHaveBeenCalled())
    const sistaAnropet = vi.mocked(api.setIdeaTriage).mock.calls.at(-1)!
    expect(sistaAnropet).toEqual(['i1', true, true, null])
  })

  it('en checkbox-ändring UTAN att textfältet rörts bevarar den gamla motiveringen', async () => {
    vi.mocked(api.fetchFeatureIdea).mockResolvedValue(detalj())
    rendera()

    await userEvent.click(await screen.findByLabelText('Bör göras'))

    await waitFor(() => expect(api.setIdeaTriage).toHaveBeenCalled())
    const sistaAnropet = vi.mocked(api.setIdeaTriage).mock.calls.at(-1)!
    expect(sistaAnropet).toEqual(['i1', true, false, 'Redan efterfrågat av flera användare'])
  })

  it('nytt värde skrivet i fältet skickas som det är (inte null, inte gamla värdet)', async () => {
    vi.mocked(api.fetchFeatureIdea).mockResolvedValue(detalj())
    rendera()

    const fält = await screen.findByDisplayValue('Redan efterfrågat av flera användare')
    await userEvent.clear(fält)
    await userEvent.type(fält, 'Ny motivering')
    fält.blur()

    await waitFor(() => expect(api.setIdeaTriage).toHaveBeenCalled())
    const sistaAnropet = vi.mocked(api.setIdeaTriage).mock.calls.at(-1)!
    expect(sistaAnropet).toEqual(['i1', true, true, 'Ny motivering'])
  })
})

describe('IdeDetaljModal — flagKey är en begränsad lista, inte fri text (E6#22b)', () => {
  it('redigeringsläget visar en <select> med riktiga flaggnycklar, inget fritextfält', async () => {
    vi.mocked(api.fetchFeatureIdea).mockResolvedValue(detalj())
    rendera()

    await userEvent.click(await screen.findByText('Redigera'))

    expect(screen.queryByPlaceholderText(/Feature flag-nyckel/)).not.toBeInTheDocument()
    const select = screen.getByDisplayValue('Ingen koppling') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    // Bara riktiga definierade nycklar går att välja.
    expect(Array.from(select.options).length).toBeGreaterThan(1)
  })

  it('val av en riktig flagga och Spara skickar exakt den nyckeln', async () => {
    vi.mocked(api.fetchFeatureIdea).mockResolvedValue(detalj())
    rendera()

    await userEvent.click(await screen.findByText('Redigera'))
    const select = screen.getByDisplayValue('Ingen koppling') as HTMLSelectElement
    const giltigNyckel = Array.from(select.options).find(o => o.value !== '')!.value
    await userEvent.selectOptions(select, giltigNyckel)
    await userEvent.click(screen.getByRole('button', { name: 'Spara' }))

    await waitFor(() => expect(api.updateFeatureIdea).toHaveBeenCalledWith('i1', expect.objectContaining({ flagKey: giltigNyckel })))
  })
})
