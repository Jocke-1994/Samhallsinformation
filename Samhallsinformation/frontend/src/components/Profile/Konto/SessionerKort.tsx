import { useState } from 'react'

interface Session {
  id: number
  enhet: string
  plats: string
  senastAktiv: string
  nuvarande: boolean
}

interface InloggningsRad {
  id: number
  enhet: string
  plats: string
  tid: string
  lyckad: boolean
}

const INITIAL_SESSIONER: Session[] = [
  { id: 1, enhet: 'Chrome · Windows 11',  plats: 'Stockholm, Sverige', senastAktiv: 'Nu',              nuvarande: true },
  { id: 2, enhet: 'Safari · iPhone 15',   plats: 'Stockholm, Sverige', senastAktiv: 'Idag 08:14',      nuvarande: false },
  { id: 3, enhet: 'Firefox · macOS',      plats: 'Göteborg, Sverige',  senastAktiv: '2026-03-30 19:42', nuvarande: false },
]

const HISTORIK: InloggningsRad[] = [
  { id: 1, enhet: 'Chrome · Windows 11',  plats: 'Stockholm, Sverige', tid: '2026-04-01 09:03', lyckad: true },
  { id: 2, enhet: 'Safari · iPhone 15',   plats: 'Stockholm, Sverige', tid: '2026-04-01 08:14', lyckad: true },
  { id: 3, enhet: 'Okänd enhet',          plats: 'Amsterdam, NL',      tid: '2026-03-31 03:17', lyckad: false },
  { id: 4, enhet: 'Firefox · macOS',      plats: 'Göteborg, Sverige',  tid: '2026-03-30 19:42', lyckad: true },
  { id: 5, enhet: 'Chrome · Windows 11',  plats: 'Stockholm, Sverige', tid: '2026-03-28 14:30', lyckad: true },
]

export default function SessionerKort() {
  const [sessioner, setSessioner] = useState<Session[]>(INITIAL_SESSIONER)
  const [open, setOpen] = useState(false)
  const [nytt, setNytt] = useState(true)

  function loggaUt(id: number) {
    setSessioner(prev => prev.filter(s => s.id !== id))
  }

  function handleOpen() {
    setOpen(prev => !prev)
    setNytt(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={handleOpen}
        className="w-full px-6 pt-6 pb-5 flex items-center justify-between gap-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">🖥️</div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Sessioner & historik</h2>
              {nytt && <span className="text-xs bg-violet-600 text-white font-semibold px-2 py-0.5 rounded-full">Nytt</span>}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Aktiva inloggningar och senaste aktivitet</p>
          </div>
        </div>
        <span className={`text-slate-300 text-sm transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && <div className="border-t border-slate-100">

      {/* Aktiva sessioner */}
      <div className="px-6 pt-5 pb-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Aktiva sessioner</p>
        <div className="flex flex-col gap-2">
          {sessioner.map(s => (
            <div key={s.id} className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border ${s.nuvarande ? 'bg-violet-50 border-violet-100' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800">{s.enhet}</p>
                  {s.nuvarande && <span className="text-xs bg-violet-100 text-violet-700 font-semibold px-2 py-0.5 rounded-full">Denna session</span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{s.plats} · {s.senastAktiv}</p>
              </div>
              {!s.nuvarande && (
                <button
                  onClick={() => loggaUt(s.id)}
                  className="shrink-0 px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Logga ut
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Inloggningshistorik */}
      <div className="px-6 pt-2 pb-5 border-t border-slate-100">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-4 mb-3">Inloggningshistorik</p>
        <div className="flex flex-col">
          {HISTORIK.map(({ id, enhet, plats, tid, lyckad }, i) => (
            <div key={id} className={`flex items-center gap-3 py-3 ${i < HISTORIK.length - 1 ? 'border-b border-slate-100' : ''}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${lyckad ? 'bg-green-400' : 'bg-red-400'}`} />
              <div className="flex-1">
                <p className="text-sm text-slate-700">{enhet}</p>
                <p className="text-xs text-slate-400 mt-0.5">{plats}</p>
              </div>
              <p className="text-xs text-slate-400 shrink-0">{tid}</p>
            </div>
          ))}
        </div>
      </div>
      </div>}
    </div>
  )
}
