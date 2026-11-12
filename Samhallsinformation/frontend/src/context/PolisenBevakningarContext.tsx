import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  fetchBevakningar,
  createBevakning,
  updateBevakning,
  deleteBevakning,
  type BevakningDto,
  type BevakningRequest,
} from '../api/polisenBevakningar'
import { kommunerILän } from '../components/Profile/MinaKallor/kallorUtils'
import { useInloggadHamtning, type HamtLage } from '../hooks/useInloggadHamtning'

// Ersätter PolisenFilterContext (en delad, global AND-kombination) med flera
// oberoende bevakningar per användare, ELLER-kombinerade — se
// PolisenBevakningMatcher.cs på backend för den speglade logiken. Bara
// Polisen har det här.
export interface Bevakning {
  id: string
  kategorier: Set<string> | null // null = alla typer
  omraden: Set<string> | null // null = alla områden
}

export const MAX_BEVAKNINGAR = 5

interface PolisenBevakningarContextValue {
  bevakningar: Bevakning[]
  // laddar = ingen lista känd än, klar = listan hämtad, fel = hämtningen
  // misslyckades (efter omförsök). laddar/fel betyder "okänt" — aldrig
  // "inga bevakningar".
  lage: HamtLage
  forsokIgen: () => void
  matchar: (typ: string | null, omrade: string | null) => boolean
  matcharLän: (typ: string | null, län: string | null) => boolean
  typDackt: (typ: string) => boolean
  omradeDackt: (omrade: string) => boolean
  matchandeBevakning: (typ: string | null, omrade: string | null) => Bevakning | null
  skapa: (kategorier: string[] | null, omraden: string[] | null) => Promise<boolean>
  uppdatera: (id: string, kategorier: string[] | null, omraden: string[] | null) => Promise<void>
  taBort: (id: string) => Promise<void>
}

const PolisenBevakningarContext = createContext<PolisenBevakningarContextValue | null>(null)

function toSet(v: string[] | null): Set<string> | null {
  return v === null ? null : new Set(v)
}

function toArray(v: Set<string> | null): string[] | null {
  return v === null ? null : [...v]
}

function frånDto(r: BevakningDto): Bevakning {
  return { id: r.id, kategorier: toSet(r.kategorier), omraden: toSet(r.omraden) }
}

export function PolisenBevakningarProvider({ children }: { children: ReactNode }) {
  const {
    data: rader,
    lage,
    forsokIgen,
    uppdatera: uppdateraLista,
  } = useInloggadHamtning<BevakningDto[]>('polisen-bevakningar', fetchBevakningar)
  const bevakningar = useMemo(() => (rader ?? []).map(frånDto), [rader])
  const queryClient = useQueryClient()

  // Mitt flöde filtreras på servern efter bevakningarna (V3-11): en ändring ska
  // ge ett omhämtat flöde, inte vänta på nästa besök.
  const flodetBehoverHamtasOm = () => {
    void queryClient.invalidateQueries({ queryKey: ['mitt-flode'] })
  }

  // Tom lista = inget anpassat = allt syns (matchar backendens
  // PolisenBevakningMatcher.Matches exakt) — men bara när listan faktiskt
  // hämtats (lage === 'klar'). Innan dess, och om hämtningen misslyckats
  // (utgången token, nätverksfel), är listan OKÄND, inte tom: matchar()
  // returnerar då false (Polisen-händelser döljs) i stället för true
  // (Polisen från hela landet). Det var buggen som upptäcktes live via en
  // skärmdump med händelser från städer långt utanför en riktig, sparad
  // bevakning. En misslyckad omhämtning behåller senast kända lista.
  function matchar(typ: string | null, omrade: string | null): boolean {
    if (lage !== 'klar') return false
    if (bevakningar.length === 0) return true
    return bevakningar.some((b) => {
      const typOk = b.kategorier === null || typ === null || b.kategorier.has(typ)
      const omradeOk = b.omraden === null || omrade === null || b.omraden.has(omrade)
      return typOk && omradeOk
    })
  }

  // Som matchar(), men för händelser vars geografi bara går att slå upp på
  // läns-nivå (Polisens sammanfattningar, se länFörGeografi i kallorUtils.ts)
  // — ett områdesvillkor anses uppfyllt om NÅGON av bevakningens valda
  // kommuner ligger i det länet, inte via en exakt strängjämförelse (som
  // aldrig kan träffa, eftersom bevakningens omraden alltid är kommunnamn).
  function matcharLän(typ: string | null, län: string | null): boolean {
    if (lage !== 'klar') return false
    if (bevakningar.length === 0) return true
    return bevakningar.some((b) => {
      const typOk = b.kategorier === null || typ === null || b.kategorier.has(typ)
      const omradeOk =
        b.omraden === null || län === null || kommunerILän(län).some((k) => b.omraden!.has(k))
      return typOk && omradeOk
    })
  }

  function typDackt(typ: string): boolean {
    return bevakningar.some((b) => b.kategorier === null || b.kategorier.has(typ))
  }

  function omradeDackt(omrade: string): boolean {
    return bevakningar.some((b) => b.omraden === null || b.omraden.has(omrade))
  }

  // Bara meningsfullt att erbjuda "ta bort" i flödet när EXAKT en bevakning
  // är anledningen till att händelsen syns — annars är det oklart vilken av
  // flera överlappande bevakningar som skulle tas bort.
  function matchandeBevakning(typ: string | null, omrade: string | null): Bevakning | null {
    const träffar = bevakningar.filter((b) => {
      const typOk = b.kategorier === null || typ === null || b.kategorier.has(typ)
      const omradeOk = b.omraden === null || omrade === null || b.omraden.has(omrade)
      return typOk && omradeOk
    })
    return träffar.length === 1 ? träffar[0] : null
  }

  async function skapa(kategorier: string[] | null, omraden: string[] | null): Promise<boolean> {
    // Okänd lista: skapa inte (max-kollen går inte att göra, och en delmängd
    // får inte se ut som hela listan). Anroparen visar sitt vanliga felmeddelande.
    if (lage !== 'klar') throw new Error('Bevakningarna har inte hämtats')
    if (bevakningar.length >= MAX_BEVAKNINGAR) return false
    const req: BevakningRequest = { kategorier, omraden }
    const ny = await createBevakning(req)
    uppdateraLista((prev) => [...prev, ny])
    flodetBehoverHamtasOm()
    return true
  }

  async function uppdatera(
    id: string,
    kategorier: string[] | null,
    omraden: string[] | null,
  ): Promise<void> {
    const req: BevakningRequest = { kategorier, omraden }
    const uppdaterad = await updateBevakning(id, req)
    uppdateraLista((prev) => prev.map((b) => (b.id === id ? uppdaterad : b)))
    flodetBehoverHamtasOm()
  }

  async function taBort(id: string): Promise<void> {
    await deleteBevakning(id)
    uppdateraLista((prev) => prev.filter((b) => b.id !== id))
    flodetBehoverHamtasOm()
  }

  const value: PolisenBevakningarContextValue = {
    bevakningar,
    lage,
    forsokIgen,
    matchar,
    matcharLän,
    typDackt,
    omradeDackt,
    matchandeBevakning,
    skapa,
    uppdatera,
    taBort,
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
