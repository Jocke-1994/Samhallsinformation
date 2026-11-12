import { useEffect, useRef, useState } from 'react'
import type { CanonicalEvent } from '../../types'
import { markAsRead } from '../../services/readState'
import { extraheraPolisenTyp, extraheraPolisenOmrade } from '../Profile/MinaKallor/kallorUtils'
import PrenumerationsKlocka from './PrenumerationsKlocka'
import { useAuth } from '../../context/AuthContext'
import { useSavedEvents } from '../../context/SavedEventsContext'
import { useFlags } from '../../context/FeatureFlagsContext'
import { checkEventLinkStatus, logEventShare } from '../../api/events'

interface Props {
  event: CanonicalEvent
  isRead: boolean
  sourceName?: string
  sourceShortName?: string
  viewMode?: 'allt' | 'mitt'
  checkbox?: { checked: boolean; onChange: () => void }
  /** Öppnad via en push-djuplänk: visas utfälld, scrollas fram och får en ram. */
  markerad?: boolean
}

const SEVERITY_CONFIG = {
  Kritisk: {
    pill: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    severityBorder: 'border-l-red-500',
  },
  Viktigt: {
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    severityBorder: 'border-l-amber-400',
  },
  'Bra att veta': {
    pill: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    severityBorder: 'border-l-sky-300',
  },
}

const SOURCE_BORDER: Record<number, string> = {
  1: 'border-l-blue-500',
  5: 'border-l-orange-400',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

const contentP = 'text-sm text-slate-600 dark:text-slate-300 leading-relaxed'

function ContentParagraph({ text }: { text: string }) {
  const labelEnd = text.indexOf(': ')
  if (labelEnd === -1) return <p className={contentP}>{text}</p>

  return (
    <p className={contentP}>
      <strong className="font-semibold text-slate-900 dark:text-white">
        {text.slice(0, labelEnd + 1)}
      </strong>
      {text.slice(labelEnd + 1)}
    </p>
  )
}

function EventContent({ content }: { content: string }) {
  const paragraphs = content.split('\n\n')
  if (paragraphs.length === 1) return <p className={contentP}>{content}</p>

  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => (
        <ContentParagraph key={i} text={p} />
      ))}
    </div>
  )
}

