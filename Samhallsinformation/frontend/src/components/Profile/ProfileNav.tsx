export type ProfileSection =
  | 'mina-kallor'
  | 'notifieringar'
  | 'konto'
  | 'uppdateringar'
  | 'support'

const sections: { id: ProfileSection; label: string }[] = [
  { id: 'mina-kallor', label: 'Mina källor' },
  { id: 'notifieringar', label: 'Notifieringar' },
  { id: 'konto', label: 'Konto' },
  { id: 'uppdateringar', label: 'Uppdateringar' },
  { id: 'support', label: 'Support' },
]

interface Props {
  active: ProfileSection
  onChange: (section: ProfileSection) => void
}

export default function ProfileNav({ active, onChange }: Props) {
  return (
    <nav className="flex flex-col w-48 shrink-0 gap-1">
      {sections.map(s => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`
            w-full text-left px-3 py-2 rounded text-sm transition-colors
            ${active === s.id
              ? 'bg-violet-50 text-violet-700 font-semibold border-l-2 border-violet-600'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}
          `}
        >
          {s.label}
        </button>
      ))}
    </nav>
  )
}
