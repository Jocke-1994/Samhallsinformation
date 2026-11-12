import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPlatskatalog, fetchPlatsHandelser } from '../../api/platser'
import type { CanonicalEvent, PlatsKatalogPost, PlatsSektion, Source } from '../../types'
import NewsItem from './NewsItem'

// Senaste valet (beslut 8) — samma mönster som theme/cookie_consent: en
// webbläsarlokal bekvämlighet för besökare utan konto, inget att synka mot
// servern.
const VALDA_PLATSER_NYCKEL = 'si_platsfilter_val'

function läsSparatVal(): string[] {
  try {
    const rå = localStorage.getItem(VALDA_PLATSER_NYCKEL)
    const parsed = rå ? JSON.parse(rå) : []
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

// Ärvning (beslut 2+3) sker bara till en KOMMUN-sektion (sek.lan är satt bara
// för kommuner). Där är en händelse vars geography skiljer sig från kommunen
// en länsvarning som ärvts in. Under ett läns egen plupp är allt direkta
// träffar, även Trafikverkets "Skåne Väg 19" — inget märke där.
function ärÄrvdLänsvarning(sek: PlatsSektion, event: CanonicalEvent): boolean {
  if (!sek.lan || !event.geography) return false
  return event.geography.toLowerCase() !== sek.plats.toLowerCase()
}

interface Props {
  sources: Source[]
}

export default function Platsfilter({ sources }: Props) {
  const [valda, setValda] = useState<string[]>(läsSparatVal)
  const [sök, setSök] = useState('')
  const [expanderad, setExpanderad] = useState(false)
  const [ärDesktop, setÄrDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const lyssna = () => setÄrDesktop(mq.matches)
    mq.addEventListener('change', lyssna)
    return () => mq.removeEventListener('change', lyssna)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(VALDA_PLATSER_NYCKEL, JSON.stringify(valda))
    } catch {
      /* okej att inte spara */
    }
  }, [valda])

  const {
    data: katalog,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['platser-katalog'],
    queryFn: fetchPlatskatalog,
  })

  const platserNyckel = useMemo(() => [...valda].sort().join(','), [valda])
  const { data: sektioner } = useQuery({
    queryKey: ['platser-handelser', platserNyckel],
    queryFn: () => fetchPlatsHandelser(valda),
    enabled: valda.length > 0,
  })

  const sourceMap = useMemo(
    () => Object.fromEntries(sources.map((s) => [s.id, s.shortName])),
    [sources],
  )

  function togglaPlats(plats: PlatsKatalogPost) {
    if (!plats.aktiv) return
    setValda((prev) =>
      prev.includes(plats.namn) ? prev.filter((p) => p !== plats.namn) : [...prev, plats.namn],
    )
  }

  const CAP = ärDesktop ? 8 : 6
  const sökTrimmad = sök.trim()

  const aktivaPlatser = useMemo(() => (katalog ?? []).filter((p) => p.aktiv), [katalog])
  const matchande = sökTrimmad
    ? (katalog ?? []).filter((p) => p.namn.toLowerCase().includes(sökTrimmad.toLowerCase()))
    : aktivaPlatser
  const synliga = sökTrimmad ? matchande : expanderad ? matchande : matchande.slice(0, CAP)
  const doldaAntal = sökTrimmad ? 0 : matchande.length - synliga.length
  const visarInaktiva = synliga.some((p) => !p.aktiv)

  if (isLoading) return <p className="text-slate-400 text-sm py-6 text-center">Hämtar platser...</p>
  if (isError)
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-slate-600 dark:text-slate-300 text-sm">
          Vi kunde inte hämta platslistan just nu.
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Försök igen
        </button>
      </div>
    )

  return (
    <div className="max-w-3xl mx-auto">
      <input
        type="text"
        value={sök}
        onChange={(e) => setSök(e.target.value)}
        placeholder="Sök plats, t.ex. Kungälv"
        className="w-full max-w-sm px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300 mb-3"
      />

      <div className="flex gap-2 flex-wrap mb-2">
        {synliga.map((p) => (
          <button
            key={p.namn}
            disabled={!p.aktiv}
            onClick={() => togglaPlats(p)}
            className={`text-xs font-semibold px-3.5 py-2 rounded-full whitespace-nowrap transition-colors ${
              valda.includes(p.namn)
                ? 'bg-violet-600 text-white border border-violet-600'
                : p.aktiv
                  ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  : 'bg-slate-50 border border-dashed border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {p.namn} ({p.antalHandelser})
          </button>
        ))}
        {!sökTrimmad && doldaAntal > 0 && (
          <button
            onClick={() => setExpanderad(true)}
            className="text-xs font-bold px-3.5 py-2 rounded-full border border-dashed border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Visa fler (+{doldaAntal})
          </button>
        )}
      </div>

      {sökTrimmad && matchande.length === 0 && (
        <p className="text-sm text-slate-400 mb-2">
          Hittade ingen plats som matchar "{sökTrimmad}".
        </p>
      )}
      {visarInaktiva && (
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          Gråmarkerade orter har inga aktuella händelser just nu — gå tillbaka hit senare om det
          händer något.
        </p>
      )}

      {valda.length === 0 && (
        <p className="text-sm text-slate-400 py-8 text-center">
          Sök och välj en eller flera platser ovan för att se vad som gäller där.
        </p>
      )}

      <div className="flex flex-col gap-6 mt-4">
        {(sektioner ?? []).map((sek) => (
          <div key={sek.plats}>
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2.5">
              Gäller {sek.plats}
            </h2>
            {sek.handelser.length === 0 && (
              <p className="text-sm text-slate-400">Inga aktuella händelser just nu.</p>
            )}
            <div className="flex flex-col gap-1.5">
              {sek.handelser.map((event) => (
                <div key={event.id}>
                  <NewsItem
                    event={event}
                    isRead={false}
                    sourceName={sourceMap[event.sourceId]}
                    sourceShortName={sourceMap[event.sourceId]}
                    viewMode="allt"
                  />
                  {ärÄrvdLänsvarning(sek, event) && (
                    <span className="inline-flex mt-1 ml-1 text-[11px] font-semibold text-violet-600 bg-violet-50 dark:bg-violet-950/40 px-2.5 py-1 rounded-full">
                      📍 Länsvarning — gäller hela {event.geography}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
