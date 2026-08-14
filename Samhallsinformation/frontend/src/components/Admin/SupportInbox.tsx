import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdminTickets, fetchAdminTicket, fetchAgents, fetchSupportNotifications,
  replyAsAgent, setTicketStatus, assignTicket, setTicketReminder, setTicketArchived,
  addScheduledAction, cancelScheduledAction,
  type AdminTicketListItemDto, type AdminScheduledActionDto, type AdminAgentDto,
} from '../../api/support'
import { createFeatureIdea } from '../../api/featureIdeas'
import type { PendingNotis } from '../../types/adminNotis'

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

type ArendeStatus = 'Öppet' | 'Under behandling' | 'Hanterat' | 'Stängt'
type SchemaTyp = 'svar' | 'intern' | 'tilldela'

export type { PendingNotis }

type SortField    = 'status' | 'skapat' | 'uppdaterat' | null
type SortDir       = 'asc' | 'desc'
type SvarFlik       = 'svar' | 'intern'
type KanalFilter   = '' | 'arendehantering' | 'feedback'
type InboxFlik     = KanalFilter | 'arkiverat'

// ---------------------------------------------------------------------------
// Konstanter & hjälpare
// ---------------------------------------------------------------------------

const STATUS_CLS: Record<ArendeStatus, string> = {
  'Öppet':            'bg-blue-50 text-blue-700 border border-blue-200',
  'Under behandling': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Hanterat':         'bg-green-50 text-green-700 border border-green-200',
  'Stängt':           'bg-slate-100 text-slate-500 border border-slate-200',
}
const STATUS_ORDER: ArendeStatus[] = ['Öppet', 'Under behandling', 'Hanterat', 'Stängt']
const ALLA_KATEGORIER = ['Notifieringar', 'Inloggning', 'GDPR & uppgifter', 'Konto', 'Tekniskt fel', 'Önskemål', 'Feedback', 'Annat']

const SCHEMA_IKONER: Record<SchemaTyp, string> = { svar: '💬', intern: '🔒', tilldela: '👤' }
const SCHEMA_LABELS: Record<SchemaTyp, string> = {
  svar:     'Svar till användare',
  intern:   'Intern anteckning',
  tilldela: 'Tilldela ärende',
}
const KANAL_LABELS: Record<string, string> = { arendehantering: 'Ärende', feedback: 'Feedback' }

