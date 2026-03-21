import { useState } from 'react'

type Kanal = 'epost' | 'sms' | 'push'
type Filter = 'alla' | Kanal

interface Notis {
  id:        number
  tid:       string
  kalla:     string
  kanal:     Kanal
  mottagare: string
  rubrik:    string
}

const KANAL_IKON: Record<Kanal, string> = {
  epost: '📧',
  sms:   '📱',
  push:  '🔔',
}

const KANAL_LABEL: Record<Kanal, string> = {
  epost: 'E-post',
  sms:   'SMS',
  push:  'Push',
}

const MOCK: Notis[] = [
  { id: 1,  tid: '2026-03-21 08:14', kalla: 'Polisen',     kanal: 'epost', mottagare: 'Mig',    rubrik: 'Trafikolycka på E6 vid Göteborg' },
  { id: 2,  tid: '2026-03-21 08:14', kalla: 'Polisen',     kanal: 'sms',   mottagare: 'Mamma',  rubrik: 'Trafikolycka på E6 vid Göteborg' },
  { id: 3,  tid: '2026-03-20 19:02', kalla: 'SMHI',        kanal: 'epost', mottagare: 'Mig',    rubrik: 'Klass 1-varning för snö i Norrland' },
  { id: 4,  tid: '2026-03-20 12:30', kalla: 'MSB',         kanal: 'push',  mottagare: 'Mig',    rubrik: 'Viktigt meddelande till allmänheten' },
  { id: 5,  tid: '2026-03-20 09:45', kalla: 'Trafikverket',kanal: 'epost', mottagare: 'Mig',    rubrik: 'Planerat vägarbete på riksväg 40' },
  { id: 6,  tid: '2026-03-19 16:20', kalla: 'Polisen',     kanal: 'sms',   mottagare: 'Mormor', rubrik: 'Inbrott rapporterat i Majorna' },
  { id: 7,  tid: '2026-03-19 11:05', kalla: 'SMHI',        kanal: 'epost', mottagare: 'Mig',    rubrik: 'Gult vädervarning — hård vind' },
  { id: 8,  tid: '2026-03-18 08:00', kalla: 'MSB',         kanal: 'push',  mottagare: 'Mig',    rubrik: 'Övning VMA — ingen fara föreligger' },
]

const FLIKAR: { key: Filter; label: string }[] = [
  { key: 'alla',  label: 'Alla'   },
  { key: 'epost', label: 'E-post' },
  { key: 'sms',   label: 'SMS'    },
  { key: 'push',  label: 'Push'   },
]

function formatTid(tid: string): { datum: string; klocka: string } {
  const [datum, klocka] = tid.split(' ')
  return { datum, klocka }
}

export default function NotisHistorik() {
  const [filter, setFilter] = useState<Filter>('alla')

  const visade = filter === 'alla' ? MOCK : MOCK.filter(n => n.kanal === filter)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">

      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">📋</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Notifieringshistorik</h2>
            <p className="text-sm text-slate-500 mt-0.5">Senast skickade notiser</p>
          </div>
        </div>
      </div>

      {/* Filterflikar */}
      <div className="px-6 pt-4 pb-0 flex gap-1 border-b border-slate-100">
        {FLIKAR.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-8 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
              filter === f.key
                ? 'text-violet-600 border-violet-500 bg-violet-50'
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            {f.label}
            {f.key !== 'alla' && (
              <span className="ml-1.5 text-slate-300 font-normal">
                {MOCK.filter(n => n.kanal === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {visade.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-slate-400">Inga notiser skickade via {KANAL_LABEL[filter as Kanal]}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {visade.map(n => {
            const { datum, klocka } = formatTid(n.tid)
            return (
              <div key={n.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors">

                {/* Tidsstämpel */}
                <div className="text-right shrink-0 w-20">
                  <p className="text-xs font-medium text-slate-700">{klocka}</p>
                  <p className="text-xs text-slate-400">{datum}</p>
                </div>

                <div className="w-px h-8 bg-slate-100 shrink-0" />

                {/* Kanal + mottagare */}
                <div className="shrink-0 w-44">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{KANAL_IKON[n.kanal]}</span>
                    <span className="text-xs font-medium text-slate-600">{n.mottagare}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{KANAL_LABEL[n.kanal]}</p>
                </div>

                <div className="w-px h-8 bg-slate-100 shrink-0" />

                {/* Källa + rubrik */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-500 mb-0.5">{n.kalla}</p>
                  <p className="text-sm text-slate-700 truncate">{n.rubrik}</p>
                </div>

              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
