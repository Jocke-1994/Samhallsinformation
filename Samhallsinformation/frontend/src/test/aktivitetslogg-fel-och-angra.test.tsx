import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ActivityLogResponse, LoggPost } from '../api/activityLog'

// V3-8 (E6#8 + E6#19): Aktivitetslogg. Hämtfel visas som fel (inte "Inga poster matchar
// filtret" eller 0 fel), och Ångra har felhantering, dubbelklicksskydd och tydligt
// halvt resultat (ändringen gjord men raden inte markerad).

vi.mock('../api/activityLog', () => ({
  fetchAdminActivityLog: vi.fn(),
  undoActivityLogEntry: vi.fn(),
}))
vi.mock('../api/adminUsers', () => ({ saveAdminUserEvent: vi.fn(), unsaveAdminUserEvent: vi.fn() }))

const { fetchAdminActivityLog, undoActivityLogEntry } = await import('../api/activityLog')
const { saveAdminUserEvent, unsaveAdminUserEvent } = await import('../api/adminUsers')
const { default: Aktivitetslogg } = await import('../components/Admin/Aktivitetslogg')

const post = (over: Partial<LoggPost> = {}): LoggPost => ({
  id: 'l1',
  tid: '2026-09-25T10:00:00Z',
  vem: 'Admin',
  aktörTyp: 'Admin',
  typ: 'Kontoåtgärd',
  rubrik: 'Sparade händelse till Anna',
  detalj: '"Brand i Uppsala" kopplad till Annas konto.',
  status: 'OK',
  ångrad: false,
  arkiverad: false,
  test: false,
  ångraData: {
    anvandareId: 'u-anna',
    undoAction: 'ta-bort',
    handelse: {
      eventId: 'e1',
      title: 'Brand i Uppsala',
      sourceName: 'Polisen',
      publishedAt: '2026-09-01T10:00:00Z',
      sparadDatum: '2026-09-25T10:00:00Z',
    },
  },
  ...over,
})
const svar = (rader: LoggPost[]): ActivityLogResponse => ({
  rader,
  totalt: rader.length,
  sammanfattning: { ingestor: 3, fel: 2, varningar: 1 },
})

function rendera() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <Aktivitetslogg />
    </QueryClientProvider>,
  )
}

async function öppnaRaden() {
  await userEvent.click(await screen.findByText('Sparade händelse till Anna'))
}

beforeEach(() => {
  vi.mocked(fetchAdminActivityLog).mockReset()
  vi.mocked(undoActivityLogEntry).mockReset().mockResolvedValue()
  vi.mocked(saveAdminUserEvent).mockReset().mockResolvedValue()
  vi.mocked(unsaveAdminUserEvent).mockReset().mockResolvedValue()
})

