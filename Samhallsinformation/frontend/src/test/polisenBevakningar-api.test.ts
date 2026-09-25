import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/adminFetch', () => ({ adminFetch: vi.fn() }))

import { adminFetch } from '../api/adminFetch'
import { BevakningError, createBevakning, updateBevakning } from '../api/polisenBevakningar'

const mockFetch = vi.mocked(adminFetch)

function svar(status: number, body = ''): Response {
  return new Response(body, { status })
}

beforeEach(() => mockFetch.mockReset())

// V3-17: backend avvisar ogiltiga/för stora bevakningar med 400 + svensk text.
describe('polisenBevakningar-API — serverns felmeddelande', () => {
  it('createBevakning kastar BevakningError med serverns text vid 400', async () => {
    mockFetch.mockResolvedValue(svar(400, 'Max 5 bevakningar per användare.'))

    const fel = await createBevakning({ kategorier: null, omraden: null }).catch(e => e)

    expect(fel).toBeInstanceOf(BevakningError)
    expect(fel.message).toBe('Max 5 bevakningar per användare.')
  })

  it('updateBevakning kastar BevakningError med serverns text vid 400', async () => {
    mockFetch.mockResolvedValue(svar(400, 'Okänd kommun: "Atlantis".'))

    const fel = await updateBevakning('b1', { kategorier: null, omraden: ['Atlantis'] }).catch(e => e)

    expect(fel).toBeInstanceOf(BevakningError)
    expect(fel.message).toContain('Atlantis')
  })

  it('andra fel (500) blir ett vanligt Error, inte BevakningError', async () => {
    mockFetch.mockResolvedValue(svar(500, 'Internal'))

    const fel = await createBevakning({ kategorier: null, omraden: null }).catch(e => e)

    expect(fel).toBeInstanceOf(Error)
    expect(fel).not.toBeInstanceOf(BevakningError)
  })

  it('en 400 utan läsbar text faller tillbaka på ett vanligt Error', async () => {
    mockFetch.mockResolvedValue(svar(400, ''))

    const fel = await createBevakning({ kategorier: null, omraden: null }).catch(e => e)

    expect(fel).not.toBeInstanceOf(BevakningError)
  })
})
