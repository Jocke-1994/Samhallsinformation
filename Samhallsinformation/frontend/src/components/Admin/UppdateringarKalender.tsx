import { useMemo, useState } from 'react'
import type { Uppdatering } from '../../api/uppdateringar'
import type { FaqItem } from '../../api/faq'
import {
  byggKalenderEntries, byggMånadsCeller, sammaDag, visningsMålgrupp, pushGällerFör,
  KALENDER_STIL, type KalenderEntry, type KalenderFas,
} from '../../lib/uppdateringKalender'

// Kalendervy i Uppdateringar — UI-struktur enligt skissen (artifact UJL6oXzVJUC6qcCVvBUgJZ,
// beslut 2026-10-18): Lista/Kalender-flikar, Månadsvy/Agenda-växling, en
// detaljpanel per post med två flikar. Skissens tredje flik ("Historik" med
// en hel Brainstorm→Triage→Bygger→Testar-pipeline) byggs INTE som skissad —
// den datan finns inte lagrad på Uppdatering-posten. Historik här visar bara
// riktiga, sparade tidpunkter (Skapad/Annonsering/Lansering/Publicerad).

function formatDag(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatDagKort(d: Date): string {
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

interface HistorikSteg {
  label: string
  datumLabel: string
  state: 'done' | 'current'
  pointer: boolean
}

function byggHistorik(u: Uppdatering, aktivFas: KalenderFas): HistorikSteg[] {
  const nu = new Date()
  const steg: HistorikSteg[] = [
    { label: '📝 Skapad', datumLabel: formatDag(u.createdAt), state: 'done', pointer: false },
  ]
  if (u.annonseringUtc) {
    const varit = new Date(u.annonseringUtc) <= nu
    steg.push({ label: '📣 Annonsering', datumLabel: formatDag(u.annonseringUtc), state: varit ? 'done' : 'current', pointer: aktivFas === 'Annonsering' })
  }
  if (u.publicerad && !u.schemalagdPubliceringUtc) {
    steg.push({ label: '✅ Publicerad', datumLabel: formatDag(u.datum), state: 'done', pointer: aktivFas === 'Publicerad' })
  } else if (u.schemalagdPubliceringUtc) {
    steg.push({ label: '🚀 Lansering', datumLabel: formatDag(u.schemalagdPubliceringUtc), state: 'current', pointer: aktivFas === 'Lansering' })
  }
  return steg
}

function Badge({ entry }: { entry: KalenderEntry }) {
  const stil = KALENDER_STIL[entry.kind]
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${stil.bg} ${stil.fg}`}>
      {entry.icon} {entry.fas}
    </span>
  )
}

function Legend() {
  return (
    <div className="flex gap-4 flex-wrap text-xs text-slate-500 items-center">
      {(Object.values(KALENDER_STIL)).map(s => (
        <span key={s.label} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delad detaljpanel (Innehåll / Historik) — används av både Månadsvy och Agenda
// ---------------------------------------------------------------------------

function DetaljPanel({ entry, faqItems, onRedigera }: {
  entry: KalenderEntry
  faqItems: FaqItem[]
  onRedigera: (u: Uppdatering) => void
}) {
  const [flik, setFlik] = useState<'innehall' | 'historik'>('innehall')
  const u = entry.uppdatering
  const kopplatFaq = faqItems.filter(f => f.flagKey && u.schemalagdaFlaggor.includes(f.flagKey))
  const förstaText = u.punkter[0]?.text ?? null
  const historik = useMemo(() => byggHistorik(u, entry.fas), [u, entry.fas])

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Badge entry={entry} />
        <p className="text-[15px] font-bold text-slate-800 mt-2">{u.titel}</p>
        {förstaText && <p className="text-xs text-slate-500 mt-1 line-clamp-3">{förstaText}</p>}
      </div>

      <div className="flex gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
        {([['innehall', 'Innehåll'], ['historik', 'Historik']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFlik(v)}
            className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors ${
              flik === v ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {flik === 'innehall' && (
        <div className="flex flex-col gap-1.5 text-xs text-slate-600">
          <span>👁 Syns för: <strong>{visningsMålgrupp(u)}</strong></span>
          {u.schemalagdaFlaggor.length > 0 && (
            <span>🚩 {u.schemalagdaFlaggor.length} flagg{u.schemalagdaFlaggor.length === 1 ? 'a' : 'or'} aktiveras vid lansering</span>
          )}
          {kopplatFaq.length > 0 && (
            <span>❓ {kopplatFaq.length} FAQ-{kopplatFaq.length === 1 ? 'fråga' : 'frågor'} kopplade</span>
          )}
          {pushGällerFör(u, entry.fas) && (
            <span>🔔 Push {entry.fas === 'Publicerad' ? 'skickades' : 'skickas'} till inloggade</span>
          )}
          {u.visaBanderoll && (
            <span>📢 Banderoll {entry.fas === 'Publicerad' ? 'visades' : 'visas'} på sajten</span>
          )}
          {u.schemalagdaFlaggor.length === 0 && kopplatFaq.length === 0 && !pushGällerFör(u, entry.fas) && !u.visaBanderoll && (
            <span className="text-slate-400">Ingen push, banderoll eller flaggkoppling.</span>
          )}
        </div>
      )}

      {flik === 'historik' && (
        <div className="flex flex-col gap-1.5">
          {historik.map((s, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5 ${
                s.state === 'done' ? 'bg-green-600 text-white' : 'bg-violet-600 text-white'
              }`}>
                {s.state === 'done' ? '✓' : ''}
              </div>
              <div className="flex-1 flex flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-xs ${s.state === 'done' ? 'text-slate-700 font-medium' : 'text-violet-700 font-bold'}`}>{s.label}</span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{s.datumLabel}</span>
                </div>
                {s.pointer && <span className="text-[10.5px] font-bold text-violet-600">👈 den här kalenderdagen</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => onRedigera(u)}
        className="mt-1 text-xs font-semibold px-3 py-2 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors text-left"
      >
        ✏️ Redigera uppdateringen
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Månadsvy
// ---------------------------------------------------------------------------

function Månadsvy({ entries, faqItems, onRedigera }: {
  entries: KalenderEntry[]
  faqItems: FaqItem[]
  onRedigera: (u: Uppdatering) => void
}) {
  const nu = new Date()
  const [vyÅr, setVyÅr] = useState(nu.getFullYear())
  const [vyMånad, setVyMånad] = useState(nu.getMonth())
  const [valdDatum, setValdDatum] = useState<Date | null>(null)

  const celler = useMemo(() => byggMånadsCeller(vyÅr, vyMånad), [vyÅr, vyMånad])
  const entriesPerDag = useMemo(() => {
    const map = new Map<string, KalenderEntry[]>()
    for (const e of entries) {
      const nyckel = e.datum.toDateString()
      const lista = map.get(nyckel) ?? []
      lista.push(e)
      map.set(nyckel, lista)
    }
    return map
  }, [entries])

  function byt(delta: number) {
    const d = new Date(vyÅr, vyMånad + delta, 1)
    setVyÅr(d.getFullYear())
    setVyMånad(d.getMonth())
  }

  const valdaEntries = valdDatum ? (entriesPerDag.get(valdDatum.toDateString()) ?? []) : []

  return (
    <div className="flex gap-5 items-start flex-wrap">
      <div className="flex-[2_1_560px] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-w-[420px]">
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-100">
          <button onClick={() => byt(-1)} className="text-sm font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">←</button>
          <strong className="text-sm text-slate-800">
            {new Date(vyÅr, vyMånad, 1).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}
          </strong>
          <button onClick={() => byt(1)} className="text-sm font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">→</button>
        </div>
        <div className="grid grid-cols-7 gap-px bg-slate-200">
          {['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'].map(d => (
            <div key={d} className="bg-white py-2 text-center text-[11px] font-bold text-slate-400 uppercase">{d}</div>
          ))}
          {celler.map(c => {
            const dagEntries = entriesPerDag.get(c.datum.toDateString()) ?? []
            const förstaEntry = dagEntries[0]
            const vald = valdDatum && sammaDag(valdDatum, c.datum)
            return (
              <button
                key={c.datum.toISOString()}
                onClick={() => setValdDatum(c.datum)}
                className={`bg-white min-h-[84px] p-2 flex flex-col gap-1.5 items-start text-left transition-colors ${
                  vald ? 'ring-2 ring-inset ring-violet-500 bg-slate-50' : 'hover:bg-slate-50'
                }`}
              >
                <span className={`text-xs ${!c.iAktuellMånad ? 'text-slate-300' : c.idag ? 'text-violet-700 font-extrabold' : 'text-slate-700 font-semibold'}`}>
                  {c.datum.getDate()}
                </span>
                {förstaEntry && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${KALENDER_STIL[förstaEntry.kind].bg} ${KALENDER_STIL[förstaEntry.kind].fg}`}>
                    {förstaEntry.icon} {förstaEntry.fas}
                  </span>
                )}
                {dagEntries.length > 1 && <span className="text-[10px] text-slate-400">+{dagEntries.length - 1} till</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-[1_1_280px] max-w-[340px] bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Vald dag</p>
          <p className="text-[15px] font-bold text-slate-800 mt-0.5">
            {valdDatum ? valdDatum.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Klicka en dag'}
          </p>
        </div>
        {valdaEntries.length > 0 ? (
          valdaEntries.map(e => <DetaljPanel key={e.id} entry={e} faqItems={faqItems} onRedigera={onRedigera} />)
        ) : (
          <p className="text-xs text-slate-400">
            {valdDatum ? 'Inga planerade uppdateringar denna dag.' : 'Klicka en dag med en färgad bricka för att se detaljer.'}
          </p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

function AgendaRad({ entry, öppen, onKlicka, faqItems, onRedigera }: {
  entry: KalenderEntry
  öppen: boolean
  onKlicka: () => void
  faqItems: FaqItem[]
  onRedigera: (u: Uppdatering) => void
}) {
  return (
    <div className={öppen ? 'bg-slate-50' : ''}>
      <button onClick={onKlicka} className="w-full flex gap-4 items-start px-5 py-3.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0">
        <div className="w-12 shrink-0 text-center bg-slate-50 border border-slate-200 rounded-lg py-1.5">
          <div className="text-sm font-extrabold text-slate-800">{entry.datum.getDate()}</div>
          <div className="text-[9px] font-bold text-slate-400 uppercase">{entry.datum.toLocaleDateString('sv-SE', { month: 'short' })}</div>
        </div>
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <Badge entry={entry} />
          <strong className="text-sm text-slate-800">{entry.uppdatering.titel}</strong>
          {entry.uppdatering.punkter[0]?.text && (
            <span className="text-xs text-slate-500 line-clamp-1">{entry.uppdatering.punkter[0].text}</span>
          )}
        </div>
      </button>
      {öppen && (
        <div className="px-5 pb-4 pl-[88px] border-b border-slate-50">
          <DetaljPanel entry={entry} faqItems={faqItems} onRedigera={onRedigera} />
        </div>
      )}
    </div>
  )
}

function Agenda({ entries, faqItems, onRedigera }: {
  entries: KalenderEntry[]
  faqItems: FaqItem[]
  onRedigera: (u: Uppdatering) => void
}) {
  const [öppenId, setÖppenId] = useState<string | null>(null)
  const nu = new Date()
  const tidigare = entries.filter(e => e.datum < nu)
  const kommande = entries.filter(e => e.datum >= nu)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {tidigare.length > 0 && (
        <>
          <p className="px-5 pt-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Tidigare</p>
          {tidigare.map(e => (
            <AgendaRad key={e.id} entry={e} öppen={öppenId === e.id} onKlicka={() => setÖppenId(öppenId === e.id ? null : e.id)} faqItems={faqItems} onRedigera={onRedigera} />
          ))}
        </>
      )}

      <div className="flex items-center gap-3 px-5 py-2 bg-violet-50">
        <div className="flex-1 h-px bg-violet-200" />
        <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wide whitespace-nowrap">Idag · {formatDagKort(nu)}</span>
        <div className="flex-1 h-px bg-violet-200" />
      </div>

      <p className="px-5 pt-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wide">Kommande</p>
      {kommande.length > 0 ? (
        kommande.map(e => (
          <AgendaRad key={e.id} entry={e} öppen={öppenId === e.id} onKlicka={() => setÖppenId(öppenId === e.id ? null : e.id)} faqItems={faqItems} onRedigera={onRedigera} />
        ))
      ) : (
        <p className="px-5 py-6 text-center text-xs text-slate-400">Inga kommande schemalagda eller annonserade poster.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

export default function UppdateringarKalender({ uppdateringar, faqItems, onRedigera }: {
  uppdateringar: Uppdatering[]
  faqItems: FaqItem[]
  onRedigera: (u: Uppdatering) => void
}) {
  const [delvy, setDelvy] = useState<'manad' | 'agenda'>('manad')
  const entries = useMemo(() => byggKalenderEntries(uppdateringar), [uppdateringar])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
          {([['manad', 'Månadsvy'], ['agenda', 'Agenda']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setDelvy(v)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-md transition-colors ${
                delvy === v ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Legend />
      </div>
      <p className="text-xs text-slate-400 -mt-2">
        Visar bara schemalagda och publicerade poster — utkast utan schemaläggning syns bara i Listan.
      </p>

      {delvy === 'manad'
        ? <Månadsvy entries={entries} faqItems={faqItems} onRedigera={onRedigera} />
        : <Agenda entries={entries} faqItems={faqItems} onRedigera={onRedigera} />}
    </div>
  )
}