describe('Aktivitetslogg — hämtfel är inte "tom logg"', () => {
  it('fel: felmeddelande + Försök igen, "—" i stat-korten (inte 0), aldrig "Inga poster matchar filtret"', async () => {
    vi.mocked(fetchAdminActivityLog).mockRejectedValue(new Error('fetchAdminActivityLog: 500'))
    rendera()

    const fel = await screen.findByRole('alert')
    expect(fel).toHaveTextContent('Kunde inte hämta aktivitetsloggen')
    expect(screen.getByRole('button', { name: 'Försök igen' })).toBeInTheDocument()
    expect(screen.queryByText('Inga poster matchar filtret.')).not.toBeInTheDocument()
    expect(screen.queryByText('Laddar...')).not.toBeInTheDocument()
    // Ingestor, Fel, Varningar visar "okänt" — och det ej kopplade kortet har alltid "—".
    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('Försök igen hämtar om och visar raderna', async () => {
    vi.mocked(fetchAdminActivityLog)
      .mockRejectedValueOnce(new Error('fetchAdminActivityLog: 500'))
      .mockResolvedValue(svar([post()]))
    rendera()

    await userEvent.click(await screen.findByRole('button', { name: 'Försök igen' }))

    expect(await screen.findByText('Sparade händelse till Anna')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('tomt svar: "Inga poster matchar filtret." (ett riktigt tomt-läge, inget fel)', async () => {
    vi.mocked(fetchAdminActivityLog).mockResolvedValue(svar([]))
    rendera()

    expect(await screen.findByText('Inga poster matchar filtret.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lyckat: rader och riktiga siffror', async () => {
    vi.mocked(fetchAdminActivityLog).mockResolvedValue(svar([post()]))
    rendera()

    expect(await screen.findByText('Sparade händelse till Anna')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

describe('Aktivitetslogg — Ångra', () => {
  async function klickaÅngraOchBekräfta() {
    await öppnaRaden()
    await userEvent.click(screen.getByRole('button', { name: '↩ Ångra' }))
    await userEvent.click(screen.getByRole('button', { name: 'Bekräfta ångra?' }))
  }

  it('lyckat: ändringen görs, raden markeras ångrad och listan hämtas om', async () => {
    vi.mocked(fetchAdminActivityLog).mockResolvedValue(svar([post()]))
    rendera()

    await klickaÅngraOchBekräfta()

    await waitFor(() => expect(undoActivityLogEntry).toHaveBeenCalled())
    expect(vi.mocked(undoActivityLogEntry).mock.calls[0][0]).toBe('l1')
    expect(unsaveAdminUserEvent).toHaveBeenCalledWith('u-anna', 'e1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('felet i själva ändringen: felmeddelande, raden markeras INTE ångrad, försök igen möjligt', async () => {
    vi.mocked(fetchAdminActivityLog).mockResolvedValue(svar([post()]))
    vi.mocked(unsaveAdminUserEvent).mockRejectedValueOnce(
      new Error('Användaren finns inte längre.'),
    )
    rendera()

    await klickaÅngraOchBekräfta()

    const fel = await screen.findByRole('alert')
    expect(fel).toHaveTextContent('Användaren finns inte längre.')
    expect(fel).toHaveTextContent('Ingenting har ändrats')
    expect(undoActivityLogEntry).not.toHaveBeenCalled()
    // Knappen går att använda igen.
    expect(screen.getByRole('button', { name: 'Bekräfta ångra?' })).not.toBeDisabled()
  })

  it('teknisk felkod visas inte rått', async () => {
    vi.mocked(fetchAdminActivityLog).mockResolvedValue(svar([post()]))
    vi.mocked(unsaveAdminUserEvent).mockRejectedValueOnce(new Error('unsaveAdminUserEvent: 500'))
    rendera()

    await klickaÅngraOchBekräfta()

    const fel = await screen.findByRole('alert')
    expect(fel).toHaveTextContent('Kunde inte ångra.')
    expect(fel).not.toHaveTextContent('unsaveAdminUserEvent')
  })

  it('halvt resultat: ändringen gjord men markeringen misslyckas -> tydligt besked, och nytt försök kör BARA markeringen', async () => {
    vi.mocked(fetchAdminActivityLog).mockResolvedValue(svar([post()]))
    vi.mocked(undoActivityLogEntry)
      .mockRejectedValueOnce(new Error('undoActivityLogEntry: 500'))
      .mockResolvedValue()
    rendera()

    await klickaÅngraOchBekräfta()

    const fel = await screen.findByRole('alert')
    expect(fel).toHaveTextContent('Själva ändringen är redan gjord')
    expect(fel).toHaveTextContent('händelsen är borttagen från användarens sparade')
    expect(unsaveAdminUserEvent).toHaveBeenCalledTimes(1)

    // Knappen byter till att bara markera raden — den riktiga ändringen körs inte om.
    await userEvent.click(screen.getByRole('button', { name: 'Markera som ångrad' }))

    await waitFor(() => expect(undoActivityLogEntry).toHaveBeenCalledTimes(2))
    expect(unsaveAdminUserEvent).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('dubbelklick på "Bekräfta ångra?" ger EN ändring och EN markering', async () => {
    vi.mocked(fetchAdminActivityLog).mockResolvedValue(svar([post()]))
    let släpp: () => void = () => {}
    vi.mocked(unsaveAdminUserEvent).mockImplementation(
      () =>
        new Promise<void>((res) => {
          släpp = res
        }),
    )
    rendera()

    await öppnaRaden()
    await userEvent.click(screen.getByRole('button', { name: '↩ Ångra' }))
    const bekräfta = screen.getByRole('button', { name: 'Bekräfta ångra?' })
    await userEvent.dblClick(bekräfta)

    expect(unsaveAdminUserEvent).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Ångrar...' })).toBeDisabled()

    släpp()
    await waitFor(() => expect(undoActivityLogEntry).toHaveBeenCalledTimes(1))
    expect(unsaveAdminUserEvent).toHaveBeenCalledTimes(1)
  })

  it('"lägg-till"-ångring anropar saveAdminUserEvent', async () => {
    vi.mocked(fetchAdminActivityLog).mockResolvedValue(
      svar([
        post({
          ångraData: {
            anvandareId: 'u-anna',
            undoAction: 'lägg-till',
            handelse: {
              eventId: 'e9',
              title: 'X',
              sourceName: 'Y',
              publishedAt: '2026-09-01T10:00:00Z',
              sparadDatum: '2026-09-25T10:00:00Z',
            },
          },
        }),
      ]),
    )
    rendera()

    await klickaÅngraOchBekräfta()

    await waitFor(() => expect(saveAdminUserEvent).toHaveBeenCalledWith('u-anna', 'e9'))
    expect(unsaveAdminUserEvent).not.toHaveBeenCalled()
  })
})
