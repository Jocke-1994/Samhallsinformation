import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSearchableSources, searchEvents, type SearchParams } from '../../api/eventSearch'
import NewsItem from '../NewsFeed/NewsItem'

const SIDA_STORLEK = 20

export default function Handelsesok() {
  const [sourceId, setSourceId]   = useState<string>('')
  const [geography, setGeography] = useState('')
  const [from, setFrom]           = useState('')
  const [to, setTo]               = useState('')
  const [page, setPage]           = useState(1)

  const [activeParams, setActiveParams] = useState<SearchParams>({ page: 1, pageSize: SIDA_STORLEK })

  const { data: sources } = useQuery({
    queryKey: ['admin-event-search-sources'],
    queryFn:  fetchSearchableSources,
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
      from:      from || undefined,
      to:        to || undefined,
      page:      nyPage,
      pageSize:  SIDA_STORLEK,
    })
  }

  function nollställ() {
    setSourceId('')
    setGeography('')
    setFrom('')
    setTo('')
    setPage(1)
    setActiveParams({ page: 1, pageSize: SIDA_STORLEK })
  }

  const harFilter = !!(activeParams.sourceId || activeParams.geography || activeParams.from || activeParams.to)
  const totalSidor = data ? Math.max(1, Math.ceil(data.total / SIDA_STORLEK)) : 1

  return (
    <div>
      <p className="text-sm text-slate-500 mb-6">
        Sök bakåt i tiden bland alla ingestade händelser (oavsett publiceringsstatus) — källa, plats och datumintervall.
        Fristående verktyg, inte kopplat till en specifik användares sparade lista.
      </p>

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Källa</label>
            <select
              value={sourceId}
              onChange={e => setSourceId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="">Alla källor</option>
              {sources?.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
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
                <NewsItem key={e.id} event={e} isRead sourceName={e.sourceName} />
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
