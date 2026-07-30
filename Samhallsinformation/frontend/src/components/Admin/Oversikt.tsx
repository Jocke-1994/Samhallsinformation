import { useQuery } from '@tanstack/react-query'
import type { AdminSection } from './AdminSidebar'
import { fetchAdminSources } from '../../api/sources'
import { deriveStatus, STATUS_DOT } from './Kallhantering'

interface StatKort {
  label:    string
  value:    string | number
  sub?:     string
  color:    string
  ikon:     string
  sektion?: AdminSection
  mock?:    boolean
}

const SENASTE_HÄNDELSER = [
  { tid: '10:42', typ: 'Användare',  text: 'Ny registrering — anna.svensson@mail.se',        färg: 'bg-violet-100 text-violet-700' },
  { tid: '09:15', typ: 'Ärende',    text: 'SUP-0043 öppnat: "Kan inte logga in"',             färg: 'bg-amber-100 text-amber-700'   },
  { tid: '08:30', typ: 'Källa',     text: 'SMHI — begränsad drift rapporterad',               färg: 'bg-sky-100 text-sky-700'       },
  { tid: '07:00', typ: 'System',    text: 'Schemalagd insamling slutförd — 847 händelser',    färg: 'bg-green-100 text-green-700'   },
  { tid: '06:55', typ: 'Källa',     text: 'Regeringen.se — källa svarade inte, retry OK',    färg: 'bg-orange-100 text-orange-700' },
  { tid: '2026-03-20', typ: 'Användare', text: 'Konto raderat på begäran — GDPR art. 17',    färg: 'bg-red-100 text-red-700'       },
]

function MockBadge() {
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">MOCK</span>
}

export default function Oversikt({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const { data: sources = [] } = useQuery({
    queryKey: ['admin-sources'],
    queryFn:  fetchAdminSources,
  })

  const aktivaKallor = sources.filter(s => s.isActive)
  const kallorMedFel  = aktivaKallor.filter(s => s.lastFetchError !== null)
  const systemhälsaProcent = aktivaKallor.length > 0
    ? Math.round(((aktivaKallor.length - kallorMedFel.length) / aktivaKallor.length) * 100)
    : 100

  const STAT_KORT: StatKort[] = [
    { label: 'Användare',       value: 1284,  sub: '+12 senaste 7 dagarna',                          color: 'text-violet-600', ikon: '👥', sektion: 'anvandare',     mock: true },
    { label: 'Öppna ärenden',   value: 3,     sub: 'Ärendehantering avstängd',                       color: 'text-amber-600',  ikon: '🎫', sektion: 'support-inbox', mock: true },
    { label: 'Aktiva källor',   value: aktivaKallor.length, sub: `${kallorMedFel.length} med varningar`, color: 'text-sky-600',    ikon: '📡', sektion: 'kallor' },
    { label: 'Systemhälsa',     value: `${systemhälsaProcent}%`, sub: `${aktivaKallor.length - kallorMedFel.length}/${aktivaKallor.length} källor utan fel`, color: 'text-green-600', ikon: '✅', sektion: 'felsökning' },
  ]

  return (
    <div className="flex flex-col gap-6">

      {/* Välkommen */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Välkommen, Admin</h2>
        <p className="text-sm text-slate-500 mt-0.5">Här är en överblick av systemet just nu.</p>
      </div>

      {/* Stat-kort */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_KORT.map(k => (
          <button
            key={k.label}
            onClick={() => k.sektion && onNavigate(k.sektion)}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-6 flex flex-col gap-2 items-center text-center hover:shadow-md hover:border-slate-300 transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{k.ikon}</span>
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{k.label}</span>
              {k.mock && <MockBadge />}
            </div>
            <p className={`text-4xl font-bold ${k.color}`}>{k.value}</p>
            {k.sub && <p className="text-xs text-slate-400 text-center">{k.sub}</p>}
          </button>
        ))}
      </div>

      {/* Senaste händelser + Källstatus */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Senaste händelser */}
        <div className="lg:col-span-2 lg:row-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Senaste händelser</h3>
              <p className="text-xs text-slate-400 mt-0.5">Aktivitet i systemet de senaste 24 timmarna</p>
            </div>
            <MockBadge />
          </div>
          <div className="divide-y divide-slate-50">
            {SENASTE_HÄNDELSER.map((h, i) => (
              <div key={i} className="flex items-start gap-3 px-6 py-3">
                <span className="text-xs text-slate-400 w-12 shrink-0 pt-0.5">{h.tid}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${h.färg}`}>{h.typ}</span>
                <p className="text-sm text-slate-700">{h.text}</p>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 border-t border-slate-100">
            <button
              onClick={() => onNavigate('aktivitetslogg')}
              className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
            >
              Visa hela aktivitetsloggen →
            </button>
          </div>
        </div>

        {/* Kommande kontroller */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Kommande kontroller</h3>
            <p className="text-xs text-slate-400 mt-0.5">Schemalagd datainsamling</p>
          </div>
          <div className="divide-y divide-slate-50">
            <div className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Ingestor</p>
                <p className="text-xs text-slate-400">Alla aktiva källor</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-700">Var 5:e minut</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-3 border-t border-slate-100">
            <button
              onClick={() => onNavigate('felsökning')}
              className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
            >
              Visa alla kontroller →
            </button>
          </div>
        </div>

        {/* Källstatus */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Källstatus</h3>
            <p className="text-xs text-slate-400 mt-0.5">{aktivaKallor.length} aktiva källor</p>
          </div>
          <div className="divide-y divide-slate-50">
            {aktivaKallor.length === 0 ? (
              <p className="px-6 py-4 text-sm text-slate-400 text-center">Inga aktiva källor.</p>
            ) : aktivaKallor.map(s => {
              const status = deriveStatus(s)
              return (
                <div key={s.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
                    <span className="text-sm text-slate-700 font-medium">{s.shortName}</span>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{status}</span>
                </div>
              )
            })}
          </div>
          <div className="px-6 py-3 border-t border-slate-100">
            <button
              onClick={() => onNavigate('kallor')}
              className="text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors"
            >
              Hantera alla källor →
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
