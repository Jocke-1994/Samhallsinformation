export default function Toggle({ on, onChange, small }: { on: boolean; onChange: (v: boolean) => void; small?: boolean }) {
  if (small) {
    return (
      <button
        onClick={() => onChange(!on)}
        className={`relative w-8 h-4 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ${on ? 'bg-violet-600' : 'bg-slate-200'}`}
      >
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    )
  }
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${on ? 'bg-violet-600' : 'bg-slate-200'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}
