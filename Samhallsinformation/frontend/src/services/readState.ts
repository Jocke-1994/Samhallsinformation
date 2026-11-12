const STORAGE_KEY = 'si_read_events'

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

export function isRead(eventId: string): boolean {
  return getReadIds().has(eventId)
}

export function markAsRead(eventId: string): void {
  const ids = getReadIds()
  ids.add(eventId)
  saveReadIds(ids)
}

export function markAllAsRead(eventIds: string[]): void {
  const ids = getReadIds()
  eventIds.forEach((id) => ids.add(id))
  saveReadIds(ids)
}

export function getReadStatus(eventIds: string[]): Record<string, boolean> {
  const ids = getReadIds()
  return Object.fromEntries(eventIds.map((id) => [id, ids.has(id)]))
}
