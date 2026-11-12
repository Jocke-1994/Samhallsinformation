import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePolisenBevakningar, MAX_BEVAKNINGAR } from '../../context/PolisenBevakningarContext'
import { BevakningError } from '../../api/polisenBevakningar'
import { visaBevakningsToast } from './bevakningsToastStore'

// Kontextuell prenumerationsklocka per händelse (PROTOTYP, FAS 4-diskussion,
// session 24; skriven om för bevakningar — flera oberoende regler, session
// 34-uppföljning). Allt-flödet: "lägg till"-meny som skapar en NY bevakning
// scopead till det klickade typen/området/båda. Mitt-flödet: en enda
// "ta bort"-knapp, bara synlig när EXAKT en bevakning är anledningen till
// att händelsen visas (annars är det oklart vilken av flera överlappande
// bevakningar som skulle tas bort).
//
// Menyn och varningsdialogen renderas via en portal till <body> med fixed
// positionering (menyn beräknad från klockans egen bounding rect) —
// NewsItem-kortet har overflow-hidden för att klippa den infällbara
// innehållsdelen, vilket annars klipper bort en absolut-positionerad meny
// (samma stacking-fälla som FeedbackModal löste med createPortal, session 7).
//
// Toasten (bekräftelse/fel/Ångra) bor INTE här: kortet — och därmed klockan —
// kan avmonteras i samma stund en bevakning tas bort eller skapas, och en
// toast i klockans egen state dog då tyst (E7#3). Den ligger i
// bevakningsToastStore och renderas av BevakningsToastHost (monterad i App).
interface Props {
  polisenTyp: string | null
  polisenOmrade: string | null
  mode: 'allt' | 'mitt'
}

