import { useState } from 'react'
import { POLISEN_KATEGORIER, SVENSKA_LÄN, LÄN_KOMMUNER, ALLA_KOMMUNER } from './kallorUtils'

type Flik = 'typ' | 'omrade'

function TypLista({ valda, onToggle }: { valda: Set<string>; onToggle: (v: string) => void }) {
  return (
    <div className="px-6 py-4 flex flex-col gap-1 overflow-y-auto">
      {POLISEN_KATEGORIER.map(kat => (
        <label key={kat} className="flex items-center gap-3 cursor-pointer group py-2 -mx-2 px-2 rounded-lg hover:bg-slate-50">
          <input
            type="checkbox"
            checked={valda.has(kat)}
            onChange={() => onToggle(kat)}
            className="accent-violet-600 w-4 h-4 shrink-0"
          />
          <span className="text-sm md:text-base text-slate-700 group-hover:text-slate-900">{kat}</span>
        </label>
      ))}
    </div>
  )
}

// Samma tvåkolumns-mönster som Arbetsförmedlingens platsval: klicka ett län
// till vänster, kryssa dess kommuner till höger. Undviker en enda lista med
// alla 290 kommuner på en gång.
function OmradeVal({ valda, onToggle, onVäljFlera, onAvmarkeraFlera }: {
  valda:            Set<string>
  onToggle:         (kommun: string) => void
  onVäljFlera:      (kommuner: string[]) => void
  onAvmarkeraFlera: (kommuner: string[]) => void
}) {
  const [aktivtLän, setAktivtLän] = useState(SVENSKA_LÄN[0])
  const kommuner = LÄN_KOMMUNER[aktivtLän]
  const alltValtILän = kommuner.every(k => valda.has(k))

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-1/2 border-r border-slate-100 overflow-y-auto py-2">
        {SVENSKA_LÄN.map(län => {
          // Pricken visar var du faktiskt har något valt — bara meningsfullt
          // att räkna ut när något överhuvudtaget skiljer sig från "allt".
          const harValtNågot = valda.size < ALLA_KOMMUNER.length
          const länHarVal    = harValtNågot && LÄN_KOMMUNER[län].some(kommun => valda.has(kommun))
          return (
            <button
              key={län}
              onClick={() => setAktivtLän(län)}
              className={`w-full flex items-center justify-between gap-2 text-left px-4 py-2 text-sm md:text-base transition-colors ${
                län === aktivtLän ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="truncate">{län}</span>
              {länHarVal && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" title="Har valda kommuner här" />}
            </button>
          )
        })}
      </div>
      <div className="w-1/2 overflow-y-auto px-4 py-2">
        <label className="flex items-center gap-3 cursor-pointer py-2 -mx-2 px-2 rounded-lg hover:bg-slate-50 border-b border-slate-100 mb-1">
          <input
            type="checkbox"
            checked={alltValtILän}
            onChange={() => alltValtILän ? onAvmarkeraFlera(kommuner) : onVäljFlera(kommuner)}
            className="accent-violet-600 w-4 h-4 shrink-0"
          />
          <span className="text-sm md:text-base font-semibold text-slate-700">Välj alla kommuner</span>
        </label>
        {kommuner.map(kommun => (
          <label key={kommun} className="flex items-center gap-3 cursor-pointer group py-2 -mx-2 px-2 rounded-lg hover:bg-slate-50">
            <input
              type="checkbox"
              checked={valda.has(kommun)}
              onChange={() => onToggle(kommun)}
              className="accent-violet-600 w-4 h-4 shrink-0"
            />
            <span className="text-sm md:text-base text-slate-700 group-hover:text-slate-900">{kommun}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// Skapar/redigerar EN bevakning — äger sitt eget utkast-state (initierat
// från props) och committar bara vid explicit Spara. Ett null-fält (alla
// typer/områden) representeras internt som en fullständig Set för
// kryssrutornas skull, och konverteras tillbaka till null vid Spara om inget
// avmarkerats (samma "fullt set = null" konvention som backend/kontexten).
export default function KategoriFilterModal({
  kallNamn, initialKategorier, initialOmraden, onSpara, onClose,
}: {
  kallNamn:          string
  initialKategorier: string[] | null
  initialOmraden:    string[] | null
  onSpara:           (kategorier: string[] | null, omraden: string[] | null) => void
  onClose:           () => void
}) {
  const [flik, setFlik] = useState<Flik>('typ')
  const [valdaKategorier, setValdaKategorier] = useState<Set<string>>(new Set(initialKategorier ?? POLISEN_KATEGORIER))
  const [valdaOmraden, setValdaOmraden]       = useState<Set<string>>(new Set(initialOmraden ?? ALLA_KOMMUNER))

  function toggleKategori(kategori: string) {
    setValdaKategorier(prev => {
      const n = new Set(prev)
      if (n.has(kategori)) n.delete(kategori); else n.add(kategori)
      return n
    })
  }

  function toggleOmrade(kommun: string) {
    setValdaOmraden(prev => {
      const n = new Set(prev)
      if (n.has(kommun)) n.delete(kommun); else n.add(kommun)
      return n
    })
  }

  function väljFleraOmraden(kommuner: string[]) {
    setValdaOmraden(prev => new Set([...prev, ...kommuner]))
  }

  function avmarkeraFleraOmraden(kommuner: string[]) {
    setValdaOmraden(prev => {
      const n = new Set(prev)
      kommuner.forEach(k => n.delete(k))
      return n
    })
  }

  function spara() {
    const kategorier = valdaKategorier.size === POLISEN_KATEGORIER.length ? null : [...valdaKategorier]
    const omraden     = valdaOmraden.size    === ALLA_KOMMUNER.length      ? null : [...valdaOmraden]
    onSpara(kategorier, omraden)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl md:max-w-2xl sm:mx-4 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base md:text-lg font-bold text-slate-900">Vad ska den här bevakningen visa från {kallNamn}?</h3>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              {valdaKategorier.size} av {POLISEN_KATEGORIER.length} typer · {valdaOmraden.size} av {ALLA_KOMMUNER.length} kommuner
            </p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 text-xl md:text-2xl leading-none transition-colors">×</button>
        </div>

        <div className="flex border-b border-slate-100 shrink-0">
          <button
            onClick={() => setFlik('typ')}
            className={`flex-1 py-2.5 text-sm md:text-base font-semibold transition-colors ${
              flik === 'typ' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Typ
          </button>
          <button
            onClick={() => setFlik('omrade')}
            className={`flex-1 py-2.5 text-sm md:text-base font-semibold transition-colors ${
              flik === 'omrade' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Område
          </button>
        </div>

        <div className="px-6 py-2 border-b border-slate-100 flex gap-4 shrink-0">
          {flik === 'typ' ? (
            <>
              <button onClick={() => setValdaKategorier(new Set(POLISEN_KATEGORIER))} className="text-xs md:text-sm text-violet-600 hover:text-violet-800 font-medium py-2">Välj alla</button>
              <button onClick={() => setValdaKategorier(new Set())} className="text-xs md:text-sm text-slate-400 hover:text-slate-600 font-medium py-2">Avmarkera alla</button>
            </>
          ) : (
            <>
              <button onClick={() => setValdaOmraden(new Set(ALLA_KOMMUNER))} className="text-xs md:text-sm text-violet-600 hover:text-violet-800 font-medium py-2">Välj alla län</button>
              <button onClick={() => setValdaOmraden(new Set())} className="text-xs md:text-sm text-slate-400 hover:text-slate-600 font-medium py-2">Avmarkera alla län</button>
            </>
          )}
        </div>

        {flik === 'typ' ? (
          <TypLista valda={valdaKategorier} onToggle={toggleKategori} />
        ) : (
          <OmradeVal
            valda={valdaOmraden}
            onToggle={toggleOmrade}
            onVäljFlera={väljFleraOmraden}
            onAvmarkeraFlera={avmarkeraFleraOmraden}
          />
        )}

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm md:text-base font-semibold rounded-xl transition-all"
          >
            Avbryt
          </button>
          <button
            onClick={spara}
            className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm md:text-base font-semibold rounded-xl transition-all"
          >
            Spara
          </button>
        </div>
      </div>
    </div>
  )
}
