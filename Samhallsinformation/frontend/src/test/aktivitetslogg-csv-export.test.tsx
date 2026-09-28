import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ActivityLogResponse, LoggPost } from '../api/activityLog'
import { escapaCsvCell, exporteraCsv } from '../components/Admin/Aktivitetslogg'

// V4-3 (E6#16): CSV-exporten i Aktivitetsloggen. (a) värden med citattecken/kommatecken/
// radbrytning ska förbli en enda kolumn efter escaping, (b) ett värde som börjar med
// = + - @ (eller tabb/CR) ska neutraliseras (OWASP CSV-injektionsskydd), (c) inga
// fabricerade Notis-mockrader ska följa med exporten.

vi.mock('../api/activityLog', () => ({ fetchAdminActivityLog: vi.fn(), undoActivityLogEntry: vi.fn() }))
vi.mock('../api/adminUsers', () => ({ saveAdminUserEvent: vi.fn(), unsaveAdminUserEvent: vi.fn() }))

const { fetchAdminActivityLog, undoActivityLogEntry } = await import('../api/activityLog')
const { default: Aktivitetslogg } = await import('../components/Admin/Aktivitetslogg')

const post = (over: Partial<LoggPost> = {}): LoggPost => ({
  id: 'l1', tid: '2026-09-25T10:00:00Z', vem: 'Admin', aktörTyp: 'Admin', typ: 'Kontoåtgärd',
  rubrik: 'Sparade händelse till Anna', detalj: 'Vanlig detaljtext',
  status: 'OK', ångrad: false, arkiverad: false, test: false,
  ...over,
})
const svar = (rader: LoggPost[]): ActivityLogResponse => ({
  rader, totalt: rader.length, sammanfattning: { ingestor: 3, fel: 2, varningar: 1 },
})

function rendera() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><Aktivitetslogg /></QueryClientProvider>)
}

beforeEach(() => {
  vi.mocked(fetchAdminActivityLog).mockReset()
  vi.mocked(undoActivityLogEntry).mockReset().mockResolvedValue()
})

describe('escapaCsvCell — ren funktion', () => {
  it('citattecken dubblas och cellen omsluts alltid i citattecken', () => {
    expect(escapaCsvCell('Titel "Brand" i Uppsala')).toBe('"Titel ""Brand"" i Uppsala"')
  })

  it('kommatecken och radbrytning i värdet bevaras inom EN cell', () => {
    expect(escapaCsvCell('Rad 1,med komma\noch radbrytning')).toBe('"Rad 1,med komma\noch radbrytning"')
  })

  it('ett värde som börjar med = neutraliseras med en apostrof (formelinjektion)', () => {
    expect(escapaCsvCell('=HYPERLINK("http://evil.example")')).toBe('"\'=HYPERLINK(""http://evil.example"")"')
  })

  it('+, -, @, tabb och CR i cellens BÖRJAN neutraliseras också', () => {
    expect(escapaCsvCell('+1234')).toBe('"\'+1234"')
    expect(escapaCsvCell('-1234')).toBe('"\'-1234"')
    expect(escapaCsvCell('@mention')).toBe('"\'@mention"')
    expect(escapaCsvCell('\tledande tabb')).toBe('"\'\tledande tabb"')
    expect(escapaCsvCell('\rledande cr')).toBe('"\'\rledande cr"')
  })

  it('= mitt i en sträng (inte i BÖRJAN) neutraliseras inte', () => {
    expect(escapaCsvCell('Namn=Värde')).toBe('"Namn=Värde"')
  })

  it('en tom/odefinierad cell blir en tom, citerad sträng utan att krascha', () => {
    expect(escapaCsvCell('')).toBe('""')
  })
})

describe('exporteraCsv — hela filen', () => {
  it('bygger en Blob vars innehåll har escapade och neutraliserade celler, inga mockrader', async () => {
    let inspelatInnehåll = ''
    const ursprungligBlobText = Blob.prototype.text
    Blob.prototype.text = async function (this: Blob) {
      inspelatInnehåll = await ursprungligBlobText.call(this)
      return inspelatInnehåll
    }
    const skapadUrl = vi.fn().mockReturnValue('blob:mock')
    const återkalladUrl = vi.fn()
    URL.createObjectURL = skapadUrl as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = återkalladUrl

    try {
      const rader = [
        {
          id: 'l1', tid: '10:00', datum: '2026-09-27', typ: 'Kontoåtgärd' as const,
          rubrik: '=HYPERLINK("http://evil.example")', detalj: 'Innehåller "citattecken", komma och\nradbrytning',
          status: 'OK' as const, vem: 'En, Användare',
        },
      ]
      exporteraCsv(rader)
      expect(skapadUrl).toHaveBeenCalledTimes(1)
      const blob = skapadUrl.mock.calls[0][0] as Blob
      const text = await blob.text()

      expect(text).toContain('"\'=HYPERLINK(""http://evil.example"")"')
      expect(text).toContain('"Innehåller ""citattecken"", komma och\nradbrytning"')
      expect(text).toContain('"En, Användare"')
      expect(text).not.toContain('MSB')
      expect(text).not.toContain('Notis skickad')
      expect(återkalladUrl).toHaveBeenCalledWith('blob:mock')
    } finally {
      Blob.prototype.text = ursprungligBlobText
    }
  })
})

describe('Aktivitetslogg — export innehåller aldrig fabricerad Notis-data', () => {
  it('en logg utan riktiga notisrader (backend saknar en global notislista) exporterar inga påhittade rader', async () => {
    vi.mocked(fetchAdminActivityLog).mockResolvedValue(svar([post()]))
    rendera()

    expect(await screen.findByText('Sparade händelse till Anna')).toBeInTheDocument()
    expect(screen.queryByText(/Notis skickad/)).not.toBeInTheDocument()
    expect(screen.queryByText(/MSB/)).not.toBeInTheDocument()

    // Exportknappen ska gå att klicka utan att krascha, och görs bara utifrån riktiga rader.
    const skapadUrl = vi.fn().mockReturnValue('blob:mock')
    URL.createObjectURL = skapadUrl as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    await userEvent.click(screen.getByRole('button', { name: /Exportera CSV/ }))
    expect(skapadUrl).toHaveBeenCalledTimes(1)
  })
})
