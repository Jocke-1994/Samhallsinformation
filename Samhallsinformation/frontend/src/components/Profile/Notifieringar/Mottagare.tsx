import { useState, useRef } from 'react'
import Toggle from '../../common/Toggle'

const MAX = 5

interface Mottagare {
  id:       number
  kontakt:  string
  smeknamn: string
  aktiv:    boolean
}

type SektionKey = 'epost' | 'sms' | 'push'

interface SektionDef {
  key:              SektionKey
  label:            string
  ikon:             string
  inputPlaceholder: string
  inputType:        string
}

const SEKTIONER: SektionDef[] = [
  { key: 'epost', label: 'E-POST', ikon: '📧', inputPlaceholder: 'namn@epost.se', inputType: 'email' },
  { key: 'sms',   label: 'SMS',    ikon: '📱', inputPlaceholder: '070-XXX XX XX', inputType: 'tel'   },
  { key: 'push',  label: 'PUSH',   ikon: '🔔', inputPlaceholder: 'Enhetens namn', inputType: 'text'  },
]

type AllData  = Record<SektionKey, Mottagare[]>
type FormData = Record<SektionKey, { kontakt: string; smeknamn: string; open: boolean }>

interface Editing {
  key:   SektionKey
  id:    number
  value: string
}

interface Saved {
  key: SektionKey
  id:  number
}

const INITIAL_DATA: AllData = {
  epost: [{ id: 1, kontakt: 'din@epost.se', smeknamn: '', aktiv: true }],
  sms:   [],
  push:  [],
}

let nextId = 10

