import { adminFetch } from './adminFetch'

export async function fetchSavedEventIds(): Promise<string[]> {
  const res = await adminFetch('/api/user/saved-events')
  if (!res.ok) throw new Error(`fetchSavedEventIds: ${res.status}`)
  return res.json()
}

export async function saveEvent(eventId: string): Promise<void> {
  const res = await adminFetch('/api/user/saved-events', {
    method: 'POST',
    body: JSON.stringify({ eventId }),
  })
  if (!res.ok) throw new Error(`saveEvent: ${res.status}`)
}

export async function unsaveEvent(eventId: string): Promise<void> {
  const res = await adminFetch(`/api/user/saved-events/${eventId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`unsaveEvent: ${res.status}`)
}
