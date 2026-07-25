import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'

const STORAGE_KEY = 'si_welcome_seen'

export default function WelcomeModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 flex flex-col gap-5">

        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Välkommen till Samhällsinformation</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Här samlar vi händelser och nyheter från svenska myndigheter på ett och samma ställe — direkt från källan, utan tolkning.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Så här navigerar du</p>
          <div className="flex items-start gap-3">
            <span className="text-base leading-none shrink-0 mt-0.5">☰</span>
            <p className="text-sm text-slate-700 leading-relaxed">
              Öppna menyn med <strong>knappen uppe till vänster</strong> — på mobil kan du också svepa in från vänsterkant
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-base leading-none shrink-0 mt-0.5">🗂️</span>
            <p className="text-sm text-slate-700 leading-relaxed">
              Välj källa i menyn — t.ex. <strong>Polisen</strong> eller <strong>Krisinformation</strong> — för att filtrera flödet
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-base leading-none shrink-0 mt-0.5">📰</span>
            <p className="text-sm text-slate-700 leading-relaxed">
              Klicka på en händelse för att läsa mer och gå direkt till ursprungskällan
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <Link
            to="/uppdateringar"
            onClick={dismiss}
            className="text-sm text-violet-600 hover:underline font-medium"
          >
            Nyheter &amp; uppdateringar →
          </Link>
          <button
            onClick={dismiss}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Kom igång
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}
