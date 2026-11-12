import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ArendehanteringKort from '../components/Profile/Support/ArendehanteringKort'
import { FeedbackModal } from '../components/Feedback/FeedbackButton'
import { TicketError, TICKET_RATE_LIMIT_MESSAGE } from '../api/support'
import * as supportApi from '../api/support'

// V3-9: supportformuläret (Ärendehantering + Feedback-modalen) — kategoribyte
// får inte radera det användaren skrivit, fel ska synas, och knappen ska vara
// låst under pågående anrop. V2-9:s begränsningar (maxLength, 429-texten,
// TicketError) ska finnas kvar.
vi.mock('../api/support', async (importOriginal) => {
  const faktisk = await importOriginal<typeof import('../api/support')>()
  return {
    ...faktisk,
    createTicket: vi.fn(),
    fetchMyTickets: vi.fn(),
    fetchMyTicket: vi.fn(),
    replyToTicket: vi.fn(),
  }
})
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: true, email: 'a@b.se', accessToken: 't' }),
}))
vi.mock('../betaConfig', () => ({
  BETA: { aktiv: true, sokesFor: 'x', beskrivning: 'x', mall: 'BETAMALL: beskriv vad du testade' },
}))

const api = vi.mocked(supportApi)

function renderaKort() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ArendehanteringKort />
    </QueryClientProvider>,
  )
}

const kategoriVal = () => screen.getByRole('combobox') as HTMLSelectElement
const amneFalt = () => screen.getByPlaceholderText(/Beskriv kortfattat/) as HTMLInputElement
const meddelandeFalt = () =>
  screen.getByPlaceholderText(/Berätta vad som hänt/) as HTMLTextAreaElement
const skickaKnapp = () => screen.getByRole('button', { name: /Skicka ärende|Skickar/ })

beforeEach(() => {
  api.createTicket.mockReset()
  api.fetchMyTickets.mockReset().mockResolvedValue([])
  api.fetchMyTicket.mockReset()
  api.replyToTicket.mockReset()
})

