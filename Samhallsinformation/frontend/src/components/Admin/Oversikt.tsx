import { useQuery } from '@tanstack/react-query'
import type { AdminSection } from './AdminSidebar'
import { fetchAdminSources } from '../../api/sources'
import { fetchAdminUsers } from '../../api/adminUsers'
import { fetchAdminTickets, type AdminTicketListItemDto } from '../../api/support'
import { deriveStatus, STATUS_DOT } from './Kallhantering'

interface StatKort {
  label:    string
  value:    string | number
  sub?:     string
  color:    string
  ikon:     string
  sektion?: AdminSection
}

interface HändelseRad {
  tid:   string
  typ:   string
  text:  string
  färg:  string
}

function ticketNr(t: AdminTicketListItemDto): string {
  return `SUP-${String(t.ticketNumber).padStart(4, '0')}`
}

function formatTid(iso: string): string {
  const d    = new Date(iso)
  const idag = new Date()
  const sammaDag = d.toDateString() === idag.toDateString()
  return sammaDag
    ? d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('sv-SE')
}

export default function Oversikt({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const { data: sources = [] } = useQuery({
    queryKey: ['admin-sources'],
    queryFn:  fetchAdminSources,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn:  fetchAdminUsers,
  })

  const { data: tickets = [] } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn:  () => fetchAdminTickets(),
  })

  const aktivaKallor = sources.filter(s => s.isActive)
  const kallorMedFel  = aktivaKallor.filter(s => s.lastFetchError !== null)
  const systemhälsaProcent = aktivaKallor.length > 0
    ? Math.round(((aktivaKallor.length - kallorMedFel.length) / aktivaKallor.length) * 100)
    : 100

  // Raderade (anonymiserade) konton räknas inte som riktiga användare längre.
  const riktigaAnvändare = users.filter(u => !u.deletedAt)
  const sjuDagarSedan    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const nyaSenasteVeckan = riktigaAnvändare.filter(u => new Date(u.createdAt) >= sjuDagarSedan).length

  const aktivaÄrenden  = tickets.filter(t => !t.isArchived)
  const öppnaÄrenden   = aktivaÄrenden.filter(t => t.status === 'Öppet').length
  const pågåendeÄrenden = aktivaÄrenden.filter(t => t.status === 'Under behandling').length

  const STAT_KORT: StatKort[] = [
    { label: 'Användare',       value: riktigaAnvändare.length, sub: `+${nyaSenasteVeckan} senaste 7 dagarna`,        color: 'text-violet-600', ikon: '👥', sektion: 'anvandare' },
    { label: 'Öppna ärenden',   value: öppnaÄrenden, sub: `${pågåendeÄrenden} under behandling`,                      color: 'text-amber-600',  ikon: '🎫', sektion: 'support-inbox' },
    { label: 'Aktiva källor',   value: aktivaKallor.length, sub: `${kallorMedFel.length} med varningar`, color: 'text-sky-600',    ikon: '📡', sektion: 'kallor' },
    { label: 'Systemhälsa',     value: `${systemhälsaProcent}%`, sub: `${aktivaKallor.length - kallorMedFel.length}/${aktivaKallor.length} källor utan fel`, color: 'text-green-600', ikon: '✅', sektion: 'felsökning' },
  ]

  // Slår ihop tre riktiga händelsekällor till ett flöde — ingen ingestor-
  // körningslogg finns i backend än, så "System"-rader (schemalagd insamling
  // slutförd) kan inte visas här ännu.
  const senasteHändelser: HändelseRad[] = [
    ...riktigaAnvändare.map((u): HändelseRad => ({
      tid: u.createdAt, typ: 'Användare', text: `Ny registrering — ${u.email}`, färg: 'bg-violet-100 text-violet-700',
    })),
    ...aktivaÄrenden.map((t): HändelseRad => ({
      tid: t.createdAt, typ: 'Ärende', text: `${ticketNr(t)} öppnat: "${t.subject}"`, färg: 'bg-amber-100 text-amber-700',
    })),
    ...kallorMedFel.filter(s => s.lastFetchedAt).map((s): HändelseRad => ({
      tid: s.lastFetchedAt as string, typ: 'Källa', text: `${s.shortName} — ${s.lastFetchError}`, färg: 'bg-orange-100 text-orange-700',
    })),
  ]
    .sort((a, b) => new Date(b.tid).getTime() - new Date(a.tid).getTime())
    .slice(0, 8)

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
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Senaste händelser</h3>
            <p className="text-xs text-slate-400 mt-0.5">Nya registreringar, ärenden och källfel</p>
          </div>
          <div className="divide-y divide-slate-50">
            {senasteHändelser.length === 0 ? (
              <p className="px-6 py-4 text-sm text-slate-400 text-center">Ingen aktivitet att visa.</p>
            ) : senasteHändelser.map((h, i) => (
              <div key={i} className="flex items-start gap-3 px-6 py-3">
                <span className="text-xs text-slate-400 w-12 shrink-0 pt-0.5">{formatTid(h.tid)}</span>
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
