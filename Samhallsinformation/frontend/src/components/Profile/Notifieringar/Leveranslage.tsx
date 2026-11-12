import { useState } from 'react'
import type { AllData, SektionKey } from './index'

type Lage = 'direkt' | 'schemalagd'

const MOCK_KALLOR = ['Polisen', 'SMHI', 'MSB', 'Trafikverket']

const DAGAR: { key: string; kort: string }[] = [
  { key: 'Måndag', kort: 'Må' },
  { key: 'Tisdag', kort: 'Ti' },
  { key: 'Onsdag', kort: 'On' },
  { key: 'Torsdag', kort: 'To' },
  { key: 'Fredag', kort: 'Fr' },
  { key: 'Lördag', kort: 'Lö' },
  { key: 'Söndag', kort: 'Sö' },
]

const ALLA_DAGAR = DAGAR.map((d) => d.key)
const VARDAGAR = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag']
const HELGER = ['Lördag', 'Söndag']

const SEKTION_LABEL: Record<SektionKey, string> = { epost: 'E-POST', sms: 'SMS', push: 'PUSH' }
const SEKTION_IKON: Record<SektionKey, string> = { epost: '📧', sms: '📱', push: '🔔' }
const SEKTION_LABEL_CLS: Record<SektionKey, string> = {
  epost: 'text-violet-500',
  sms: 'text-sky-500',
  push: 'text-amber-500',
}
const SEKTION_IKON_BG: Record<SektionKey, string> = {
  epost: 'bg-violet-100',
  sms: 'bg-sky-100',
  push: 'bg-amber-100',
}
const SEKTION_BORDER: Record<SektionKey, string> = {
  epost: 'border-l-4 border-l-violet-300',
  sms: 'border-l-4 border-l-sky-300',
  push: 'border-l-4 border-l-amber-300',
}

interface SchemaInst {
  leveranstid: string
  dagar: string[]
}

interface KällUndantag {
  id: number
  kalla: string
  lage: Lage
  schema: SchemaInst
}

interface PendingUndantag {
  kalla: string
  lage: Lage
  schema: SchemaInst
}

interface KontaktInst {
  lage: Lage
  schema: SchemaInst
  undantag: KällUndantag[]
}

const DEFAULT_SCHEMA: SchemaInst = { leveranstid: '08:00', dagar: ALLA_DAGAR }

const DEFAULT_INST: KontaktInst = {
  lage: 'direkt',
  schema: DEFAULT_SCHEMA,
  undantag: [],
}

let nextUndantagId = 100

// ── Helpers ──────────────────────────────────────────────────────────────────

function dagSummary(dagar: string[]): string {
  if (dagar.length === 0) return 'Inga dagar'
  if (dagar.length === 7) return 'Varje dag'
  const isVardagar =
    VARDAGAR.every((d) => dagar.includes(d)) && HELGER.every((d) => !dagar.includes(d))
  if (isVardagar) return 'Vardagar'
  const isHelger =
    HELGER.every((d) => dagar.includes(d)) && VARDAGAR.every((d) => !dagar.includes(d))
  if (isHelger) return 'Helger'
  return DAGAR.filter((d) => dagar.includes(d.key))
    .map((d) => d.kort)
    .join(' ')
}

function headerSummary(inst: KontaktInst): string {
  if (inst.lage === 'direkt') return 'Direkt'
  return `Schemalagd · ${inst.schema.leveranstid} · ${dagSummary(inst.schema.dagar)}`
}

