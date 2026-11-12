import { adminFetch } from './adminFetch'
import type { EventsResponse } from '../types'
import { felFranSvar } from './hamta'

// De sparade händelserna själva (inte bara id:n), paginerat på servern — så att
// en sparad händelse syns oavsett hur gammal den är (V3-11).
export async function fetchSparadeHandelser(
  page: number,
  pageSize: number,
): Promise<EventsResponse> {
  const res = await adminFetch(`/api/user/saved-events/events?page=${page}&pageSize=${pageSize}`)
  if (!res.ok) throw await felFranSvar(res, 'fetchSparadeHandelser')
  return res.json()
}

export async function fetchSavedEventIds(): Promise<string[]> {
  const res = await adminFetch('/api/user/saved-events')
  if (!res.ok) throw await felFranSvar(res, 'fetchSavedEventIds')
  return res.json()
}

export async function saveEvent(eventId: string): Promise<void> {
  const res = await adminFetch('/api/user/saved-events', {
    method: 'POST',
    body: JSON.stringify({ eventId }),
  })
  if (!res.ok) throw await felFranSvar(res, 'saveEvent')
}

export async function unsaveEvent(eventId: string): Promise<void> {
  const res = await adminFetch(`/api/user/saved-events/${eventId}`, { method: 'DELETE' })
  if (!res.ok) throw await felFranSvar(res, 'unsaveEvent')
}
