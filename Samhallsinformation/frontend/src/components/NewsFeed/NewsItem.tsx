import type { CanonicalEvent } from '../../types'
import { markAsRead } from '../../services/readState'

interface Props {
  event: CanonicalEvent
  isRead: boolean
  onMarkRead: (id: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

export default function NewsItem({ event, isRead, onMarkRead }: Props) {
  function handleTitleClick() {
    markAsRead(event.id)
    onMarkRead(event.id)
    window.open(event.url, '_blank', 'noopener,noreferrer')
  }

  function handleCheckbox() {
    markAsRead(event.id)
    onMarkRead(event.id)
  }

  return (
    <div className={`flex items-center justify-between py-3 px-4 gap-4 ${isRead ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <button
          onClick={handleTitleClick}
          className="text-left text-sm text-white hover:text-blue-400 transition-colors truncate block w-full"
        >
          {event.title}
        </button>
        <span className="text-xs text-neutral-500 mt-0.5 block">
          {formatDate(event.publishedAt)}
        </span>
      </div>
      <input
        type="checkbox"
        checked={isRead}
        onChange={handleCheckbox}
        className="w-4 h-4 flex-shrink-0 accent-blue-600 cursor-pointer"
        aria-label="Markera som läst"
      />
    </div>
  )
}
