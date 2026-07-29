import { useState } from 'react'
import type { Source } from '../../../types'
import { SVENSKA_LÄN, LÄN_KOMMUNER } from './kallorUtils'
import KategoriFilterModal from './KategoriFilterModal'
import { usePolisenFilter } from '../../../context/PolisenFilterContext'

// PROTOTYP (FAS 4-diskussion) — bara Polisen har kategorifilter tillgängligt
// just nu, eftersom det är den enda källan som fått sina händelsetyper
// extraherade (EventType, PR #373). Övriga källor visar ingen filterkontroll
// alls — "allt" är redan rätt standard för dem.
const HAR_KATEGORIFILTER = new Set(['Polisen'])

function KallaRad({ k, onRemove }: { k: Source; onRemove: (id: number) => void }) {
  const [visaFilter, setVisaFilter] = useState(false)
  const {
    valdaKategorier, valdaOmraden, harAnpassatFilter,
    toggleKategori, toggleOmrade,
    väljAllaKategorier, avmarkeraAllaKategorier,
    väljFleraOmraden, avmarkeraFleraOmraden, väljAllaOmraden, avmarkeraAllaOmraden,
  } = usePolisenFilter()
  const typerValda = valdaKategorier.size
  // Län som har minst en vald kommun — matchar modalens fråga "Vad vill du
  // se?": siffrorna beskriver vad som VISAS, inte vad som är bortvalt.
  const länAktiva  = SVENSKA_LÄN.filter(län => LÄN_KOMMUNER[län].some(kommun => valdaOmraden.has(kommun))).length

  const filterEtikett = `${typerValda} typ${typerValda === 1 ? '' : 'er'}, ${länAktiva} län`
  const filterKnappText = harAnpassatFilter ? `Filter · ${filterEtikett}` : 'Filter'

  const harFilterKnapp = HAR_KATEGORIFILTER.has(k.shortName)

  return (
    <div className="py-2 group">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <a href={k.url ?? k.baseUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-800 hover:text-violet-600 hover:underline leading-snug transition-colors">{k.name}</a>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {harFilterKnapp && !harAnpassatFilter && (
            <button
              onClick={() => setVisaFilter(true)}
              title="Välj vad du vill se från den här källan"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap bg-white border border-violet-200 text-violet-600 hover:bg-violet-50"
            >
              Filter
            </button>
          )}
          <button
            onClick={() => onRemove(k.id)}
            className="hover-reveal px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-all"
          >- Ta bort</button>
        </div>
      </div>
      {harFilterKnapp && harAnpassatFilter && (
        <button
          onClick={() => setVisaFilter(true)}
          title="Välj vad du vill se från den här källan"
          className="mt-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap bg-violet-600 hover:bg-violet-500 text-white"
        >
          {filterKnappText}
        </button>
      )}
      {visaFilter && (
        <KategoriFilterModal
          kallNamn={k.name}
          valdaKategorier={valdaKategorier}
          onToggleKategori={toggleKategori}
          onVäljAllaKategorier={väljAllaKategorier}
          onAvmarkeraAllaKategorier={avmarkeraAllaKategorier}
          valdaOmraden={valdaOmraden}
          onToggleOmrade={toggleOmrade}
          onVäljFleraOmraden={väljFleraOmraden}
          onAvmarkeraFleraOmraden={avmarkeraFleraOmraden}
          onVäljAllaOmraden={väljAllaOmraden}
          onAvmarkeraAllaOmraden={avmarkeraAllaOmraden}
          onClose={() => setVisaFilter(false)}
        />
      )}
    </div>
  )
}

export default function AktivaKallorKort({ sources, onRemove, onDeleteAll, highlightId, harLaggTillKort }: {
  sources:          Source[]
  onRemove:         (id: number) => void
  onDeleteAll:      () => void
  highlightId:      string | null
  harLaggTillKort:  boolean
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const sorterade = [...sources].sort((a, b) => a.name.localeCompare(b.name, 'sv'))

  return (
    <div
      id="aktiva-kallor"
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm h-auto sm:h-[523px] flex flex-col ${highlightId === 'aktiva-kallor' ? 'card-highlight' : ''}`}
    >
      <div style={{ padding: '1.5rem 2.5rem 1.25rem' }} className="border-b border-slate-100">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl shrink-0">🗂️</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Aktiva källor</h2>
            <p className="text-sm text-slate-500 mt-0.5">Dessa myndigheter visas i ditt nyhetsflöde</p>
          </div>
        </div>
      </div>

      {sorterade.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-sm font-medium text-slate-700">Inga aktiva källor</p>
          <p className="text-xs text-slate-400 mt-1">
            {harLaggTillKort ? 'Lägg till källor via kortet till vänster' : 'Lägg till källor via Alla källor till höger'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col">
            {sorterade.map(k => <KallaRad key={k.id} k={k} onRemove={onRemove} />)}
          </div>
        </div>
      )}

      {sorterade.length > 0 && (
        <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium"
            >
              Radera alla källor
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <p className="text-xs text-slate-600">Är du säker? Detta kan inte ångras.</p>
              <button
                onClick={() => { onDeleteAll(); setShowDeleteConfirm(false) }}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Ja, radera
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
              >
                Avbryt
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
