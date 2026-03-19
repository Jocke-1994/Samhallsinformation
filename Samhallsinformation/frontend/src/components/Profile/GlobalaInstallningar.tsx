import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface Props {
  smsNummer: string
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${on ? 'bg-violet-600' : 'bg-slate-200'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function GlobalaInstallningar({ smsNummer }: Props) {
  const [mail, setMail] = useState(true)
  const [sms, setSms] = useState(false)
  const [saved, setSaved] = useState(false)
  const location = useLocation()
  const [highlighted, setHighlighted] = useState(location.state?.highlightId === 'globala-installningar')

  useEffect(() => {
    if (!highlighted) return
    const timer = setTimeout(() => setHighlighted(false), 4200)
    return () => clearTimeout(timer)
  }, [highlighted])

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div id="globala-installningar" className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${highlighted ? 'card-highlight' : ''}`}>
      <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-blue-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl shrink-0">⚙️</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Standardinställningar</h2>
            <p className="text-sm text-slate-500 mt-0.5">Gäller alla källor om inget annat är valt</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-4">

        {/* Mail-toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">E-post</p>
            <p className="text-xs text-slate-400 mt-0.5">Notiser skickas till din registrerade e-post</p>
          </div>
          <Toggle on={mail} onChange={v => { setMail(v); setSaved(false) }} />
        </div>

        {/* SMS-toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">SMS</p>
            <p className="text-xs text-slate-400 mt-0.5">{smsNummer}</p>
          </div>
          <Toggle on={sms} onChange={v => { setSms(v); setSaved(false) }} />
        </div>

        {/* SMS-nummer info */}
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
          <span className="text-base">📱</span>
          <p className="text-xs text-slate-500">
            Mobilnummer ändras under{' '}
            <span className="font-semibold text-slate-700">Konto</span>
          </p>
        </div>

        {/* Spara */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow"
          >
            Spara
          </button>
          {saved && (
            <span className="text-xs font-medium text-green-600 flex items-center gap-1">
              ✓ Sparat
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
