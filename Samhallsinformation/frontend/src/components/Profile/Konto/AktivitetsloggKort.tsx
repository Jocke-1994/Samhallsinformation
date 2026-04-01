import { useState } from 'react'

interface LoggRad {
  id: number
  text: string
  tid: string
  från?: string
  till?: string
}

const LOGG: LoggRad[] = [
  { id: 1, text: 'Lösenord ändrat',          tid: '2026-03-28 14:32' },
  { id: 2, text: 'E-postadress uppdaterad',  tid: '2026-03-21 09:14', från: 'joakim@exempel.se', till: 'joakim.rehn@exempel.se' },
  { id: 3, text: 'Telefonnummer tillagt',    tid: '2026-03-15 18:05', till: '+46 70 123 45 67' },
  { id: 4, text: 'SPAR-samtycke aktiverat',  tid: '2026-03-10 11:47', från: 'Inaktiverat', till: 'Aktiverat' },
  { id: 5, text: 'Konto skapat',             tid: '2026-02-01 08:00' },
]

export default function AktivitetsloggKort() {
  const [open, setOpen] = useState(false)
  const [nytt, setNytt] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function handleOpen() {
    setOpen(prev => !prev)
    setNytt(false)
  }

  function toggle(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={handleOpen}
        className="w-full px-6 pt-6 pb-5 flex items-center justify-between gap-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">📋</div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Aktivitetslogg</h2>
              {nytt && <span className="text-xs bg-violet-600 text-white font-semibold px-2 py-0.5 rounded-full">Nytt</span>}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Senaste ändringar på ditt konto</p>
          </div>
        </div>
        <span className={`text-slate-300 text-sm transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-6 py-2">
          {LOGG.map(({ id, text, tid, från, till }, i) => {
            const isExpanded = expanded.has(id)
            const hasDetaljer = från !== undefined || till !== undefined

            return (
              <div key={id} className={`${i < LOGG.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <button
                  onClick={() => hasDetaljer && toggle(id)}
                  className={`w-full flex items-center justify-between gap-4 py-3.5 text-left ${hasDetaljer ? 'cursor-pointer hover:bg-slate-50 -mx-6 px-6' : 'cursor-default'} transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                    <div>
                      <p className="text-sm text-slate-700">{text}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{tid}</p>
                    </div>
                  </div>
                  {hasDetaljer && (
                    <span className={`text-slate-300 text-xs transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  )}
                </button>

                {hasDetaljer && isExpanded && (
                  <div className="mb-3 ml-5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    {från && (
                      <>
                        <span className="text-sm text-slate-500 font-mono">{från}</span>
                        <span className="text-slate-300">→</span>
                      </>
                    )}
                    <span className="text-sm text-slate-800 font-mono font-semibold">{till}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
