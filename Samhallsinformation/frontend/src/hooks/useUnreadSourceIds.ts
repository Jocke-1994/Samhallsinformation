import type { Source } from '../types'

export function useUnreadSourceIds(sources: Source[], readTrigger?: number): Set<number> {
  void readTrigger
  const stored = localStorage.getItem('si_read_events')
  const readIds: Set<string> = stored ? new Set(JSON.parse(stored)) : new Set()
  return new Set(
    sources
      .filter(s => s.isActive)
      .filter(s => {
        const cached = sessionStorage.getItem(`si_events_${s.id}`)
        if (!cached) return false
        const events: { id: string }[] = JSON.parse(cached)
        return events.some(e => !readIds.has(e.id))
      })
      .map(s => s.id)
  )
}
