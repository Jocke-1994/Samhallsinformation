import { adminFetch } from './adminFetch'

export interface AdminUserDto {
  id:                     string
  name:                   string
  email:                  string
  role:                   string
  isActive:               boolean
  suspendedAt:            string | null
  suspendedReason:        string | null
  suspensionReminderAt:   string | null
  suspensionReminderNote: string | null
  authProvider:           string
  createdAt:              string
  deletedAt:              string | null
  deletionScheduledAt:    string | null
}

export interface UserNotisDto {
  userId:   string
  namn:     string
  epost:    string
  notering: string | null
}

export interface AdminPolisenBevakningDto {
  id:         string
  kategorier: string[] | null
  omraden:    string[] | null
}

export interface AdminUserSourceDto {
  sourceId:  number
  shortName: string
  name:      string
  isActive:  boolean
}

interface BevakningRequestBody {
  kategorier: string[] | null
  omraden:    string[] | null
}

export interface AdminSettingLogDto {
  setting:   string
  oldValue:  string | null
  newValue:  string | null
  changedBy: string
  changedAt: string
}

export interface AdminNotificationLogDto {
  sentAt:       string
  channel:      string
  sourceName:   string | null
  subject:      string
  recipient:    string
  status:       string
  errorMessage: string | null
}

export interface AdminSavedEventDto {
  eventId:     string
  title:       string
  url:         string
  sourceName:  string
  publishedAt: string
  savedAt:     string
}

export interface SavedByUser {
  id:    string
  name:  string
  email: string
}

export async function fetchAdminUsers(): Promise<AdminUserDto[]> {
  const res = await adminFetch('/api/admin/users')
  if (!res.ok) throw new Error(`fetchAdminUsers: ${res.status}`)
  return res.json()
}

export async function fetchUserNotifications(): Promise<UserNotisDto[]> {
  const res = await adminFetch('/api/admin/users/notifications')
  if (!res.ok) throw new Error(`fetchUserNotifications: ${res.status}`)
  return res.json()
}

export async function setAdminUserStatus(
  id: string,
  isActive: boolean,
  reason?: string,
  reminderAt?: string | null,
  reminderNote?: string | null,
): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ isActive, reason, reminderAt, reminderNote }),
  })
  if (!res.ok) throw new Error(`setAdminUserStatus: ${res.status}`)
}

export async function deleteAdminUser(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `deleteAdminUser: ${res.status}`)
  }
}

export async function cancelUserDeletion(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/cancel-deletion`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `cancelUserDeletion: ${res.status}`)
  }
}

export async function fetchAdminUserPolisenBevakningar(id: string): Promise<AdminPolisenBevakningDto[]> {
  const res = await adminFetch(`/api/admin/users/${id}/polisen-bevakningar`)
  if (!res.ok) throw new Error(`fetchAdminUserPolisenBevakningar: ${res.status}`)
  return res.json()
}

// Admin/support-skrivrätt på en användares bevakningar — löser att man
// annars måste slå på kallor_polisen_filter GLOBALT bara för att kunna
// hjälpa en enskild användare rätta sina inställningar.
export async function createAdminUserPolisenBevakning(id: string, req: BevakningRequestBody): Promise<AdminPolisenBevakningDto> {
  const res = await adminFetch(`/api/admin/users/${id}/polisen-bevakningar`, { method: 'POST', body: JSON.stringify(req) })
  if (!res.ok) throw new Error(`createAdminUserPolisenBevakning: ${res.status}`)
  return res.json()
}

export async function updateAdminUserPolisenBevakning(id: string, bevakningId: string, req: BevakningRequestBody): Promise<AdminPolisenBevakningDto> {
  const res = await adminFetch(`/api/admin/users/${id}/polisen-bevakningar/${bevakningId}`, { method: 'PUT', body: JSON.stringify(req) })
  if (!res.ok) throw new Error(`updateAdminUserPolisenBevakning: ${res.status}`)
  return res.json()
}

export async function deleteAdminUserPolisenBevakning(id: string, bevakningId: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/polisen-bevakningar/${bevakningId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteAdminUserPolisenBevakning: ${res.status}`)
}

export async function fetchAdminUserSources(id: string): Promise<AdminUserSourceDto[]> {
  const res = await adminFetch(`/api/admin/users/${id}/sources`)
  if (!res.ok) throw new Error(`fetchAdminUserSources: ${res.status}`)
  return res.json()
}

export async function setAdminUserSourceActive(id: string, sourceId: number, isActive: boolean): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/sources/${sourceId}`, { method: 'PUT', body: JSON.stringify({ isActive }) })
  if (!res.ok) throw new Error(`setAdminUserSourceActive: ${res.status}`)
}

export async function fetchAdminUserSettingLog(id: string): Promise<AdminSettingLogDto[]> {
  const res = await adminFetch(`/api/admin/users/${id}/setting-log`)
  if (!res.ok) throw new Error(`fetchAdminUserSettingLog: ${res.status}`)
  return res.json()
}

export async function fetchAdminUserNotificationLog(id: string): Promise<AdminNotificationLogDto[]> {
  const res = await adminFetch(`/api/admin/users/${id}/notification-log`)
  if (!res.ok) throw new Error(`fetchAdminUserNotificationLog: ${res.status}`)
  return res.json()
}

export async function fetchAdminUserSavedEvents(id: string): Promise<AdminSavedEventDto[]> {
  const res = await adminFetch(`/api/admin/users/${id}/saved-events`)
  if (!res.ok) throw new Error(`fetchAdminUserSavedEvents: ${res.status}`)
  return res.json()
}

export async function saveAdminUserEvent(id: string, eventId: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/saved-events`, {
    method: 'POST',
    body: JSON.stringify({ eventId }),
  })
  if (!res.ok) throw new Error(`saveAdminUserEvent: ${res.status}`)
}

export async function unsaveAdminUserEvent(id: string, eventId: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/saved-events/${eventId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`unsaveAdminUserEvent: ${res.status}`)
}

export async function fetchSavedEventsByEvent(eventIds: string[]): Promise<Record<string, SavedByUser[]>> {
  if (eventIds.length === 0) return {}
  const qs = eventIds.map(id => `eventIds=${encodeURIComponent(id)}`).join('&')
  const res = await adminFetch(`/api/admin/saved-events/by-event?${qs}`)
  if (!res.ok) throw new Error(`fetchSavedEventsByEvent: ${res.status}`)
  return res.json()
}