export default function NewsItem({
  event,
  isRead,
  sourceName,
  sourceShortName,
  viewMode = 'allt',
  checkbox,
  markerad = false,
}: Props) {
  const { isLoggedIn } = useAuth()
  const flaggor = useFlags()
  const { sparade, lage: sparatLage, toggleSparad } = useSavedEvents()
  const [expanded, setExpanded] = useState(markerad)
  const rotRef = useRef<HTMLDivElement>(null)

  // Push-djuplänken: scrolla fram händelsen och räkna den som läst, en gång
  // när den blir markerad (inte vid varje omrendering).
  useEffect(() => {
    if (!markerad) return
    setExpanded(true)
    markAsRead(event.id)
    rotRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [markerad, event.id])
  const [länkDöd, setLänkDöd] = useState(false)
  const [delaFeedback, setDelaFeedback] = useState<string | null>(null)
  const ärSparad = sparade.has(event.id)
  const cfg = SEVERITY_CONFIG[event.severity]

  const borderClass = sourceName
    ? (SOURCE_BORDER[event.sourceId] ?? 'border-l-slate-300')
    : cfg.severityBorder

  const showGeography =
    !!event.geography && !event.title.toLowerCase().includes(event.geography.toLowerCase())

  const ärPolisen = isLoggedIn && sourceShortName === 'Polisen'
  const polisenTyp = ärPolisen ? extraheraPolisenTyp(event.eventType) : null
  const polisenOmrade = ärPolisen ? extraheraPolisenOmrade(event.geography) : null

  function handleToggle() {
    if (!isRead) markAsRead(event.id)
    setExpanded((prev) => !prev)
  }

  // Själva länken är en vanlig <a target="_blank"> och öppnas av webbläsaren
  // synkront i klickhändelsen — ingen await före, så iOS/PWA aldrig blockerar
  // den som popup och en misslyckad förkoll aldrig kan hindra någon från att
  // nå källan. Länkkollen körs i bakgrunden EFTER klicket (ingen
  // bakgrundsbevakning av länkar, bara vid faktiskt klick) och får bara
  // påverka UI:t vid ett entydigt 'dead' (404/410 hos källan). Allt annat —
  // 'alive', 'unknown', nätverksfel — lämnar knappen som den är.
  function handleLäsMer() {
    checkEventLinkStatus(event.id)
      .then((status) => {
        if (status === 'dead') setLänkDöd(true)
      })
      .catch(() => {
        /* kollen är bara en bonus — ett fel ska aldrig synas eller störa */
      })
  }

  // Delar alltid källänken (inte vår egen sida) — grundprincipen om
  // källkrav/transparens (CLAUDE.md) gäller lika mycket här. Loggas oavsett
  // om delningen faktiskt fullföljs — ett klick på Dela är signalen vi vill
  // mäta, inte om OS-menyn stängdes utan val. navigator.share() ger samma
  // sorts delningsmeny som t.ex. Instagram (kontakter/appar installerade på
  // ENHETEN, inte något vi bygger kanal för kanal) — stöds brett på mobil,
  // inte tillförlitligt på desktop, där vi istället kopierar länken direkt.
  async function handleDela(e: React.MouseEvent) {
    e.stopPropagation()
    logEventShare(event.id)

    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, url: event.url })
      } catch {
        // Avbruten/nekad delning (AbortError) — inget att visa användaren för
      }
      return
    }

    try {
      await navigator.clipboard.writeText(event.url)
      setDelaFeedback('Länk kopierad!')
      setTimeout(() => setDelaFeedback(null), 2000)
    } catch {
      // Urklipp kan nekas av webbläsaren — inget bra att göra åt det här
    }
  }

  return (
    <div
      ref={rotRef}
      data-markerad={markerad || undefined}
      className={`rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 ${borderClass} bg-white dark:bg-slate-800 shadow-sm overflow-hidden ${markerad ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900' : ''}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleToggle()
        }}
        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
      >
        {/* Rad 1: severity + titel får hela bredden, ingen konkurrens om plats */}
        <div className="flex items-center gap-2.5">
          {checkbox && (
            <input
              type="checkbox"
              checked={checkbox.checked}
              onClick={(e) => e.stopPropagation()}
              onChange={checkbox.onChange}
              className="shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-400 cursor-pointer"
            />
          )}

          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.pill}`}>
            {event.severity}
          </span>

          <p className="flex-1 min-w-0 text-sm font-medium text-slate-900 dark:text-white leading-snug">
            {event.title}
          </p>

          <span
            className={`text-slate-300 text-xs shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            ▾
          </span>
        </div>

        {/* Rad 2: källa, plats, tid och åtgärdsknappar — egen rad så de aldrig
            tränger undan titeln (upptäckt via en lång källa + lång titel som
            fick titeln att radbrytas till ett ord per rad) */}
        <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-400 dark:text-slate-500">
          {sourceName && <span className="shrink-0">{sourceName}</span>}

          {showGeography && (
            <span className="shrink-0 text-slate-500 dark:text-slate-400">
              📍 {event.geography}
            </span>
          )}

          <span className="shrink-0">{formatTime(event.publishedAt)}</span>

          {flaggor.kallor_polisen_filter && (polisenTyp || polisenOmrade) && (
            <div onClick={(e) => e.stopPropagation()}>
              <PrenumerationsKlocka
                polisenTyp={polisenTyp}
                polisenOmrade={polisenOmrade}
                mode={viewMode}
              />
            </div>
          )}

          {flaggor.flode_sparat && isLoggedIn && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleSparad(event.id)
              }}
              // Listan över sparade är okänd (hämtas/misslyckades): ikonen kan
              // inte visa sanningen och ett tryck vore en gissning.
              disabled={sparatLage !== 'klar'}
              title={
                sparatLage !== 'klar'
                  ? 'Dina sparade händelser är inte hämtade just nu'
                  : ärSparad
                    ? 'Ta bort från Sparat'
                    : 'Spara den här händelsen'
              }
              aria-label={ärSparad ? 'Ta bort från Sparat' : 'Spara'}
              className={`p-1.5 -my-1.5 rounded-full shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                ärSparad
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-slate-300 hover:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              <span className="text-base leading-none">{ärSparad ? '🔖' : '📑'}</span>
            </button>
          )}

          {flaggor.flode_dela && (
            <button
              onClick={handleDela}
              title="Dela källänken"
              aria-label="Dela"
              className="p-1.5 -my-1.5 rounded-full shrink-0 text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 transition-colors"
            >
              <span className="text-base leading-none">🔗</span>
            </button>
          )}

          {delaFeedback && (
            <span className="shrink-0 text-violet-600 dark:text-violet-400 font-medium">
              {delaFeedback}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <EventContent content={event.content} />
          {länkDöd && (
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              ⚠️ Originalsidan finns inte längre hos {sourceName ?? 'källan'} — sammandraget ovan är
              vad vi sparade.
            </p>
          )}
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLäsMer}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-500 transition-colors"
          >
            {event.url.includes('trafikinformation')
              ? 'Se trafikläget hos Trafikverket'
              : 'Läs mer hos källan'}{' '}
            →
          </a>
        </div>
      )}
    </div>
  )
}
