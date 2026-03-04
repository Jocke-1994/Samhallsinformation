interface Props {
  label: string
  active: boolean
  hasUnread: boolean
  onClick: () => void
}

export default function SourceButton({ label, active, hasUnread, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-3 py-2 rounded text-sm transition-colors relative
        ${active
          ? 'bg-neutral-700 text-white font-medium'
          : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'}
      `}
    >
      <span>{label}</span>
      {hasUnread && (
        <span className="ml-2 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
          New
        </span>
      )}
    </button>
  )
}
