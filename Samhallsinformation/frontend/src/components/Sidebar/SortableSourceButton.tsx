import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SourceButton from './SourceButton'

interface Props {
  shortName: string
  sorteraAktiv: boolean
  active: boolean
  hasUnread: boolean
  onClick: () => void
}

export default function SortableSourceButton({ shortName, sorteraAktiv, active, hasUnread, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shortName })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center"
    >
      <button
        {...attributes}
        {...listeners}
        tabIndex={-1}
        aria-label="Dra för att sortera"
        className={`shrink-0 px-1 py-2 text-slate-400 cursor-grab active:cursor-grabbing transition-all touch-none ${sorteraAktiv ? 'opacity-100' : 'opacity-0 pointer-events-none w-0 px-0'}`}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="7" cy="4"  r="1.5" />
          <circle cx="13" cy="4"  r="1.5" />
          <circle cx="7" cy="10" r="1.5" />
          <circle cx="13" cy="10" r="1.5" />
          <circle cx="7" cy="16" r="1.5" />
          <circle cx="13" cy="16" r="1.5" />
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <SourceButton label={shortName} active={active} hasUnread={hasUnread} onClick={onClick} />
      </div>
    </div>
  )
}
