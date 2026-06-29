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
        w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 flex items-center justify-between
        ${active
          ? 'bg-violet-100 text-violet-700 font-semibold'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}
      `}
    >
      <span className="truncate">{label}</span>
      {hasUnread && (
        <span className="ml-2 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500 text-white leading-none">
          Nytt
        </span>
      )}
    </button>
  )
}
