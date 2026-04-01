import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, useMemo } from 'react'
import { fetchEvents } from '../../api/events'
import { getReadStatus, markAllAsRead } from '../../services/readState'
import NewsItem from './NewsItem'
import type { CanonicalEvent, Source } from '../../types'

type SeverityFilter = 'Alla' | 'Kritisk' | 'Viktigt' | 'Bra att veta'

const FILTER_STYLES: Record<SeverityFilter, { active: string; count: string }> = {
  'Alla':         { active: 'bg-violet-100 text-violet-700 border-violet-200', count: 'text-violet-500' },
  'Kritisk':      { active: 'bg-red-100 text-red-700 border-red-200',          count: 'text-red-500'    },
  'Viktigt':      { active: 'bg-amber-100 text-amber-700 border-amber-200',    count: 'text-amber-600'  },
  'Bra att veta': { active: 'bg-slate-100 text-slate-600 border-slate-200',    count: 'text-slate-500'  },
}

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
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('Alla')

  useEffect(() => {
    if (events.length > 0) {
      setReadMap(getReadStatus(events.map(e => e.id)))
    }
  }, [data])

  function handleMarkAllRead() {
    const ids = events.map(e => e.id)
    markAllAsRead(ids)
    setReadMap(Object.fromEntries(ids.map(id => [id, true])))
    if (source) onReadStatusChange(source.id)
  }

  const filteredEvents = useMemo(() =>
    severityFilter === 'Alla' ? events : events.filter(e => e.severity === severityFilter),
    [events, severityFilter]
  )

  const unread = filteredEvents.filter(e => !readMap[e.id])
  const read   = filteredEvents.filter(e => readMap[e.id])
  const hasUnread = events.filter(e => !readMap[e.id]).length > 0

  const severityCounts = useMemo(() => ({
    'Kritisk':      events.filter(e => e.severity === 'Kritisk').length,
    'Viktigt':      events.filter(e => e.severity === 'Viktigt').length,
    'Bra att veta': events.filter(e => e.severity === 'Bra att veta').length,
  }), [events])

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
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-10 py-10 shrink-0 relative">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white text-center">
          {source.shortName}
        </h1>
        {hasUnread && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-3">
            <span className="text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-400 px-2.5 py-1 rounded-full">
              {unread.length} olästa
            </span>
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              Markera alla som lästa
            </button>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-10 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-1.5">
          {(['Alla', 'Kritisk', 'Viktigt', 'Bra att veta'] as SeverityFilter[])
            .filter(f => f === 'Alla' || severityCounts[f] > 0)
            .map(f => {
              const count = f === 'Alla' ? events.length : severityCounts[f]
              const isActive = severityFilter === f
              const s = FILTER_STYLES[f]
              return (
                <button
                  key={f}
                  onClick={() => setSeverityFilter(f)}
                  style={{ marginBottom: '-1px' }}
                  className={`text-xs font-semibold px-3 py-2 rounded-t-lg border transition-colors ${
                    isActive
                      ? s.active
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-transparent hover:text-slate-900'
                  }`}
                >
                  {f} <span className={isActive ? s.count : 'text-slate-500'}>{count}</span>
                </button>
              )
            })}
        </div>
      </div>

      {/* Händelselista */}
      <div className="flex-1 overflow-y-auto px-10 py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-1.5">
        {events.length === 0 ? (
          <p className="text-slate-400 text-sm py-6 text-center">Inga händelser hittades.</p>
        ) : (
          <>
            {unread.map(event => (
              <NewsItem key={event.id} event={event} isRead={false} />
            ))}

            {unread.length > 0 && read.length > 0 && (
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
                <span className="text-xs text-slate-300 dark:text-slate-600">lästa</span>
                <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
              </div>
            )}

            {read.map(event => (
              <NewsItem key={event.id} event={event} isRead={true} />
            ))}
          </>
        )}
        </div>
      </div>
    </div>
  )
}
