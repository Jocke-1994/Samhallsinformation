import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FeatureIdeaDetailDto, TestCatalogFileDto } from '../api/featureIdeas'

// Admin-önskemål 2026-10-19: "Testar" sa bara ATT nåt verifieras, inte VAD.
// Testchecklistan delar upp det i Automatiska tester (riktiga filer ur
// test-catalog.json, sökbara — inte fri text) och Manuella tester (vanlig
// checklista, fas="testning"). Syns bara från stadiet Testar och uppåt.

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
  addTestFile: vi.fn(),
  removeTestFile: vi.fn(),
  fetchTestCatalog: vi.fn(),
  deleteFeatureIdea: vi.fn(),
}))

const api = await import('../api/featureIdeas')
const { default: IdeDetaljModal } = await import('../components/Admin/IdeDetaljModal')

const BAS_IDEA: FeatureIdeaDetailDto['idea'] = {
  id: 'i1', ideaNumber: 7, title: 'Geografiskt platsfilter', stage: 'testas', priority: 0, källaTyp: 'admin',
  flagKey: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z',
  description: 'Platsfilter för besökare', triageKanGoras: true, triageBorGoras: true,
  triageMotivering: null, createdByName: 'Admin',
}

function detalj(over: Partial<FeatureIdeaDetailDto> = {}): FeatureIdeaDetailDto {
  return {
    idea: BAS_IDEA,
    testers: [],
    checklist: [],
    testFiles: [],
    ...over,
  }
}

function rendera() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}><IdeDetaljModal ideaId="i1" onClose={() => {}} /></QueryClientProvider>)
}

describe('IdeDetaljModal — Testchecklista (automatiska + manuella tester)', () => {
  it('syns inte i ett tidigare stadie (Triage)', async () => {
    vi.mocked(api.fetchFeatureIdea).mockResolvedValue(detalj({ idea: { ...BAS_IDEA, stage: 'triage' } }))
    rendera()

    await waitFor(() => expect(screen.getByText('Geografiskt platsfilter')).toBeInTheDocument())
    expect(screen.queryByText('Automatiska tester')).not.toBeInTheDocument()
    expect(screen.queryByText('Manuella tester')).not.toBeInTheDocument()
  })

  it('visar kopplade testfiler och manuella testpunkter i stadiet Testar', async () => {
    vi.mocked(api.fetchFeatureIdea).mockResolvedValue(detalj({
      testFiles: [{ id: 'tf1', filePath: 'backend.Tests/PlatsMatchareTests.cs', className: 'PlatsMatchareTests', count: 7, names: [], okänd: false }],
      checklist: [{ id: 'c1', fas: 'testning', label: 'Testa på mobil', done: false }],
    }))
    rendera()

    await waitFor(() => expect(screen.getByText('Automatiska tester')).toBeInTheDocument())
    expect(screen.getByText('PlatsMatchareTests — 7 tester')).toBeInTheDocument()
    expect(screen.getByText('Testa på mobil')).toBeInTheDocument()
  })

  it('sök efter en testfil och lägg till den', async () => {
    const user = userEvent.setup()
    vi.mocked(api.fetchFeatureIdea).mockResolvedValue(detalj())
    const träff: TestCatalogFileDto = { path: 'backend.Tests/KommunLanTests.cs', className: 'KommunLanTests', project: 'backend', count: 8, names: [] }
    vi.mocked(api.fetchTestCatalog).mockResolvedValue({ files: [träff] })
    rendera()
    await waitFor(() => expect(screen.getByText('Automatiska tester')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(/Sök testfil/), 'kommun')

    await waitFor(() => expect(screen.getByText(/KommunLanTests/)).toBeInTheDocument())
    await user.click(screen.getByText(/KommunLanTests/))

    expect(api.addTestFile).toHaveBeenCalledWith('i1', 'backend.Tests/KommunLanTests.cs')
  })

  it('lägger till en manuell testpunkt med fas "testning"', async () => {
    const user = userEvent.setup()
    vi.mocked(api.fetchFeatureIdea).mockResolvedValue(detalj())
    rendera()
    await waitFor(() => expect(screen.getByText('Manuella tester')).toBeInTheDocument())
    const manuellaSektion = screen.getByText('Manuella tester').closest('div')!.parentElement!

    await user.click(within(manuellaSektion).getByText('+ Eget item'))
    await user.type(screen.getByPlaceholderText('Ny manuell testpunkt'), 'Verifiera i mörkt läge')
    await user.click(within(manuellaSektion).getByText('Lägg till'))

    expect(api.addChecklistItem).toHaveBeenCalledWith('i1', 'Verifiera i mörkt läge', 'testning')
  })
})
