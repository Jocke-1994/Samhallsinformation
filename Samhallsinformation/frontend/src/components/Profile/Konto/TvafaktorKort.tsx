import { useState } from 'react'
import Toggle from '../../common/Toggle'

type Metod = 'sms' | 'mail'

export default function TvafaktorKort({ harTelefon }: { harTelefon: boolean }) {
  const [aktiv, setAktiv] = useState(false)
  const [metod, setMetod] = useState<Metod>('mail')
  const [skickat, setSkickat] = useState(false)
  const [kod, setKod] = useState('')
  const [bekraftad, setBekraftad] = useState(false)

  function handleInaktivera() {
    setAktiv(false)
    setBekraftad(false)
    setSkickat(false)
    setKod('')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl shrink-0">
            🔐
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Tvåfaktorsautentisering</h2>
            <p className="text-sm text-slate-500 mt-0.5">Extra skydd vid inloggning</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Aktivera 2FA</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Vid inloggning krävs en engångskod utöver lösenordet.
            </p>
          </div>
          <Toggle on={aktiv} onChange={setAktiv} />
        </div>

        {aktiv && !bekraftad && (
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Skicka kod via
            </p>
            <div className="flex flex-col gap-2">
              {(
                [
                  {
                    value: 'mail',
                    label: 'E-post',
                    info: 'Kod skickas till din registrerade e-postadress.',
                  },
                  ...(harTelefon
                    ? [
                        {
                          value: 'sms' as Metod,
                          label: 'SMS',
                          info: 'Kod skickas till ditt registrerade telefonnummer.',
                        },
                      ]
                    : []),
                ] as { value: Metod; label: string; info: string }[]
              ).map(({ value, label, info }) => (
                <button
                  key={value}
                  onClick={() => {
                    setMetod(value)
                    setSkickat(false)
                    setKod('')
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${metod === value ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${metod === value ? 'border-violet-600' : 'border-slate-300'}`}
                  >
                    {metod === value && <span className="w-2 h-2 rounded-full bg-violet-600" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{info}</p>
                  </div>
                </button>
              ))}
              {!harTelefon && (
                <p className="text-xs text-slate-400">
                  Vill du använda SMS?{' '}
                  <span className="text-violet-600 font-medium">
                    Lägg till ett telefonnummer under Kontouppgifter.
                  </span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setSkickat(true)}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                Skicka kod
              </button>
              {skickat && <p className="text-xs text-green-600 font-medium">✓ Kod skickad</p>}
            </div>

            {skickat && (
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Ange kod
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={kod}
                    onChange={(e) => setKod(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    className="w-32 bg-slate-50 text-slate-900 text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-violet-400 focus:bg-white placeholder-slate-400 transition-colors tracking-widest font-mono"
                  />
                  <button
                    onClick={() => {
                      if (kod.trim()) setBekraftad(true)
                    }}
                    disabled={!kod.trim()}
                    className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    Bekräfta
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {aktiv && bekraftad && (
          <div className="flex flex-col gap-4 border-t border-slate-100 pt-5">
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <span className="text-green-600 text-lg">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-800">2FA är aktiverat</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Kod skickas via {metod === 'mail' ? 'e-post' : 'SMS'} vid inloggning.
                </p>
              </div>
            </div>
            <button
              onClick={handleInaktivera}
              className="self-start px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Inaktivera 2FA
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
