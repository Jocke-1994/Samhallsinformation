import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTicket, TicketError, TICKET_RATE_LIMIT_MESSAGE } from '../api/support'

const req = { message: 'Hej', channel: 'feedback' as const }

describe('createTicket (API-klient, V2-9)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ger ett begripligt svenskt meddelande vid 429 (rate limit)', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'För många försök.' }), { status: 429 }),
    )

    const err = await createTicket(req).catch((e) => e)

    expect(err).toBeInstanceOf(TicketError)
    expect(err.status).toBe(429)
    expect(err.message).toBe(TICKET_RATE_LIMIT_MESSAGE)
    expect(err.message).toBe('För många ärenden just nu, försök igen senare.')
  })

  it('visar serverns svenska valideringsfel vid 400', async () => {
    fetchMock.mockResolvedValue(new Response('Ogiltig e-postadress.', { status: 400 }))

    await expect(createTicket(req)).rejects.toThrow('Ogiltig e-postadress.')
  })

  it('ger ett generellt fel vid 5xx och returnerar svaret vid lyckat anrop', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await expect(createTicket(req)).rejects.toThrow(/Något gick fel/)

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'abc', ticketNumber: 7 }), { status: 200 }),
    )
    await expect(createTicket(req)).resolves.toEqual({ id: 'abc', ticketNumber: 7 })
  })
})
