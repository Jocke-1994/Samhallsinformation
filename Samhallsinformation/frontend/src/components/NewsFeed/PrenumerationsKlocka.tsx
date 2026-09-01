import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePolisenBevakningar, MAX_BEVAKNINGAR } from '../../context/PolisenBevakningarContext'

// Kontextuell prenumerationsklocka per händelse (PROTOTYP, FAS 4-diskussion,
// session 24; skriven om för bevakningar — flera oberoende regler, session
// 34-uppföljning). Allt-flödet: "lägg till"-meny som skapar en NY bevakning
// scopead till det klickade typen/området/båda. Mitt-flödet: en enda
// "ta bort"-knapp, bara synlig när EXAKT en bevakning är anledningen till
// att händelsen visas (annars är det oklart vilken av flera överlappande
// bevakningar som skulle tas bort).
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
  const { typDackt, omradeDackt, matchandeBevakning, skapa, taBort, bevakningar } = usePolisenBevakningar()

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

  if (mode === 'mitt') {
    const matchande = polisenTyp || polisenOmrade ? matchandeBevakning(polisenTyp, polisenOmrade) : null
    if (!matchande) return null

    // Samma ikon (🔔) betyder tvärtom i "allt"-läget (lägg till) — ett enda
    // ogenomtänkt tryck fick tidigare ta bort en HEL bevakning direkt, utan
    // bekräftelse, bara en 5-sekunders ångra-toast som lätt missas. Byggd om
    // till samma öppna-en-meny-först-mönster som "allt"-lägets egen
    // bevaknings-meny, så borttagning kräver ett andra, tydligt märkt tryck.
    async function taBortBevakning() {
      if (!matchande) return
      setÖppen(false)
      const kopia = matchande
      await taBort(kopia.id)
      setToast({
        text: 'Bevakning borttagen',
        ångra: () => { skapa(kopia.kategorier ? [...kopia.kategorier] : null, kopia.omraden ? [...kopia.omraden] : null) },
      })
    }

    return (
      <div className="relative shrink-0">
        <button
          ref={knappRef}
          onClick={e => { e.stopPropagation(); öppna() }}
          title="Hantera den här bevakningen"
          aria-label="Hantera bevakning"
          className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors"
        >
          <span className="text-base leading-none">🔔</span>
        </button>

        {öppen && createPortal(
          <div
            ref={menyRef}
            style={{ position: 'fixed', top: menyPos.top, left: menyPos.left }}
            className="z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 min-w-[220px]"
          >
            <p className="px-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Bevakning</p>
            <button
              onClick={e => { e.stopPropagation(); taBortBevakning() }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors"
            >
              Ta bort den här bevakningen
            </button>
          </div>,
          document.body,
        )}

        {toast && createPortal(
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3">
            <span>{toast.text}</span>
            <button onClick={() => { toast.ångra(); setToast(null) }} className="font-semibold text-violet-300 hover:text-violet-200 transition-colors">
              Ångra
            </button>
          </div>,
          document.body,
        )}
      </div>
    )
  }

  // mode === 'allt': erbjud att skapa en ny bevakning för det som INTE redan
  // täcks av en befintlig bevakning.
  const visaTyp    = !!polisenTyp    && !typDackt(polisenTyp)
  const visaOmrade = !!polisenOmrade && !omradeDackt(polisenOmrade)
  if (!visaTyp && !visaOmrade) return null

  const vidTak = bevakningar.length >= MAX_BEVAKNINGAR

  async function skapaBevakning(vad: 'typ' | 'omrade' | 'bada') {
    setÖppen(false)
    if (vidTak) {
      setToast({ text: `Max ${MAX_BEVAKNINGAR} bevakningar — hantera dem i Mina källor`, ångra: () => {} })
      return
    }
    const kategorier = (vad === 'typ' || vad === 'bada') && polisenTyp ? [polisenTyp] : null
    const omraden     = (vad === 'omrade' || vad === 'bada') && polisenOmrade ? [polisenOmrade] : null
    const lyckades = await skapa(kategorier, omraden)
    if (!lyckades) {
      setToast({ text: `Max ${MAX_BEVAKNINGAR} bevakningar — hantera dem i Mina källor`, ångra: () => {} })
      return
    }
    const namn = vad === 'bada' ? `${polisenTyp} i ${polisenOmrade}` : vad === 'typ' ? polisenTyp : polisenOmrade
    setToast({ text: `Ny bevakning: ${namn}`, ångra: () => {} })
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={knappRef}
        onClick={öppna}
        title="Skapa en bevakning för det här"
        aria-label="Skapa bevakning"
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
          <p className="px-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Ny bevakning</p>
          {visaTyp && (
            <button
              onClick={() => skapaBevakning('typ')}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Typ · {polisenTyp}
            </button>
          )}
          {visaOmrade && (
            <button
              onClick={() => skapaBevakning('omrade')}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Område · {polisenOmrade}
            </button>
          )}
          {visaTyp && visaOmrade && (
            <button
              onClick={() => skapaBevakning('bada')}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-t border-slate-100 dark:border-slate-700"
            >
              Typ &amp; Område · båda
            </button>
          )}
        </div>,
        document.body,
      )}

      {toast && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3">
          <span>{toast.text}</span>
        </div>,
        document.body,
      )}
    </div>
  )
}