export default function Mottagare() {
  const [data, setData]     = useState<AllData>(INITIAL_DATA)
  const [forms, setForms]   = useState<FormData>({
    epost: { kontakt: '', smeknamn: '', open: false },
    sms:   { kontakt: '', smeknamn: '', open: false },
    push:  { kontakt: '', smeknamn: '', open: false },
  })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [saved, setSaved]     = useState<Saved | null>(null)
  const inputRef              = useRef<HTMLInputElement>(null)

  function toggleAktiv(key: SektionKey, id: number) {
    setData(prev => ({ ...prev, [key]: prev[key].map(m => m.id === id ? { ...m, aktiv: !m.aktiv } : m) }))
    flashSaved(key, id)
  }

  function flashSaved(key: SektionKey, id: number) {
    setSaved({ key, id })
    setTimeout(() => setSaved(null), 2000)
  }

  function startEdit(key: SektionKey, id: number, current: string) {
    setEditing({ key, id, value: current })
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitEdit() {
    if (!editing) return
    setData(prev => ({
      ...prev,
      [editing.key]: prev[editing.key].map(m =>
        m.id === editing.id ? { ...m, smeknamn: editing.value.trim() } : m
      ),
    }))
    flashSaved(editing.key, editing.id)
    setEditing(null)
  }

  function cancelEdit() {
    setEditing(null)
  }

  function remove(key: SektionKey, id: number) {
    setData(prev => ({ ...prev, [key]: prev[key].filter(m => m.id !== id) }))
    if (editing?.key === key && editing?.id === id) setEditing(null)
  }

  function openForm(key: SektionKey) {
    setForms(prev => ({ ...prev, [key]: { kontakt: '', smeknamn: '', open: true } }))
  }

  function closeForm(key: SektionKey) {
    setForms(prev => ({ ...prev, [key]: { kontakt: '', smeknamn: '', open: false } }))
  }

  function addMottagare(key: SektionKey) {
    const form = forms[key]
    if (!form.kontakt.trim()) return
    setData(prev => ({
      ...prev,
      [key]: [...prev[key], { id: nextId++, kontakt: form.kontakt.trim(), smeknamn: form.smeknamn.trim(), aktiv: true }],
    }))
    closeForm(key)
  }

  const isEditing = (key: SektionKey, id: number) => editing?.key === key && editing?.id === id
  const isSaved   = (key: SektionKey, id: number) => saved?.key === key && saved?.id === id

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">

      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">📬</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Mottagare</h2>
            <p className="text-sm text-slate-500 mt-0.5">Välj vart dina notiser ska skickas</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col">
        {SEKTIONER.map((sek, i) => {
          const mottagare = data[sek.key]
          const atMax     = mottagare.length >= MAX
          const form      = forms[sek.key]

          return (
            <div key={sek.key}>
              {i > 0 && <div className="border-t border-slate-100 mb-6" />}

              {/* Sektionsrubrik */}
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{sek.label}</p>
                <span className={`text-xs font-semibold tabular-nums ${atMax ? 'text-red-400' : 'text-slate-400'}`}>
                  {mottagare.length}/{MAX}
                </span>
              </div>

              {/* Rader */}
              <div className="flex flex-col gap-2">
                {mottagare.length === 0 && !form.open && (
                  <p className="text-xs text-slate-300 py-1">Inga mottagare tillagda</p>
                )}

                {mottagare.map(m => (
                  <div key={m.id} className="flex items-center gap-2 group py-0.5">
                    <span className="text-base shrink-0">{sek.ikon}</span>
                    <span className="text-sm text-slate-700 font-medium shrink-0">{m.kontakt}</span>

                    {/* Smeknamn — klick för att redigera */}
                    {isEditing(sek.key, m.id) ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={inputRef}
                          type="text"
                          value={editing!.value}
                          onChange={e => setEditing(prev => prev ? { ...prev, value: e.target.value } : null)}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                          className="text-xs bg-white border border-violet-300 rounded-lg px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-violet-400"
                        />
                        <button onClick={commitEdit} className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">Spara</button>
                        <button onClick={cancelEdit} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(sek.key, m.id, m.smeknamn)}
                        className="text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg px-2 py-1 transition-colors text-left"
                        title="Klicka för att redigera smeknamn"
                      >
                        {m.smeknamn || <span className="italic text-slate-300">Smeknamn</span>}
                      </button>
                    )}

                    <div className="flex-1" />

                    {isSaved(sek.key, m.id) && (
                      <span className="text-xs text-green-500 font-medium shrink-0">✓ Sparat</span>
                    )}

                    <Toggle on={m.aktiv} onChange={() => toggleAktiv(sek.key, m.id)} />

                    <button
                      onClick={() => remove(sek.key, m.id)}
                      className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition-all ml-1 shrink-0"
                    >
                      Ta bort
                    </button>
                  </div>
                ))}

                {/* Lägg till-formulär */}
                {form.open && (
                  <div className="flex items-center gap-2 mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type={sek.inputType}
                      value={form.kontakt}
                      onChange={e => setForms(prev => ({ ...prev, [sek.key]: { ...prev[sek.key], kontakt: e.target.value } }))}
                      placeholder={sek.inputPlaceholder}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-violet-300"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') addMottagare(sek.key); if (e.key === 'Escape') closeForm(sek.key) }}
                    />
                    <input
                      type="text"
                      value={form.smeknamn}
                      onChange={e => setForms(prev => ({ ...prev, [sek.key]: { ...prev[sek.key], smeknamn: e.target.value } }))}
                      placeholder="Smeknamn (valfritt)"
                      className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-violet-300"
                      onKeyDown={e => { if (e.key === 'Enter') addMottagare(sek.key); if (e.key === 'Escape') closeForm(sek.key) }}
                    />
                    <button
                      onClick={() => addMottagare(sek.key)}
                      className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    >
                      Lägg till
                    </button>
                    <button
                      onClick={() => closeForm(sek.key)}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                    >
                      Avbryt
                    </button>
                  </div>
                )}
              </div>

              {/* Lägg till + max-varning */}
              <div className="mt-3 text-center">
                {atMax ? (
                  <p className="text-xs text-slate-300">
                    Max {MAX} mottagare per kanal — ta bort en för att lägga till fler.
                  </p>
                ) : (
                  !form.open && (
                    <button
                      onClick={() => openForm(sek.key)}
                      className="text-xs font-semibold text-violet-600 hover:text-violet-800 hover:bg-violet-50 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      + Lägg till
                    </button>
                  )
                )}
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}
