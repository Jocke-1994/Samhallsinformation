import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { fetchEvents } from '../../api/events'
import { getReadStatus, markAllAsRead } from '../../services/readState'
import NewsItem from './NewsItem'
import type { CanonicalEvent, Source } from '../../types'

interface Props {
  source: Source | null
  onReadStatusChange: (sourceId: number) => void
}

export default function NewsFeed({ source, onReadStatusChange }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['events', source?.id],
    queryFn: () => fetchEvents({ sourceId: source?.id, pageSize: 50 }),
    enabled: source !== null,
  })

  const events: CanonicalEvent[] = data?.events ?? []

  const [readMap, setReadMap] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (events.length > 0) {
      setReadMap(getReadStatus(events.map(e => e.id)))
    }
  }, [data])

  function handleMarkRead(id: string) {
    setReadMap(prev => ({ ...prev, [id]: true }))
    if (source) onReadStatusChange(source.id)
  }

  function handleMarkAllRead() {
    const ids = events.map(e => e.id)
    markAllAsRead(ids)
    setReadMap(Object.fromEntries(ids.map(id => [id, true])))
    if (source) onReadStatusChange(source.id)
  }

  const unread = events.filter(e => !readMap[e.id])
  const read = events.filter(e => readMap[e.id])
  const hasUnread = unread.length > 0

  if (!source) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
        Välj en källa i menyn till vänster
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
        Hämtar nyheter...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm">
        Kunde inte hämta nyheter. Är backend igång?
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <h2 className="text-white font-semibold">{source.shortName}</h2>
        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-neutral-400 hover:text-white transition-colors"
          >
            Markera alla som lästa
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-neutral-500 text-sm px-4 py-6">Inga nyheter hittades.</p>
        ) : (
          <>
            {unread.map(event => (
              <NewsItem
                key={event.id}
                event={event}
                isRead={false}
                onMarkRead={handleMarkRead}
              />
            ))}

            {unread.length > 0 && read.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-1">
                <div className="flex-1 border-t border-dashed border-neutral-700" />
                <span className="text-xs text-neutral-600">läst</span>
                <div className="flex-1 border-t border-dashed border-neutral-700" />
              </div>
            )}

            {read.map(event => (
              <NewsItem
                key={event.id}
                event={event}
                isRead={true}
                onMarkRead={handleMarkRead}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
