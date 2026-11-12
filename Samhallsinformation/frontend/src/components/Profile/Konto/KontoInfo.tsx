import { type FormField, inputClass } from './kontoTypes'

export default function KontoInfo({
  namn,
  epost,
  pendingEmail,
  requiresPassword,
  sparar = false,
  emailPassword,
  onUpdateNamn,
  onUpdateEpost,
  onSaveNamn,
  onUpdateEmailPassword,
  onRequestEmailChange,
  onCancelEmailChange,
}: {
  namn: FormField
  epost: FormField
  pendingEmail: string | null
  requiresPassword: boolean
  // Ett sparanrop pågår — alla knappar i kortet är låsta så inget skickas två gånger.
  sparar?: boolean
  emailPassword: string
  onUpdateNamn: (value: string) => void
  onUpdateEpost: (value: string) => void
  onSaveNamn: () => void
  onUpdateEmailPassword: (value: string) => void
  onRequestEmailChange: () => void
  onCancelEmailChange: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">
            👤
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Kontouppgifter</h2>
            <p className="text-sm text-slate-500 mt-0.5">Namn och e-postadress</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">
        {/* Namn */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Visningsnamn
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={namn.value}
              onChange={(e) => onUpdateNamn(e.target.value)}
              placeholder="Förnamn Efternamn"
              className={inputClass}
            />
            <button
              onClick={onSaveNamn}
              disabled={sparar}
              className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow w-full sm:w-auto sm:shrink-0"
            >
              {sparar ? 'Sparar…' : 'Spara'}
            </button>
          </div>
          {namn.error && (
            <p role="alert" className="text-xs text-red-500 font-medium">
              {namn.error}
            </p>
          )}
          {namn.saved && <p className="text-xs text-green-600 font-medium">✓ Sparat</p>}
        </div>

        {/* E-post */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            E-postadress
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={epost.value}
              onChange={(e) => onUpdateEpost(e.target.value)}
              placeholder="din@epost.se"
              className={inputClass}
            />
            {!requiresPassword && (
              <button
                onClick={onRequestEmailChange}
                disabled={sparar}
                className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow w-full sm:w-auto sm:shrink-0"
              >
                {sparar ? 'Skickar…' : 'Skicka bekräftelse'}
              </button>
            )}
          </div>
          {requiresPassword && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={emailPassword}
                onChange={(e) => onUpdateEmailPassword(e.target.value)}
                placeholder="Nuvarande lösenord"
                className={inputClass}
              />
              <button
                onClick={onRequestEmailChange}
                disabled={sparar}
                className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow w-full sm:w-auto sm:shrink-0"
              >
                {sparar ? 'Skickar…' : 'Skicka bekräftelse'}
              </button>
            </div>
          )}
          {requiresPassword && (
            <p className="text-xs text-slate-400">
              Vi ber om ditt lösenord för att bekräfta att det är du som byter e-post.
            </p>
          )}
          {epost.error && (
            <p role="alert" className="text-xs text-red-500 font-medium">
              {epost.error}
            </p>
          )}
          {pendingEmail && (
            <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-800">
                📧 Bekräftelse skickad till <strong>{pendingEmail}</strong>. Klicka länken i mejlet
                för att slutföra bytet — giltig i 24 timmar. Din nuvarande adress fungerar som
                vanligt tills dess.
              </p>
              <button
                onClick={onCancelEmailChange}
                disabled={sparar}
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
              >
                Avbryt
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
