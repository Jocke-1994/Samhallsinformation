import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePolisenFilter } from '../../context/PolisenFilterContext'

// PROTOTYP (FAS 4-diskussion, session 24) — kontextuell prenumerationsklocka
// per händelse. Allt-flödet: "lägg till"-meny med det som INTE redan följs.
// Mitt-flödet: "ta bort"-meny med det som FAKTISKT är anledningen till att
// händelsen syns här. Bara Polisen-händelser där typ/område kunde tolkas.
//
// Menyn och toasten renderas via en portal till <body> med fixed positionering
// (beräknad från klockans egen bounding rect) — NewsItem-kortet har
// overflow-hidden för att klippa den infällbara innehållsdelen, vilket annars
// klipper bort en absolut-positionerad meny (samma stacking-fälla som
// FeedbackModal löste med createPortal, session 7).
interface Props {
  polisenTyp:    string | null
  polisenOmrade: string | null
  mode: 'allt' | 'mitt'
}

export default function PrenumerationsKlocka({ polisenTyp, polisenOmrade, mode }: Props) {
  const {
    valdaKategorier, valdaOmraden, harAnpassatTyp, harAnpassatOmrade,
    läggTillTyp, läggTillOmrade,
    sättValdaKategorierRakt, sättValdaOmradenRakt,
  } = usePolisenFilter()

  const [öppen, setÖppen] = useState(false)
  const [menyPos, setMenyPos] = useState({ top: 0, left: 0 })
  const [toast, setToast] = useState<{ text: string; ångra: () => void } | null>(null)
  const knappRef = useRef<HTMLButtonElement>(null)
  const menyRef = useRef<HTMLDivElement>(null)

  function öppna() {
    const rect = knappRef.current?.getBoundingClientRect()
    if (rect) setMenyPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 220) })
    setÖppen(v => !v)
  }

  useEffect(() => {
    if (!öppen) return
    function onClickAway(e: MouseEvent) {
      const target = e.target as Node
      if (knappRef.current?.contains(target)) return
      if (menyRef.current && !menyRef.current.contains(target)) setÖppen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [öppen])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const typActiv    = harAnpassatTyp    && !!polisenTyp    && valdaKategorier.has(polisenTyp)
  const omradeActiv = harAnpassatOmrade && !!polisenOmrade && valdaOmraden.has(polisenOmrade)

  // Allt: erbjud det som inte redan följs. Mitt: erbjud det som faktiskt gör
  // att händelsen matchar (annars inget meningsfullt att ta bort).
  const visaTyp    = mode === 'allt' ? (!!polisenTyp && !typActiv)       : (!!polisenTyp && typActiv)
  const visaOmrade = mode === 'allt' ? (!!polisenOmrade && !omradeActiv) : (!!polisenOmrade && omradeActiv)

  if (!visaTyp && !visaOmrade) return null

  function läggTill(vad: 'typ' | 'omrade' | 'bada') {
    const föreKategorier = new Set(valdaKategorier)
    const föreOmraden    = new Set(valdaOmraden)
    if ((vad === 'typ' || vad === 'bada') && polisenTyp) läggTillTyp(polisenTyp)
    if ((vad === 'omrade' || vad === 'bada') && polisenOmrade) läggTillOmrade(polisenOmrade)

    const namn = vad === 'bada' ? `${polisenTyp} i ${polisenOmrade}` : vad === 'typ' ? polisenTyp : polisenOmrade
    setToast({
      text: `${namn} tillagt i dina prenumerationer`,
      ångra: () => {
        sättValdaKategorierRakt(föreKategorier)
        sättValdaOmradenRakt(föreOmraden)
      },
    })
    setÖppen(false)
  }

  function taBort(vad: 'typ' | 'omrade' | 'bada') {
    if ((vad === 'typ' || vad === 'bada') && polisenTyp) {
      sättValdaKategorierRakt(prev => { const n = new Set(prev); n.delete(polisenTyp); return n })
    }
    if ((vad === 'omrade' || vad === 'bada') && polisenOmrade) {
      sättValdaOmradenRakt(prev => { const n = new Set(prev); n.delete(polisenOmrade); return n })
    }
    setÖppen(false)
  }

  const handleAction = mode === 'allt' ? läggTill : taBort
  const verbLabel = mode === 'allt' ? 'Prenumerera på' : 'Ta bort'

  return (
    <div className="relative shrink-0">
      <button
        ref={knappRef}
        onClick={öppna}
        title={mode === 'allt' ? 'Prenumerera på mer av det här' : 'Ta bort från dina prenumerationer'}
        aria-label={mode === 'allt' ? 'Prenumerera' : 'Ta bort prenumeration'}
        className="p-1.5 rounded-full text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-slate-700 transition-colors"
      >
        <span className="text-base leading-none">🔔</span>
      </button>

      {öppen && createPortal(
        <div
          ref={menyRef}
          style={{ position: 'fixed', top: menyPos.top, left: menyPos.left }}
          className="z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 min-w-[220px]"
        >
          <p className="px-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{verbLabel}</p>
          {visaTyp && (
            <button
              onClick={() => handleAction('typ')}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Typ · {polisenTyp}
            </button>
          )}
          {visaOmrade && (
            <button
              onClick={() => handleAction('omrade')}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Område · {polisenOmrade}
            </button>
          )}
          {visaTyp && visaOmrade && (
            <button
              onClick={() => handleAction('bada')}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-t border-slate-100 dark:border-slate-700"
            >
              Typ &amp; Område · båda
            </button>
          )}
        </div>,
        document.body
      )}

      {toast && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3">
          <span>{toast.text}</span>
          <button
            onClick={() => { toast.ångra(); setToast(null) }}
            className="font-semibold text-violet-300 hover:text-violet-200 transition-colors"
          >
            Ångra
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
