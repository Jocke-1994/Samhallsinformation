import { Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, useMemo } from 'react'
import { fetchEvents } from '../../api/events'
import { getReadStatus, markAllAsRead } from '../../services/readState'
import NewsItem from './NewsItem'
import type { CanonicalEvent, Source } from '../../types'
import { useAuth } from '../../context/AuthContext'

type SeverityFilter = 'Alla' | 'Kritisk' | 'Viktigt' | 'Bra att veta'

const FILTER_STYLES: Record<SeverityFilter, { active: string; activeBadge: string; inactiveBadge: string }> = {
  'Alla':         { active: 'bg-violet-100 text-violet-700 border-violet-200', activeBadge: 'bg-violet-200 text-violet-700', inactiveBadge: 'bg-slate-100 text-slate-500' },
  'Kritisk':      { active: 'bg-red-100 text-red-700 border-red-200',          activeBadge: 'bg-red-200 text-red-700',       inactiveBadge: 'bg-slate-100 text-slate-500' },
  'Viktigt':      { active: 'bg-amber-100 text-amber-700 border-amber-200',    activeBadge: 'bg-amber-200 text-amber-700',   inactiveBadge: 'bg-slate-100 text-slate-500' },
  'Bra att veta': { active: 'bg-slate-100 text-slate-600 border-slate-200',    activeBadge: 'bg-slate-200 text-slate-600',   inactiveBadge: 'bg-slate-100 text-slate-500' },
}

const EMPTY_STATE_TEXT: Partial<Record<SeverityFilter, string>> = {
  'Kritisk':      'Inga kritiska händelser just nu',
  'Viktigt':      'Inga viktiga händelser just nu',
  'Bra att veta': 'Inga informationshändelser just nu',
}


function toDateKey(iso: string): string {
  return new Date(iso).toDateString()
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const dateStr = date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
  if (date.toDateString() === now.toDateString()) return `Idag ${dateStr}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `Igår ${dateStr}`
  return dateStr
}

interface Props {
  source: Source | null
  sources: Source[]
  onReadStatusChange: (sourceId: number) => void
}

export default function NewsFeed({ source, sources, onReadStatusChange }: Props) {
  const { isLoggedIn } = useAuth()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['events', source?.id ?? 'all'],
    queryFn: () => fetchEvents({ sourceId: source?.id, pageSize: 50 }),
  })

  const events: CanonicalEvent[] = data?.events ?? []

  const [readMap, setReadMap] = useState<Record<string, boolean>>({})
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('Alla')

  useEffect(() => { setSeverityFilter('Alla') }, [source?.id])

  useEffect(() => {
    if (events.length > 0) setReadMap(getReadStatus(events.map(e => e.id)))
  }, [data])

  const sourceMap = useMemo(
    () => Object.fromEntries(sources.map(s => [s.id, s.shortName])),
    [sources]
  )

  const sortedEvents = useMemo(() => {
    if (source !== null) return events
    return [...events].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
  }, [events, source])

  function handleMarkAllRead() {
    const ids = sortedEvents.map(e => e.id)
    markAllAsRead(ids)
    setReadMap(Object.fromEntries(ids.map(id => [id, true])))
    if (source) onReadStatusChange(source.id)
  }

  const filteredEvents = useMemo(() =>
    severityFilter === 'Alla' ? sortedEvents : sortedEvents.filter(e => e.severity === severityFilter),
    [sortedEvents, severityFilter]
  )

  const hasUnread = sortedEvents.some(e => !readMap[e.id])

  const severityCounts = useMemo(() => ({
    'Kritisk':      sortedEvents.filter(e => e.severity === 'Kritisk').length,
    'Viktigt':      sortedEvents.filter(e => e.severity === 'Viktigt').length,
    'Bra att veta': sortedEvents.filter(e => e.severity === 'Bra att veta').length,
  }), [sortedEvents])

  const title = source ? source.shortName : 'Samhällsinformation'

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-neutral-500 text-sm">Hämtar nyheter...</div>
  )
  if (isError) return (
    <div className="flex items-center justify-center h-full text-red-400 text-sm">Kunde inte hämta nyheter. Är backend igång?</div>
  )

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-10 py-10 shrink-0 relative">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white text-center">{title}</h1>
        {isLoggedIn && hasUnread && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-3">
            <span className="text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full">
              {filteredEvents.filter(e => !readMap[e.id]).length} olästa
            </span>
            <button onClick={handleMarkAllRead} className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
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
              const count = f === 'Alla' ? sortedEvents.length : severityCounts[f]
              const isActive = severityFilter === f
              const s = FILTER_STYLES[f]
              return (
                <button
                  key={f}
                  onClick={() => setSeverityFilter(f)}
                  style={{ marginBottom: '-1px' }}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-t-lg border transition-colors ${
                    isActive ? s.active : 'bg-white dark:bg-slate-800 text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  {f}
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    isActive ? s.activeBadge : s.inactiveBadge
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
        </div>
      </div>

      {/* Händelselista */}
      <div className="flex-1 overflow-y-auto px-10 py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-1.5">

          {sortedEvents.length === 0 && (
            <p className="text-slate-400 text-sm py-6 text-center">Inga händelser hittades.</p>
          )}

          {sortedEvents.length > 0 && filteredEvents.length === 0 && (
            <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
              <span className="text-3xl">✓</span>
              <p className="text-sm">{EMPTY_STATE_TEXT[severityFilter] ?? 'Inga händelser hittades'}</p>
            </div>
          )}

          {(() => {
            let readSepShown = false
            return filteredEvents.map((event, i) => {
              const prev = filteredEvents[i - 1]
              const dateChanged = !prev || toDateKey(event.publishedAt) !== toDateKey(prev.publishedAt)
              const readTransition = isLoggedIn && !!prev && !readMap[prev.id] && !!readMap[event.id]
              const showReadSep = readTransition && !dateChanged && !readSepShown
              if (showReadSep) readSepShown = true

              return (
                <Fragment key={event.id}>
                  {showReadSep && (
                    <div className="flex items-center gap-2 py-1">
                      <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
                      <span className="text-xs text-slate-300 dark:text-slate-600">lästa</span>
                      <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
                    </div>
                  )}
                  {dateChanged && (
                    <div className="flex items-center gap-2 py-1">
                      <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{formatDateLabel(event.publishedAt)}</span>
                      <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
                    </div>
                  )}
                  <NewsItem
                    event={event}
                    isRead={!!readMap[event.id]}
                    sourceName={source === null ? sourceMap[event.sourceId] : undefined}
                  />
                </Fragment>
              )
            })
          })()}

        </div>
      </div>
    </div>
  )
}
