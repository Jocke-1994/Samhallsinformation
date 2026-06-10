import { useState } from 'react'
import { FLAG_GRUPPER, type FlagKey, type FlagState } from '../../lib/featureFlags'

interface Props {
  flaggor: FlagState
  onVäxla: (key: FlagKey) => void
  onÅterställ: () => void
}

export default function FeatureFlagsAdmin({ flaggor, onVäxla, onÅterställ }: Props) {
  const [öppna, setÖppna] = useState<Set<string>>(new Set())

  function växlaGrupp(key: string) {
    setÖppna(prev => {
      const ny = new Set(prev)
      if (ny.has(key)) ny.delete(key)
      else ny.add(key)
      return ny
    })
  }

  const totalAktiva = Object.values(flaggor).filter(Boolean).length
  const total = Object.keys(flaggor).length

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{totalAktiva} av {total} funktioner aktiverade</p>
        <button
          onClick={onÅterställ}
          className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Återställ standardvärden
        </button>
      </div>

      {/* Accordion-kort */}
      <div className="flex flex-col gap-3">
        {FLAG_GRUPPER.map(grupp => {
          const öppen = öppna.has(grupp.key)
          const aktivaIGrupp = grupp.flaggor.filter(f => flaggor[f.key]).length
          const totalIGrupp = grupp.flaggor.length
          const allaAktiva = aktivaIGrupp === totalIGrupp

          return (
            <div key={grupp.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">

              {/* Kort-header */}
              <button
                onClick={() => växlaGrupp(grupp.key)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base">{grupp.ikon}</span>
                  <span className="text-sm font-semibold text-slate-800">{grupp.label}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    allaAktiva ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {aktivaIGrupp}/{totalIGrupp} aktiva
                  </span>
                </div>
                <span className={`text-slate-400 text-xs transition-transform duration-200 ${öppen ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>

              {/* Under-flaggor */}
              {öppen && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {grupp.flaggor.map(flagga => {
                    const aktiv = flaggor[flagga.key]
                    return (
                      <div
                        key={flagga.key}
                        className={`flex items-center justify-between px-5 py-3 transition-colors ${
                          aktiv ? '' : 'opacity-50'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-slate-700">{flagga.label}</span>
                          <span className="text-xs text-slate-400">{flagga.beskrivning}</span>
                        </div>
                        <button
                          onClick={() => onVäxla(flagga.key)}
                          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-6 ${
                            aktiv ? 'bg-violet-600' : 'bg-slate-300'
                          }`}
                          aria-label={`${aktiv ? 'Inaktivera' : 'Aktivera'} ${flagga.label}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                            aktiv ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

            </div>
          )
        })}
      </div>

    </div>
  )
}
