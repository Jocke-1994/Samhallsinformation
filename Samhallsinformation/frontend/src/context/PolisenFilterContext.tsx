import { createContext, useContext, useState, useEffect, useRef, type Dispatch, type SetStateAction, type ReactNode } from 'react'
import { POLISEN_KATEGORIER, ALLA_KOMMUNER } from '../components/Profile/MinaKallor/kallorUtils'
import { fetchPolisenFilter, savePolisenFilter } from '../api/polisenFilter'
import { useAuth } from './AuthContext'

// PROTOTYP (FAS 4-diskussion, session 24) — delat state mellan Mina källors
// filtermodal och prenumerationsklockan i flödet. Bara Polisen har detta.
interface PolisenFilterContextValue {
  valdaKategorier:   Set<string>
  valdaOmraden:      Set<string>
  harAnpassatTyp:      boolean
  harAnpassatOmrade:   boolean
  harAnpassatFilter:   boolean
  toggleKategori:      (kategori: string) => void
  toggleOmrade:        (kommun: string) => void
  läggTillTyp:         (kategori: string) => void
  läggTillOmrade:      (kommun: string) => void
  väljAllaKategorier:      () => void
  avmarkeraAllaKategorier: () => void
  väljFleraOmraden:        (kommuner: string[]) => void
  avmarkeraFleraOmraden:   (kommuner: string[]) => void
  väljAllaOmraden:         () => void
  avmarkeraAllaOmraden:    () => void
  // Råa settrar — bara för "Ångra" på prenumerationsklockan, som behöver
  // återställa exakt föregående state (inte bara toggla bort det nya värdet,
  // vilket vore fel efter en "första klicket smalnar av"-åtgärd).
  sättValdaKategorierRakt: Dispatch<SetStateAction<Set<string>>>
  sättValdaOmradenRakt:    Dispatch<SetStateAction<Set<string>>>
}

const PolisenFilterContext = createContext<PolisenFilterContextValue | null>(null)

export function PolisenFilterProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth()
  // Allt ikryssat som standard = inget filter aktivt, matchar dagens beteende
  const [valdaKategorier, setValdaKategorier] = useState<Set<string>>(new Set(POLISEN_KATEGORIER))
  const [valdaOmraden,    setValdaOmraden]    = useState<Set<string>>(new Set(ALLA_KOMMUNER))
  const laddadRef = useRef(false)

  // Läs in sparat filter från backend vid inloggning. null-fält från API:t =
  // ej anpassat (allt), en JSON-array = explicit vald mängd.
  useEffect(() => {
    if (!isLoggedIn) {
      laddadRef.current = false
      setValdaKategorier(new Set(POLISEN_KATEGORIER))
      setValdaOmraden(new Set(ALLA_KOMMUNER))
      return
    }
    let avbruten = false
    fetchPolisenFilter()
      .then(filter => {
        if (avbruten) return
        setValdaKategorier(filter.kategorier === null ? new Set(POLISEN_KATEGORIER) : new Set(filter.kategorier))
        setValdaOmraden(filter.omraden === null ? new Set(ALLA_KOMMUNER) : new Set(filter.omraden))
        laddadRef.current = true
      })
      .catch(() => { laddadRef.current = true }) // fortsätt lokalt om hämtningen misslyckas
    return () => { avbruten = true }
  }, [isLoggedIn])

  // Spara till backend vid ändring — men inte innan den initiala hämtningen
  // är klar, annars skriver vi över sparad data med default-läget.
  useEffect(() => {
    if (!isLoggedIn || !laddadRef.current) return
    savePolisenFilter({
      kategorier: valdaKategorier.size === POLISEN_KATEGORIER.length ? null : [...valdaKategorier],
      omraden:    valdaOmraden.size    === ALLA_KOMMUNER.length      ? null : [...valdaOmraden],
    }).catch(() => {})
  }, [valdaKategorier, valdaOmraden, isLoggedIn])

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

  // Första gången en dimension "läggs till" (från prenumerationsklockan i
  // flödet) smalnar det av från "allt" till bara det valda — annars vore
  // klicket en no-op eftersom allting redan ingick i default-läget.
  function läggTillTyp(kategori: string) {
    setValdaKategorier(prev => prev.size === POLISEN_KATEGORIER.length ? new Set([kategori]) : new Set(prev).add(kategori))
  }

  function läggTillOmrade(kommun: string) {
    setValdaOmraden(prev => prev.size === ALLA_KOMMUNER.length ? new Set([kommun]) : new Set(prev).add(kommun))
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

  const value: PolisenFilterContextValue = {
    valdaKategorier,
    valdaOmraden,
    harAnpassatTyp:    valdaKategorier.size < POLISEN_KATEGORIER.length,
    harAnpassatOmrade: valdaOmraden.size < ALLA_KOMMUNER.length,
    harAnpassatFilter: valdaKategorier.size < POLISEN_KATEGORIER.length || valdaOmraden.size < ALLA_KOMMUNER.length,
    toggleKategori,
    toggleOmrade,
    läggTillTyp,
    läggTillOmrade,
    väljAllaKategorier:      () => setValdaKategorier(new Set(POLISEN_KATEGORIER)),
    avmarkeraAllaKategorier: () => setValdaKategorier(new Set()),
    väljFleraOmraden,
    avmarkeraFleraOmraden,
    väljAllaOmraden:      () => setValdaOmraden(new Set(ALLA_KOMMUNER)),
    avmarkeraAllaOmraden: () => setValdaOmraden(new Set()),
    sättValdaKategorierRakt: setValdaKategorier,
    sättValdaOmradenRakt:    setValdaOmraden,
  }

  return (
    <PolisenFilterContext.Provider value={value}>
      {children}
    </PolisenFilterContext.Provider>
  )
}

export function usePolisenFilter() {
  const ctx = useContext(PolisenFilterContext)
  if (!ctx) throw new Error('usePolisenFilter måste användas inom PolisenFilterProvider')
  return ctx
}
