import { useState } from 'react'
import Toggle from '../../common/Toggle'

type DagVal = 'alla' | 'vardagar' | 'helger'
type KanalIkon = Record<string, string>

const KANAL_IKON: KanalIkon = { epost: '📧', sms: '📱', push: '🔔' }

const DAGAR: { key: DagVal; label: string }[] = [
  { key: 'alla', label: 'Alla dagar' },
  { key: 'vardagar', label: 'Vardagar' },
  { key: 'helger', label: 'Helger' },
]

const MOCK_MOTTAGARE = [
  { id: 1, namn: 'Mig', kontakt: 'din@epost.se', kanal: 'epost' },
  { id: 2, namn: 'Mamma', kontakt: '073-XXX XX XX', kanal: 'sms' },
  { id: 3, namn: 'Mormor', kontakt: '076-XXX XX XX', kanal: 'sms' },
  { id: 4, namn: 'iPhone', kontakt: 'iPhone', kanal: 'push' },
]

const MOCK_KALLOR = ['Polisen', 'SMHI', 'MSB', 'Trafikverket']

interface Schema {
  id: number
  mottagareIds: number[]
  start: string
  slut: string
  dagar: DagVal
  undantag: string[]
}

interface TillfälligRegel {
  id: number
  datum: string
  start: string
  slut: string
  mottagareIds: number[]
  kallor: string[]
}

let nextSchemaId = 10
let nextTillfId = 10

const INIT_SCHEMAN: Schema[] = [
  { id: 1, mottagareIds: [1], start: '19:00', slut: '08:00', dagar: 'alla', undantag: ['Polisen'] },
  {
    id: 2,
    mottagareIds: [2, 3],
    start: '23:00',
    slut: '06:00',
    dagar: 'alla',
    undantag: ['Polisen', 'MSB'],
  },
  { id: 3, mottagareIds: [1, 2], start: '22:00', slut: '07:00', dagar: 'helger', undantag: [] },
]

const INIT_TILLFÄLLIGA: TillfälligRegel[] = []

const DAG_LABEL: Record<DagVal, string> = {
  alla: 'Alla dagar',
  vardagar: 'Vardagar',
  helger: 'Helger',
}

function MottagareChip({ id }: { id: number }) {
  const m = MOCK_MOTTAGARE.find((m) => m.id === id)
  if (!m) return null
  return (
    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
      <span>{KANAL_IKON[m.kanal]}</span>
      {m.namn}
    </span>
  )
}

function emptySchema(): Omit<Schema, 'id'> {
  return { mottagareIds: [], start: '22:00', slut: '07:00', dagar: 'alla', undantag: [] }
}

function emptyTillfällig(): Omit<TillfälligRegel, 'id'> {
  return { datum: '', start: '12:00', slut: '14:00', mottagareIds: [], kallor: [] }
}

function MultiToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
            value === o.key
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function CheckboxList({
  items,
  selected,
  onChange,
  renderLabel,
}: {
  items: string[]
  selected: string[]
  onChange: (v: string[]) => void
  renderLabel?: (item: string) => React.ReactNode
}) {
  function toggle(item: string) {
    onChange(selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => toggle(item)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
            selected.includes(item)
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          <span
            className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-colors ${
              selected.includes(item)
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'border-slate-300'
            }`}
          >
            {selected.includes(item) && <span className="text-[8px] leading-none">✓</span>}
          </span>
          {renderLabel ? renderLabel(item) : item}
        </button>
      ))}
    </div>
  )
}

function SchemaForm({
  init,
  onSave,
  onCancel,
  saveLabel = 'Spara regel',
}: {
  init: Omit<Schema, 'id'>
  onSave: (s: Omit<Schema, 'id'>) => void
  onCancel: () => void
  saveLabel?: string
}) {
  const [form, setForm] = useState(init)

  const mottagareItems = MOCK_MOTTAGARE.map((m) => String(m.id))
  const selectedIds = form.mottagareIds.map(String)

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Mottagare */}
        <div className="col-span-2">
          <p className="text-xs font-semibold text-slate-500 mb-2">Mottagare</p>
          <CheckboxList
            items={mottagareItems}
            selected={selectedIds}
            onChange={(v) => setForm((f) => ({ ...f, mottagareIds: v.map(Number) }))}
            renderLabel={(id) => {
              const m = MOCK_MOTTAGARE.find((m) => String(m.id) === id)
              return m ? (
                <span className="flex items-center gap-1">
                  {KANAL_IKON[m.kanal]} {m.namn}
                </span>
              ) : (
                id
              )
            }}
          />
        </div>

        {/* Tid */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Tyst från</p>
          <input
            type="time"
            value={form.start}
            onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
            className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Tyst till</p>
          <input
            type="time"
            value={form.slut}
            onChange={(e) => setForm((f) => ({ ...f, slut: e.target.value }))}
            className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>

        {/* Dagar */}
        <div className="col-span-2">
          <p className="text-xs font-semibold text-slate-500 mb-2">Gäller</p>
          <MultiToggle
            options={DAGAR}
            value={form.dagar}
            onChange={(v) => setForm((f) => ({ ...f, dagar: v }))}
          />
        </div>

        {/* Undantag */}
        <div className="col-span-2">
          <p className="text-xs font-semibold text-slate-500 mb-2">Undantag — passerar alltid</p>
          <CheckboxList
            items={MOCK_KALLOR}
            selected={form.undantag}
            onChange={(v) => setForm((f) => ({ ...f, undantag: v }))}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-3 py-1.5"
        >
          Avbryt
        </button>
        <button
          onClick={() => {
            if (form.mottagareIds.length > 0) onSave(form)
          }}
          disabled={form.mottagareIds.length === 0}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  )
}

function TillfälligForm({
  init,
  onSave,
  onCancel,
  saveLabel = 'Spara undantag',
}: {
  init: Omit<TillfälligRegel, 'id'>
  onSave: (r: Omit<TillfälligRegel, 'id'>) => void
  onCancel: () => void
  saveLabel?: string
}) {
  const [form, setForm] = useState(init)

  const mottagareItems = MOCK_MOTTAGARE.map((m) => String(m.id))
  const selectedIds = form.mottagareIds.map(String)

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Datum */}
        <div className="col-span-2">
          <p className="text-xs font-semibold text-slate-500 mb-2">Datum</p>
          <input
            type="date"
            value={form.datum}
            onChange={(e) => setForm((f) => ({ ...f, datum: e.target.value }))}
            className="text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>

        {/* Tid */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Från</p>
          <input
            type="time"
            value={form.start}
            onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
            className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Till</p>
          <input
            type="time"
            value={form.slut}
            onChange={(e) => setForm((f) => ({ ...f, slut: e.target.value }))}
            className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>

        {/* Mottagare */}
        <div className="col-span-2">
          <p className="text-xs font-semibold text-slate-500 mb-2">Mottagare</p>
          <CheckboxList
            items={mottagareItems}
            selected={selectedIds}
            onChange={(v) => setForm((f) => ({ ...f, mottagareIds: v.map(Number) }))}
            renderLabel={(id) => {
              const m = MOCK_MOTTAGARE.find((m) => String(m.id) === id)
              return m ? (
                <span className="flex items-center gap-1">
                  {KANAL_IKON[m.kanal]} {m.namn}
                </span>
              ) : (
                id
              )
            }}
          />
        </div>

        {/* Källor att tysta */}
        <div className="col-span-2">
          <p className="text-xs font-semibold text-slate-500 mb-2">Tysta dessa källor</p>
          <CheckboxList
            items={MOCK_KALLOR}
            selected={form.kallor}
            onChange={(v) => setForm((f) => ({ ...f, kallor: v }))}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors px-3 py-1.5"
        >
          Avbryt
        </button>
        <button
          onClick={() => {
            if (form.datum && form.mottagareIds.length > 0 && form.kallor.length > 0) onSave(form)
          }}
          disabled={!form.datum || form.mottagareIds.length === 0 || form.kallor.length === 0}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  )
}

export default function StorEj() {
  const [aktiv, setAktiv] = useState(true)
  const [scheman, setScheman] = useState<Schema[]>(INIT_SCHEMAN)
  const [tillfälliga, setTillfälliga] = useState<TillfälligRegel[]>(INIT_TILLFÄLLIGA)
  const [visaSchemaForm, setVisaSchemaForm] = useState(false)
  const [visaTillfForm, setVisaTillfForm] = useState(false)
  const [editSchemaId, setEditSchemaId] = useState<number | null>(null)
  const [editTillfId, setEditTillfId] = useState<number | null>(null)
  const [mergeSuggestion, setMergeSuggestion] = useState<{
    existingId: number
    newMottagare: number[]
    pendingSchema: Omit<Schema, 'id'>
  } | null>(null)

  function sameUndantag(a: string[], b: string[]) {
    return a.length === b.length && [...a].sort().join() === [...b].sort().join()
  }

  function addSchema(s: Omit<Schema, 'id'>) {
    const match = scheman.find(
      (r) =>
        r.start === s.start &&
        r.slut === s.slut &&
        r.dagar === s.dagar &&
        sameUndantag(r.undantag, s.undantag),
    )
    if (match) {
      const nyaMottagare = s.mottagareIds.filter((id) => !match.mottagareIds.includes(id))
      if (nyaMottagare.length > 0) {
        setMergeSuggestion({ existingId: match.id, newMottagare: nyaMottagare, pendingSchema: s })
        setVisaSchemaForm(false)
        return
      }
    }
    setScheman((prev) => [...prev, { ...s, id: nextSchemaId++ }])
    setVisaSchemaForm(false)
  }

  function confirmMerge() {
    if (!mergeSuggestion) return
    setScheman((prev) =>
      prev.map((r) =>
        r.id === mergeSuggestion.existingId
          ? { ...r, mottagareIds: [...r.mottagareIds, ...mergeSuggestion.newMottagare] }
          : r,
      ),
    )
    setMergeSuggestion(null)
  }

  function declineMerge() {
    if (!mergeSuggestion) return
    setScheman((prev) => [...prev, { ...mergeSuggestion.pendingSchema, id: nextSchemaId++ }])
    setMergeSuggestion(null)
  }

  function updateSchema(id: number, s: Omit<Schema, 'id'>) {
    setScheman((prev) => prev.map((r) => (r.id === id ? { ...s, id } : r)))
    setEditSchemaId(null)
  }

  function removeSchema(id: number) {
    setScheman((prev) => prev.filter((s) => s.id !== id))
    if (editSchemaId === id) setEditSchemaId(null)
  }

  function addTillfällig(r: Omit<TillfälligRegel, 'id'>) {
    setTillfälliga((prev) => [...prev, { ...r, id: nextTillfId++ }])
    setVisaTillfForm(false)
  }

  function updateTillfällig(id: number, r: Omit<TillfälligRegel, 'id'>) {
    setTillfälliga((prev) => prev.map((t) => (t.id === id ? { ...r, id } : t)))
    setEditTillfId(null)
  }

  function removeTillfällig(id: number) {
    setTillfälliga((prev) => prev.filter((r) => r.id !== id))
    if (editTillfId === id) setEditTillfId(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl shrink-0">
              🌙
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Stör ej</h2>
              <p className="text-sm text-slate-500 mt-0.5">Tysta notiser under valda tider</p>
            </div>
          </div>
          <Toggle on={aktiv} onChange={() => setAktiv((p) => !p)} />
        </div>
      </div>

      <div
        className={`transition-opacity ${aktiv ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}
      >
        {/* Schemalagda regler */}
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Schemalagda regler
            </p>
            {!visaSchemaForm && (
              <button
                onClick={() => setVisaSchemaForm(true)}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                + Lägg till
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {scheman.map((s) =>
              editSchemaId === s.id ? (
                <SchemaForm
                  key={s.id}
                  init={{
                    mottagareIds: s.mottagareIds,
                    start: s.start,
                    slut: s.slut,
                    dagar: s.dagar,
                    undantag: s.undantag,
                  }}
                  onSave={(updated) => updateSchema(s.id, updated)}
                  onCancel={() => setEditSchemaId(null)}
                  saveLabel="Spara ändringar"
                />
              ) : (
                <div
                  key={s.id}
                  className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 group transition-colors border-l-4 ${
                    mergeSuggestion?.existingId === s.id
                      ? 'bg-indigo-50 border-2 border-indigo-400 ring-2 ring-indigo-100'
                      : 'bg-slate-50 border-l-indigo-300'
                  }`}
                >
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-indigo-400 font-bold">🔁</span>
                      {s.mottagareIds.map((id) => (
                        <MottagareChip key={id} id={id} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      🕙 {s.start} → {s.slut} · {DAG_LABEL[s.dagar]}
                    </p>
                    {s.undantag.length > 0 && (
                      <p className="text-xs text-slate-400">Undantag: {s.undantag.join(', ')}</p>
                    )}
                  </div>
                  <div className="hover-reveal flex items-center gap-2 transition-all shrink-0 mt-0.5">
                    <button
                      onClick={() => {
                        setEditSchemaId(s.id)
                        setVisaSchemaForm(false)
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Ändra
                    </button>
                    <button
                      onClick={() => removeSchema(s.id)}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      - Ta bort
                    </button>
                  </div>
                </div>
              ),
            )}

            {scheman.length === 0 && !visaSchemaForm && !mergeSuggestion && (
              <p className="text-xs text-slate-300 py-1">Inga schemalagda regler</p>
            )}

            {/* Merge-förslag */}
            {mergeSuggestion && (
              <div className="border border-indigo-200 bg-white rounded-xl px-4 py-3 flex flex-col gap-2.5">
                <p className="text-xs font-semibold text-indigo-900">
                  Den markerade regeln har samma inställningar — vill du lägga till{' '}
                  <span className="font-bold">
                    {mergeSuggestion.newMottagare
                      .map((id) => MOCK_MOTTAGARE.find((m) => m.id === id)?.namn ?? id)
                      .join(', ')}
                  </span>{' '}
                  i den istället för att skapa en ny?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={confirmMerge}
                    className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Ja, slå ihop
                  </button>
                  <button
                    onClick={declineMerge}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Nej, skapa separat
                  </button>
                </div>
              </div>
            )}

            {visaSchemaForm && (
              <SchemaForm
                init={emptySchema()}
                onSave={addSchema}
                onCancel={() => setVisaSchemaForm(false)}
              />
            )}
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* Tillfälliga undantag */}
        <div className="px-6 pt-4 pb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Tillfälliga undantag
            </p>
            {!visaTillfForm && (
              <button
                onClick={() => setVisaTillfForm(true)}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                + Lägg till
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {tillfälliga.map((r) =>
              editTillfId === r.id ? (
                <TillfälligForm
                  key={r.id}
                  init={{
                    datum: r.datum,
                    start: r.start,
                    slut: r.slut,
                    mottagareIds: r.mottagareIds,
                    kallor: r.kallor,
                  }}
                  onSave={(updated) => updateTillfällig(r.id, updated)}
                  onCancel={() => setEditTillfId(null)}
                  saveLabel="Spara ändringar"
                />
              ) : (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-3 bg-amber-50 border-l-4 border-l-amber-300 rounded-xl px-4 py-3 group"
                >
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-amber-500 font-bold">📅</span>
                      {r.mottagareIds.map((id) => (
                        <MottagareChip key={id} id={id} />
                      ))}
                    </div>
                    <p className="text-xs font-medium text-slate-700">
                      🕙 {r.datum} · {r.start}–{r.slut}
                    </p>
                    <p className="text-xs text-slate-400">Tystar: {r.kallor.join(', ')}</p>
                  </div>
                  <div className="hover-reveal flex items-center gap-2 transition-all shrink-0 mt-0.5">
                    <button
                      onClick={() => {
                        setEditTillfId(r.id)
                        setVisaTillfForm(false)
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Ändra
                    </button>
                    <button
                      onClick={() => removeTillfällig(r.id)}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      - Ta bort
                    </button>
                  </div>
                </div>
              ),
            )}

            {tillfälliga.length === 0 && !visaTillfForm && (
              <p className="text-xs text-slate-300 py-1">Inga tillfälliga undantag</p>
            )}

            {visaTillfForm && (
              <TillfälligForm
                init={emptyTillfällig()}
                onSave={addTillfällig}
                onCancel={() => setVisaTillfForm(false)}
              />
            )}
          </div>
        </div>

        {/* Kritisk-varning */}
        <div className="mx-6 mb-5 flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <span className="text-base shrink-0 mt-0.5">⚠️</span>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-amber-900">
              Kritiska notiser skickas alltid, oavsett regler
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Allvarlighetsgraden sätts per händelse — vilken källa som helst kan skicka en kritisk
              notis.
            </p>
            <p className="text-xs text-amber-700">
              Exempel: VMA, SMHI klass 3-varning, kemikalieolyckor, större infrastrukturincidenter
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
