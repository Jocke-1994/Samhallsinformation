import { useState } from 'react'
import { usePolisenBevakningar, MAX_BEVAKNINGAR, type Bevakning } from '../../../context/PolisenBevakningarContext'
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
  const [sparar, setSparar] = useState(false)
  const [sparFel, setSparFel] = useState<string | null>(null)
  // Id på bevakningen som håller på att tas bort (låser just den raden).
  const [tarBortId, setTarBortId] = useState<string | null>(null)
  const [listFel, setListFel] = useState<string | null>(null)

  const vidTak = bevakningar.length >= MAX_BEVAKNINGAR

  async function handleSpara(kategorier: string[] | null, omraden: string[] | null) {
    if (sparar) return
    setSparar(true)
    setSparFel(null)
    try {
      if (redigerar === 'ny') {
        const skapad = await skapa(kategorier, omraden)
        if (!skapad) {
          setSparFel(`Du har redan max ${MAX_BEVAKNINGAR} bevakningar — ta bort en först.`)
          return
        }
      } else if (redigerar) {
        await uppdatera(redigerar.id, kategorier, omraden)
      }
      setRedigerar(null)
    } catch {
      // Modalen står kvar med användarens val intakta så att hen kan försöka igen.
      setSparFel('Bevakningen kunde inte sparas. Försök igen.')
    } finally {
      setSparar(false)
    }
  }

  async function handleTaBort(id: string) {
    if (tarBortId !== null) return
    setTarBortId(id)
    setListFel(null)
    try {
      await taBort(id)
    } catch {
      setListFel('Bevakningen kunde inte tas bort. Försök igen.')
    } finally {
      setTarBortId(null)
    }
  }

  function oppna(vad: Bevakning | 'ny') {
    setSparFel(null)
    setListFel(null)
    setRedigerar(vad)
  }

  function stang() {
    if (sparar) return
    setRedigerar(null)
    setSparFel(null)
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
                <button onClick={() => oppna(b)} className="text-xs text-violet-600 hover:text-violet-800 font-medium">Ändra</button>
                <button
                  onClick={() => handleTaBort(b.id)}
                  disabled={tarBortId !== null}
                  className="text-xs text-slate-400 hover:text-red-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tarBortId === b.id ? 'Tar bort…' : 'Ta bort'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {listFel && (
        <p role="alert" className="text-xs font-medium text-red-600 mb-1.5">{listFel}</p>
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
          onClick={() => oppna('ny')}
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
          onClose={stang}
          sparar={sparar}
          fel={sparFel}
        />
      )}
    </div>
  )
}
