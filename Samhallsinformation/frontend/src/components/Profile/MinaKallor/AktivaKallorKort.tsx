import { useState } from 'react'
import type { Source } from '../../../types'
import PolisenBevakningarLista from './PolisenBevakningarLista'
import { useFlags } from '../../../context/FeatureFlagsContext'
import { grupperaKallor, representant } from './kallGrupper'

// Bara Polisen har bevakningar tillgängligt just nu, eftersom det är den
// enda källan som fått sina händelsetyper extraherade (EventType, PR #373).
// Övriga källor visar ingen filterkontroll alls — "allt" är redan rätt
// standard för dem.
const HAR_KATEGORIFILTER = new Set(['Polisen'])

function KallaRad({ visningsKalla, gruppIds, onRemove }: {
  visningsKalla: Source
  gruppIds:      number[]
  onRemove:      (ids: number[]) => void
}) {
  const flaggor = useFlags()
  const harFilterKnapp = flaggor.kallor_polisen_filter && HAR_KATEGORIFILTER.has(visningsKalla.shortName)

  return (
    <div className="py-2 group">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug truncate">{visningsKalla.name}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onRemove(gruppIds)}
            className="hover-reveal px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-all"
          >- Ta bort</button>
        </div>
      </div>
      {harFilterKnapp && <PolisenBevakningarLista kallNamn={visningsKalla.name} />}
    </div>
  )
}

export default function AktivaKallorKort({ sources, onRemove, onDeleteAll, highlightId, harLaggTillKort }: {
  sources:          Source[]
  onRemove:         (ids: number[]) => void
  onDeleteAll:      () => void
  highlightId:      string | null
  harLaggTillKort:  boolean
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  // Källor som delar shortName (t.ex. Polisen + Polisen Efterlysningar) visas
  // som EN rad — samma gruppering som Sidebar redan använder.
  const grupper = [...grupperaKallor(sources).values()]
    .map(gruppkallor => ({ visningsKalla: representant(gruppkallor), gruppIds: gruppkallor.map(k => k.id) }))
    .sort((a, b) => a.visningsKalla.name.localeCompare(b.visningsKalla.name, 'sv'))

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

      {grupper.length === 0 ? (
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
            {grupper.map(({ visningsKalla, gruppIds }) => (
              <KallaRad key={visningsKalla.shortName} visningsKalla={visningsKalla} gruppIds={gruppIds} onRemove={onRemove} />
            ))}
          </div>
        </div>
      )}

      {grupper.length > 0 && (
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