export default function PrenumerationsKlocka({ polisenTyp, polisenOmrade, mode }: Props) {
  const { typDackt, omradeDackt, matchandeBevakning, skapa, taBort, bevakningar } =
    usePolisenBevakningar()

  const [öppen, setÖppen] = useState(false)
  const [menyPos, setMenyPos] = useState({ top: 0, left: 0 })
  const [visaSistaVarning, setVisaSistaVarning] = useState(false)
  // Skydd mot dubbelklick medan ett anrop mot servern pågår.
  const arbetar = useRef(false)
  const knappRef = useRef<HTMLButtonElement>(null)
  const menyRef = useRef<HTMLDivElement>(null)

  function öppna() {
    const rect = knappRef.current?.getBoundingClientRect()
    if (rect) setMenyPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 220) })
    setÖppen((v) => !v)
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

  if (mode === 'mitt') {
    const matchande =
      polisenTyp || polisenOmrade ? matchandeBevakning(polisenTyp, polisenOmrade) : null
    if (!matchande) return null

    // Är det den SISTA bevakningen tar borttagningen bort allt anpassat, och
    // Mitt flöde går över till alla Polisen-händelser i hela landet
    // (PolisenBevakningarContext.matchar: tom lista = allt syns). Det kräver
    // en uttrycklig bekräftelse.
    const ärSista = bevakningar.length === 1

    // Samma ikon (🔔) betyder tvärtom i "allt"-läget (lägg till) — ett enda
    // ogenomtänkt tryck fick tidigare ta bort en HEL bevakning direkt, utan
    // bekräftelse, bara en 5-sekunders ångra-toast som lätt missas. Byggd om
    // till samma öppna-en-meny-först-mönster som "allt"-lägets egen
    // bevaknings-meny, så borttagning kräver ett andra, tydligt märkt tryck.
    function begärTaBort() {
      setÖppen(false)
      if (ärSista) setVisaSistaVarning(true)
      else taBortBevakning()
    }

    async function taBortBevakning() {
      if (!matchande || arbetar.current) return
      arbetar.current = true
      setÖppen(false)
      setVisaSistaVarning(false)
      const kopia = matchande
      const sista = ärSista
      try {
        await taBort(kopia.id)
        visaBevakningsToast({
          typ: 'info',
          text: sista
            ? 'Bevakning borttagen — Mitt flöde visar nu alla Polisen-händelser i hela landet'
            : 'Bevakning borttagen',
          ångra: {
            kategorier: kopia.kategorier ? [...kopia.kategorier] : null,
            omraden: kopia.omraden ? [...kopia.omraden] : null,
          },
        })
      } catch {
        // taBort() kastar före den ändrar kontextens state, så listan är
        // orörd — det enda som behövs är att tala om att det misslyckades.
        visaBevakningsToast({ typ: 'fel', text: 'Kunde inte ta bort bevakningen. Försök igen.' })
      } finally {
        arbetar.current = false
      }
    }

    return (
      <div className="relative shrink-0">
        <button
          ref={knappRef}
          onClick={(e) => {
            e.stopPropagation()
            öppna()
          }}
          title="Hantera den här bevakningen"
          aria-label="Hantera bevakning"
          className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors"
        >
          <span className="text-base leading-none">🔔</span>
        </button>

        {öppen &&
          createPortal(
            <div
              ref={menyRef}
              style={{ position: 'fixed', top: menyPos.top, left: menyPos.left }}
              className="z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 min-w-[220px]"
            >
              <p className="px-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                Bevakning
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  begärTaBort()
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 transition-colors"
              >
                Ta bort den här bevakningen
              </button>
            </div>,
            document.body,
          )}

        {visaSistaVarning &&
          createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={(e) => {
                e.stopPropagation()
                setVisaSistaVarning(false)
              }}
            >
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="sista-bevakning-rubrik"
                aria-describedby="sista-bevakning-text"
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-5 w-full max-w-sm"
              >
                <h2
                  id="sista-bevakning-rubrik"
                  className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2"
                >
                  Ta bort din sista bevakning?
                </h2>
                <p
                  id="sista-bevakning-text"
                  className="text-sm text-slate-600 dark:text-slate-300 mb-4"
                >
                  Utan bevakningar visar Mitt flöde alla Polisen-händelser i hela landet, inte bara
                  det du bevakar nu.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    autoFocus
                    onClick={(e) => {
                      e.stopPropagation()
                      setVisaSistaVarning(false)
                    }}
                    className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      taBortBevakning()
                    }}
                    className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
                  >
                    Ta bort ändå
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    )
  }

  // mode === 'allt': erbjud att skapa en ny bevakning för det som INTE redan
  // täcks av en befintlig bevakning.
  const visaTyp = !!polisenTyp && !typDackt(polisenTyp)
  const visaOmrade = !!polisenOmrade && !omradeDackt(polisenOmrade)
  if (!visaTyp && !visaOmrade) return null

  const vidTak = bevakningar.length >= MAX_BEVAKNINGAR

  async function skapaBevakning(vad: 'typ' | 'omrade' | 'bada') {
    setÖppen(false)
    if (vidTak) {
      visaBevakningsToast({
        typ: 'info',
        text: `Max ${MAX_BEVAKNINGAR} bevakningar — hantera dem i Mina källor`,
      })
      return
    }
    if (arbetar.current) return
    arbetar.current = true
    const kategorier = (vad === 'typ' || vad === 'bada') && polisenTyp ? [polisenTyp] : null
    const omraden = (vad === 'omrade' || vad === 'bada') && polisenOmrade ? [polisenOmrade] : null
    try {
      const lyckades = await skapa(kategorier, omraden)
      if (!lyckades) {
        visaBevakningsToast({
          typ: 'info',
          text: `Max ${MAX_BEVAKNINGAR} bevakningar — hantera dem i Mina källor`,
        })
        return
      }
      const namn =
        vad === 'bada'
          ? `${polisenTyp} i ${polisenOmrade}`
          : vad === 'typ'
            ? polisenTyp
            : polisenOmrade
      visaBevakningsToast({ typ: 'info', text: `Ny bevakning: ${namn}` })
    } catch (e) {
      visaBevakningsToast({
        typ: 'fel',
        text:
          e instanceof BevakningError ? e.message : 'Kunde inte skapa bevakningen. Försök igen.',
      })
    } finally {
      arbetar.current = false
    }
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

      {öppen &&
        createPortal(
          <div
            ref={menyRef}
            style={{ position: 'fixed', top: menyPos.top, left: menyPos.left }}
            className="z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 min-w-[220px]"
          >
            <p className="px-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Ny bevakning
            </p>
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
    </div>
  )
}
