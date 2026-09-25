import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { acknowledgeAdminAlert, fetchAdminAlerts, type AdminAlertDto, type AlertSeverity } from '../../api/alerts'

// Larm från övervakningen (V1-9) överst i Systemhälsa/Felsökning. Laddfel visas som fel —
// aldrig som "Inga larm" — och ett misslyckat Kvittera visas vid larmet.

const SEVERITY: Record<AlertSeverity, { etikett: string; pill: string; kant: string }> = {
  critical: { etikett: 'Kritisk', pill: 'bg-red-100 text-red-700 border-red-200',       kant: 'border-l-red-500'   },
  warning:  { etikett: 'Varning', pill: 'bg-amber-100 text-amber-700 border-amber-200', kant: 'border-l-amber-400' },
  info:     { etikett: 'Info',    pill: 'bg-sky-100 text-sky-700 border-sky-200',       kant: 'border-l-sky-400'   },
}

function tid(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function LarmKort() {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn:  fetchAdminAlerts,
    refetchInterval: 60_000,
  })

  const kvittera = useMutation({
    mutationFn: (id: string) => acknowledgeAdminAlert(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['admin-alerts'] }),
  })
  const kvitteradesId = kvittera.isPending ? kvittera.variables : null
  const felId = kvittera.isError ? kvittera.variables : null

  const öppna = data?.open ?? []
  const olästa = öppna.filter(a => !a.acknowledgedAt).length

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-testid="larm-kort">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            Larm
            {olästa > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">{olästa}</span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Övervakningen kontrollerar var 5:e minut och mejlar admins vid nya larm</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-xs font-medium text-violet-600 hover:text-violet-800 border border-violet-200 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          {isFetching ? 'Hämtar...' : 'Uppdatera'}
        </button>
      </div>

      {isLoading ? (
        <div className="px-6 py-6 text-center text-sm text-slate-400">Laddar larm...</div>
      ) : isError ? (
        <div role="alert" className="px-6 py-6 text-center text-sm text-red-600">
          Kunde inte hämta larm. Det här är inte samma sak som "inga larm" — försök igen.
        </div>
      ) : öppna.length === 0 ? (
        <div className="px-6 py-6 text-center text-sm text-slate-400">Inga larm</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {öppna.map((a: AdminAlertDto) => {
            const s = SEVERITY[a.severity] ?? SEVERITY.info
            return (
              <li key={a.id} className={`px-6 py-4 border-l-4 ${s.kant} flex items-start gap-4`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.pill}`}>{s.etikett}</span>
                    <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{a.detail}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Första gången {tid(a.firstRaisedAt)} · sedd i {a.occurrenceCount} {a.occurrenceCount === 1 ? 'kontroll' : 'kontroller'}
                    {a.acknowledgedAt && ` · Kvitterad av ${a.acknowledgedBy ?? 'okänd'} ${tid(a.acknowledgedAt)}`}
                  </p>
                  {felId === a.id && (
                    <p role="alert" className="text-xs text-red-600 mt-1">Kunde inte kvittera larmet — försök igen.</p>
                  )}
                </div>
                {!a.acknowledgedAt && (
                  <button
                    onClick={() => kvittera.mutate(a.id)}
                    disabled={kvitteradesId === a.id}
                    className="shrink-0 text-xs font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {kvitteradesId === a.id ? 'Kvitterar...' : 'Kvittera'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
