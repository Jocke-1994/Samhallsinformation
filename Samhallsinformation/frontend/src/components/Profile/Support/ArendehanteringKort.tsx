import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createTicket, TicketError, fetchMyTicket, fetchMyTickets, replyToTicket, type MyTicketDto } from '../../../api/support'
import { BETA } from '../../../betaConfig'

type SortField = 'status' | 'skapat' | 'uppdaterat' | null
type SortDir = 'asc' | 'desc'

const STATUS_STYLES: Record<string, string> = {
  'Öppet':            'bg-blue-50 text-blue-700 border border-blue-200',
  'Under behandling': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Hanterat':             'bg-green-50 text-green-700 border border-green-200',
  'Stängt':           'bg-slate-100 text-slate-500 border border-slate-200',
}

const STATUS_ORDER = ['Öppet', 'Under behandling', 'Hanterat', 'Stängt']

const KATEGORIER = [
  'Notifieringar',
  'Inloggning',
  'GDPR & uppgifter',
  'Konto',
  'Tekniskt fel',
  'Önskemål',
  ...(BETA.aktiv ? ['Testare'] : []),
  'Annat',
]

function ticketNr(t: { ticketNumber: number }) {
  return `SUP-${String(t.ticketNumber).padStart(4, '0')}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE')
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-10 flex flex-col items-center gap-2">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-4xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-slate-300">↕</span>
  return <span className="ml-1 text-violet-600">{dir === 'asc' ? '↑' : '↓'}</span>
}

function ArendeRad({
  ticket,
  expanded,
  pinned,
  onToggle,
  onTogglePin,
}: {
  ticket: MyTicketDto
  expanded: boolean
  pinned: boolean
  onToggle: () => void
  onTogglePin: (e: React.MouseEvent) => void
}) {
  const [svar, setSvar] = useState('')
  const queryClient = useQueryClient()
  const kanSvara = ticket.status === 'Öppet' || ticket.status === 'Under behandling'

  const { data: detail, isLoading } = useQuery({
    queryKey: ['my-ticket', ticket.id],
    queryFn: () => fetchMyTicket(ticket.id),
    enabled: expanded,
  })

  const replyMutation = useMutation({
    mutationFn: () => replyToTicket(ticket.id, svar),
    onSuccess: () => {
      setSvar('')
      queryClient.invalidateQueries({ queryKey: ['my-ticket', ticket.id] })
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
    },
  })

  return (
    <>
      <tr onClick={onToggle} className="hover:bg-slate-50 transition-colors cursor-pointer">
        <td className="pl-4 py-4 text-center" onClick={e => e.stopPropagation()}>
          <button
            onClick={onTogglePin}
            className="text-lg leading-none transition-colors"
            title={pinned ? 'Ta bort fästning' : 'Fäst överst'}
          >
            {pinned ? (
              <span className="text-amber-400">★</span>
            ) : (
              <span className="text-slate-300 hover:text-amber-300">☆</span>
            )}
          </button>
        </td>
        <td className="pl-4 pr-8 py-4 font-mono text-xs text-slate-400">{ticketNr(ticket)}</td>
        <td className="px-4 py-4">
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full mb-1 inline-block">{ticket.category}</span>
          <p className="text-slate-700 font-medium">{ticket.subject}</p>
        </td>
        <td className="px-4 py-4">
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${STATUS_STYLES[ticket.status]}`}>
            {ticket.status}
          </span>
        </td>
        <td className="px-4 py-4 text-slate-400 text-xs">{formatDate(ticket.createdAt)}</td>
        <td className="pl-6 pr-4 py-4 text-slate-400 text-xs">{formatDate(ticket.updatedAt)}</td>
        <td className="pr-4 py-4 text-slate-400 text-xs text-right">
          <span className={`transition-transform inline-block ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} className="bg-slate-50 border-t border-b border-slate-200 p-0">
            <div className="px-8 py-6 flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Historik</p>
                {isLoading && <p className="text-sm text-slate-400">Laddar...</p>}
                {detail?.messages.map(m => (
                  <div
                    key={m.id}
                    className={`flex flex-col gap-1 max-w-2xl ${m.senderType === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                  >
                    <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${
                      m.senderType === 'user'
                        ? 'bg-violet-600 text-white rounded-br-sm'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                    }`}>
                      {m.text}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {m.senderType === 'user' ? 'Du' : (m.authorName ?? 'Support')} · {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                ))}
              </div>

              {kanSvara && (
                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Svara</p>
                  {replyMutation.isSuccess ? (
                    <p className="text-sm text-green-600">Ditt svar har skickats.</p>
                  ) : (
                    <>
                      <textarea
                        value={svar}
                        onChange={e => setSvar(e.target.value)}
                        rows={3}
                        placeholder="Skriv ditt svar..."
                        className="bg-white text-slate-900 text-sm px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-violet-500 placeholder-slate-400 resize-none"
                      />
                      {replyMutation.isError && (
                        <p role="alert" className="text-xs text-red-500">
                          Ditt svar kunde inte skickas. Texten finns kvar — försök igen.
                        </p>
                      )}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { if (svar.trim() && !replyMutation.isPending) replyMutation.mutate() }}
                          disabled={replyMutation.isPending}
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {replyMutation.isPending ? 'Skickar...' : 'Skicka svar'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {!kanSvara && (
                <p className="text-xs text-slate-400 border-t border-slate-200 pt-4">
                  Det här ärendet är {ticket.status.toLowerCase()} och kan inte längre besvaras.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function ArendehanteringKort() {
  const queryClient = useQueryClient()
  const { data: tickets = [] } = useQuery({ queryKey: ['my-tickets'], queryFn: fetchMyTickets })

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [kategori, setKategori] = useState('')
  const [amne, setAmne] = useState('')
  const [meddelande, setMeddelande] = useState('')
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: () => createTicket({ subject: amne.trim(), category: kategori, message: meddelande, channel: 'arendehantering' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      setKategori('')
      setAmne('')
      setMeddelande('')
      setError('')
    },
  })

  const totalt   = tickets.length
  const oppna    = tickets.filter(a => a.status === 'Öppet').length
  const underBeh = tickets.filter(a => a.status === 'Under behandling').length
  const losta    = tickets.filter(a => a.status === 'Hanterat').length

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function togglePin(id: string) {
    setPinnedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSkicka() {
    if (!kategori)                     { setError('Välj en kategori.'); return }
    if (!amne.trim())                  { setError('Ange ett ämne.'); return }
    if (meddelande.trim().length < 10) { setError('Beskriv ditt ärende lite mer.'); return }
    createMutation.mutate()
  }

  const sorted = [...tickets].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id)
    const bPinned = pinnedIds.has(b.id)
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    if (!sortField) return 0
    let cmp = 0
    if (sortField === 'status')      cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    if (sortField === 'skapat')      cmp = a.createdAt.localeCompare(b.createdAt)
    if (sortField === 'uppdaterat')  cmp = a.updatedAt.localeCompare(b.updatedAt)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const thClass = "py-3 text-xs font-medium text-slate-500 uppercase tracking-wide select-none"

  return (
    <>
      {/* Statistik */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Alla ärenden"              value={totalt}   color="text-slate-900" />
        <StatCard label="Öppna ärenden"            value={oppna}    color="text-blue-600"  />
        <StatCard label="Ärenden under behandling" value={underBeh} color="text-amber-600" />
        <StatCard label="Hanterade ärenden"        value={losta}    color="text-green-600" />
      </div>

      {/* Skicka ärende + Ärendetabell */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch lg:items-start">

      {/* Skicka nytt ärende */}
      <div className="w-full lg:w-80 lg:shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden self-start">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Skicka nytt ärende</h2>
          <p className="text-sm text-slate-400 mt-0.5">Vi svarar inom 1–3 vardagar</p>
        </div>
        <div className="px-6 pt-6 pb-0 flex flex-col gap-5">
          {createMutation.isSuccess && createMutation.data && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
              Ditt ärende har skickats och tilldelats nummer <span className="font-mono font-semibold">{ticketNr(createMutation.data)}</span>. Vi återkommer inom 1–3 vardagar.
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Kategori</label>
            <select
              value={kategori}
              onChange={e => {
                const val = e.target.value
                setKategori(val)
                setError('')
                // Kategorin får aldrig radera det användaren skrivit: betamallen
                // fylls bara i i ett tomt fält, och tas bara bort igen om den
                // fortfarande är orörd (ämne och e-post rörs aldrig här).
                if (val === 'Testare' && BETA.mall && meddelande.trim() === '') setMeddelande(BETA.mall)
                else if (val !== 'Testare' && BETA.mall && meddelande === BETA.mall) setMeddelande('')
              }}
              className="bg-white text-slate-900 text-sm px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-violet-500"
            >
              <option value="">Välj kategori...</option>
              {KATEGORIER.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Ämne</label>
            <input
              type="text"
              maxLength={200}
              value={amne}
              onChange={e => { setAmne(e.target.value); setError('') }}
              placeholder="Beskriv kortfattat vad det gäller..."
              className="bg-white text-slate-900 text-sm px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-violet-500 placeholder-slate-400"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Beskriv ditt ärende</label>
            <textarea
              maxLength={5000}
              value={meddelande}
              onChange={e => { setMeddelande(e.target.value); setError('') }}
              rows={5}
              placeholder="Berätta vad som hänt eller vad du behöver hjälp med..."
              className="bg-white text-slate-900 text-sm px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-violet-500 placeholder-slate-400 resize-none"
            />
          </div>
          {(error || createMutation.error) && <p role="alert" className="text-xs text-red-500">{error || (createMutation.error instanceof TicketError ? createMutation.error.message : "Något gick fel. Försök igen senare.")}</p>}
        </div>
        <div className="flex justify-center py-5">
          <button
            onClick={handleSkicka}
            disabled={createMutation.isPending}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {createMutation.isPending ? 'Skickar...' : 'Skicka ärende'}
          </button>
        </div>
      </div>

      {/* Ärendetabell */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[640px]">
        <div className="px-6 py-4 border-b border-slate-200 text-center shrink-0">
          <h2 className="text-xl font-semibold text-slate-900">Mina ärenden</h2>
          <p className="text-sm text-slate-400 mt-0.5">Klicka på ett ärende för att se historik och svara</p>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left sticky top-0 z-10">
                <th className="pl-4 w-10" />
                <th className={`pl-4 pr-8 w-32 ${thClass}`}>Ärende-ID</th>
                <th className={`px-4 ${thClass}`}>Ämne</th>
                <th
                  className={`px-4 w-40 cursor-pointer hover:text-slate-700 ${thClass}`}
                  onClick={() => toggleSort('status')}
                >
                  Status <SortIcon active={sortField === 'status'} dir={sortDir} />
                </th>
                <th
                  className={`px-4 w-28 cursor-pointer hover:text-slate-700 ${thClass}`}
                  onClick={() => toggleSort('skapat')}
                >
                  Skapat <SortIcon active={sortField === 'skapat'} dir={sortDir} />
                </th>
                <th
                  className={`pl-6 pr-4 w-40 cursor-pointer hover:text-slate-700 ${thClass}`}
                  onClick={() => toggleSort('uppdaterat')}
                >
                  Senast uppdaterat <SortIcon active={sortField === 'uppdaterat'} dir={sortDir} />
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map(a => (
                <ArendeRad
                  key={a.id}
                  ticket={a}
                  expanded={expandedId === a.id}
                  pinned={pinnedIds.has(a.id)}
                  onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  onTogglePin={e => { e.stopPropagation(); togglePin(a.id) }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      </div>
    </>
  )
}
