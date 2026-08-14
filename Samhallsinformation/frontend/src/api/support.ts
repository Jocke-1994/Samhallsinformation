import { adminFetch } from './adminFetch'

export interface CreateTicketRequest {
  subject?: string
  category?: string
  message: string
  channel: 'arendehantering' | 'feedback'
  contactName?: string
  contactEmail?: string
}

export interface MyTicketDto {
  id: string
  ticketNumber: number
  subject: string
  category: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface TicketMessageDto {
  id: string
  senderType: 'user' | 'agent'
  authorName?: string | null
  text: string
  isInternal?: boolean
  createdAt: string
}

export interface MyTicketDetailDto extends MyTicketDto {
  messages: TicketMessageDto[]
}

export async function createTicket(req: CreateTicketRequest): Promise<{ id: string; ticketNumber: number }> {
  const res = await adminFetch('/api/support/tickets', {
    method: 'POST',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`createTicket: ${res.status}`)
  return res.json()
}

export async function fetchMyTickets(): Promise<MyTicketDto[]> {
  const res = await adminFetch('/api/support/tickets')
  if (!res.ok) throw new Error(`fetchMyTickets: ${res.status}`)
  return res.json()
}

export async function fetchMyTicket(id: string): Promise<MyTicketDetailDto> {
  const res = await adminFetch(`/api/support/tickets/${id}`)
  if (!res.ok) throw new Error(`fetchMyTicket: ${res.status}`)
  return res.json()
}

export async function replyToTicket(id: string, text: string): Promise<void> {
  const res = await adminFetch(`/api/support/tickets/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`replyToTicket: ${res.status}`)
}

// --- Admin ---

export interface AdminAgentDto {
  id: string
  name: string
}

export interface AdminTicketListItemDto {
  id: string
  ticketNumber: number
  subject: string
  category: string
  status: string
  channel: string
  contactName?: string | null
  contactEmail?: string | null
  assignedToUserId?: string | null
  assignedToName?: string | null
  isArchived: boolean
  firstOpenedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminScheduledActionDto {
  id: string
  type: 'svar' | 'intern' | 'tilldela'
  scheduledAt: string
  createdByName: string
  text?: string | null
  reassignToUserId?: string | null
  reassignToName?: string | null
  instruction?: string | null
  executed: boolean
  executedAt?: string | null
}

export interface AdminTicketDetailDto {
  ticket: AdminTicketListItemDto & {
    createdByName?: string | null
    reminderAt?: string | null
    reminderNote?: string | null
  }
  messages: TicketMessageDto[]
  scheduledActions: AdminScheduledActionDto[]
}

export interface NotisDto {
  ticketId: string
  amne: string
  typ: 'tilldelad' | 'påminnelse'
  notering?: string | null
}

export async function fetchAgents(): Promise<AdminAgentDto[]> {
  const res = await adminFetch('/api/admin/support/agents')
  if (!res.ok) throw new Error(`fetchAgents: ${res.status}`)
  return res.json()
}

export async function fetchAdminTickets(params?: { userId?: string; status?: string }): Promise<AdminTicketListItemDto[]> {
  const query = new URLSearchParams()
  if (params?.userId) query.set('userId', params.userId)
  if (params?.status) query.set('status', params.status)
  const qs = query.toString()
  const res = await adminFetch(`/api/admin/support/tickets${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(`fetchAdminTickets: ${res.status}`)
  return res.json()
}

export async function fetchAdminTicket(id: string): Promise<AdminTicketDetailDto> {
  const res = await adminFetch(`/api/admin/support/tickets/${id}`)
  if (!res.ok) throw new Error(`fetchAdminTicket: ${res.status}`)
  return res.json()
}

export async function replyAsAgent(id: string, text: string, isInternal: boolean): Promise<void> {
  const res = await adminFetch(`/api/admin/support/tickets/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ text, isInternal }),
  })
  if (!res.ok) throw new Error(`replyAsAgent: ${res.status}`)
}

export async function setTicketStatus(id: string, status: string): Promise<void> {
  const res = await adminFetch(`/api/admin/support/tickets/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`setTicketStatus: ${res.status}`)
}

export async function setTicketArchived(id: string, archived: boolean): Promise<void> {
  const res = await adminFetch(`/api/admin/support/tickets/${id}/archive`, {
    method: 'PUT',
    body: JSON.stringify({ archived }),
  })
  if (!res.ok) throw new Error(`setTicketArchived: ${res.status}`)
}

export async function assignTicket(id: string, userId: string | null): Promise<void> {
  const res = await adminFetch(`/api/admin/support/tickets/${id}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) throw new Error(`assignTicket: ${res.status}`)
}

export async function setTicketReminder(id: string, reminderAt: string | null, reminderNote: string | null): Promise<void> {
  const res = await adminFetch(`/api/admin/support/tickets/${id}/reminder`, {
    method: 'PUT',
    body: JSON.stringify({ reminderAt, reminderNote }),
  })
  if (!res.ok) throw new Error(`setTicketReminder: ${res.status}`)
}

export interface AddScheduledActionRequest {
  type: 'svar' | 'intern' | 'tilldela'
  scheduledAt: string
  text?: string
  reassignToUserId?: string
  instruction?: string
}

export async function addScheduledAction(ticketId: string, req: AddScheduledActionRequest): Promise<{ id: string }> {
  const res = await adminFetch(`/api/admin/support/tickets/${ticketId}/scheduled-actions`, {
    method: 'POST',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`addScheduledAction: ${res.status}`)
  return res.json()
}

export async function cancelScheduledAction(actionId: string): Promise<void> {
  const res = await adminFetch(`/api/admin/support/scheduled-actions/${actionId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`cancelScheduledAction: ${res.status}`)
}

export async function fetchSupportNotifications(): Promise<NotisDto[]> {
  const res = await adminFetch('/api/admin/support/notifications')
  if (!res.ok) throw new Error(`fetchSupportNotifications: ${res.status}`)
  return res.json()
}
