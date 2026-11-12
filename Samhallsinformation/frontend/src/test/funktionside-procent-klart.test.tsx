import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FeatureIdeaListItemDto } from '../api/featureIdeas'

// % klart-kolumnen (admin-önskemål 2026-10-19) härleds automatiskt ur
// pipeline-stadiet, ingen egen inmatning — se STAGE_PERCENT i
// FunktionsIdePipeline.tsx. Reordnings-dragningen testas inte här (ingen
// dnd-kit-pekargest simulerad någonstans i den här kodbasen sen tidigare,
// se Sidebar/useSourceOrder-testerna som bara kör spara(order) direkt).

const IDÉER: FeatureIdeaListItemDto[] = [
  {
    id: '1',
    ideaNumber: 1,
    title: 'Brainstorm-idé',
    stage: 'brainstorm',
    priority: 0,
    källaTyp: 'admin',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: '2',
    ideaNumber: 2,
    title: 'Triage-idé',
    stage: 'triage',
    priority: 1,
    källaTyp: 'admin',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: '3',
    ideaNumber: 3,
    title: 'Bygger-idé',
    stage: 'byggs',
    priority: 2,
    källaTyp: 'admin',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: '4',
    ideaNumber: 4,
    title: 'Testar-idé',
    stage: 'testas',
    priority: 3,
    källaTyp: 'admin',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: '5',
    ideaNumber: 5,
    title: 'Klar-idé',
    stage: 'lanseringsklar',
    priority: 4,
    källaTyp: 'admin',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: '6',
    ideaNumber: 6,
    title: 'Lanserad-idé',
    stage: 'lanserad',
    priority: 5,
    källaTyp: 'admin',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: '7',
    ideaNumber: 7,
    title: 'Avfärdad-idé',
    stage: 'avfärdad',
    priority: 6,
    källaTyp: 'admin',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
]

vi.mock('../api/featureIdeas', async () => {
  const faktisk = await vi.importActual<typeof import('../api/featureIdeas')>('../api/featureIdeas')
  return {
    ...faktisk,
    fetchFeatureIdeas: vi.fn().mockResolvedValue(IDÉER),
    createFeatureIdea: vi.fn(),
    reorderFeatureIdeas: vi.fn(),
  }
})

const { default: FunktionsIdePipeline } = await import('../components/Admin/FunktionsIdePipeline')

function rendera() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <FunktionsIdePipeline />
    </QueryClientProvider>,
  )
}

function radFor(titel: string) {
  return screen.getByText(titel).closest('tr')!
}

describe('Funktionsidéer — % klart-kolumn (automatisk, från stadiet)', () => {
  it('visar rätt procent per pipeline-stadie, och ett streck för avfärdade idéer', async () => {
    rendera()
    await waitFor(() => expect(screen.getByText('Brainstorm-idé')).toBeInTheDocument())

    expect(within(radFor('Brainstorm-idé')).getByText('0%')).toBeInTheDocument()
    expect(within(radFor('Triage-idé')).getByText('15%')).toBeInTheDocument()
    expect(within(radFor('Bygger-idé')).getByText('40%')).toBeInTheDocument()
    expect(within(radFor('Testar-idé')).getByText('70%')).toBeInTheDocument()
    expect(within(radFor('Klar-idé')).getByText('90%')).toBeInTheDocument()
    expect(within(radFor('Lanserad-idé')).getByText('100%')).toBeInTheDocument()
    expect(within(radFor('Avfärdad-idé')).getByText('—')).toBeInTheDocument()
  })

  it('stadie-flikarna filtrerar listan, % klart-kolumnen följer med', async () => {
    const user = userEvent.setup()
    rendera()
    await waitFor(() => expect(screen.getByText('Brainstorm-idé')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Testar' }))

    await waitFor(() => expect(screen.getByText('Testar-idé')).toBeInTheDocument())
    expect(screen.queryByText('Brainstorm-idé')).not.toBeInTheDocument()
    expect(within(radFor('Testar-idé')).getByText('70%')).toBeInTheDocument()
  })
})