describe('Skicka nytt ärende', () => {
  it('kategoribyte raderar varken ämne eller meddelande', async () => {
    const user = userEvent.setup()
    renderaKort()

    await user.selectOptions(kategoriVal(), 'Konto')
    await user.type(amneFalt(), 'Kan inte byta e-post')
    await user.type(meddelandeFalt(), 'Jag försöker byta e-postadress men inget händer.')

    await user.selectOptions(kategoriVal(), 'Inloggning')

    expect(kategoriVal().value).toBe('Inloggning')
    expect(amneFalt()).toHaveValue('Kan inte byta e-post')
    expect(meddelandeFalt()).toHaveValue('Jag försöker byta e-postadress men inget händer.')
  })

  it('betamallen fylls bara i ett tomt fält och skriver aldrig över egen text', async () => {
    const user = userEvent.setup()
    renderaKort()

    await user.type(meddelandeFalt(), 'Min egen text som ska överleva')
    await user.selectOptions(kategoriVal(), 'Testare')
    expect(meddelandeFalt()).toHaveValue('Min egen text som ska överleva')

    await user.clear(meddelandeFalt())
    await user.selectOptions(kategoriVal(), 'Annat')
    await user.selectOptions(kategoriVal(), 'Testare')
    expect(meddelandeFalt()).toHaveValue('BETAMALL: beskriv vad du testade')
  })

  it('betamallen tas bort igen bara om den är orörd när man byter bort från Testare', async () => {
    const user = userEvent.setup()
    renderaKort()

    await user.selectOptions(kategoriVal(), 'Testare')
    expect(meddelandeFalt()).toHaveValue('BETAMALL: beskriv vad du testade')
    await user.selectOptions(kategoriVal(), 'Konto')
    expect(meddelandeFalt()).toHaveValue('')

    await user.selectOptions(kategoriVal(), 'Testare')
    await user.type(meddelandeFalt(), ' plus mitt tillägg')
    await user.selectOptions(kategoriVal(), 'Konto')
    expect(meddelandeFalt()).toHaveValue('BETAMALL: beskriv vad du testade plus mitt tillägg')
  })

  it('behåller maxLength på ämne och meddelande (V2-9)', () => {
    renderaKort()
    expect(amneFalt()).toHaveAttribute('maxlength', '200')
    expect(meddelandeFalt()).toHaveAttribute('maxlength', '5000')
  })

  it('misslyckat anrop: felmeddelande syns, ingen bekräftelse, texten finns kvar', async () => {
    const user = userEvent.setup()
    api.createTicket.mockRejectedValue(
      new TicketError(500, 'Något gick fel. Försök igen eller kontakta oss direkt.'),
    )
    renderaKort()

    await user.selectOptions(kategoriVal(), 'Tekniskt fel')
    await user.type(amneFalt(), 'Appen kraschar')
    await user.type(meddelandeFalt(), 'Den kraschar när jag öppnar Sparat.')
    await user.click(skickaKnapp())

    expect(await screen.findByRole('alert')).toHaveTextContent('Något gick fel')
    expect(screen.queryByText(/Ditt ärende har skickats/)).not.toBeInTheDocument()
    expect(amneFalt()).toHaveValue('Appen kraschar')
    expect(meddelandeFalt()).toHaveValue('Den kraschar när jag öppnar Sparat.')
    expect(skickaKnapp()).toBeEnabled()
  })

  it('visar 429-meddelandet från TicketError (V2-9)', async () => {
    const user = userEvent.setup()
    api.createTicket.mockRejectedValue(new TicketError(429, TICKET_RATE_LIMIT_MESSAGE))
    renderaKort()

    await user.selectOptions(kategoriVal(), 'Konto')
    await user.type(amneFalt(), 'Fråga')
    await user.type(meddelandeFalt(), 'Tio tecken eller mer här.')
    await user.click(skickaKnapp())

    expect(await screen.findByRole('alert')).toHaveTextContent(TICKET_RATE_LIMIT_MESSAGE)
  })

  it('lyckat anrop: bekräftelse med ärendenummer och nollställt formulär', async () => {
    const user = userEvent.setup()
    api.createTicket.mockResolvedValue({ id: 't1', ticketNumber: 42 })
    renderaKort()

    await user.selectOptions(kategoriVal(), 'Konto')
    await user.type(amneFalt(), 'Fråga')
    await user.type(meddelandeFalt(), 'Tio tecken eller mer här.')
    await user.click(skickaKnapp())

    expect(await screen.findByText('SUP-0042')).toBeInTheDocument()
    expect(amneFalt()).toHaveValue('')
    expect(meddelandeFalt()).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('låser knappen under pågående anrop (ingen dubbel-submit)', async () => {
    const user = userEvent.setup()
    let avsluta!: (v: { id: string; ticketNumber: number }) => void
    api.createTicket.mockReturnValue(
      new Promise((resolve) => {
        avsluta = resolve
      }),
    )
    renderaKort()

    await user.selectOptions(kategoriVal(), 'Konto')
    await user.type(amneFalt(), 'Fråga')
    await user.type(meddelandeFalt(), 'Tio tecken eller mer här.')
    await user.click(skickaKnapp())

    await waitFor(() => expect(screen.getByRole('button', { name: 'Skickar...' })).toBeDisabled())
    await user.click(screen.getByRole('button', { name: 'Skickar...' }))
    expect(api.createTicket).toHaveBeenCalledTimes(1)

    avsluta({ id: 't1', ticketNumber: 1 })
    expect(await screen.findByText('SUP-0001')).toBeInTheDocument()
  })
})

describe('Svara på ärende', () => {
  const ticket = {
    id: 't1',
    ticketNumber: 7,
    subject: 'Hjälp',
    category: 'Konto',
    status: 'Öppet',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
  }

  async function oppnaArende(user: ReturnType<typeof userEvent.setup>) {
    api.fetchMyTickets.mockResolvedValue([ticket] as never)
    api.fetchMyTicket.mockResolvedValue({ ...ticket, messages: [] } as never)
    renderaKort()
    await user.click(await screen.findByText('Hjälp'))
    return await screen.findByPlaceholderText('Skriv ditt svar...')
  }

  it('misslyckat svar: felmeddelande syns, ingen bekräftelse, texten finns kvar', async () => {
    const user = userEvent.setup()
    api.replyToTicket.mockRejectedValue(new Error('replyToTicket: 500'))
    const falt = await oppnaArende(user)

    await user.type(falt, 'Tack för hjälpen')
    await user.click(screen.getByRole('button', { name: 'Skicka svar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ditt svar kunde inte skickas')
    expect(screen.queryByText('Ditt svar har skickats.')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Skriv ditt svar...')).toHaveValue('Tack för hjälpen')
    expect(screen.getByRole('button', { name: 'Skicka svar' })).toBeEnabled()
  })

  it('lyckat svar: bekräftelse och inget felmeddelande', async () => {
    const user = userEvent.setup()
    api.replyToTicket.mockResolvedValue(undefined)
    const falt = await oppnaArende(user)

    await user.type(falt, 'Tack för hjälpen')
    await user.click(screen.getByRole('button', { name: 'Skicka svar' }))

    expect(await screen.findByText('Ditt svar har skickats.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('låser Skicka svar under pågående anrop', async () => {
    const user = userEvent.setup()
    let avsluta!: () => void
    api.replyToTicket.mockReturnValue(
      new Promise<void>((resolve) => {
        avsluta = resolve
      }),
    )
    const falt = await oppnaArende(user)

    await user.type(falt, 'Tack')
    await user.click(screen.getByRole('button', { name: 'Skicka svar' }))
    const upptagen = await screen.findByRole('button', { name: 'Skickar...' })
    expect(upptagen).toBeDisabled()
    await user.click(upptagen)
    expect(api.replyToTicket).toHaveBeenCalledTimes(1)

    avsluta()
    expect(await screen.findByText('Ditt svar har skickats.')).toBeInTheDocument()
  })
})

describe('Feedback-modalen', () => {
  function renderaModal() {
    return render(<FeedbackModal open onClose={() => {}} />)
  }

  it('misslyckat anrop: felmeddelandet syns och det skrivna behålls', async () => {
    const user = userEvent.setup()
    api.createTicket.mockRejectedValue(new TicketError(429, TICKET_RATE_LIMIT_MESSAGE))
    renderaModal()

    await user.type(screen.getByPlaceholderText(/Vad tänker du på/), 'Bra app men en bugg')
    await user.click(screen.getByLabelText(/Jag vill ha återkoppling/))
    await user.type(screen.getByPlaceholderText('Ditt namn'), 'Anna')
    await user.type(screen.getByPlaceholderText('din@email.se'), 'anna@example.se')
    await user.click(screen.getByRole('button', { name: 'Skicka feedback' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(TICKET_RATE_LIMIT_MESSAGE)
    expect(screen.queryByText('Tack för din feedback!')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Vad tänker du på/)).toHaveValue('Bra app men en bugg')
    expect(screen.getByPlaceholderText('Ditt namn')).toHaveValue('Anna')
    expect(screen.getByPlaceholderText('din@email.se')).toHaveValue('anna@example.se')
    expect(screen.getByRole('button', { name: 'Skicka feedback' })).toBeEnabled()
  })

  it('låser knappen under pågående anrop och visar tack när det lyckats', async () => {
    const user = userEvent.setup()
    let avsluta!: (v: { id: string; ticketNumber: number }) => void
    api.createTicket.mockReturnValue(
      new Promise((resolve) => {
        avsluta = resolve
      }),
    )
    renderaModal()

    await user.type(screen.getByPlaceholderText(/Vad tänker du på/), 'Hej')
    await user.click(screen.getByRole('button', { name: 'Skicka feedback' }))

    const upptagen = await screen.findByRole('button', { name: 'Skickar...' })
    expect(upptagen).toBeDisabled()
    expect(api.createTicket).toHaveBeenCalledTimes(1)

    avsluta({ id: 't', ticketNumber: 1 })
    expect(await screen.findByText('Tack för din feedback!')).toBeInTheDocument()
  })
})
