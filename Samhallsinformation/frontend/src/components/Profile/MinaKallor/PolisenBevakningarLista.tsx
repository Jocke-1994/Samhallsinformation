import { useState } from 'react'
import { usePolisenBevakningar, MAX_BEVAKNINGAR, type Bevakning } from '../../../context/PolisenBevakningarContext'
import { BevakningError } from '../../../api/polisenBevakningar'
import KategoriFilterModal from './KategoriFilterModal'

function sammanfatta(lista: string[] | null, allaLabel: string): string {
  if (lista === null) return allaLabel
  if (lista.length === 0) return 'Inget valt'
  if (lista.length <= 3) return lista.join(', ')
  return `${lista.slice(0, 3).join(', ')} +${lista.length - 3} till`
}

// Ersätter den enskilda delade "Filter"-knappen (KategoriFilterModal band
// direkt mot en global PolisenFilterContext) med en lista av flera
// oberoende bevakningar — se PolisenBevakningarContext för ELLER-logiken.
export default function PolisenBevakningarLista({ kallNamn }: { kallNamn: string }) {
  const { bevakningar, lage, forsokIgen, skapa, uppdatera, taBort } = usePolisenBevakningar()
  const [redigerar, setRedigerar] = useState<Bevakning | 'ny' | null>(null)
  const [sparfel, setSparfel] = useState<string | null>(null)

  const vidTak = bevakningar.length >= MAX_BEVAKNINGAR

  async function handleSpara(kategorier: string[] | null, omraden: string[] | null) {
    setSparfel(null)
    try {
      if (redigerar === 'ny') {
        await skapa(kategorier, omraden)
      } else if (redigerar) {
        await uppdatera(redigerar.id, kategorier, omraden)
      }
      setRedigerar(null)
    } catch (e) {
      // Serverns text (t.ex. "Max 5 bevakningar per användare.") visas som den är;
      // modalen står kvar öppen så valen inte går förlorade.
      setSparfel(e instanceof BevakningError ? e.message : 'Kunde inte spara bevakningen. Försök igen.')
    }
  }

  return (
    <div className="mt-1.5">
      {bevakningar.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-1.5">
          {bevakningar.map(b => (
            <div key={b.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-600 truncate">
                {sammanfatta(b.kategorier ? [...b.kategorier] : null, 'Alla typer')} · {sammanfatta(b.omraden ? [...b.omraden] : null, 'Alla områden')}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setRedigerar(b)} className="text-xs text-violet-600 hover:text-violet-800 font-medium">Ändra</button>
                <button onClick={() => taBort(b.id)} className="text-xs text-slate-400 hover:text-red-500 font-medium">Ta bort</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {lage === 'laddar' ? (
        <p className="text-xs text-slate-400">Hämtar dina bevakningar...</p>
      ) : lage === 'fel' ? (
        <p className="text-xs text-slate-500">
          Kunde inte hämta dina bevakningar.{' '}
          <button onClick={forsokIgen} className="font-semibold text-violet-600 hover:text-violet-800">Försök igen</button>
        </p>
      ) : vidTak ? (
        <p className="text-xs text-slate-400">Max {MAX_BEVAKNINGAR} bevakningar nådda — ta bort en för att lägga till en ny.</p>
      ) : (
        <button
          onClick={() => setRedigerar('ny')}
          className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
        >
          + Ny bevakning
        </button>
      )}

      {redigerar && (
        <KategoriFilterModal
          kallNamn={kallNamn}
          initialKategorier={redigerar === 'ny' ? null : (redigerar.kategorier ? [...redigerar.kategorier] : null)}
          initialOmraden={redigerar === 'ny' ? null : (redigerar.omraden ? [...redigerar.omraden] : null)}
          onSpara={handleSpara}
          onClose={() => { setSparfel(null); setRedigerar(null) }}
          fel={sparfel}
        />
      )}
    </div>
  )
}
