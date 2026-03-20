import { type FormField, inputClass } from './kontoTypes'

export default function KontoInfo({ namn, epost, onUpdateNamn, onUpdateEpost, onSaveNamn, onSaveEpost }: {
  namn: FormField
  epost: FormField
  onUpdateNamn: (value: string) => void
  onUpdateEpost: (value: string) => void
  onSaveNamn: () => void
  onSaveEpost: () => void
}) {
  return (
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
              onChange={e => onUpdateNamn(e.target.value)}
              placeholder="Förnamn Efternamn"
              className={inputClass}
            />
            <button
              onClick={onSaveNamn}
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
              onChange={e => onUpdateEpost(e.target.value)}
              placeholder="din@epost.se"
              className={inputClass}
            />
            <button
              onClick={onSaveEpost}
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
  )
}
