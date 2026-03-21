import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Toggle from '../../common/Toggle'

type Leveransläge = 'realtid' | 'daglig' | 'veckovis'
type Allvarlighet = 'Bra att veta' | 'Viktigt' | 'Kritisk'

const LEVERANS: { value: Leveransläge; label: string; desc: string }[] = [
  { value: 'realtid',  label: 'Realtid',              desc: 'Notis skickas direkt när något publiceras' },
  { value: 'daglig',   label: 'Daglig sammanfattning', desc: 'En sammanställning varje dag kl. 07:00' },
  { value: 'veckovis', label: 'Veckovis sammanfattning', desc: 'En sammanställning varje måndag kl. 07:00' },
]

const NIVAER: Allvarlighet[] = ['Bra att veta', 'Viktigt', 'Kritisk']

const NIVA_FARG: Record<Allvarlighet, string> = {
  'Bra att veta': 'text-slate-500',
  'Viktigt':      'text-orange-500',
  'Kritisk':      'text-red-500',
}

const NIVA_DOT: Record<Allvarlighet, string> = {
  'Bra att veta': 'bg-slate-400',
  'Viktigt':      'bg-orange-400',
  'Kritisk':      'bg-red-500',
}

interface Props {
  smsNummer: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{children}</p>
  )
}

export default function GlobalaInstallningar({ smsNummer }: Props) {
  const [mail, setMail]               = useState(true)
  const [sms, setSms]                 = useState(false)
  const [leverans, setLeverans]       = useState<Leveransläge>('realtid')
  const [nivaer, setNivaer]           = useState<Record<Allvarlighet, boolean>>({
    'Bra att veta': true,
    'Viktigt':      true,
    'Kritisk':      true,
  })
  const [pausad, setPausad]           = useState(false)
  const [pausTill, setPausTill]       = useState('')
  const [saved, setSaved]             = useState(false)
  const [testSkickat, setTestSkickat] = useState(false)

  const location   = useLocation()
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

  function handleTestnotis() {
    setTestSkickat(true)
    setTimeout(() => setTestSkickat(false), 3000)
  }

  function toggleNiva(niva: Allvarlighet) {
    setNivaer(prev => ({ ...prev, [niva]: !prev[niva] }))
  }

  return (
    <div
      id="globala-installningar"
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${highlighted ? 'card-highlight' : ''}`}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-blue-50 to-white border-b border-slate-100 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl shrink-0">⚙️</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Standardinställningar</h2>
            <p className="text-sm text-slate-500 mt-0.5">Gäller alla källor om inget annat är valt</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex flex-col gap-6">

        {/* Kanaler */}
        <div>
          <SectionLabel>Kanaler</SectionLabel>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">E-post</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  din@epost.se &middot;{' '}
                  <a href="/profil/konto" className="text-violet-500 hover:underline">Ändra under Konto</a>
                </p>
              </div>
              <Toggle on={mail} onChange={v => { setMail(v); setSaved(false) }} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">SMS</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {smsNummer} &middot;{' '}
                  <a href="/profil/konto" className="text-violet-500 hover:underline">Ändra under Konto</a>
                </p>
              </div>
              <Toggle on={sms} onChange={v => { setSms(v); setSaved(false) }} />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* Leveransläge */}
        <div>
          <SectionLabel>Leveransläge</SectionLabel>
          <div className="flex flex-col gap-2">
            {LEVERANS.map(l => (
              <label
                key={l.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  leverans === l.value
                    ? 'border-violet-300 bg-violet-50'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="leverans"
                  value={l.value}
                  checked={leverans === l.value}
                  onChange={() => { setLeverans(l.value); setSaved(false) }}
                  className="mt-0.5 accent-violet-600"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{l.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{l.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* Allvarlighetsfilter */}
        <div>
          <SectionLabel>Notifiera vid allvarlighetsgrad</SectionLabel>
          <div className="flex flex-col gap-2">
            {NIVAER.map(niva => (
              <div key={niva} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${NIVA_DOT[niva]}`} />
                  <p className={`text-sm font-semibold ${NIVA_FARG[niva]}`}>{niva}</p>
                </div>
                <Toggle on={nivaer[niva]} onChange={() => { toggleNiva(niva); setSaved(false) }} />
              </div>
            ))}
            {!nivaer['Kritisk'] && (
              <p className="text-xs text-red-400 mt-1">
                Observera: Kritiska händelser rekommenderas alltid att ta emot.
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* Pausläge */}
        <div>
          <SectionLabel>Pausläge</SectionLabel>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Pausa alla notiser</p>
                <p className="text-xs text-slate-400 mt-0.5">Dina inställningar bevaras och aktiveras igen automatiskt</p>
              </div>
              <Toggle on={pausad} onChange={v => { setPausad(v); setSaved(false) }} />
            </div>

            {pausad && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <span className="text-base">⏸️</span>
                <div className="flex items-center gap-2 flex-1">
                  <p className="text-xs text-amber-700 font-medium shrink-0">Pausa till</p>
                  <input
                    type="date"
                    value={pausTill}
                    onChange={e => setPausTill(e.target.value)}
                    className="text-xs bg-white border border-amber-200 rounded-lg px-2 py-1 text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* Spara + Testnotis */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow"
            >
              Spara
            </button>
            {saved && (
              <span className="text-xs font-medium text-green-600">✓ Sparat</span>
            )}
          </div>

          <button
            onClick={handleTestnotis}
            className="text-xs font-medium text-slate-500 hover:text-violet-600 transition-colors"
          >
            {testSkickat ? '✓ Testnotis skickad' : 'Skicka testnotis →'}
          </button>
        </div>

      </div>
    </div>
  )
}
