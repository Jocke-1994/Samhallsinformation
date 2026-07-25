import { useState } from 'react'
import type { CanonicalEvent } from '../../types'
import { markAsRead } from '../../services/readState'

interface Props {
  event: CanonicalEvent
  isRead: boolean
  sourceName?: string
}

const SEVERITY_CONFIG = {
  'Kritisk':      { pill: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',        severityBorder: 'border-l-red-500'   },
  'Viktigt':      { pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', severityBorder: 'border-l-amber-400' },
  'Bra att veta': { pill: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',          severityBorder: 'border-l-sky-300'   },
}

const SOURCE_BORDER: Record<number, string> = {
  1: 'border-l-blue-500',
  5: 'border-l-orange-400',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

const contentP = 'text-sm text-slate-600 dark:text-slate-300 leading-relaxed'

function ContentParagraph({ text }: { text: string }) {
  const labelEnd = text.indexOf(': ')
  if (labelEnd === -1) return <p className={contentP}>{text}</p>

  return (
    <p className={contentP}>
      <strong className="font-semibold text-slate-900 dark:text-white">
        {text.slice(0, labelEnd + 1)}
      </strong>
      {text.slice(labelEnd + 1)}
    </p>
  )
}

function EventContent({ content }: { content: string }) {
  const paragraphs = content.split('\n\n')
  if (paragraphs.length === 1) return <p className={contentP}>{content}</p>

  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => <ContentParagraph key={i} text={p} />)}
    </div>
  )
}

export default function NewsItem({ event, isRead, sourceName }: Props) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEVERITY_CONFIG[event.severity]

  const borderClass = sourceName
    ? (SOURCE_BORDER[event.sourceId] ?? 'border-l-slate-300')
    : cfg.severityBorder

  const showGeography = !!event.geography &&
    !event.title.toLowerCase().includes(event.geography.toLowerCase())

  function handleToggle() {
    if (!isRead) markAsRead(event.id)
    setExpanded(prev => !prev)
  }

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 ${borderClass} bg-white dark:bg-slate-800 shadow-sm overflow-hidden`}>

      <button
        onClick={handleToggle}
        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.pill}`}>
            {event.severity}
          </span>

          <p className="flex-1 text-sm font-medium text-slate-900 dark:text-white leading-snug">
            {event.title}
          </p>

          {sourceName && (
            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{sourceName}</span>
          )}

          {showGeography && (
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
              📍 {event.geography}
            </span>
          )}

          <span className="text-xs text-slate-400 shrink-0">{formatTime(event.publishedAt)}</span>

          <span className={`text-slate-300 text-xs shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <EventContent content={event.content} />
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-500 transition-colors"
          >
            {event.url.includes('trafikinformation') ? 'Se trafikläget hos Trafikverket' : 'Läs mer hos källan'} →
          </a>
        </div>
      )}
    </div>
  )
}
