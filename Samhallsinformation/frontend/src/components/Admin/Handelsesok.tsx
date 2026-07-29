import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSearchableSources, fetchEventTypes, searchEvents, type SearchParams, type AdminSearchEvent } from '../../api/eventSearch'
import NewsItem from '../NewsFeed/NewsItem'
import { MOCK_ANVÄNDARE_LISTA } from '../../lib/mockAnvandare'
import { sparaHandelseForAnvandare } from '../../lib/sparadeHandelserStorage'

const SIDA_STORLEK = 20

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

function SparaTillAnvändare({ handelse }: { handelse: AdminSearchEvent }) {
  const [öppen, setÖppen]           = useState(false)
  const [sparadTill, setSparadTill] = useState<string | null>(null)

  function spara(id: number, namn: string) {
    sparaHandelseForAnvandare(id, {
      eventId:     handelse.id,
      title:       handelse.title,
      sourceName:  handelse.sourceName,
      publishedAt: handelse.publishedAt,
      sparadDatum: formatDatum(new Date().toISOString()),
    })
    setSparadTill(namn)
    setÖppen(false)
  }

  if (sparadTill) {
    return <p className="text-xs text-slate-400 px-1">Sparad till {sparadTill} ✓</p>
  }

  return (
    <div className="relative w-fit px-1">
      <button
        onClick={() => setÖppen(v => !v)}
        className="text-xs text-slate-400 hover:text-violet-600 transition-colors"
      >
        👤 Spara till användare
      </button>
      {öppen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setÖppen(false)} />
          <div className="absolute left-0 top-6 z-40 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <ul className="max-h-64 overflow-y-auto py-1">
              {MOCK_ANVÄNDARE_LISTA.map(u => (
                <li key={u.id}>
                  <button
                    onClick={() => spara(u.id, u.namn)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {u.namn}
                    <span className="block text-xs text-slate-400">{u.epost}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

export default function Handelsesok() {
  const [sourceId, setSourceId]   = useState<string>('')
  const [geography, setGeography] = useState('')
  const [eventType, setEventType] = useState('')
  const [from, setFrom]           = useState('')
  const [to, setTo]               = useState('')
  const [page, setPage]           = useState(1)

  const [activeParams, setActiveParams] = useState<SearchParams>({ page: 1, pageSize: SIDA_STORLEK })

  const { data: sources } = useQuery({
    queryKey: ['admin-event-search-sources'],
    queryFn:  fetchSearchableSources,
  })

  const { data: types } = useQuery({
    queryKey: ['admin-event-search-types', sourceId],
    queryFn:  () => fetchEventTypes(sourceId ? Number(sourceId) : undefined),
  })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-event-search', activeParams],
    queryFn:  () => searchEvents(activeParams),
  })

  function sök(nyPage = 1) {
    setPage(nyPage)
    setActiveParams({
      sourceId:  sourceId ? Number(sourceId) : undefined,
      geography: geography.trim() || undefined,
      eventType: eventType || undefined,
      from:      from || undefined,
      to:        to || undefined,
      page:      nyPage,
      pageSize:  SIDA_STORLEK,
    })
  }

  function nollställ() {
    setSourceId('')
    setGeography('')
    setEventType('')
    setFrom('')
    setTo('')
    setPage(1)
    setActiveParams({ page: 1, pageSize: SIDA_STORLEK })
  }

  const harFilter = !!(activeParams.sourceId || activeParams.geography || activeParams.eventType || activeParams.from || activeParams.to)
  const totalSidor = data ? Math.max(1, Math.ceil(data.total / SIDA_STORLEK)) : 1

  return (
    <div>
      <p className="text-sm text-slate-500 mb-6">
        Sök bakåt i tiden bland alla ingestade händelser (oavsett publiceringsstatus) — källa, typ, plats och datumintervall.
        Typ-filtret kräver att källan fått sina händelsetyper extraherade (idag bara Polisen).
        Hittar du något en användare frågar om kan du spara det direkt till deras konto (mockat tills riktiga användare finns).
      </p>

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Källa</label>
            <select
              value={sourceId}
              onChange={e => { setSourceId(e.target.value); setEventType('') }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="">Alla källor</option>
              {sources?.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Typ</label>
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              disabled={!types || types.length === 0}
              title={!types || types.length === 0 ? 'Ingen källa har kategoriserade typer ännu' : undefined}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Alla typer</option>
              {types?.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Plats</label>
            <input
              type="text"
              value={geography}
              onChange={e => setGeography(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sök() }}
              placeholder="t.ex. Göteborg"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Från</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Till</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => sök()}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Sök
          </button>
          {harFilter && (
            <button
              onClick={nollställ}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Nollställ filter
            </button>
          )}
        </div>
      </div>

      {/* Resultat */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Söker...</div>
      )}

      {isError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          Kunde inte hämta sökresultat.{' '}
          <button onClick={() => refetch()} className="underline font-medium">Försök igen</button>
        </div>
      )}

      {data && !isLoading && !isError && (
        data.events.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-sm font-medium">Inga händelser matchade sökningen</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-3">{data.total} träffar</p>
            <div className="flex flex-col gap-2 mb-6">
              {data.events.map(e => (
                <div key={e.id} className="flex flex-col gap-1">
                  <NewsItem event={e} isRead sourceName={e.sourceName} />
                  <SparaTillAnvändare handelse={e} />
                </div>
              ))}
            </div>

            {totalSidor > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => sök(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                  Föregående
                </button>
                <span className="text-xs text-slate-400">Sida {page} av {totalSidor}</span>
                <button
                  onClick={() => sök(page + 1)}
                  disabled={page >= totalSidor}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                  Nästa
                </button>
              </div>
            )}
          </>
        )
      )}
    </div>
  )
}
