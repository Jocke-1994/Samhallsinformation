import { useState } from 'react'
import { makeField, inputClass } from './kontoTypes'

export default function LösenordByte() {
  const [gammalt, setGammalt] = useState(makeField(''))
  const [nytt, setNytt] = useState(makeField(''))
  const [bekrafta, setBekrafta] = useState(makeField(''))
  const [losenordSaved, setLosenordSaved] = useState(false)
  const [losenordError, setLosenordError] = useState('')

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

  return (
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
  )
}
