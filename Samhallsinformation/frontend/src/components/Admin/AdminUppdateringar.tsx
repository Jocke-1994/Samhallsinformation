import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sendNewVersionNotice } from '../../api/push'
import {
  fetchAdminUppdateringar, createUppdatering, updateUppdatering, deleteUppdatering,
  type Uppdatering, type UppdateringRequest, type UppdateringsPunkt, type PunktRequest,
  type PunktTyp, type Synlighet,
} from '../../api/uppdateringar'
import { fetchAdminFeatureFlags } from '../../api/featureFlags'
import { fetchAdminFaq } from '../../api/faq'
import { isoTillDatetimeLocal } from '../../lib/tid'
import ConfirmDialog from '../common/ConfirmDialog'

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

const TYP_CONFIG: Record<PunktTyp, { label: string; pill: string; pillAktiv: string; dot: string }> = {
  'ny-funktion':  { label: 'Ny funktion',  dot: 'bg-violet-500',  pill: 'border-slate-200 text-slate-500 hover:bg-slate-50',              pillAktiv: 'bg-violet-100 text-violet-700 border-violet-200'   },
  'förbättring':  { label: 'Förbättring',  dot: 'bg-amber-400',   pill: 'border-slate-200 text-slate-500 hover:bg-slate-50',              pillAktiv: 'bg-amber-100 text-amber-700 border-amber-200'       },
  'buggfix':      { label: 'Buggfix',      dot: 'bg-green-500',   pill: 'border-slate-200 text-slate-500 hover:bg-slate-50',              pillAktiv: 'bg-green-100 text-green-700 border-green-200'       },
  'känt-problem': { label: 'Känt problem', dot: 'bg-red-500',     pill: 'border-slate-200 text-slate-500 hover:bg-slate-50',              pillAktiv: 'bg-red-100 text-red-700 border-red-200'             },
  'kommer-snart': { label: 'Kommer snart', dot: 'bg-emerald-500', pill: 'border-slate-200 text-slate-500 hover:bg-slate-50',              pillAktiv: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
}

const TYP_PILL_LISTA: Record<PunktTyp, string> = {
  'ny-funktion':  'bg-violet-100 text-violet-700 border border-violet-200',
  'förbättring':  'bg-amber-100 text-amber-700 border border-amber-200',
  'buggfix':      'bg-green-100 text-green-700 border border-green-200',
  'känt-problem': 'bg-red-100 text-red-700 border border-red-200',
  'kommer-snart': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
}

const ALLA_TYPER:    Array<PunktTyp | 'Alla'>  = ['Alla', 'ny-funktion', 'förbättring', 'buggfix', 'känt-problem', 'kommer-snart']
const ALLA_STATUSAR: Array<'publicerad' | 'utkast' | 'Alla'> = ['Alla', 'publicerad', 'utkast']
const PLATS_OPTIONS = ['Allmänt', 'Nyhetsflöde', 'Mina källor', 'Notifieringar', 'Konto']
const ALLA_TYPER_FORM = Object.keys(TYP_CONFIG) as PunktTyp[]

function typSummary(punkter: { typ: PunktTyp }[]) {
  const seen = new Map<PunktTyp, number>()
  for (const p of punkter) seen.set(p.typ, (seen.get(p.typ) ?? 0) + 1)
  return Array.from(seen.entries()).map(([typ, antal]) => ({ typ, antal }))
}

// ---------------------------------------------------------------------------
// Skicka "Ny version"-notis — riktig, fristående funktion (kopplad mot
// PushDispatcher.DispatchNewVersionAsync). Fristående från listan nedan.
// ---------------------------------------------------------------------------

function SkickaNyVersionKort() {
  const [version, setVersion] = useState('')
  const [meddelande, setMeddelande] = useState('')
  const [skickar, setSkickar] = useState(false)
  const [resultat, setResultat] = useState<string | null>(null)
  const [fel, setFel] = useState('')
  const [bekräfta, setBekräfta] = useState(false)

  const kanSkicka = version.trim() !== '' && meddelande.trim() !== '' && !skickar

  async function skicka() {
    setBekräfta(false)
    setSkickar(true)
    setFel('')
    setResultat(null)
    try {
      const { sent } = await sendNewVersionNotice(version.trim(), meddelande.trim())
      setResultat(sent === 0 ? 'Skickat — men ingen hade opt:at in på "Ny version" än.' : `Skickat till ${sent} enhet${sent === 1 ? '' : 'er'}.`)
      setVersion('')
      setMeddelande('')
    } catch (err) {
      setFel(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setSkickar(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-violet-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-violet-100 bg-violet-50">
        <h2 className="text-sm font-bold text-violet-800">Skicka "Ny version"-notis</h2>
        <p className="text-xs text-violet-500 mt-0.5">
          Riktig push till alla som slagit på kategorin Ny version under Konto — fristående från listan nedan.
        </p>
      </div>
      <div className="px-6 py-5 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
          <input
            type="text"
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder="T.ex. 0.6.0"
            className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          <input
            type="text"
            value={meddelande}
            onChange={e => setMeddelande(e.target.value)}
            placeholder="T.ex. 'Nya källor och en snabbare sidomeny'"
            className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBekräfta(true)}
            disabled={!kanSkicka}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            {skickar ? 'Skickar…' : 'Skicka nu'}
          </button>
          {resultat && <p className="text-sm text-green-600">{resultat}</p>}
          {fel && <p className="text-sm text-red-500">{fel}</p>}
        </div>
      </div>
      {bekräfta && (
        <ConfirmDialog
          rubrik={'Skicka "Ny version"-notis till alla?'}
          bekräftaText="Skicka till alla"
          onBekräfta={skicka}
          onAvbryt={() => setBekräfta(false)}
        >
          <p>
            Det här är en <strong>riktig push-notis</strong> som skickas direkt till alla
            prenumeranter som slagit på kategorin Ny version. Den kan inte återkallas.
          </p>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Version</p>
            <p className="text-sm text-slate-800 break-words">{version.trim()}</p>
            <p className="text-xs text-slate-500 mt-2">Meddelande</p>
            <p className="text-sm text-slate-800 break-words">{meddelande.trim()}</p>
          </div>
        </ConfirmDialog>
      )}
    </div>
  )
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

interface PunktFormRad extends PunktRequest {
  radId: number
}

function nyPunkt(radId: number): PunktFormRad {
  return { radId, typ: 'ny-funktion', plats: 'Allmänt', text: '', synlighet: 'alla' }
}

let nästaRadId = 0

function FormPanel({ redigerar, onSpara, onStäng }: {
  redigerar: Uppdatering | null
  onSpara:   (data: UppdateringRequest) => void
  onStäng:   () => void
}) {
  const [titel,      setTitel]      = useState(redigerar?.titel ?? '')
  const [datum,      setDatum]      = useState(redigerar?.datum.split('T')[0] ?? new Date().toISOString().split('T')[0])
  const [publicerad, setPublicerad] = useState(redigerar?.publicerad ?? false)
  // Bara en HELT NY post får en tom startrad injicerad — redigeras en
  // befintlig post visas exakt vad som är sparat, även 0 rader (en giltig
  // ren flagg-schemaläggning). Att injicera en rad även vid 0 sparade
  // punkter gjorde tidigare formuläret osparbart vid omöppning (code
  // review-fynd, PR #590): kanSpara blev false direkt eftersom den
  // injicerade raden hade tom text, utan någon förklaring i UI:t.
  const [punkter, setPunkter] = useState<PunktFormRad[]>(
    redigerar
      ? redigerar.punkter.map(p => ({ radId: nästaRadId++, typ: p.typ, plats: p.plats, text: p.text, synlighet: p.synlighet }))
      : [nyPunkt(nästaRadId++)]
  )

  // Schemalagd lansering — ett delat datum/tid för både changelog-
  // publicering OCH aktivering av valda feature-flaggor (se
  // ScheduledReleaseBackgroundService på backend).
  const [schemalagd,   setSchemalagd]   = useState(redigerar?.schemalagdPubliceringUtc != null)
  const [schemaDatum,  setSchemaDatum]  = useState(redigerar?.schemalagdPubliceringUtc ? isoTillDatetimeLocal(redigerar.schemalagdPubliceringUtc) : '')
  const [valdaFlaggor, setValdaFlaggor] = useState<string[]>(redigerar?.schemalagdaFlaggor ?? [])

  const { data: adminFlaggor = [] } = useQuery({ queryKey: ['admin-feature-flags'], queryFn: fetchAdminFeatureFlags })
  const redoFlaggor = adminFlaggor.filter(f => f.redoAttLanseras && !f.value)

  const { data: faqItems = [] } = useQuery({ queryKey: ['admin-faq'], queryFn: fetchAdminFaq })
  const kopplatFaq = faqItems.filter(f => f.flagKey && valdaFlaggor.includes(f.flagKey))

  function toggleFlagga(key: string) {
    setValdaFlaggor(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function addPunkt() { setPunkter(prev => [...prev, nyPunkt(nästaRadId++)]) }

  function removePunkt(radId: number) {
    setPunkter(prev => prev.filter(p => p.radId !== radId))
  }

  function updatePunkt<K extends keyof PunktFormRad>(radId: number, key: K, val: PunktFormRad[K]) {
    setPunkter(prev => prev.map(p => p.radId === radId ? { ...p, [key]: val } : p))
  }

  // En schemalagd lansering med minst en flagga vald får sakna innehåll
  // helt (en ren flagg-aktivering utan publik nyhet) — men en vanlig, ej
  // schemalagd post kräver fortfarande minst en rad text som förut. Samma
  // regel användes tidigare på två ställen (här och i "ta bort rad"-
  // spärren nedan), en gång rakt av och en gång som en dubbel negation —
  // en enda delad boolean istället (code review-fynd, PR #590).
  const kanHaNollPunkter = schemalagd && valdaFlaggor.length > 0
  const harInnehåll      = punkter.length > 0 && punkter.every(p => p.text.trim() !== '')
  const rentFlaggSchema  = kanHaNollPunkter && punkter.length === 0
  const kanSpara = titel.trim() !== '' && (harInnehåll || rentFlaggSchema) && (!schemalagd || schemaDatum !== '')

  function spara(publicera: boolean) {
    onSpara({
      titel: titel.trim(),
      datum: new Date(datum).toISOString(),
      publicerad: schemalagd ? false : publicera,
      punkter: punkter.map(({ typ, plats, text, synlighet }) => ({ typ, plats, text, synlighet })),
      schemalagdPubliceringUtc: schemalagd && schemaDatum ? new Date(schemaDatum).toISOString() : null,
      schemalagdaFlaggor: schemalagd ? valdaFlaggor : [],
    })
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
              placeholder="T.ex. 'Logga in och skapa konto'"
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
                {([false, true] as boolean[]).map(p => (
                  <button key={String(p)} onClick={() => setPublicerad(p)}
                    className={`flex-1 rounded-xl text-sm font-medium border transition-colors ${
                      publicerad === p
                        ? (p ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200')
                        : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                    }`}>
                    {p ? 'Publicerad' : 'Utkast'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Schemalägg lansering */}
          <div className="flex flex-col gap-3 border border-slate-200 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={schemalagd}
                onChange={e => setSchemalagd(e.target.checked)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-400"
              />
              Schemalägg lansering
            </label>

            {schemalagd && (
              <div className="flex flex-col gap-3 pl-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Datum/tid (din lokala tid)</label>
                  <input
                    type="datetime-local"
                    value={schemaDatum}
                    onChange={e => setSchemaDatum(e.target.value)}
                    className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Flaggor att aktivera</label>
                  {redoFlaggor.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Inga flaggor är markerade "redo att lanseras" än — gör det i Feature flags-panelen, eller flytta en idé till "lanseringsklar" i Funktionsidéer.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {redoFlaggor.map(f => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => toggleFlagga(f.key)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                            valdaFlaggor.includes(f.key)
                              ? 'bg-violet-100 text-violet-700 border-violet-200'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {f.key}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {kopplatFaq.length > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {kopplatFaq.length} FAQ-{kopplatFaq.length === 1 ? 'fråga' : 'frågor'} kopplad{kopplatFaq.length === 1 ? '' : 'e'} till valda flaggor — värt att granska i FAQ-fliken innan lansering.
                  </p>
                )}
              </div>
            )}
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
              <div key={p.radId} className="border border-slate-200 rounded-xl overflow-hidden">

                {/* Topprad: nummer + typ-pills + plats + ta bort */}
                <div className="bg-slate-50 px-3 py-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 w-4 shrink-0">{idx + 1}</span>

                  {/* Typ-pills */}
                  <div className="flex gap-1 flex-wrap flex-1">
                    {ALLA_TYPER_FORM.map(t => (
                      <button key={t} onClick={() => updatePunkt(p.radId, 'typ', t)}
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
                    onChange={e => updatePunkt(p.radId, 'plats', e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-violet-400 shrink-0"
                  >
                    {PLATS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>

                  {/* Ta bort */}
                  <button
                    onClick={() => removePunkt(p.radId)}
                    disabled={punkter.length === 1 && !kanHaNollPunkter}
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
                    onChange={e => updatePunkt(p.radId, 'text', e.target.value)}
                    placeholder="Beskriv ändringen kort och tydligt..."
                    className="w-full text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none bg-transparent"
                  />
                </div>

                {/* Synlighet — vem ser den här punkten */}
                <div className="px-3 pb-2.5 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 shrink-0">Syns för</span>
                  {(['alla', 'inloggade'] as Synlighet[]).map(s => (
                    <button key={s} onClick={() => updatePunkt(p.radId, 'synlighet', s)}
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                        p.synlighet === s
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                      }`}>
                      {s === 'alla' ? 'Alla (även besökare)' : 'Endast inloggade'}
                    </button>
                  ))}
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
          {schemalagd ? (
            <button
              onClick={() => kanSpara && spara(false)}
              disabled={!kanSpara}
              className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {schemaDatum ? `Sparas, publiceras automatiskt ${schemaDatum.replace('T', ' ')}` : 'Schemalägg'}
            </button>
          ) : (
            <>
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
                {redigerar?.publicerad ? 'Uppdatera' : 'Publicera'}
              </button>
            </>
          )}
        </div>

      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

export default function AdminUppdateringar() {
  const queryClient = useQueryClient()
  const { data: uppdateringar = [] } = useQuery({
    queryKey: ['admin-uppdateringar'],
    queryFn:  fetchAdminUppdateringar,
  })

  const [typFilter,     setTypFilter]     = useState<PunktTyp | 'Alla'>('Alla')
  const [statusFilter,  setStatusFilter]  = useState<'publicerad' | 'utkast' | 'Alla'>('Alla')
  const [panelÖppen,    setPanelÖppen]    = useState(false)
  const [redigerar,     setRedigerar]     = useState<Uppdatering | null>(null)
  const [taBort,        setTaBort]        = useState<Uppdatering | null>(null)

  function invalidera() {
    queryClient.invalidateQueries({ queryKey: ['admin-uppdateringar'] })
    queryClient.invalidateQueries({ queryKey: ['uppdateringar'] })
  }

  const createMutation = useMutation({ mutationFn: createUppdatering, onSuccess: invalidera })
  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; req: UppdateringRequest }) => updateUppdatering(vars.id, vars.req),
    onSuccess:  invalidera,
  })
  const deleteMutation = useMutation({ mutationFn: deleteUppdatering, onSuccess: invalidera })

  const filtrerade = uppdateringar.filter(u => {
    if (statusFilter !== 'Alla' && (statusFilter === 'publicerad') !== u.publicerad) return false
    if (typFilter !== 'Alla' && !u.punkter.some(p => p.typ === typFilter)) return false
    return true
  })

  function öppnaSkapa()                 { setRedigerar(null); setPanelÖppen(true) }
  function öppnaRedigera(u: Uppdatering) { setRedigerar(u);    setPanelÖppen(true) }
  function stängPanel()                 { setPanelÖppen(false); setRedigerar(null) }

  function spara(data: UppdateringRequest) {
    if (redigerar) {
      updateMutation.mutate({ id: redigerar.id, req: data })
    } else {
      createMutation.mutate(data)
    }
    stängPanel()
  }

  function togglePublicerad(u: Uppdatering) {
    // Manuell publicera/avpublicera vinner över ett ev. väntande schema —
    // annars skulle en ihågkommen schemaläggning kunna publicera om posten
    // igen senare, mot admins uttryckliga handling här.
    const req: UppdateringRequest = {
      titel:      u.titel,
      datum:      u.datum,
      publicerad: !u.publicerad,
      punkter:    u.punkter.map(({ typ, plats, text, synlighet }: UppdateringsPunkt) => ({ typ, plats, text, synlighet })),
      schemalagdPubliceringUtc: null,
      schemalagdaFlaggor: [],
    }
    updateMutation.mutate({ id: u.id, req })
  }

  const antal = {
    totalt:      uppdateringar.length,
    publicerade: uppdateringar.filter(u => u.publicerad).length,
    utkast:      uppdateringar.filter(u => !u.publicerad).length,
  }

  return (
    <div className="flex flex-col gap-6">

      {taBort && (
        <TaBortModal
          titel={taBort.titel}
          onBekräfta={() => { deleteMutation.mutate(taBort.id); setTaBort(null) }}
          onStäng={() => setTaBort(null)}
        />
      )}

      {panelÖppen && (
        <FormPanel redigerar={redigerar} onSpara={spara} onStäng={stängPanel} />
      )}

      <SkickaNyVersionKort />

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
                    ? t === 'Alla' ? 'bg-violet-100 text-violet-700' : TYP_PILL_LISTA[t as PunktTyp]
                    : 'text-slate-500 hover:bg-slate-100'
                }`}>
                {t === 'Alla' ? 'Alla typer' : TYP_CONFIG[t as PunktTyp].label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {ALLA_STATUSAR.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  statusFilter === s ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'
                }`}>
                {s === 'Alla' ? 'Alla statusar' : s === 'publicerad' ? 'Publicerad' : 'Utkast'}
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
              const summary = typSummary(u.punkter)
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
                  <td className="px-4 py-3 text-sm text-slate-500 font-mono whitespace-nowrap">{u.datum.split('T')[0]}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${
                        u.publicerad ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {u.publicerad ? 'Publicerad' : 'Utkast'}
                      </span>
                      {u.schemalagdPubliceringUtc && (
                        <span
                          className="text-xs font-medium px-2 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 whitespace-nowrap"
                          title={`Schemalagd till ${isoTillDatetimeLocal(u.schemalagdPubliceringUtc).replace('T', ' ')}`}
                        >
                          ⏰ Schemalagd
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => togglePublicerad(u)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap ${
                          u.publicerad
                            ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                            : 'border-green-200 text-green-700 hover:bg-green-50'
                        }`}>
                        {u.publicerad ? 'Avpublicera' : 'Publicera'}
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
