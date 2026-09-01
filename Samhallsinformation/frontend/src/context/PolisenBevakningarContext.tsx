import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
  fetchBevakningar, createBevakning, updateBevakning, deleteBevakning, type BevakningRequest,
} from '../api/polisenBevakningar'
import { useAuth } from './AuthContext'

// Ersätter PolisenFilterContext (en delad, global AND-kombination) med flera
// oberoende bevakningar per användare, ELLER-kombinerade — se
// PolisenBevakningMatcher.cs på backend för den speglade logiken. Bara
// Polisen har det här.
export interface Bevakning {
  id:         string
  kategorier: Set<string> | null // null = alla typer
  omraden:    Set<string> | null // null = alla områden
}

export const MAX_BEVAKNINGAR = 5

interface PolisenBevakningarContextValue {
  bevakningar: Bevakning[]
  laddat:      boolean
  matchar:      (typ: string | null, omrade: string | null) => boolean
  typDackt:     (typ: string) => boolean
  omradeDackt:  (omrade: string) => boolean
  matchandeBevakning: (typ: string | null, omrade: string | null) => Bevakning | null
  skapa:        (kategorier: string[] | null, omraden: string[] | null) => Promise<boolean>
  uppdatera:    (id: string, kategorier: string[] | null, omraden: string[] | null) => Promise<void>
  taBort:       (id: string) => Promise<void>
}

const PolisenBevakningarContext = createContext<PolisenBevakningarContextValue | null>(null)

function toSet(v: string[] | null): Set<string> | null {
  return v === null ? null : new Set(v)
}

function toArray(v: Set<string> | null): string[] | null {
  return v === null ? null : [...v]
}

export function PolisenBevakningarProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth()
  const [bevakningar, setBevakningar] = useState<Bevakning[]>([])
  const [laddat, setLaddat] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) {
      setBevakningar([])
      setLaddat(false)
      return
    }
    let avbruten = false
    fetchBevakningar()
      .then(rader => {
        if (avbruten) return
        setBevakningar(rader.map(r => ({ id: r.id, kategorier: toSet(r.kategorier), omraden: toSet(r.omraden) })))
        setLaddat(true)
      })
      .catch(() => { setLaddat(true) })
    return () => { avbruten = true }
  }, [isLoggedIn])

  // Tom lista = inget anpassat = allt syns (matchar backendens
  // PolisenBevakningMatcher.Matches exakt) — men bara EFTER att hämtningen
  // faktiskt svarat. Innan dess är listan också tom (initialt useState),
  // och utan laddat-kollen visade Mitt flöde tyst ALLT från Polisen
  // (inte bara ospecificerat, obegränsat, hela landet) under det korta
  // fönstret precis efter inloggning/sidladdning innan bevakningarna hunnit
  // hämtas — upptäckt live via en skärmdump med händelser från städer långt
  // utanför en riktig, sparad bevakning.
  function matchar(typ: string | null, omrade: string | null): boolean {
    if (!laddat) return false
    if (bevakningar.length === 0) return true
    return bevakningar.some(b => {
      const typOk    = b.kategorier === null || typ    === null || b.kategorier.has(typ)
      const omradeOk = b.omraden    === null || omrade === null || b.omraden.has(omrade)
      return typOk && omradeOk
    })
  }

  function typDackt(typ: string): boolean {
    return bevakningar.some(b => b.kategorier === null || b.kategorier.has(typ))
  }

  function omradeDackt(omrade: string): boolean {
    return bevakningar.some(b => b.omraden === null || b.omraden.has(omrade))
  }

  // Bara meningsfullt att erbjuda "ta bort" i flödet när EXAKT en bevakning
  // är anledningen till att händelsen syns — annars är det oklart vilken av
  // flera överlappande bevakningar som skulle tas bort.
  function matchandeBevakning(typ: string | null, omrade: string | null): Bevakning | null {
    const träffar = bevakningar.filter(b => {
      const typOk    = b.kategorier === null || typ    === null || b.kategorier.has(typ)
      const omradeOk = b.omraden    === null || omrade === null || b.omraden.has(omrade)
      return typOk && omradeOk
    })
    return träffar.length === 1 ? träffar[0] : null
  }

  async function skapa(kategorier: string[] | null, omraden: string[] | null): Promise<boolean> {
    if (bevakningar.length >= MAX_BEVAKNINGAR) return false
    const req: BevakningRequest = { kategorier, omraden }
    const ny = await createBevakning(req)
    setBevakningar(prev => [...prev, { id: ny.id, kategorier: toSet(ny.kategorier), omraden: toSet(ny.omraden) }])
    return true
  }

  async function uppdatera(id: string, kategorier: string[] | null, omraden: string[] | null): Promise<void> {
    const req: BevakningRequest = { kategorier, omraden }
    const uppdaterad = await updateBevakning(id, req)
    setBevakningar(prev => prev.map(b => b.id === id
      ? { id: uppdaterad.id, kategorier: toSet(uppdaterad.kategorier), omraden: toSet(uppdaterad.omraden) }
      : b))
  }

  async function taBort(id: string): Promise<void> {
    await deleteBevakning(id)
    setBevakningar(prev => prev.filter(b => b.id !== id))
  }

  const value: PolisenBevakningarContextValue = {
    bevakningar, laddat, matchar, typDackt, omradeDackt, matchandeBevakning, skapa, uppdatera, taBort,
  }

  return (
    <PolisenBevakningarContext.Provider value={value}>
      {children}
    </PolisenBevakningarContext.Provider>
  )
}

export function usePolisenBevakningar() {
  const ctx = useContext(PolisenBevakningarContext)
  if (!ctx) throw new Error('usePolisenBevakningar måste användas inom PolisenBevakningarProvider')
  return ctx
}

export { toArray }
