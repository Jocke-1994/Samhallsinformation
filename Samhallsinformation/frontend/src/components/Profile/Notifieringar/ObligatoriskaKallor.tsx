import { useNavigate } from 'react-router'
import type { AllData, SektionKey } from './index'

const KANAL_IKON: Record<SektionKey, string> = { epost: '📧', sms: '📱', push: '🔔' }
const KANAL_CLS: Record<SektionKey, string> = {
  epost: 'bg-violet-50 text-violet-600 border-violet-200',
  sms: 'bg-sky-50 text-sky-600 border-sky-200',
  push: 'bg-amber-50 text-amber-600 border-amber-200',
}

const OBLIGATORISKA = [
  { id: 'kris', namn: 'Krisinformation.se', beskrivning: 'Nationell krisinformation' },
  { id: 'msb', namn: 'MSB — VMA', beskrivning: 'Viktigt meddelande till allmänheten' },
]

const SEKTIONER: SektionKey[] = ['epost', 'sms', 'push']

export default function ObligatoriskaKallor({ data }: { data: AllData }) {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
            🔒
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Obligatoriska källor</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Skickas alltid oavsett dina övriga inställningar
            </p>
          </div>
        </div>
      </div>

      {/* Källista */}
      <div className="divide-y divide-slate-100">
        {OBLIGATORISKA.map((källa) => {
          const aktiva = SEKTIONER.map((key) => ({
            key,
            kontakter: data[key].filter((m) => m.aktiv),
          })).filter((s) => s.kontakter.length > 0)

          return (
            <div key={källa.id} className="px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{källa.namn}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{källa.beskrivning}</p>
                </div>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                  ⚡ Direkt
                </span>
              </div>

              {aktiva.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-3">
                  {aktiva.map(({ key, kontakter }) => (
                    <div
                      key={key}
                      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${KANAL_CLS[key]}`}
                    >
                      <span>{KANAL_IKON[key]}</span>
                      <span>{kontakter.map((m) => m.smeknamn || m.kontakt).join(' · ')}</span>
                      <span className="opacity-40 text-[10px]">🔒</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-300 mt-2 italic">
                  Inga aktiva mottagare — aktivera i Mottagare-kortet
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Vill du ändra dessa inställningar?{' '}
          <button
            onClick={() => navigate('/profil?section=support')}
            className="text-violet-500 hover:text-violet-700 font-medium transition-colors"
          >
            Kontakta support
          </button>
        </p>
      </div>
    </div>
  )
}