function undantagSummary(u: KällUndantag): string {
  if (u.lage === 'direkt') return 'Direkt'
  return `Schemalagd · ${u.schema.leveranstid} · ${dagSummary(u.schema.dagar)}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DagVäljare({ dagar, onChange }: { dagar: string[]; onChange: (d: string[]) => void }) {
  const allSelected = dagar.length === ALLA_DAGAR.length

  function toggle(dag: string) {
    onChange(dagar.includes(dag) ? dagar.filter((d) => d !== dag) : [...dagar, dag])
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1 flex-wrap">
        {DAGAR.map((d) => (
          <button
            key={d.key}
            onClick={() => toggle(d.key)}
            className={`w-7 h-7 text-xs font-semibold rounded-lg border transition-colors ${
              dagar.includes(d.key)
                ? 'bg-teal-600 border-teal-600 text-white'
                : 'bg-white border-slate-200 text-slate-400 hover:border-teal-300 hover:text-teal-600'
            }`}
          >
            {d.kort}
          </button>
        ))}
        <button
          onClick={() => onChange(allSelected ? [] : ALLA_DAGAR)}
          className={`px-2 h-7 text-xs font-semibold rounded-lg border transition-colors ml-1 ${
            allSelected
              ? 'bg-teal-600 border-teal-600 text-white'
              : 'bg-white border-slate-200 text-slate-400 hover:border-teal-300 hover:text-teal-600'
          }`}
        >
          Alla
        </button>
      </div>
      {allSelected && <p className="text-xs text-teal-600 font-medium">Varje dag</p>}
    </div>
  )
}

function SchemaVäljare({
  schema,
  onChange,
}: {
  schema: SchemaInst
  onChange: (p: Partial<SchemaInst>) => void
}) {
  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Kl.</span>
        <input
          type="time"
          value={schema.leveranstid}
          onChange={(e) => onChange({ leveranstid: e.target.value })}
          className="text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-300"
        />
      </div>
      <DagVäljare dagar={schema.dagar} onChange={(dagar) => onChange({ dagar })} />
    </div>
  )
}

function LageKnappar({ value, onChange }: { value: Lage; onChange: (v: Lage) => void }) {
  return (
    <div className="flex gap-1">
      {(['direkt', 'schemalagd'] as Lage[]).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`px-2.5 py-0.5 text-xs font-semibold rounded-lg border transition-colors capitalize ${
            value === l
              ? 'bg-teal-600 border-teal-600 text-white'
              : 'bg-white border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-600'
          }`}
        >
          {l === 'direkt' ? 'Direkt' : 'Schemalagd'}
        </button>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Leveranslage({ data }: { data: AllData }) {
  const [inställningar, setInställningar] = useState<Record<number, KontaktInst>>({})
  const [pending, setPending] = useState<Record<number, PendingUndantag | null>>({})
  const [sparadInst, setSparadInst] = useState<number | null>(null)
  const [sparadUnd, setSparadUnd] = useState<number | null>(null)
  const [öppen, setÖppen] = useState<Record<number, boolean>>({})
  const [öppenUndantag, setÖppenUndantag] = useState<Record<number, boolean>>({})

  function getInst(id: number): KontaktInst {
    return inställningar[id] ?? { ...DEFAULT_INST, schema: { ...DEFAULT_SCHEMA }, undantag: [] }
  }

  function updateInst(id: number, patch: Partial<KontaktInst>) {
    setInställningar((prev) => ({ ...prev, [id]: { ...getInst(id), ...patch } }))
  }

  function updateInstWithFlash(id: number, patch: Partial<KontaktInst>) {
    updateInst(id, patch)
    setSparadInst(id)
    setTimeout(() => setSparadInst(null), 2000)
  }

  function openPending(kontaktId: number, ledigaKällor: string[]) {
    if (ledigaKällor.length === 0) return
    setPending((prev) => ({
      ...prev,
      [kontaktId]: { kalla: ledigaKällor[0], lage: 'schemalagd', schema: { ...DEFAULT_SCHEMA } },
    }))
  }

  function updatePending(kontaktId: number, patch: Partial<PendingUndantag>) {
    setPending((prev) => {
      const curr = prev[kontaktId]
      if (!curr) return prev
      return { ...prev, [kontaktId]: { ...curr, ...patch } }
    })
  }

  function savePending(kontaktId: number) {
    const p = pending[kontaktId]
    if (!p) return
    const inst = getInst(kontaktId)
    const newId = nextUndantagId++
    updateInst(kontaktId, { undantag: [...inst.undantag, { id: newId, ...p }] })
    setPending((prev) => ({ ...prev, [kontaktId]: null }))
    setSparadUnd(newId)
    setTimeout(() => setSparadUnd(null), 2000)
  }

  function cancelPending(kontaktId: number) {
    setPending((prev) => ({ ...prev, [kontaktId]: null }))
  }

  function updateUndantag(kontaktId: number, undantagId: number, patch: Partial<KällUndantag>) {
    const inst = getInst(kontaktId)
    // Prevent duplicate source
    if (patch.kalla) {
      const duplicate = inst.undantag.some((u) => u.id !== undantagId && u.kalla === patch.kalla)
      if (duplicate) return
    }
    updateInst(kontaktId, {
      undantag: inst.undantag.map((u) => (u.id === undantagId ? { ...u, ...patch } : u)),
    })
  }

  function removeUndantag(kontaktId: number, undantagId: number) {
    const inst = getInst(kontaktId)
    updateInst(kontaktId, { undantag: inst.undantag.filter((u) => u.id !== undantagId) })
    setÖppenUndantag((prev) => {
      const n = { ...prev }
      delete n[undantagId]
      return n
    })
  }

  const SEKTIONER: SektionKey[] = ['epost', 'sms', 'push']
  const harNågotAktivt = SEKTIONER.some((k) => data[k].some((m) => m.aktiv))

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-xl shrink-0">
            ⚡
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Leveransläge</h2>
            <p className="text-sm text-slate-500 mt-0.5">Välj hur och när notiser levereras</p>
          </div>
        </div>
      </div>

      {!harNågotAktivt ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-slate-400">
            Inga aktiva mottagare — aktivera mottagare i kortet ovan
          </p>
        </div>
      ) : (
        <div className="px-6 py-5 flex flex-col">
          {SEKTIONER.map((key, i) => {
            const aktiva = data[key].filter((m) => m.aktiv)
            if (aktiva.length === 0) return null

            return (
              <div key={key}>
                {i > 0 && <div className="border-t border-slate-100 mb-5" />}

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0 ${SEKTION_IKON_BG[key]}`}
                  >
                    {SEKTION_IKON[key]}
                  </span>
                  <p
                    className={`text-xs font-bold uppercase tracking-wider ${SEKTION_LABEL_CLS[key]}`}
                  >
                    {SEKTION_LABEL[key]}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {aktiva.map((m) => {
                    const inst = getInst(m.id)
                    const ledigaKällor = MOCK_KALLOR.filter(
                      (k) => !inst.undantag.some((u) => u.kalla === k),
                    )
                    const pend = pending[m.id] ?? null
                    const expanderad = öppen[m.id] ?? false

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col bg-slate-50 rounded-xl overflow-hidden ${SEKTION_BORDER[key]}`}
                      >
                        {/* Kollapsbar header */}
                        <button
                          onClick={() => setÖppen((prev) => ({ ...prev, [m.id]: !expanderad }))}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 transition-colors text-left w-full"
                        >
                          <span className="text-xs font-semibold text-slate-700 shrink-0">
                            {m.smeknamn || m.kontakt}
                          </span>
                          {m.smeknamn && (
                            <span className="text-xs text-slate-400 shrink-0">{m.kontakt}</span>
                          )}
                          <div className="flex-1" />
                          {sparadInst === m.id && (
                            <span className="text-xs text-green-500 font-medium shrink-0">
                              ✓ Sparat
                            </span>
                          )}
                          <span className="text-xs text-slate-400 shrink-0">
                            {headerSummary(inst)}
                          </span>
                          <span
                            className={`text-slate-400 text-xs transition-transform shrink-0 ${expanderad ? 'rotate-180' : ''}`}
                          >
                            ▾
                          </span>
                        </button>

                        {/* Expanderat innehåll */}
                        {expanderad && (
                          <div className="flex flex-col gap-2 px-4 pb-3 border-t border-slate-200 pt-3">
                            <LageKnappar
                              value={inst.lage}
                              onChange={(lage) => updateInstWithFlash(m.id, { lage })}
                            />

                            {inst.lage === 'schemalagd' && (
                              <SchemaVäljare
                                schema={inst.schema}
                                onChange={(patch) =>
                                  updateInstWithFlash(m.id, {
                                    schema: { ...inst.schema, ...patch },
                                  })
                                }
                              />
                            )}

                            {/* Källundantag */}
                            {(inst.undantag.length > 0 || pend) && (
                              <div className="border-t border-slate-200 pt-2 flex flex-col gap-2">
                                <p className="text-xs text-slate-400 font-medium">Källundantag</p>

                                {inst.undantag.map((u) => {
                                  const uÖppen = öppenUndantag[u.id] ?? false
                                  const källorFörU = MOCK_KALLOR.filter(
                                    (k) =>
                                      k === u.kalla ||
                                      !inst.undantag.some((x) => x.id !== u.id && x.kalla === k),
                                  )
                                  return (
                                    <div
                                      key={u.id}
                                      className="bg-white rounded-lg border border-slate-100 overflow-hidden group"
                                    >
                                      <button
                                        onClick={() =>
                                          setÖppenUndantag((prev) => ({ ...prev, [u.id]: !uÖppen }))
                                        }
                                        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                                      >
                                        <span className="text-xs font-semibold text-slate-700 flex-1">
                                          {u.kalla}
                                        </span>
                                        {sparadUnd === u.id && (
                                          <span className="text-xs text-green-500 font-medium shrink-0">
                                            ✓
                                          </span>
                                        )}
                                        <span className="text-xs text-slate-400 shrink-0">
                                          {undantagSummary(u)}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            removeUndantag(m.id, u.id)
                                          }}
                                          className="hover-reveal ml-1 shrink-0 px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-all"
                                        >
                                          - Ta bort
                                        </button>
                                        <span
                                          className={`text-slate-400 text-xs transition-transform shrink-0 ${uÖppen ? 'rotate-180' : ''}`}
                                        >
                                          ▾
                                        </span>
                                      </button>

                                      {uÖppen && (
                                        <div className="flex flex-col gap-2 px-3 pb-2.5 border-t border-slate-100 pt-2.5">
                                          <select
                                            value={u.kalla}
                                            onChange={(e) =>
                                              updateUndantag(m.id, u.id, { kalla: e.target.value })
                                            }
                                            className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none w-fit"
                                          >
                                            {källorFörU.map((k) => (
                                              <option key={k} value={k}>
                                                {k}
                                              </option>
                                            ))}
                                          </select>
                                          <LageKnappar
                                            value={u.lage}
                                            onChange={(lage) =>
                                              updateUndantag(m.id, u.id, { lage })
                                            }
                                          />
                                          {u.lage === 'schemalagd' && (
                                            <SchemaVäljare
                                              schema={u.schema}
                                              onChange={(patch) =>
                                                updateUndantag(m.id, u.id, {
                                                  schema: { ...u.schema, ...patch },
                                                })
                                              }
                                            />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}

                                {pend && (
                                  <div className="flex flex-col gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                                    <select
                                      value={pend.kalla}
                                      onChange={(e) =>
                                        updatePending(m.id, { kalla: e.target.value })
                                      }
                                      className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none"
                                    >
                                      {ledigaKällor.map((k) => (
                                        <option key={k} value={k}>
                                          {k}
                                        </option>
                                      ))}
                                    </select>
                                    <LageKnappar
                                      value={pend.lage}
                                      onChange={(lage) => updatePending(m.id, { lage })}
                                    />
                                    {pend.lage === 'schemalagd' && (
                                      <SchemaVäljare
                                        schema={pend.schema}
                                        onChange={(patch) =>
                                          updatePending(m.id, {
                                            schema: { ...pend.schema, ...patch },
                                          })
                                        }
                                      />
                                    )}
                                    <div className="flex gap-2 mt-1">
                                      <button
                                        onClick={() => savePending(m.id)}
                                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
                                      >
                                        Spara
                                      </button>
                                      <button
                                        onClick={() => cancelPending(m.id)}
                                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                                      >
                                        Avbryt
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-3">
                              {ledigaKällor.length > 0 && !pend && (
                                <button
                                  onClick={() => openPending(m.id, ledigaKällor)}
                                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
                                >
                                  + Källundantag
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
