import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSearchableSources, fetchEventTypes, searchEvents, type SearchParams, type AdminSearchEvent } from '../../api/eventSearch'
import NewsItem from '../NewsFeed/NewsItem'
import { fetchAdminUsers, saveAdminUserEvent, fetchSavedEventsByEvent, type AdminUserDto } from '../../api/adminUsers'
import { createActivityLogEntry } from '../../api/activityLog'
import { useAuth } from '../../context/AuthContext'

const SIDA_STORLEK = 20

function BulkSparaKnapp({ handelser, användare, onKlar }: { handelser: AdminSearchEvent[]; användare: AdminUserDto[]; onKlar: () => void }) {
  const [öppen, setÖppen]   = useState(false)
  const [sparar, setSparar] = useState(false)
  const { aktivVy } = useAuth()

  async function spara(anvandareId: string, anvandareNamn: string) {
    setSparar(true)
    const nuIso = new Date().toISOString()
    try {
      await Promise.all(handelser.map(async h => {
        await saveAdminUserEvent(anvandareId, h.id)
        await createActivityLogEntry({
          typ:     'Sparat: tillagd',
          rubrik:  `Sparade händelse till ${anvandareNamn}`,
          detalj:  `"${h.title}" (${h.sourceName}) kopplad till ${anvandareNamn}s konto.`,
          aktivVy,
          ångraData: {
            anvandareId,
            handelse: { eventId: h.id, title: h.title, sourceName: h.sourceName, publishedAt: h.publishedAt, sparadDatum: nuIso },
            undoAction: 'ta-bort',
          },
        })
      }))
    } finally {
      setSparar(false)
    }
    setÖppen(false)
    onKlar()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setÖppen(v => !v)}
        disabled={sparar}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 transition-colors disabled:opacity-50"
      >
        {sparar ? 'Sparar…' : '👤 Spara till användare ▾'}
      </button>
      {öppen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setÖppen(false)} />
          <div className="absolute left-0 top-8 z-40 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <ul className="max-h-64 overflow-y-auto py-1">
              {användare.length === 0 ? (
                <li className="px-3 py-2 text-xs text-slate-400">Inga användare hittades</li>
              ) : användare.map(u => (
                <li key={u.id}>
                  <button
                    onClick={() => spara(u.id, u.name)}
                    disabled={sparar}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {u.name}
                    <span className="block text-xs text-slate-400">{u.email}</span>
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

interface HandelsesokProps {
  onÖppnaAnvändare?: (epost: string) => void
}

export default function Handelsesok({ onÖppnaAnvändare }: HandelsesokProps) {
  const [sourceId, setSourceId]   = useState<string>('')
  const [geography, setGeography] = useState('')
  const [eventType, setEventType] = useState('')
  const [sokord, setSokord]       = useState('')
  const [from, setFrom]           = useState('')
  const [to, setTo]               = useState('')
  const [page, setPage]           = useState(1)
  const [markerade, setMarkerade] = useState<Set<string>>(new Set())

  const [activeParams, setActiveParams] = useState<SearchParams>({ page: 1, pageSize: SIDA_STORLEK })

  const { data: adminAnvändare = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn:  fetchAdminUsers,
  })

  function toggleMarkerad(id: string) {
    setMarkerade(prev => {
      const ny = new Set(prev)
      if (ny.has(id)) ny.delete(id)
      else ny.add(id)
      return ny
    })
  }

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

  // Omvänd uppslagning: eventId → alla användare som redan har det sparat —
  // rent informativ badge, hindrar inte att samma händelse sparas till fler.
  // Skopad till händelserna på aktuell sida.
  const eventIds = data?.events.map(e => e.id) ?? []
  const { data: sparadeAvKarta = {}, refetch: refetchSparade } = useQuery({
    queryKey: ['saved-events-by-event', eventIds],
    queryFn:  () => fetchSavedEventsByEvent(eventIds),
    enabled:  eventIds.length > 0,
  })

  function sök(nyPage = 1) {
    setPage(nyPage)
    setMarkerade(new Set())
    setActiveParams({
      sourceId:  sourceId ? Number(sourceId) : undefined,
      geography: geography.trim() || undefined,
      eventType: eventType || undefined,
      sokord:    sokord.trim() || undefined,
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
    setSokord('')
    setFrom('')
    setTo('')
    setPage(1)
    setMarkerade(new Set())
    setActiveParams({ page: 1, pageSize: SIDA_STORLEK })
  }

  const harFilter = !!(activeParams.sourceId || activeParams.geography || activeParams.eventType || activeParams.sokord || activeParams.from || activeParams.to)
  const totalSidor = data ? Math.max(1, Math.ceil(data.total / SIDA_STORLEK)) : 1

  const allaPåSidanMarkerade = !!data && data.events.length > 0 && data.events.every(e => markerade.has(e.id))

  function toggleAllaPåSidan() {
    if (!data) return
    setMarkerade(prev => {
      const ny = new Set(prev)
      if (allaPåSidanMarkerade) data.events.forEach(e => ny.delete(e.id))
      else data.events.forEach(e => ny.add(e.id))
      return ny
    })
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-6">
        Sök bakåt i tiden bland alla ingestade händelser (oavsett publiceringsstatus) — sökord (titel/innehåll), källa, typ, plats och datumintervall.
        Typ-filtret kräver att källan fått sina händelsetyper extraherade (idag bara Polisen).
        Hittar du något en användare frågar om kan du spara det direkt till deras konto.
      </p>

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Sökord</label>
            <input
              type="text"
              value={sokord}
              onChange={e => setSokord(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sök() }}
              placeholder="t.ex. rattfylleri"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

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
            <div className="flex items-center gap-3 mb-3 min-h-[28px]">
              <input
                type="checkbox"
                checked={allaPåSidanMarkerade}
                onChange={toggleAllaPåSidan}
                title="Markera alla på sidan"
                className="shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-400 cursor-pointer"
              />
              {markerade.size > 0 ? (
                <>
                  <span className="text-xs font-medium text-violet-700">{markerade.size} markerade</span>
                  <BulkSparaKnapp
                    handelser={data.events.filter(e => markerade.has(e.id))}
                    användare={adminAnvändare}
                    onKlar={() => { refetchSparade(); setMarkerade(new Set()) }}
                  />
                  <button
                    onClick={() => setMarkerade(new Set())}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ✕ Avmarkera
                  </button>
                </>
              ) : (
                <p className="text-xs text-slate-400">{data.total} träffar</p>
              )}
            </div>
            <div className="flex flex-col gap-2 mb-6">
              {data.events.map(e => {
                const sparadTill = sparadeAvKarta[e.id]
                return (
                  <div key={e.id} className="flex flex-col gap-1">
                    <NewsItem
                      event={e}
                      isRead
                      sourceName={e.sourceName}
                      checkbox={{ checked: markerade.has(e.id), onChange: () => toggleMarkerad(e.id) }}
                    />
                    {sparadTill && (
                      <p className="text-xs text-slate-400 px-1">
                        📌 Sparad till{' '}
                        {sparadTill.map((u, i) => (
                          <span key={u.id}>
                            {i > 0 && ', '}
                            <button
                              onClick={() => onÖppnaAnvändare?.(u.email)}
                              className="hover:text-violet-600 hover:underline transition-colors"
                            >
                              {u.name}
                            </button>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )
              })}
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
