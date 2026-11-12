import { Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { fetchEvent, fetchEvents } from '../../api/events'
import { getReadStatus, markAllAsRead } from '../../services/readState'
import NewsItem from './NewsItem'
import type { CanonicalEvent, Source } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { useSavedEvents } from '../../context/SavedEventsContext'
import MobilTopBar from '../common/MobilTopBar'
import { ALLA_HANDELSER_LABEL, MITT_FLODE_LABEL } from '../../lib/navLabels'
import { useMittFlode, useSparatFlode, type ServerFlode } from '../../hooks/useServerFlode'
import { useFlags } from '../../context/FeatureFlagsContext'
import Platsfilter from './Platsfilter'

type ViewMode = 'Allt' | 'Mitt'
type MittUnderflik = 'Flöde' | 'Sparat'
type SeverityFilter = 'Alla' | 'Kritisk' | 'Viktigt' | 'Bra att veta'

const FILTER_STYLES: Record<
  SeverityFilter,
  { active: string; activeBadge: string; inactiveBadge: string }
> = {
  Alla: {
    active: 'bg-violet-100 text-violet-700 border-violet-200',
    activeBadge: 'bg-violet-200 text-violet-700',
    inactiveBadge: 'bg-slate-100 text-slate-500',
  },
  Kritisk: {
    active: 'bg-red-100 text-red-700 border-red-200',
    activeBadge: 'bg-red-200 text-red-700',
    inactiveBadge: 'bg-slate-100 text-slate-500',
  },
  Viktigt: {
    active: 'bg-amber-100 text-amber-700 border-amber-200',
    activeBadge: 'bg-amber-200 text-amber-700',
    inactiveBadge: 'bg-slate-100 text-slate-500',
  },
  'Bra att veta': {
    active: 'bg-sky-100 text-sky-700 border-sky-200',
    activeBadge: 'bg-sky-200 text-sky-700',
    inactiveBadge: 'bg-slate-100 text-slate-500',
  },
}

const EMPTY_STATE_TEXT: Partial<Record<SeverityFilter, string>> = {
  Kritisk: 'Inga kritiska händelser just nu',
  Viktigt: 'Inga viktiga händelser just nu',
  'Bra att veta': 'Inga informationshändelser just nu',
}

function toDateKey(iso: string): string {
  return new Date(iso).toDateString()
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const dateStr = date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
  if (date.toDateString() === now.toDateString()) return `Idag ${dateStr}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `Igår ${dateStr}`
  return dateStr
}

function OkantListaMeddelande({ text, onForsokIgen }: { text: string; onForsokIgen: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-6 px-4 text-center">
      <p className="text-slate-600 dark:text-slate-300 text-sm">{text}</p>
      <button
        onClick={onForsokIgen}
        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Försök igen
      </button>
    </div>
  )
}

function LaddaFler({ flode }: { flode: ServerFlode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      {flode.merFel && (
        <p role="alert" className="text-slate-500 text-sm">
          Vi kunde inte hämta fler händelser just nu.
        </p>
      )}
      <button
        onClick={flode.hamtaFler}
        disabled={flode.hamtarFler}
        className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-violet-200 text-violet-600 hover:bg-violet-50 dark:hover:bg-slate-700 disabled:opacity-60 text-sm font-semibold rounded-xl transition-colors"
      >
        {flode.hamtarFler ? 'Hämtar...' : flode.merFel ? 'Försök igen' : 'Ladda fler'}
      </button>
    </div>
  )
}

interface Props {
  shortName: string | null
  sources: Source[]
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onOpenSidebar: () => void
  /** Push-djuplänk (/?handelse=<id>): händelsen scrollas fram, fälls ut och markeras. */
  markeradHandelseId?: string | null
}

export default function NewsFeed({
  shortName,
  sources,
  viewMode,
  onViewModeChange,
  onOpenSidebar,
  markeradHandelseId = null,
}: Props) {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const flaggor = useFlags()
  const { sparade, lage: sparadeIdLage } = useSavedEvents()
  // "Prova själv"-länkar (lib/provaSjalv.ts) öppnar en bestämd flik via adressen:
  // /?vy=plats → Filtrera på plats, /?vy=sparat → Mitt flöde → Sparat. Gäller vid
  // varje navigering dit (location.key) — Vad är nytt-rutan ligger ovanpå flödet,
  // så flödet är redan monterat när länken klickas. Däremellan byter användaren fritt.
  const [searchParams] = useSearchParams()
  const { key: navigeringsnyckel } = useLocation()
  const startvy = searchParams.get('vy')
  const [mittUnderflik, setMittUnderflik] = useState<MittUnderflik>(
    startvy === 'sparat' ? 'Sparat' : 'Flöde',
  )

  // "Alla"-flödet: en sida (50 senaste) av allas händelser, oförändrat. Mitt flöde
  // och Sparat hämtas i stället filtrerade på servern (V3-11) — ingen klientfiltrering.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['events', shortName ?? 'all'],
    queryFn: () => fetchEvents({ shortName: shortName ?? undefined, pageSize: 50 }),
    enabled: viewMode === 'Allt',
  })

  const mittFlode = useMittFlode(isLoggedIn && viewMode === 'Mitt' && mittUnderflik === 'Flöde')
  const sparatFlode = useSparatFlode(
    isLoggedIn && viewMode === 'Mitt' && mittUnderflik === 'Sparat',
  )

  const events: CanonicalEvent[] = useMemo(() => data?.events ?? [], [data])

  // Push-djuplänk: finns händelsen inte bland de 50 som hämtats (äldre, eller
  // flödet hann fyllas på) hämtas den separat och visas överst.
  const markeradIListan = !!markeradHandelseId && events.some((e) => e.id === markeradHandelseId)
  const { data: markeradSeparat } = useQuery({
    queryKey: ['event', markeradHandelseId],
    queryFn: () => fetchEvent(markeradHandelseId!),
    enabled: !!markeradHandelseId && viewMode === 'Allt' && !!data && !markeradIListan,
  })

  const [readMap, setReadMap] = useState<Record<string, boolean>>({})
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('Alla')
  // Platsfiltret (beslut 10) är en egen, fristående vy — inte AND-kombinerad
  // med allvarlighetsfiltret. Bara meningsfullt mot det delade 50-händelser-
  // fönstret (beslut 6), inte en enskild källas flöde.
  const [flodevy, setFlodevy] = useState<'handelser' | 'plats'>(
    startvy === 'plats' ? 'plats' : 'handelser',
  )

  // Nollställ bara vid ett faktiskt källbyte — inte vid start, då skulle
  // /?vy=plats direkt skrivas över. Jämför värdet i stället för "första
  // körningen", så att StrictModes dubbla effektkörning inte nollställer ändå.
  const föregåendeKälla = useRef(shortName)
  useEffect(() => {
    if (föregåendeKälla.current === shortName) return
    föregåendeKälla.current = shortName
    setSeverityFilter('Alla')
    setFlodevy('handelser')
  }, [shortName])

  useEffect(() => {
    if (startvy === 'plats') setFlodevy('plats')
    if (startvy === 'sparat') setMittUnderflik('Sparat')
  }, [startvy, navigeringsnyckel])

  const sourceMap = useMemo(
    () => Object.fromEntries(sources.map((s) => [s.id, s.shortName])),
    [sources],
  )

  const sortedEvents = useMemo(() => {
    if (shortName !== null) return events
    return [...events].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
  }, [events, shortName])

  function handleMarkAllRead() {
    const ids = basEvents.map((e) => e.id)
    markAllAsRead(ids)
    setReadMap(Object.fromEntries(ids.map((id) => [id, true])))
  }

  const filteredEvents = useMemo(
    () =>
      severityFilter === 'Alla'
        ? sortedEvents
        : sortedEvents.filter((e) => e.severity === severityFilter),
    [sortedEvents, severityFilter],
  )

  // Mitt flöde: servern har redan filtrerat på dina aktiva källor och på dina
  // Polisen-bevakningar (samma matchning som push) och sorterat nyast först.
  const mittEvents = mittFlode.events

  // Sparat: servern returnerar dina sparade händelser oavsett ålder. En händelse
  // du just tagit bort (bokmärket) försvinner direkt ur listan, utan omhämtning.
  const sparadeEvents = useMemo(
    () =>
      sparadeIdLage === 'klar'
        ? sparatFlode.events.filter((e) => sparade.has(e.id))
        : sparatFlode.events,
    [sparatFlode.events, sparade, sparadeIdLage],
  )

  const visaEvents =
    viewMode === 'Allt' ? filteredEvents : mittUnderflik === 'Sparat' ? sparadeEvents : mittEvents

  // Olästa och "markera alla som lästa" gäller den lista som visas: i Alla-läget hela
  // hämtade fönstret (som förut), i Mitt flöde/Sparat de händelser som visas.
  const basEvents = viewMode === 'Allt' ? sortedEvents : visaEvents
  const hasUnread = basEvents.some((e) => !readMap[e.id])

  useEffect(() => {
    if (basEvents.length > 0) setReadMap(getReadStatus(basEvents.map((e) => e.id)))
  }, [basEvents])

  const severityCounts = useMemo(
    () => ({
      Kritisk: sortedEvents.filter((e) => e.severity === 'Kritisk').length,
      Viktigt: sortedEvents.filter((e) => e.severity === 'Viktigt').length,
      'Bra att veta': sortedEvents.filter((e) => e.severity === 'Bra att veta').length,
    }),
    [sortedEvents],
  )

  const showFilters = sortedEvents.length > 0

  const title = shortName ?? (viewMode === 'Mitt' ? MITT_FLODE_LABEL : ALLA_HANDELSER_LABEL)

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
        Hämtar nyheter...
      </div>
    )
  if (isError)
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
        Just nu har vi tekniska problem, vi jobbar för att åtgärda detta.
      </div>
    )

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <MobilTopBar onOpenSidebar={onOpenSidebar} />

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-10 py-5 md:py-10 shrink-0 relative">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white text-center">
          {title}
        </h1>
        {flaggor.flode_olasta_badge && isLoggedIn && hasUnread && (
          <div className="absolute right-4 md:right-10 top-1/2 -translate-y-1/2 flex items-center gap-3">
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full hover:bg-violet-100 transition-colors"
            >
              {visaEvents.filter((e) => !readMap[e.id]).length} olästa
            </button>
            <button
              onClick={handleMarkAllRead}
              className="hidden md:block text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              Markera alla som lästa
            </button>
          </div>
        )}
      </div>

      {/* Flöde / Sparat — bara i Mitt flöde */}
      {flaggor.flode_sparat && viewMode === 'Mitt' && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-10 py-2.5 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-1 w-fit">
            {(['Flöde', 'Sparat'] as MittUnderflik[]).map((f) => (
              <button
                key={f}
                onClick={() => setMittUnderflik(f)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors ${
                  mittUnderflik === f
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Platsfilter — egen, fristående vy (beslut 10), bara meningsfull mot
          det delade "Alla källor"-fönstret, inte en enskild källas flöde. */}
      {flaggor.flode_platsfilter && viewMode === 'Allt' && shortName === null && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-10 py-2.5 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-1 w-fit">
            {[
              { key: 'handelser' as const, label: 'Senaste nytt' },
              { key: 'plats' as const, label: '📍 Filtrera på plats' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFlodevy(f.key)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors ${
                  flodevy === f.key
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter — visas alltid när det finns händelser, även allvarlighetsgrader med 0 träffar */}
      {showFilters && viewMode === 'Allt' && flodevy === 'handelser' && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-10 shrink-0">
          <div className="max-w-3xl mx-auto flex gap-1.5">
            {(['Alla', 'Kritisk', 'Viktigt', 'Bra att veta'] as SeverityFilter[]).map((f) => {
              const count = f === 'Alla' ? sortedEvents.length : severityCounts[f]
              const isActive = severityFilter === f
              const s = FILTER_STYLES[f]
              return (
                <button
                  key={f}
                  onClick={() => setSeverityFilter(f)}
                  style={{ marginBottom: '-1px' }}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-t-lg border transition-colors ${
                    isActive
                      ? s.active
                      : 'bg-white dark:bg-slate-800 text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  {f}
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                      isActive ? s.activeBadge : s.inactiveBadge
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Händelselista */}
      <div className="flex-1 overflow-y-auto px-4 md:px-10 py-4 md:py-6">
        {viewMode === 'Allt' && flodevy === 'plats' ? (
          <Platsfilter sources={sources} />
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-1.5">
            {viewMode === 'Allt' && sortedEvents.length === 0 && (
              <p className="text-slate-400 text-sm py-6 text-center">Inga händelser hittades.</p>
            )}

            {viewMode === 'Allt' && sortedEvents.length > 0 && filteredEvents.length === 0 && (
              <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
                <span className="text-3xl">✓</span>
                <p className="text-sm">
                  {EMPTY_STATE_TEXT[severityFilter] ?? 'Inga händelser hittades'}
                </p>
              </div>
            )}

            {/* Mitt flöde hämtas från servern. Fel är aldrig "tomt": vi säger bara att inget
              matchar när servern faktiskt svarat med en tom lista. */}
            {viewMode === 'Mitt' && mittUnderflik === 'Flöde' && mittFlode.lage === 'fel' && (
              <OkantListaMeddelande
                text="Vi kunde inte hämta ditt flöde just nu."
                onForsokIgen={mittFlode.forsokIgen}
              />
            )}
            {viewMode === 'Mitt' && mittUnderflik === 'Flöde' && mittFlode.lage === 'laddar' && (
              <p className="text-slate-400 text-sm py-6 text-center">Hämtar ditt flöde...</p>
            )}

            {viewMode === 'Mitt' &&
              mittUnderflik === 'Flöde' &&
              mittFlode.lage === 'klar' &&
              mittEvents.length === 0 && (
                <div className="flex flex-col items-center py-20 gap-4 text-center">
                  <span className="text-4xl">🗂️</span>
                  <p className="text-slate-700 dark:text-slate-200 font-semibold text-base">
                    Inget matchar dina prenumerationer just nu
                  </p>
                  <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                    Lägg till fler källor, typer eller områden i Mina källor — eller prenumerera
                    direkt via klockan på en händelse i {ALLA_HANDELSER_LABEL}.
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      onClick={() => onViewModeChange('Allt')}
                      className="px-4 py-2 bg-white border border-violet-200 text-violet-600 hover:bg-violet-50 text-sm font-semibold rounded-xl transition-colors"
                    >
                      Visa {ALLA_HANDELSER_LABEL}
                    </button>
                    <button
                      onClick={() => navigate('/profil?section=mina-kallor')}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      Gå till Mina källor
                    </button>
                  </div>
                </div>
              )}

            {viewMode === 'Mitt' && mittUnderflik === 'Sparat' && sparatFlode.lage === 'fel' && (
              <OkantListaMeddelande
                text="Vi kunde inte hämta dina sparade händelser just nu."
                onForsokIgen={sparatFlode.forsokIgen}
              />
            )}
            {viewMode === 'Mitt' && mittUnderflik === 'Sparat' && sparatFlode.lage === 'laddar' && (
              <p className="text-slate-400 text-sm py-6 text-center">
                Hämtar dina sparade händelser...
              </p>
            )}

            {viewMode === 'Mitt' &&
              mittUnderflik === 'Sparat' &&
              sparatFlode.lage === 'klar' &&
              sparadeEvents.length === 0 && (
                <div className="flex flex-col items-center py-20 gap-4 text-center">
                  <span className="text-4xl">📑</span>
                  <p className="text-slate-700 dark:text-slate-200 font-semibold text-base">
                    Inget sparat än
                  </p>
                  <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                    Klicka på bokmärkes-ikonen på en händelse för att spara den och hitta den igen
                    här senare.
                  </p>
                </div>
              )}

            {viewMode === 'Allt' && markeradSeparat && !markeradIListan && (
              <div className="flex flex-col gap-1.5 mb-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Från din notis
                </p>
                <NewsItem
                  event={markeradSeparat}
                  isRead={!!readMap[markeradSeparat.id]}
                  sourceName={shortName === null ? sourceMap[markeradSeparat.sourceId] : undefined}
                  sourceShortName={sourceMap[markeradSeparat.sourceId]}
                  markerad
                />
              </div>
            )}

            {(() => {
              let readSepShown = false
              return visaEvents.map((event, i) => {
                const prev = visaEvents[i - 1]
                const dateChanged =
                  !prev || toDateKey(event.publishedAt) !== toDateKey(prev.publishedAt)
                const readTransition =
                  isLoggedIn && !!prev && !readMap[prev.id] && !!readMap[event.id]
                const showReadSep = readTransition && !dateChanged && !readSepShown
                if (showReadSep) readSepShown = true

                return (
                  <Fragment key={event.id}>
                    {showReadSep && (
                      <div className="flex items-center gap-2 py-1">
                        <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
                        <span className="text-xs text-slate-300 dark:text-slate-600">lästa</span>
                        <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
                      </div>
                    )}
                    {dateChanged && (
                      <div className="flex items-center gap-2 py-1">
                        <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                          {formatDateLabel(event.publishedAt)}
                        </span>
                        <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
                      </div>
                    )}
                    <NewsItem
                      event={event}
                      isRead={!!readMap[event.id]}
                      sourceName={shortName === null ? sourceMap[event.sourceId] : undefined}
                      sourceShortName={sourceMap[event.sourceId]}
                      viewMode={viewMode === 'Allt' ? 'allt' : 'mitt'}
                      markerad={viewMode === 'Allt' && event.id === markeradHandelseId}
                    />
                  </Fragment>
                )
              })
            })()}

            {viewMode === 'Mitt' &&
              (mittUnderflik === 'Sparat' ? sparatFlode : mittFlode).harFler && (
                <LaddaFler flode={mittUnderflik === 'Sparat' ? sparatFlode : mittFlode} />
              )}
          </div>
        )}
      </div>
    </div>
  )
}
