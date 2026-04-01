import { useState } from 'react'
import type { CanonicalEvent } from '../../types'
import { markAsRead } from '../../services/readState'

interface Props {
  event: CanonicalEvent
  isRead: boolean
  onMarkRead: (id: string) => void
}

const SEVERITY_CONFIG = {
  'Kritisk':      { pill: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',       border: 'border-l-red-500'   },
  'Viktigt':      { pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', border: 'border-l-amber-400' },
  'Bra att veta': { pill: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',   border: 'border-l-slate-300' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function NewsItem({ event, isRead, onMarkRead }: Props) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEVERITY_CONFIG[event.severity]

  function handleToggle() {
    if (!isRead) {
      markAsRead(event.id)
    }
    setExpanded(prev => !prev)
  }

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 ${cfg.border} bg-white dark:bg-slate-800 shadow-sm overflow-hidden`}>

      {/* Header-rad */}
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
          {event.geography && (
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
              📍 {event.geography}
            </span>
          )}
          <span className="text-xs text-slate-400 shrink-0">{formatDate(event.publishedAt)}</span>
          <span className={`text-slate-300 text-xs shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </div>
      </button>

      {/* Expanderat innehåll */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {event.content}
          </p>
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-500 transition-colors"
          >
            Läs mer hos källan →
          </a>
        </div>
      )}
    </div>
  )
}
