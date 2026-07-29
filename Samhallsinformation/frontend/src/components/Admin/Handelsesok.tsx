import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSearchableSources, fetchEventTypes, searchEvents, type SearchParams, type AdminSearchEvent } from '../../api/eventSearch'
import NewsItem from '../NewsFeed/NewsItem'
import { MOCK_ANVÄNDARE_LISTA } from '../../lib/mockAnvandare'
import { laddaSparadeHandelser, sparaHandelseForAnvandare, type SparadHandelseMini } from '../../lib/sparadeHandelserStorage'
import { läggTillLoggpost } from '../../lib/aktivitetsloggStorage'
import { useAuth } from '../../context/AuthContext'

const SIDA_STORLEK = 20

// Mockad inloggad admin/support-identitet — samma placeholder som resten av
// admin-panelen (SupportInbox.INLOGGAD_AGENT, AdminPage-avataren)
const INLOGGAD_NAMN = 'Joakim Rehn'

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

function BulkSparaKnapp({ handelser, onKlar }: { handelser: AdminSearchEvent[]; onKlar: () => void }) {
  const [öppen, setÖppen] = useState(false)
  const { aktivVy } = useAuth()

  function spara(anvandareId: number, anvandareNamn: string) {
    const nuIso = new Date().toISOString()
    const nu    = formatDatum(nuIso)
    for (const h of handelser) {
      const handelse: SparadHandelseMini = {
        eventId:     h.id,
        title:       h.title,
        sourceName:  h.sourceName,
        publishedAt: h.publishedAt,
        sparadDatum: nu,
      }
      sparaHandelseForAnvandare(anvandareId, handelse)
      läggTillLoggpost({
        tid:    nuIso,
        vem:    `${INLOGGAD_NAMN} (${aktivVy}-läge)`,
        typ:    'Sparat: tillagd',
        rubrik: `Sparade händelse till ${anvandareNamn}`,
        detalj: `"${h.title}" (${h.sourceName}) kopplad till ${anvandareNamn}s konto.`,
        ångraData: { anvandareId, handelse, undoAction: 'ta-bort' },
      })
    }
    setÖppen(false)
    onKlar()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setÖppen(v => !v)}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 transition-colors"
      >
        👤 Spara till användare ▾
      </button>
      {öppen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setÖppen(false)} />
          <div className="absolute left-0 top-8 z-40 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
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
  const [markerade, setMarkerade] = useState<Set<string>>(new Set())
  const [sparade, setSparade]     = useState<Record<number, SparadHandelseMini[]>>(laddaSparadeHandelser)

  const [activeParams, setActiveParams] = useState<SearchParams>({ page: 1, pageSize: SIDA_STORLEK })

  // Omvänd karta: eventId → namn på alla användare som redan har det sparat —
  // rent informativ badge, hindrar inte att samma händelse sparas till fler
  const sparadeAvKarta = useMemo(() => {
    const karta: Record<string, string[]> = {}
    for (const [anvandareIdStr, lista] of Object.entries(sparade)) {
      const användare = MOCK_ANVÄNDARE_LISTA.find(u => u.id === Number(anvandareIdStr))
      if (!användare) continue
      for (const h of lista) {
        (karta[h.eventId] ??= []).push(användare.namn)
      }
    }
    return karta
  }, [sparade])

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

  function sök(nyPage = 1) {
    setPage(nyPage)
    setMarkerade(new Set())
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
    setMarkerade(new Set())
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
            <div className="flex items-center gap-3 mb-3 min-h-[28px]">
              {markerade.size > 0 ? (
                <>
                  <span className="text-xs font-medium text-violet-700">{markerade.size} markerade</span>
                  <BulkSparaKnapp
                    handelser={data.events.filter(e => markerade.has(e.id))}
                    onKlar={() => { setSparade(laddaSparadeHandelser()); setMarkerade(new Set()) }}
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
                  <div key={e.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={markerade.has(e.id)}
                      onChange={() => toggleMarkerad(e.id)}
                      className="mt-4 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-400 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <NewsItem event={e} isRead sourceName={e.sourceName} />
                      {sparadTill && (
                        <p className="text-xs text-slate-400 px-1">📌 Sparad till {sparadTill.join(', ')}</p>
                      )}
                    </div>
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