function ticketNr(t: { ticketNumber: number }) {
  return `SUP-${String(t.ticketNumber).padStart(4, '0')}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE')
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function combineDateTimeToIso(datum: string, tid: string): string {
  return new Date(`${datum}T${tid}:00`).toISOString()
}

function isPåminnelseAktiv(reminderAt: string): boolean {
  return new Date(reminderAt) <= new Date()
}

function dagarSedan(datum: string): number {
  return Math.floor((Date.now() - new Date(datum).getTime()) / (1000 * 60 * 60 * 24))
}

function slaFärg(dagar: number): string {
  if (dagar <= 3) return 'text-slate-400'
  if (dagar <= 7) return 'text-amber-600'
  return 'text-red-600'
}

function dagText(iso: string): string {
  const d = new Date(iso), idag = new Date(), imorgon = new Date()
  imorgon.setDate(idag.getDate() + 1)
  if (d.toDateString() === idag.toDateString())    return 'Idag'
  if (d.toDateString() === imorgon.toDateString()) return 'Imorgon'
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

function ArendeModal({
  ticketId, agents, onClose, onÖppnaAnvändare,
}: {
  ticketId:            string
  agents:              AdminAgentDto[]
  onClose:             () => void
  onÖppnaAnvändare?:   (epost: string) => void
}) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['admin-ticket', ticketId],
    queryFn: () => fetchAdminTicket(ticketId),
    refetchInterval: 30_000, // fångar upp det bakgrundstjänsten gör åt oss
  })

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-ticket', ticketId] })
    queryClient.invalidateQueries({ queryKey: ['admin-tickets'] })
    queryClient.invalidateQueries({ queryKey: ['support-notifications'] })
  }

  const replyMutation      = useMutation({ mutationFn: (p: { text: string; isInternal: boolean }) => replyAsAgent(ticketId, p.text, p.isInternal), onSuccess: invalidateAll })
  const statusMutation     = useMutation({ mutationFn: (status: string) => setTicketStatus(ticketId, status), onSuccess: invalidateAll })
  const assignMutation     = useMutation({ mutationFn: (userId: string | null) => assignTicket(ticketId, userId), onSuccess: invalidateAll })
  const reminderMutation   = useMutation({ mutationFn: (p: { reminderAt: string | null; reminderNote: string | null }) => setTicketReminder(ticketId, p.reminderAt, p.reminderNote), onSuccess: invalidateAll })
  const archiveMutation    = useMutation({ mutationFn: (archived: boolean) => setTicketArchived(ticketId, archived), onSuccess: invalidateAll })
  const addScheduleMutation = useMutation({ mutationFn: (p: Parameters<typeof addScheduledAction>[1]) => addScheduledAction(ticketId, p), onSuccess: invalidateAll })
  const cancelScheduleMutation = useMutation({ mutationFn: (actionId: string) => cancelScheduledAction(actionId), onSuccess: invalidateAll })
  const [idéSkapad, setIdéSkapad] = useState(false)
  const skapaIdéMutation = useMutation({
    mutationFn: () => createFeatureIdea({
      title: data!.ticket.subject,
      description: data!.messages[0]?.text,
      källaTyp: 'feedback',
      sourceTicketId: ticketId,
    }),
    onSuccess: () => setIdéSkapad(true),
  })

  const [flik, setFlik]                     = useState<SvarFlik>('svar')
  const [text, setText]                     = useState('')
  const [visaPåmForm, setVisaPåmForm]       = useState(false)
  const [påmDatum, setPåmDatum]             = useState('')
  const [påmTid, setPåmTid]                 = useState('09:00')
  const [påmNotering, setPåmNotering]       = useState('')
  const [visaSchemaForm, setVisaSchemaForm] = useState(false)
  const [schTyp, setSchTyp]                 = useState<SchemaTyp>('svar')
  const [schDatum, setSchDatum]             = useState('')
  const [schTid, setSchTid]                 = useState('09:00')
  const [schText, setSchText]               = useState('')
  const [schAgent, setSchAgent]             = useState('')
  const [schInstruktion, setSchInstruktion] = useState('')
  const [expandedId, setExpandedId]         = useState<string | null>(null)
  const [editId, setEditId]                 = useState<string | null>(null)
  const [editText, setEditText]             = useState('')
  const [editDatum, setEditDatum]           = useState('')
  const [editTid, setEditTid]               = useState('09:00')
  const [editAgent, setEditAgent]           = useState('')
  const [editInstruktion, setEditInstruktion] = useState('')

  if (!data) return null
  const { ticket, messages, scheduledActions } = data

  function startEdit(å: AdminScheduledActionDto) {
    const d = new Date(å.scheduledAt)
    setEditId(å.id)
    setEditText(å.text ?? '')
    setEditDatum(toDateInputValue(d))
    setEditTid(toTimeInputValue(d))
    setEditAgent(å.reassignToUserId ?? '')
    setEditInstruktion(å.instruction ?? '')
    setExpandedId(null)
  }

  // "Redigera" görs som avbryt + nyskapa — samma slutresultat för användaren,
  // ingen egen PUT-endpoint behövs för ett sällan använt redigeringsflöde.
  function handleSparaEdit(å: AdminScheduledActionDto) {
    if (!editDatum) return
    cancelScheduleMutation.mutate(å.id)
    addScheduleMutation.mutate({
      type: å.type,
      scheduledAt: combineDateTimeToIso(editDatum, editTid),
      text: å.type !== 'tilldela' ? editText.trim() : undefined,
      reassignToUserId: å.type === 'tilldela' ? editAgent : undefined,
      instruction: å.type === 'tilldela' ? editInstruktion.trim() : undefined,
    })
    setEditId(null)
  }

  const stängt = ticket.status === 'Hanterat' || ticket.status === 'Stängt'

  function handleSkicka() {
    if (!text.trim()) return
    replyMutation.mutate({ text: text.trim(), isInternal: flik === 'intern' })
    setText('')
  }

  function handleSparaPåminnelse() {
    if (!påmDatum) return
    reminderMutation.mutate({ reminderAt: combineDateTimeToIso(påmDatum, påmTid), reminderNote: påmNotering.trim() || null })
    setVisaPåmForm(false)
  }

  function handleTaBortPåminnelse() {
    reminderMutation.mutate({ reminderAt: null, reminderNote: null })
    setPåmDatum(''); setPåmTid('09:00'); setPåmNotering('')
    setVisaPåmForm(false)
  }

  function handleSpараSchema() {
    if (!schDatum) return
    if ((schTyp === 'svar' || schTyp === 'intern') && !schText.trim()) return
    if (schTyp === 'tilldela' && !schAgent) return
    addScheduleMutation.mutate({
      type: schTyp,
      scheduledAt: combineDateTimeToIso(schDatum, schTid),
      text: schTyp !== 'tilldela' ? schText.trim() : undefined,
      reassignToUserId: schTyp === 'tilldela' ? schAgent : undefined,
      instruction: schTyp === 'tilldela' ? schInstruktion.trim() : undefined,
    })
    setVisaSchemaForm(false)
    setSchTyp('svar'); setSchDatum(''); setSchTid('09:00')
    setSchText(''); setSchAgent(''); setSchInstruktion('')
  }

  const pendingSchema = scheduledActions.filter(å => !å.executed)
  const utfördaSchema = scheduledActions.filter(å => å.executed)
  const inlämnareNamn = ticket.createdByName ?? ticket.contactName ?? '—'
  const inlämnareEpost = ticket.contactEmail ?? ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="px-7 py-5 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-slate-400">{ticketNr(ticket)}</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{ticket.category}</span>
              <span className="text-xs text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">{KANAL_LABELS[ticket.channel] ?? ticket.channel}</span>
            </div>
            <p className="text-base font-semibold text-slate-800 leading-snug">{ticket.subject}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl shrink-0 mt-0.5">✕</button>
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">

          {/* Vänster: konversation + svar */}
          <div className="flex-1 flex flex-col md:overflow-hidden border-b md:border-b-0 md:border-r border-slate-100">
            <div className="flex-1 md:overflow-y-auto px-7 py-5 flex flex-col gap-3">
              {messages.map(m => {
                if (m.isInternal) return (
                  <div key={m.id} className="self-stretch">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 leading-relaxed flex gap-2">
                      <span className="shrink-0">🔒</span><span>{m.text}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Intern anteckning · {m.authorName ?? 'Support'} · {formatDateTime(m.createdAt)}</p>
                  </div>
                )
                const frånAdmin = m.senderType === 'agent'
                return (
                  <div key={m.id} className={`flex flex-col gap-1 ${frånAdmin ? 'items-end self-end max-w-[80%]' : 'items-start self-start max-w-[80%]'}`}>
                    <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${frånAdmin ? 'bg-violet-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-700 rounded-bl-sm'}`}>
                      {m.text}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {frånAdmin ? (m.authorName ?? 'Support') : inlämnareNamn} · {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Svar-formulär */}
            <div className="px-7 py-5 border-t border-slate-200 flex flex-col gap-3 shrink-0">
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                {(['svar', 'intern'] as SvarFlik[]).map(f => (
                  <button key={f} onClick={() => setFlik(f)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${flik === f ? (f === 'intern' ? 'bg-white text-amber-700 shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {f === 'intern' ? '🔒 Intern anteckning' : 'Svar till användare'}
                  </button>
                ))}
              </div>
              <textarea
                value={text} onChange={e => setText(e.target.value)} rows={3}
                placeholder={flik === 'svar' ? 'Skriv svar till användaren...' : 'Skriv intern anteckning (visas ej för användaren)...'}
                className={`text-slate-900 text-sm px-3 py-2.5 rounded-lg border focus:outline-none placeholder-slate-400 resize-none ${flik === 'intern' ? 'bg-amber-50 border-amber-200 focus:border-amber-400' : 'bg-white border-slate-300 focus:border-violet-500'}`}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleSkicka} disabled={!text.trim() || replyMutation.isPending}
                  className={`px-4 py-2 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors ${flik === 'intern' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-violet-600 hover:bg-violet-500'}`}
                >
                  {flik === 'intern' ? 'Lägg till anteckning' : 'Skicka svar'}
                </button>
                {!stängt && <>
                  <button onClick={() => statusMutation.mutate('Hanterat')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors">Markera hanterat</button>
                  <button onClick={() => statusMutation.mutate('Stängt')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs rounded-lg transition-colors">Stäng ärende</button>
                </>}
                {stängt && (
                  <button onClick={() => statusMutation.mutate('Öppet')} className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs rounded-lg transition-colors">Öppna igen</button>
                )}
                <button
                  onClick={() => archiveMutation.mutate(!ticket.isArchived)}
                  className="ml-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs rounded-lg transition-colors"
                >
                  {ticket.isArchived ? '📤 Återställ från arkiv' : '📦 Arkivera'}
                </button>
              </div>
            </div>
          </div>

          {/* Höger: metadata */}
          <div className="w-full md:w-64 shrink-0 flex flex-col md:overflow-y-auto">

            {/* Användare */}
            <div className="px-5 py-5 border-b border-slate-100">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Inlämnat av</p>
              <p className="text-sm font-medium text-slate-800">{inlämnareNamn}</p>
              <p className="text-xs text-slate-400">{inlämnareEpost || '—'}</p>
              <p className="text-xs text-slate-400 mt-1">Skapat {formatDate(ticket.createdAt)}</p>
              {onÖppnaAnvändare && inlämnareEpost && (
                <button
                  onClick={() => { onÖppnaAnvändare(inlämnareEpost); onClose() }}
                  className="mt-3 text-xs text-violet-600 hover:text-violet-500 font-medium flex items-center gap-1 transition-colors"
                >
                  Notifieringsinställningar →
                </button>
              )}
              {idéSkapad ? (
                <p className="mt-3 text-xs text-green-600 font-medium">✓ Idé skapad</p>
              ) : (
                <button
                  onClick={() => skapaIdéMutation.mutate()}
                  disabled={skapaIdéMutation.isPending}
                  className="mt-3 text-xs text-violet-600 hover:text-violet-500 font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  💡 Skapa idé av det här ärendet
                </button>
              )}
            </div>

            {/* Status */}
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Status</p>
              <select value={ticket.status} onChange={e => statusMutation.mutate(e.target.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border appearance-none cursor-pointer focus:outline-none whitespace-nowrap w-full ${STATUS_CLS[ticket.status as ArendeStatus]}`}
              >
                {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Tilldelad */}
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-2">Tilldelad</p>
              <select value={ticket.assignedToUserId ?? ''} onChange={e => assignMutation.mutate(e.target.value || null)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full"
              >
                <option value="">— Ingen —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Påminnelse */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Påminnelse</p>
                <button onClick={() => setVisaPåmForm(v => !v)} className="text-[11px] text-violet-600 hover:text-violet-500">
                  {ticket.reminderAt ? 'Ändra' : '+ Lägg till'}
                </button>
              </div>
              {ticket.reminderAt && !visaPåmForm && (
                <div className={`rounded-lg px-3 py-2.5 text-xs flex flex-col gap-1 ${isPåminnelseAktiv(ticket.reminderAt) ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span>{isPåminnelseAktiv(ticket.reminderAt) ? '🔴' : '⏰'}</span>
                    <span>{dagText(ticket.reminderAt)} kl {toTimeInputValue(new Date(ticket.reminderAt))}</span>
                  </div>
                  {ticket.reminderNote && <p className="text-slate-500 leading-snug">{ticket.reminderNote}</p>}
                  <button onClick={handleTaBortPåminnelse} className="text-slate-400 hover:text-red-500 text-left mt-1 transition-colors">Ta bort</button>
                </div>
              )}
              {!ticket.reminderAt && !visaPåmForm && <p className="text-xs text-slate-300">Ingen påminnelse satt.</p>}
              {visaPåmForm && (
                <div className="flex flex-col gap-2">
                  <input type="date" value={påmDatum} onChange={e => setPåmDatum(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full" />
                  <input type="time" value={påmTid} onChange={e => setPåmTid(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full" />
                  <textarea value={påmNotering} onChange={e => setPåmNotering(e.target.value)} rows={2} placeholder="Vad ska kontrolleras?" className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white resize-none placeholder-slate-300" />
                  <div className="flex gap-2">
                    <button onClick={handleSparaPåminnelse} disabled={!påmDatum} className="flex-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">Spara</button>
                    <button onClick={() => setVisaPåmForm(false)} className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors">Avbryt</button>
                  </div>
                </div>
              )}
            </div>

            {/* Schemalagda åtgärder */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Schemalagda åtgärder</p>
                {!visaSchemaForm && (
                  <button onClick={() => setVisaSchemaForm(true)} className="text-[11px] text-violet-600 hover:text-violet-500">+ Lägg till</button>
                )}
              </div>

              {/* Formulär */}
              {visaSchemaForm && (
                <div className="flex flex-col gap-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <select value={schTyp} onChange={e => setSchTyp(e.target.value as SchemaTyp)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full">
                    {(Object.keys(SCHEMA_LABELS) as SchemaTyp[]).map(t => (
                      <option key={t} value={t}>{SCHEMA_IKONER[t]} {SCHEMA_LABELS[t]}</option>
                    ))}
                  </select>
                  <div className="flex gap-1.5">
                    <input type="date" value={schDatum} onChange={e => setSchDatum(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white flex-1" />
                    <input type="time" value={schTid} onChange={e => setSchTid(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-20" />
                  </div>
                  {(schTyp === 'svar' || schTyp === 'intern') && (
                    <textarea value={schText} onChange={e => setSchText(e.target.value)} rows={3}
                      placeholder={schTyp === 'svar' ? 'Meddelande till användaren...' : 'Intern anteckning...'}
                      className={`text-xs border rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none resize-none placeholder-slate-300 ${schTyp === 'intern' ? 'bg-amber-50 border-amber-200 focus:border-amber-400' : 'bg-white border-slate-200 focus:border-violet-400'}`}
                    />
                  )}
                  {schTyp === 'tilldela' && (
                    <>
                      <select value={schAgent} onChange={e => setSchAgent(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full">
                        <option value="">Välj agent...</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <textarea value={schInstruktion} onChange={e => setSchInstruktion(e.target.value)} rows={2}
                        placeholder="Instruktion till agenten (valfritt)..." className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white resize-none placeholder-slate-300"
                      />
                    </>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSpараSchema}
                      disabled={!schDatum || ((schTyp === 'svar' || schTyp === 'intern') ? !schText.trim() : !schAgent)}
                      className="flex-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Schemalägg
                    </button>
                    <button onClick={() => setVisaSchemaForm(false)} className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors">Avbryt</button>
                  </div>
                </div>
              )}

              {/* Väntande */}
              {pendingSchema.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {pendingSchema.map(å => {
                    const isExpanded = expandedId === å.id
                    const isEditing  = editId === å.id
                    return (
                      <div key={å.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex flex-col gap-1.5">
                        {/* Rubrikrad */}
                        <div className="flex items-center justify-between gap-1">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : å.id)}
                            className="text-xs font-medium text-slate-700 flex items-center gap-1 hover:text-slate-900 text-left"
                          >
                            <span>{SCHEMA_IKONER[å.type]}</span>
                            <span>{dagText(å.scheduledAt)} kl {toTimeInputValue(new Date(å.scheduledAt))}</span>
                            <span className="text-slate-300 ml-0.5">{isExpanded ? '▴' : '▾'}</span>
                          </button>
                          <button onClick={() => cancelScheduleMutation.mutate(å.id)} className="text-slate-300 hover:text-red-400 text-sm leading-none transition-colors" title="Avbryt">✕</button>
                        </div>

                        {/* Kompakt förhandsvisning (inte expanded, inte editing) */}
                        {!isExpanded && !isEditing && (
                          <p className="text-[11px] text-slate-400 leading-snug">
                            {å.type === 'tilldela'
                              ? `→ ${å.reassignToName}${å.instruction ? ` · ${å.instruction.slice(0, 50)}${å.instruction.length > 50 ? '…' : ''}` : ''}`
                              : å.text ? `"${å.text.slice(0, 60)}${å.text.length > 60 ? '…' : ''}"` : ''}
                          </p>
                        )}

                        {/* Expanderad vy */}
                        {isExpanded && !isEditing && (
                          <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                            {å.type === 'tilldela' ? (
                              <>
                                <p className="text-xs text-slate-600">→ <span className="font-medium">{å.reassignToName}</span></p>
                                {å.instruction && <p className="text-xs text-slate-500 leading-snug">{å.instruction}</p>}
                              </>
                            ) : (
                              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{å.text}</p>
                            )}
                            <button
                              onClick={() => startEdit(å)}
                              className="text-[11px] text-violet-600 hover:text-violet-500 text-left"
                            >
                              Redigera
                            </button>
                          </div>
                        )}

                        {/* Redigera-vy */}
                        {isEditing && (
                          <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                            <div className="flex gap-1.5">
                              <input type="date" value={editDatum} onChange={e => setEditDatum(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white flex-1" />
                              <input type="time" value={editTid} onChange={e => setEditTid(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-20" />
                            </div>
                            {(å.type === 'svar' || å.type === 'intern') && (
                              <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                                className={`text-xs border rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none resize-none ${å.type === 'intern' ? 'bg-amber-50 border-amber-200 focus:border-amber-400' : 'bg-white border-slate-200 focus:border-violet-400'}`}
                              />
                            )}
                            {å.type === 'tilldela' && (
                              <>
                                <select value={editAgent} onChange={e => setEditAgent(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-full">
                                  <option value="">Välj agent...</option>
                                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                <textarea value={editInstruktion} onChange={e => setEditInstruktion(e.target.value)} rows={2}
                                  placeholder="Instruktion (valfritt)..."
                                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white resize-none placeholder-slate-300"
                                />
                              </>
                            )}
                            <div className="flex gap-2">
                              <button onClick={() => handleSparaEdit(å)} disabled={!editDatum} className="flex-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">Spara</button>
                              <button onClick={() => setEditId(null)} className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors">Avbryt</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Utförda */}
              {utfördaSchema.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] text-slate-300 uppercase tracking-wide">Utförda</p>
                  {utfördaSchema.map(å => (
                    <div key={å.id} className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="text-green-400">✓</span>
                      <span>{SCHEMA_IKONER[å.type]} {å.executedAt ? formatDateTime(å.executedAt) : ''}</span>
                    </div>
                  ))}
                </div>
              )}

              {pendingSchema.length === 0 && utfördaSchema.length === 0 && !visaSchemaForm && (
                <p className="text-xs text-slate-300">Inga schemalagda åtgärder.</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Huvudkomponent
// ---------------------------------------------------------------------------

interface Props {
  onPendingNotiser?:  (items: PendingNotis[]) => void
  defaultOpenId?:     string
  onÖppnaAnvändare?:  (epost: string) => void
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-slate-300">↕</span>
  return <span className="ml-1 text-violet-600">{dir === 'asc' ? '↑' : '↓'}</span>
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide font-medium">{label}</p>
    </div>
  )
}

export default function SupportInbox({ onPendingNotiser, defaultOpenId, onÖppnaAnvändare }: Props) {
  const [öppetId, setÖppetId]           = useState<string | null>(defaultOpenId ?? null)
  const [flik, setFlik]                 = useState<InboxFlik>('')
  const [statusFilter, setStatus]       = useState<ArendeStatus | ''>('')
  const [kategoriFilter, setKategori]   = useState('')
  const [tilldeladFilter, setTilldelad] = useState('')
  const [sortField, setSortField]       = useState<SortField>(null)
  const [sortDir, setSortDir]           = useState<SortDir>('desc')
  const [sök, setSök]                   = useState('')

  const { data: ärenden = [] } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: () => fetchAdminTickets(),
    refetchInterval: 30_000,
  })
  const { data: agents = [] } = useQuery({ queryKey: ['support-agents'], queryFn: fetchAgents })
  const { data: notiser = [] } = useQuery({
    queryKey: ['support-notifications'],
    queryFn: fetchSupportNotifications,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (!onPendingNotiser) return
    onPendingNotiser(notiser.map(n => ({ arendeId: n.ticketId, amne: n.amne, typ: n.typ, notering: n.notering })))
  }, [notiser, onPendingNotiser])

  const aktiva    = ärenden.filter(a => !a.isArchived)
  const totalt    = aktiva.length
  const öppna     = aktiva.filter(a => a.status === 'Öppet').length
  const pågående  = aktiva.filter(a => a.status === 'Under behandling').length
  const hanterade = aktiva.filter(a => a.status === 'Hanterat').length

  const oläst = (a: AdminTicketListItemDto) => !a.isArchived && !a.firstOpenedAt
  const olästaÄrenden = aktiva.filter(a => a.channel === 'arendehantering' && oläst(a)).length
  const olästaFeedback = aktiva.filter(a => a.channel === 'feedback' && oläst(a)).length

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const arkivvy  = flik === 'arkiverat'
  const sökTerm = sök.trim().toLowerCase()
  const filtrerade = ärenden
    .filter((a: AdminTicketListItemDto) => arkivvy ? a.isArchived : !a.isArchived)
    .filter(a => arkivvy || !flik || a.channel === flik)
    .filter(a => !statusFilter    || a.status    === statusFilter)
    .filter(a => !kategoriFilter  || a.category  === kategoriFilter)
    .filter(a => !tilldeladFilter || a.assignedToUserId === tilldeladFilter)
    .filter(a => !sökTerm || [a.subject, ticketNr(a), a.contactName ?? '', a.contactEmail ?? ''].some(s => s.toLowerCase().includes(sökTerm)))
    .sort((a, b) => {
      if (!sortField) return 0
      let cmp = 0
      if (sortField === 'status')     cmp = STATUS_ORDER.indexOf(a.status as ArendeStatus) - STATUS_ORDER.indexOf(b.status as ArendeStatus)
      if (sortField === 'skapat')     cmp = a.createdAt.localeCompare(b.createdAt)
      if (sortField === 'uppdaterat') cmp = a.updatedAt.localeCompare(b.updatedAt)
      return sortDir === 'asc' ? cmp : -cmp
    })

  const thCls = "py-3 text-xs font-medium text-slate-500 uppercase tracking-wide select-none"

  return (
    <div className="flex flex-col gap-6">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatChip label="Totalt antal ärenden" value={totalt}    color="text-slate-800" />
        <StatChip label="Öppna ärenden"        value={öppna}     color="text-blue-600"  />
        <StatChip label="Under behandling"     value={pågående}  color="text-amber-600" />
        <StatChip label="Hanterade ärenden"    value={hanterade} color="text-green-600" />
      </div>

      {/* Kanal-flikar */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([['', 'Alla', 0], ['arendehantering', 'Ärenden', olästaÄrenden], ['feedback', 'Feedback', olästaFeedback], ['arkiverat', 'Arkiverat', 0]] as [InboxFlik, string, number][]).map(([val, label, olästa]) => (
          <button key={val} onClick={() => setFlik(val)}
            className={`relative text-xs px-4 py-1.5 rounded-md font-medium transition-colors ${flik === val ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {label}
            {olästa > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {olästa}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
          <select value={statusFilter} onChange={e => setStatus(e.target.value as ArendeStatus | '')} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white">
            <option value="">Alla statusar</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={kategoriFilter} onChange={e => setKategori(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white">
            <option value="">Alla kategorier</option>
            {ALLA_KATEGORIER.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={tilldeladFilter} onChange={e => setTilldelad(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white">
            <option value="">Alla agenter</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input
            value={sök} onChange={e => setSök(e.target.value)}
            placeholder="Sök ärende, användare..."
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-violet-400 bg-white w-52 placeholder-slate-400"
          />
          <span className="ml-auto text-xs text-slate-400">{filtrerade.length} ärenden</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className={`pl-5 pr-3 w-28 ${thCls}`}>Ärende-ID</th>
                <th className={`px-4 ${thCls}`}>Ämne</th>
                <th className={`px-4 w-44 ${thCls}`}>Användare</th>
                <th className={`px-4 w-36 ${thCls}`}>Tilldelad</th>
                <th className={`px-4 w-16 ${thCls}`}>⏰</th>
                <th className={`px-4 w-44 cursor-pointer hover:text-slate-700 ${thCls}`} onClick={() => toggleSort('status')}>Status <SortIcon active={sortField === 'status'} dir={sortDir} /></th>
                <th className={`px-4 w-24 cursor-pointer hover:text-slate-700 ${thCls}`} onClick={() => toggleSort('skapat')}>Skapat <SortIcon active={sortField === 'skapat'} dir={sortDir} /></th>
                <th className={`pl-4 pr-5 w-28 cursor-pointer hover:text-slate-700 ${thCls}`} onClick={() => toggleSort('uppdaterat')}>Uppdaterat <SortIcon active={sortField === 'uppdaterat'} dir={sortDir} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrerade.map(a => {
                const harSchema = false // syns bara i detaljvyn nu, listan har inte schemalagda åtgärder
                return (
                  <tr key={a.id} onClick={() => setÖppetId(a.id)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                    <td className="pl-5 pr-3 py-4 font-mono text-xs text-slate-400">{ticketNr(a)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full inline-block">{a.category}</span>
                        <span className="text-[10px] text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full inline-block">{KANAL_LABELS[a.channel] ?? a.channel}</span>
                      </div>
                      <p className="text-slate-700 font-medium text-sm leading-snug">{a.subject}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-slate-700">{a.contactName ?? '—'}</p>
                      <p className="text-xs text-slate-400">{a.contactEmail ?? '—'}</p>
                    </td>
                    <td className="px-4 py-4">
                      {a.assignedToName ? <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full">{a.assignedToName}</span> : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-4 text-center text-base">
                      {notiser.some(n => n.ticketId === a.id && n.typ === 'påminnelse') ? <span title="Förfallen påminnelse">🔴</span>
                        : harSchema ? <span title="Schemalagd åtgärd">⏳</span>
                        : null}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap ${STATUS_CLS[a.status as ArendeStatus]}`}>{a.status}</span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-slate-400">{formatDate(a.createdAt)}</p>
                      {(a.status === 'Öppet' || a.status === 'Under behandling') && (() => {
                        const d = dagarSedan(a.createdAt)
                        return <span className={`text-[11px] font-medium ${slaFärg(d)}`}>{d} d</span>
                      })()}
                    </td>
                    <td className="pl-4 pr-5 py-4 text-slate-400 text-xs">{formatDate(a.updatedAt)}</td>
                  </tr>
                )
              })}
              {filtrerade.length === 0 && (
                <tr><td colSpan={8} className="py-16 text-center text-sm text-slate-400">Inga ärenden matchar filtret.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {öppetId && (
        <ArendeModal
          ticketId={öppetId}
          agents={agents}
          onClose={() => setÖppetId(null)}
          onÖppnaAnvändare={onÖppnaAnvändare}
        />
      )}
    </div>
  )
}
