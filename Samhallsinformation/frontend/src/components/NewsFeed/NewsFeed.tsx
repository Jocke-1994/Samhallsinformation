import { Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { fetchEvents } from '../../api/events'
import { getReadStatus, markAllAsRead } from '../../services/readState'
import NewsItem from './NewsItem'
import type { CanonicalEvent, Source } from '../../types'
import { useAuth } from '../../context/AuthContext'

type ViewMode = 'Allt' | 'Mitt'
type SeverityFilter = 'Alla' | 'Kritisk' | 'Viktigt' | 'Bra att veta'

const FILTER_STYLES: Record<SeverityFilter, { active: string; activeBadge: string; inactiveBadge: string }> = {
  'Alla':         { active: 'bg-violet-100 text-violet-700 border-violet-200', activeBadge: 'bg-violet-200 text-violet-700', inactiveBadge: 'bg-slate-100 text-slate-500' },
  'Kritisk':      { active: 'bg-red-100 text-red-700 border-red-200',          activeBadge: 'bg-red-200 text-red-700',       inactiveBadge: 'bg-slate-100 text-slate-500' },
  'Viktigt':      { active: 'bg-amber-100 text-amber-700 border-amber-200',    activeBadge: 'bg-amber-200 text-amber-700',   inactiveBadge: 'bg-slate-100 text-slate-500' },
  'Bra att veta': { active: 'bg-sky-100 text-sky-700 border-sky-200',          activeBadge: 'bg-sky-200 text-sky-700',       inactiveBadge: 'bg-slate-100 text-slate-500' },
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
  shortName: string | null
  sources: Source[]
  onReadStatusChange: () => void
  onOpenSidebar: () => void
}

export default function NewsFeed({ shortName, sources, onReadStatusChange, onOpenSidebar }: Props) {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['events', shortName ?? 'all'],
    queryFn: () => fetchEvents({ shortName: shortName ?? undefined, pageSize: 50 }),
  })

  const events: CanonicalEvent[] = data?.events ?? []

  const [readMap, setReadMap] = useState<Record<string, boolean>>({})
  const [viewMode, setViewMode] = useState<ViewMode>('Allt')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('Alla')

  useEffect(() => { setSeverityFilter('Alla') }, [shortName])
  useEffect(() => { if (!isLoggedIn) setViewMode('Allt') }, [isLoggedIn])

  useEffect(() => {
    if (events.length > 0) setReadMap(getReadStatus(events.map(e => e.id)))
  }, [data])

  const sourceMap = useMemo(
    () => Object.fromEntries(sources.map(s => [s.id, s.shortName])),
    [sources]
  )

  const sortedEvents = useMemo(() => {
    if (shortName !== null) return events
    return [...events].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
  }, [events, shortName])

  function handleMarkAllRead() {
    const ids = sortedEvents.map(e => e.id)
    markAllAsRead(ids)
    setReadMap(Object.fromEntries(ids.map(id => [id, true])))
    if (shortName) onReadStatusChange()
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

  const availableSeverities = useMemo(
    () => (['Kritisk', 'Viktigt', 'Bra att veta'] as const).filter(f => severityCounts[f] > 0),
    [severityCounts]
  )
  const showFilters = availableSeverities.length > 1

  const title = shortName ?? 'Samhällsinformation'

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-neutral-500 text-sm">Hämtar nyheter...</div>
  )
  if (isError) return (
    <div className="flex items-center justify-center h-full text-neutral-500 text-sm">Just nu har vi tekniska problem, vi jobbar för att åtgärda detta.</div>
  )

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-10 py-5 md:py-10 shrink-0 relative">
        {/* Hamburger — mobil */}
        <button
          onClick={onOpenSidebar}
          className="md:hidden absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Öppna meny"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white text-center">{title}</h1>
        {isLoggedIn && hasUnread && (
          <div className="absolute right-4 md:right-10 top-1/2 -translate-y-1/2 flex items-center gap-3">
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full hover:bg-violet-100 transition-colors"
            >
              {filteredEvents.filter(e => !readMap[e.id]).length} olästa
            </button>
            <button onClick={handleMarkAllRead} className="hidden md:block text-xs text-slate-400 hover:text-slate-700 transition-colors">
              Markera alla som lästa
            </button>
          </div>
        )}
      </div>

      {/* Allt / Mitt — visas bara när inloggad och inte i källvy */}
      {isLoggedIn && shortName === null && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-10 py-2.5 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-1 w-fit">
            {(['Allt', 'Mitt'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors ${
                  viewMode === mode
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter — visas bara om det finns minst 2 olika allvarlighetsgrader */}
      {showFilters && viewMode === 'Allt' && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-10 shrink-0">
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
      )}

      {/* Händelselista */}
      <div className="flex-1 overflow-y-auto px-4 md:px-10 py-4 md:py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-1.5">

          {viewMode === 'Mitt' && (
            <div className="flex flex-col items-center py-20 gap-4 text-center">
              <span className="text-4xl">🗂️</span>
              <p className="text-slate-700 dark:text-slate-200 font-semibold text-base">Ditt personliga flöde</p>
              <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                Här visas nyheter från de källor du väljer att följa. Lägg till källor i Mina källör för att komma igång.
              </p>
              <button
                onClick={() => navigate('/profil?section=mina-kallor')}
                className="mt-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Gå till Mina källör
              </button>
            </div>
          )}

          {viewMode === 'Allt' && sortedEvents.length === 0 && (
            <p className="text-slate-400 text-sm py-6 text-center">Inga händelser hittades.</p>
          )}

          {viewMode === 'Allt' && sortedEvents.length > 0 && filteredEvents.length === 0 && (
            <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
              <span className="text-3xl">✓</span>
              <p className="text-sm">{EMPTY_STATE_TEXT[severityFilter] ?? 'Inga händelser hittades'}</p>
            </div>
          )}

          {viewMode === 'Allt' && (() => {
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
                    sourceName={shortName === null ? sourceMap[event.sourceId] : undefined}
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
