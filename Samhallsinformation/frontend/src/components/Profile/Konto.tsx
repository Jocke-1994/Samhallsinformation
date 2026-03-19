import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface FormField {
  value: string
  saved: boolean
  error: string
}

function makeField(initial: string): FormField {
  return { value: initial, saved: false, error: '' }
}

const inputClass = `
  w-full bg-slate-50 text-slate-900 text-sm px-4 py-3 rounded-xl
  border border-slate-200 focus:outline-none focus:border-violet-400 focus:bg-white
  placeholder-slate-400 transition-colors
`

export default function Konto() {
  const [namn, setNamn] = useState(makeField(''))
  const [epost, setEpost] = useState(makeField(''))
  const [gammalt, setGammalt] = useState(makeField(''))
  const [nytt, setNytt] = useState(makeField(''))
  const [bekrafta, setBekrafta] = useState(makeField(''))
  const [losenordSaved, setLosenordSaved] = useState(false)
  const [losenordError, setLosenordError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const location = useLocation()
  const [highlightId, setHighlightId] = useState<string | null>(location.state?.highlightId ?? null)

  useEffect(() => {
    if (!highlightId) return
    const timer = setTimeout(() => setHighlightId(null), 4200)
    return () => clearTimeout(timer)
  }, [highlightId])

  function update<T extends FormField>(setter: React.Dispatch<React.SetStateAction<T>>, value: string) {
    setter(prev => ({ ...prev, value, saved: false, error: '' }))
  }

  function save(setter: React.Dispatch<React.SetStateAction<FormField>>, validate?: () => string) {
    const err = validate?.() ?? ''
    if (err) { setter(prev => ({ ...prev, error: err, saved: false })); return }
    setter(prev => ({ ...prev, saved: true, error: '' }))
  }

  function handleLosenord() {
    setLosenordError('')
    setLosenordSaved(false)
    if (!gammalt.value) { setLosenordError('Ange ditt nuvarande lösenord.'); return }
    if (nytt.value.length < 8) { setLosenordError('Nytt lösenord måste vara minst 8 tecken.'); return }
    if (nytt.value !== bekrafta.value) { setLosenordError('Lösenorden matchar inte.'); return }
    setGammalt(makeField(''))
    setNytt(makeField(''))
    setBekrafta(makeField(''))
    setLosenordSaved(true)
  }

  function handleExport() {
    const data = {
      namn: namn.value || '(ej angivet)',
      epost: epost.value || '(ej angivet)',
      kallor: ['(mock) Polisen', '(mock) Trafikverket'],
      notifieringar: { kanal: 'e-post', regler: [] },
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'min-data.json'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6 mt-6 max-w-xl mx-auto w-full">

      {/* Avatar + namn-banner */}
      <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl px-8 py-8 flex items-center gap-6 shadow-md">
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-extrabold shrink-0 backdrop-blur-sm">
          {namn.value ? namn.value[0].toUpperCase() : 'JO'}
        </div>
        <div>
          <p className="text-white text-xl font-bold tracking-tight">
            {namn.value || 'Ditt namn'}
          </p>
          <p className="text-violet-200 text-sm mt-0.5">
            {epost.value || 'din@epost.se'}
          </p>
        </div>
      </div>

      {/* Kontouppgifter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">👤</div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Kontouppgifter</h2>
              <p className="text-sm text-slate-500 mt-0.5">Namn och e-postadress</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Namn */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Visningsnamn</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={namn.value}
                onChange={e => update(setNamn, e.target.value)}
                placeholder="Förnamn Efternamn"
                className={inputClass}
              />
              <button
                onClick={() => save(setNamn, () => namn.value.trim() ? '' : 'Ange ett namn.')}
                className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow shrink-0"
              >
                Spara
              </button>
            </div>
            {namn.error && <p className="text-xs text-red-500 font-medium">{namn.error}</p>}
            {namn.saved && <p className="text-xs text-green-600 font-medium">✓ Sparat</p>}
          </div>

          {/* E-post */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">E-postadress</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={epost.value}
                onChange={e => update(setEpost, e.target.value)}
                placeholder="din@epost.se"
                className={inputClass}
              />
              <button
                onClick={() => save(setEpost, () => epost.value.includes('@') ? '' : 'Ange en giltig e-postadress.')}
                className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow shrink-0"
              >
                Spara
              </button>
            </div>
            {epost.error && <p className="text-xs text-red-500 font-medium">{epost.error}</p>}
            {epost.saved && <p className="text-xs text-green-600 font-medium">✓ Sparat</p>}
          </div>
        </div>
      </div>

      {/* Byt lösenord */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl shrink-0">🔑</div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Byt lösenord</h2>
              <p className="text-sm text-slate-500 mt-0.5">Minst 8 tecken krävs</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nuvarande lösenord</label>
            <input
              type="password"
              value={gammalt.value}
              onChange={e => { setGammalt(makeField(e.target.value)); setLosenordSaved(false); setLosenordError('') }}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nytt lösenord</label>
            <input
              type="password"
              value={nytt.value}
              onChange={e => { setNytt(makeField(e.target.value)); setLosenordSaved(false); setLosenordError('') }}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bekräfta nytt lösenord</label>
            <input
              type="password"
              value={bekrafta.value}
              onChange={e => { setBekrafta(makeField(e.target.value)); setLosenordSaved(false); setLosenordError('') }}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          {losenordError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <span className="text-red-500 text-sm">⚠</span>
              <p className="text-xs font-medium text-red-600">{losenordError}</p>
            </div>
          )}
          {losenordSaved && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <span className="text-green-500 text-sm">✓</span>
              <p className="text-xs font-medium text-green-700">Lösenordet har ändrats.</p>
            </div>
          )}

          <button
            onClick={handleLosenord}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow w-fit"
          >
            Byt lösenord
          </button>
        </div>
      </div>

      {/* Datahantering */}
      <div id="datahantering" className={`bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden ${highlightId === 'datahantering' ? 'card-highlight' : ''}`}>
        <div className="px-6 pt-6 pb-5 border-b border-red-100 bg-gradient-to-br from-red-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl shrink-0">🗑️</div>
            <div>
              <h2 className="text-lg font-bold text-red-700">Datahantering</h2>
              <p className="text-sm text-red-400 mt-0.5">Export och permanent radering</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Export */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Exportera din data</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Ladda ner all data vi har om dig som JSON-fil (GDPR art. 20).
              </p>
            </div>
            <button
              onClick={handleExport}
              className="shrink-0 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-200"
            >
              Ladda ner
            </button>
          </div>

          {/* Radera */}
          <div className="border-t border-red-100 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-800">Radera konto</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Permanent radering av konto och all data. Kan inte ångras.
                </p>
              </div>
              {!showDeleteConfirm && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="shrink-0 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-500 text-sm font-semibold rounded-xl transition-colors border border-red-200"
                >
                  Radera
                </button>
              )}
            </div>

            {showDeleteConfirm && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-sm font-semibold text-slate-800">
                  Är du helt säker? Detta kan inte ångras.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    Ja, radera mitt konto
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-medium rounded-xl transition-colors"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}
