interface Props {
  onOpenSidebar: () => void
}

// Permanent varumärkesrad på mobil, samma på alla sidor (som Polisens egen
// logga alltid ligger kvar i deras navbar) — separat från sidans egen,
// varierande H1 som ligger under den här raden.
export default function MobilTopBar({ onOpenSidebar }: Props) {
  return (
    <div className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
      <button
        onClick={onOpenSidebar}
        className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
        aria-label="Öppna meny"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <span className="text-sm font-bold text-violet-700 dark:text-violet-400 tracking-tight">
        Samhällsinformation
      </span>
    </div>
  )
}
