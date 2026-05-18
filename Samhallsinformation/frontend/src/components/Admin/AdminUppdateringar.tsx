import { useState } from 'react'

type Typ    = 'ny-funktion' | 'förbättring' | 'buggfix' | 'känt-problem' | 'kommer-snart'
type Status = 'utkast' | 'publicerad'

interface UppdateringsPunkt {
  id:    number
  typ:   Typ
  plats: string
  text:  string
}

interface Uppdatering {
  id:      number
  titel:   string
  datum:   string
  status:  Status
  punkter: UppdateringsPunkt[]
}

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

const TYP_CONFIG: Record<Typ, { label: string; pill: string; pillAktiv: string; dot: string }> = {
  'ny-funktion':  { label: 'Ny funktion',  dot: 'bg-violet-500',  pill: 'border-slate-200 text-slate-500 hover:bg-slate-50',              pillAktiv: 'bg-violet-100 text-violet-700 border-violet-200'   },
  'förbättring':  { label: 'Förbättring',  dot: 'bg-amber-400',   pill: 'border-slate-200 text-slate-500 hover:bg-slate-50',              pillAktiv: 'bg-amber-100 text-amber-700 border-amber-200'       },
  'buggfix':      { label: 'Buggfix',      dot: 'bg-green-500',   pill: 'border-slate-200 text-slate-500 hover:bg-slate-50',              pillAktiv: 'bg-green-100 text-green-700 border-green-200'       },
  'känt-problem': { label: 'Känt problem', dot: 'bg-red-500',     pill: 'border-slate-200 text-slate-500 hover:bg-slate-50',              pillAktiv: 'bg-red-100 text-red-700 border-red-200'             },
  'kommer-snart': { label: 'Kommer snart', dot: 'bg-emerald-500', pill: 'border-slate-200 text-slate-500 hover:bg-slate-50',              pillAktiv: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
}

const TYP_PILL_LISTA: Record<Typ, string> = {
  'ny-funktion':  'bg-violet-100 text-violet-700 border border-violet-200',
  'förbättring':  'bg-amber-100 text-amber-700 border border-amber-200',
  'buggfix':      'bg-green-100 text-green-700 border border-green-200',
  'känt-problem': 'bg-red-100 text-red-700 border border-red-200',
  'kommer-snart': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
}

const STATUS_CONFIG: Record<Status, { label: string; pill: string }> = {
  'utkast':     { label: 'Utkast',     pill: 'bg-slate-100 text-slate-500 border border-slate-200' },
  'publicerad': { label: 'Publicerad', pill: 'bg-green-100 text-green-700 border border-green-200' },
}

const ALLA_TYPER:    Array<Typ | 'Alla'>    = ['Alla', 'ny-funktion', 'förbättring', 'buggfix', 'känt-problem', 'kommer-snart']
const ALLA_STATUSAR: Array<Status | 'Alla'> = ['Alla', 'publicerad', 'utkast']
const PLATS_OPTIONS = ['Allmänt', 'Nyhetsflöde', 'Mina källor', 'Notifieringar', 'Konto']
const ALLA_TYPER_FORM = Object.keys(TYP_CONFIG) as Typ[]

// ---------------------------------------------------------------------------
// Mock-data
// ---------------------------------------------------------------------------

let nästaReleaseId = 5
let nästaRadId     = 500

const INITIAL_UPPDATERINGAR: Uppdatering[] = [
  {
    id: 1, titel: 'v0.4.0 – Profilsida & nya funktioner', datum: '2026-03-09', status: 'publicerad',
    punkter: [
      { id: 101, typ: 'ny-funktion', plats: 'Mina källor',   text: 'Profilsida lanserad — hantera källor, notifieringar och kontoinställningar på ett ställe.' },
      { id: 102, typ: 'ny-funktion', plats: 'Notifieringar', text: 'Geografiskt filter — filtrera notiser per stad eller län för att bara få relevant information.' },
      { id: 103, typ: 'ny-funktion', plats: 'Konto',         text: 'Dataexport — ladda ner all information vi har om dig som en fil.' },
    ],
  },
  {
    id: 2, titel: 'v0.3.0 – Nyhetsflöde', datum: '2026-02-16', status: 'publicerad',
    punkter: [
      { id: 201, typ: 'ny-funktion', plats: 'Nyhetsflöde', text: 'Nyhetsflöde med navigering mellan olika myndigheter i menyn.' },
      { id: 202, typ: 'ny-funktion', plats: 'Mina källor',  text: 'Stöd för att följa flera myndigheter samtidigt.' },
      { id: 203, typ: 'förbättring', plats: 'Nyhetsflöde', text: 'Deduplicering — samma nyhet visas inte längre flera gånger.' },
    ],
  },
  {
    id: 3, titel: 'Kända problem – mars 2026', datum: '2026-03-20', status: 'publicerad',
    punkter: [
      { id: 301, typ: 'känt-problem', plats: 'Notifieringar', text: 'SMS-notiser kan skickas med upp till 5 minuters fördröjning. Åtgärdas i v0.5.0.' },
      { id: 302, typ: 'känt-problem', plats: 'Konto',         text: 'BankID-session avslutas i sällsynta fall utan förvarning. Under utredning.' },
    ],
  },
  {
    id: 4, titel: 'v0.5.0 – Notifieringar & betatestning', datum: '2026-05-01', status: 'utkast',
    punkter: [
      { id: 401, typ: 'ny-funktion',  plats: 'Notifieringar', text: 'Stör ej-schema — sätt tysta timmar så att notiser inte skickas under natten.' },
      { id: 402, typ: 'buggfix',      plats: 'Notifieringar', text: 'SMS-fördröjning vid hög belastning är nu åtgärdad.' },
      { id: 403, typ: 'buggfix',      plats: 'Konto',         text: 'BankID-sessioner avslutas inte längre oväntat.' },
      { id: 404, typ: 'kommer-snart', plats: 'Allmänt',       text: 'Betatestning av ny källintegration startar inom kort — intresserade betatestare kontaktas.' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Hjälpare
// ---------------------------------------------------------------------------

function typSummary(punkter: UppdateringsPunkt[]) {
  const seen = new Map<Typ, number>()
  for (const p of punkter) seen.set(p.typ, (seen.get(p.typ) ?? 0) + 1)
  return Array.from(seen.entries()).map(([typ, antal]) => ({ typ, antal }))
}

// ---------------------------------------------------------------------------
// Ta bort-modal
// ---------------------------------------------------------------------------

function TaBortModal({ titel, onBekräfta, onStäng }: {
  titel: string; onBekräfta: () => void; onStäng: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onStäng}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-red-600 to-red-800 px-6 py-5 flex items-start justify-between">
          <h2 className="text-lg font-bold text-white">Ta bort uppdatering</h2>
          <button onClick={onStäng} className="text-red-300 hover:text-white transition-colors">✕</button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            <strong className="text-slate-800">"{titel}"</strong> tas bort permanent. Åtgärden kan inte ångras.
          </p>
          <div className="flex gap-3">
            <button onClick={onStäng} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Avbryt</button>
            <button onClick={onBekräfta} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors">Ta bort</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulärpanel
// ---------------------------------------------------------------------------

interface FormData {
  titel:   string
  datum:   string
  status:  Status
  punkter: UppdateringsPunkt[]
}

function nyPunkt(): UppdateringsPunkt {
  return { id: nästaRadId++, typ: 'ny-funktion', plats: 'Allmänt', text: '' }
}

function FormPanel({ redigerar, onSpara, onStäng }: {
  redigerar: Uppdatering | null
  onSpara:   (data: FormData, publicera: boolean) => void
  onStäng:   () => void
}) {
  const [titel,   setTitel]   = useState(redigerar?.titel ?? '')
  const [datum,   setDatum]   = useState(redigerar?.datum ?? new Date().toISOString().split('T')[0])
  const [status,  setStatus]  = useState<Status>(redigerar?.status ?? 'utkast')
  const [punkter, setPunkter] = useState<UppdateringsPunkt[]>(
    redigerar?.punkter && redigerar.punkter.length > 0 ? redigerar.punkter : [nyPunkt()]
  )

  function addPunkt() { setPunkter(prev => [...prev, nyPunkt()]) }

  function removePunkt(id: number) {
    setPunkter(prev => prev.filter(p => p.id !== id))
  }

  function updatePunkt<K extends keyof UppdateringsPunkt>(id: number, key: K, val: UppdateringsPunkt[K]) {
    setPunkter(prev => prev.map(p => p.id === id ? { ...p, [key]: val } : p))
  }

  const kanSpara = titel.trim() !== '' && punkter.length > 0 && punkter.every(p => p.text.trim() !== '')

  function spara(publicera: boolean) {
    onSpara({ titel: titel.trim(), datum, status: publicera ? 'publicerad' : status, punkter }, publicera)
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onStäng} />
      <div className="fixed top-0 right-0 bottom-0 z-40 w-[560px] bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {redigerar ? 'Redigera uppdatering' : 'Ny uppdatering'}
          </h2>
          <button onClick={onStäng} className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Innehåll */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Titel */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Titel</label>
            <input
              type="text"
              value={titel}
              onChange={e => setTitel(e.target.value)}
              placeholder="T.ex. 'v0.5.0 – Notifieringar & buggfixar'"
              className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {/* Datum + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Datum</label>
              <input
                type="date"
                value={datum}
                onChange={e => setDatum(e.target.value)}
                className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</label>
              <div className="flex gap-2 h-[42px]">
                {(['utkast', 'publicerad'] as Status[]).map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`flex-1 rounded-xl text-sm font-medium border transition-colors ${
                      status === s ? STATUS_CONFIG[s].pill : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                    }`}>
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Innehåll</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Punkter */}
          <div className="flex flex-col gap-3">
            {punkter.map((p, idx) => (
              <div key={p.id} className="border border-slate-200 rounded-xl overflow-hidden">

                {/* Topprad: nummer + typ-pills + plats + ta bort */}
                <div className="bg-slate-50 px-3 py-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 w-4 shrink-0">{idx + 1}</span>

                  {/* Typ-pills */}
                  <div className="flex gap-1 flex-wrap flex-1">
                    {ALLA_TYPER_FORM.map(t => (
                      <button key={t} onClick={() => updatePunkt(p.id, 'typ', t)}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${
                          p.typ === t ? TYP_CONFIG[t].pillAktiv : TYP_CONFIG[t].pill
                        }`}>
                        {TYP_CONFIG[t].label}
                      </button>
                    ))}
                  </div>

                  {/* Plats */}
                  <select
                    value={p.plats}
                    onChange={e => updatePunkt(p.id, 'plats', e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-violet-400 shrink-0"
                  >
                    {PLATS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>

                  {/* Ta bort */}
                  <button
                    onClick={() => removePunkt(p.id)}
                    disabled={punkter.length === 1}
                    className="text-slate-300 hover:text-red-400 disabled:opacity-30 transition-colors text-sm shrink-0"
                    title="Ta bort rad"
                  >
                    ✕
                  </button>
                </div>

                {/* Text */}
                <div className="px-3 py-2">
                  <input
                    type="text"
                    value={p.text}
                    onChange={e => updatePunkt(p.id, 'text', e.target.value)}
                    placeholder="Beskriv ändringen kort och tydligt..."
                    className="w-full text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none bg-transparent"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={addPunkt}
              className="text-sm font-medium text-violet-600 hover:text-violet-800 border border-dashed border-violet-200 hover:border-violet-400 rounded-xl py-2.5 transition-colors"
            >
              + Lägg till rad
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          <button onClick={onStäng} className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            Avbryt
          </button>
          <button
            onClick={() => kanSpara && spara(false)}
            disabled={!kanSpara}
            className="flex-1 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Spara som utkast
          </button>
          <button
            onClick={() => kanSpara && spara(true)}
            disabled={!kanSpara}
            className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {redigerar?.status === 'publicerad' ? 'Uppdatera' : 'Publicera'}
          </button>
        </div>

      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

export default function AdminUppdateringar() {
  const [uppdateringar, setUppdateringar] = useState<Uppdatering[]>(INITIAL_UPPDATERINGAR)
  const [typFilter,     setTypFilter]     = useState<Typ | 'Alla'>('Alla')
  const [statusFilter,  setStatusFilter]  = useState<Status | 'Alla'>('Alla')
  const [panelÖppen,    setPanelÖppen]    = useState(false)
  const [redigerar,     setRedigerar]     = useState<Uppdatering | null>(null)
  const [taBort,        setTaBort]        = useState<Uppdatering | null>(null)

  const filtrerade = uppdateringar.filter(u => {
    if (statusFilter !== 'Alla' && u.status !== statusFilter) return false
    if (typFilter !== 'Alla' && !u.punkter.some(p => p.typ === typFilter)) return false
    return true
  }).sort((a, b) => b.datum.localeCompare(a.datum))

  function öppnaSkapa()              { setRedigerar(null); setPanelÖppen(true) }
  function öppnaRedigera(u: Uppdatering) { setRedigerar(u);   setPanelÖppen(true) }
  function stängPanel()              { setPanelÖppen(false); setRedigerar(null) }

  function spara(data: FormData, _publicera: boolean) {
    if (redigerar) {
      setUppdateringar(prev => prev.map(u => u.id === redigerar.id ? { ...u, ...data } : u))
    } else {
      setUppdateringar(prev => [{ id: nästaReleaseId++, ...data }, ...prev])
    }
    stängPanel()
  }

  function togglePublicerad(u: Uppdatering) {
    setUppdateringar(prev => prev.map(x =>
      x.id === u.id ? { ...x, status: x.status === 'publicerad' ? 'utkast' : 'publicerad' } : x
    ))
  }

  const antal = {
    totalt:      uppdateringar.length,
    publicerade: uppdateringar.filter(u => u.status === 'publicerad').length,
    utkast:      uppdateringar.filter(u => u.status === 'utkast').length,
  }

  return (
    <div className="flex flex-col gap-6">

      {taBort && (
        <TaBortModal
          titel={taBort.titel}
          onBekräfta={() => { setUppdateringar(prev => prev.filter(u => u.id !== taBort.id)); setTaBort(null) }}
          onStäng={() => setTaBort(null)}
        />
      )}

      {panelÖppen && (
        <FormPanel redigerar={redigerar} onSpara={spara} onStäng={stängPanel} />
      )}

      {/* Stat-kort */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Totalt',      värde: antal.totalt,      färg: 'text-slate-800' },
          { label: 'Publicerade', värde: antal.publicerade, färg: 'text-green-600' },
          { label: 'Utkast',      värde: antal.utkast,      färg: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5 text-center">
            <p className={`text-3xl font-bold ${s.färg}`}>{s.värde}</p>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Verktygsfält */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {ALLA_TYPER.map(t => (
              <button key={t} onClick={() => setTypFilter(t)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  typFilter === t
                    ? t === 'Alla' ? 'bg-violet-100 text-violet-700' : TYP_PILL_LISTA[t as Typ]
                    : 'text-slate-500 hover:bg-slate-100'
                }`}>
                {t === 'Alla' ? 'Alla typer' : TYP_CONFIG[t as Typ].label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {ALLA_STATUSAR.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  statusFilter === s ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'
                }`}>
                {s === 'Alla' ? 'Alla statusar' : STATUS_CONFIG[s as Status].label}
              </button>
            ))}
          </div>
          <button
            onClick={öppnaSkapa}
            className="ml-auto text-sm font-semibold px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors shrink-0"
          >
            + Ny uppdatering
          </button>
        </div>

        {/* Tabell */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
              <th className="text-left px-6 py-3 font-medium">Titel</th>
              <th className="text-left px-4 py-3 font-medium">Innehåll</th>
              <th className="text-left px-4 py-3 font-medium">Datum</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtrerade.map(u => {
              const summary     = typSummary(u.punkter)
              const statusCfg   = STATUS_CONFIG[u.status]
              return (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3">
                    <p className="font-medium text-slate-800">{u.titel}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{u.punkter.length} {u.punkter.length === 1 ? 'rad' : 'rader'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {summary.map(({ typ, antal }) => (
                        <span key={typ} className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${TYP_PILL_LISTA[typ]}`}>
                          {TYP_CONFIG[typ].label}{antal > 1 ? ` ×${antal}` : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 font-mono whitespace-nowrap">{u.datum}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${statusCfg.pill}`}>
                      {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => togglePublicerad(u)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap ${
                          u.status === 'publicerad'
                            ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                            : 'border-green-200 text-green-700 hover:bg-green-50'
                        }`}>
                        {u.status === 'publicerad' ? 'Avpublicera' : 'Publicera'}
                      </button>
                      <button onClick={() => öppnaRedigera(u)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                        Redigera
                      </button>
                      <button onClick={() => setTaBort(u)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                        Ta bort
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtrerade.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                  Inga uppdateringar matchar filtret.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
