import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  rubrik: string
  children: ReactNode
  bekräftaText: string
  avbrytText?: string
  /** Röd bekräfta-knapp (standard) — sätt false för icke-destruktiva åtgärder. */
  destruktiv?: boolean
  onBekräfta: () => void
  onAvbryt: () => void
}

/**
 * Delad, tillgänglig bekräftelsedialog (role="alertdialog") för destruktiva
 * eller globala åtgärder. Förvalt fokus ligger på Avbryt, Tab cirkulerar
 * inom dialogen, Esc avbryter. Klick på bakgrunden stänger INTE — en
 * felträff vid sidan av dialogen ska aldrig avbryta (eller bekräfta) något.
 */
export default function ConfirmDialog({
  rubrik,
  children,
  bekräftaText,
  avbrytText = 'Avbryt',
  destruktiv = true,
  onBekräfta,
  onAvbryt,
}: Props) {
  const id = useId()
  const rubrikId = `${id}-rubrik`
  const textId = `${id}-text`
  const avbrytRef = useRef<HTMLButtonElement>(null)
  const bekräftaRef = useRef<HTMLButtonElement>(null)
  const avbrytRefFn = useRef(onAvbryt)
  useEffect(() => {
    avbrytRefFn.current = onAvbryt
  })

  useEffect(() => {
    const tidigare = document.activeElement as HTMLElement | null
    avbrytRef.current?.focus()

    function vidTangent(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        avbrytRefFn.current()
        return
      }
      if (e.key === 'Tab') {
        // Fokusfälla: två fokuserbara element, cirkulera mellan dem.
        const första = avbrytRef.current
        const sista = bekräftaRef.current
        if (!första || !sista) return
        const aktivt = document.activeElement
        if (e.shiftKey && aktivt === första) {
          e.preventDefault()
          sista.focus()
        } else if (!e.shiftKey && aktivt === sista) {
          e.preventDefault()
          första.focus()
        } else if (aktivt !== första && aktivt !== sista) {
          e.preventDefault()
          första.focus()
        }
      }
    }

    document.addEventListener('keydown', vidTangent, true)
    return () => {
      document.removeEventListener('keydown', vidTangent, true)
      tidigare?.focus?.()
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={rubrikId}
        aria-describedby={textId}
        className="bg-white border border-slate-200 rounded-2xl shadow-xl p-5 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <h2 id={rubrikId} className="text-base font-semibold text-slate-800 mb-2">
          {rubrik}
        </h2>
        <div id={textId} className="text-sm text-slate-600 mb-5 flex flex-col gap-2">
          {children}
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            ref={avbrytRef}
            type="button"
            onClick={onAvbryt}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            {avbrytText}
          </button>
          <button
            ref={bekräftaRef}
            type="button"
            onClick={onBekräfta}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
              destruktiv ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-500'
            }`}
          >
            {bekräftaText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
