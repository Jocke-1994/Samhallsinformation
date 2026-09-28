import { beforeEach, describe, expect, it, vi } from 'vitest'

// Anropen till serverflödena (V3-11): rätt endpoint, sida och storlek via adminFetch
// (som bär token + 401-hantering), och ett felsvar kastar i stället för att bli en tom lista.
const adminFetch = vi.hoisted(() => vi.fn())
vi.mock('../api/adminFetch', () => ({ adminFetch }))

import { fetchMittFlode } from '../api/events'
import { fetchSparadeHandelser } from '../api/savedEvents'

function svar(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

beforeEach(() => adminFetch.mockReset())

describe('fetchMittFlode', () => {
  it('anropar /api/user/feed med sida och storlek och returnerar svaret', async () => {
    const body = { total: 1, page: 2, pageSize: 50, events: [], hasMore: false }
    adminFetch.mockResolvedValue(svar(200, body))

    await expect(fetchMittFlode(2, 50)).resolves.toEqual(body)
    expect(adminFetch).toHaveBeenCalledExactlyOnceWith('/api/user/feed?page=2&pageSize=50')
  })

  it('kastar vid felsvar (401/500) i stället för att returnera en tom lista', async () => {
    adminFetch.mockResolvedValue(svar(401))
    await expect(fetchMittFlode(1, 50)).rejects.toThrow('fetchMittFlode: 401')
    adminFetch.mockResolvedValue(svar(500))
    await expect(fetchMittFlode(1, 50)).rejects.toThrow('fetchMittFlode: 500')
  })
})

describe('fetchSparadeHandelser', () => {
  it('anropar /api/user/saved-events/events med sida och storlek', async () => {
    const body = { total: 0, page: 1, pageSize: 50, events: [], hasMore: false }
    adminFetch.mockResolvedValue(svar(200, body))

    await expect(fetchSparadeHandelser(1, 50)).resolves.toEqual(body)
    expect(adminFetch).toHaveBeenCalledExactlyOnceWith('/api/user/saved-events/events?page=1&pageSize=50')
  })

  it('kastar vid felsvar', async () => {
    adminFetch.mockResolvedValue(svar(500))
    await expect(fetchSparadeHandelser(1, 50)).rejects.toThrow('fetchSparadeHandelser: 500')
  })
})
