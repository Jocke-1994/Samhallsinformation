import { adminFetch } from './adminFetch'
import { felFranSvar } from './hamta'

export interface AdminUserDto {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  suspendedAt: string | null
  suspendedReason: string | null
  suspensionReminderAt: string | null
  suspensionReminderNote: string | null
  authProvider: string
  createdAt: string
  deletedAt: string | null
  deletionScheduledAt: string | null
}

export interface UserNotisDto {
  userId: string
  namn: string
  epost: string
  notering: string | null
}

export interface AdminPolisenBevakningDto {
  id: string
  kategorier: string[] | null
  omraden: string[] | null
}

export interface AdminUserSourceDto {
  sourceId: number
  shortName: string
  name: string
  isActive: boolean
}

interface BevakningRequestBody {
  kategorier: string[] | null
  omraden: string[] | null
}

export interface AdminSettingLogDto {
  setting: string
  oldValue: string | null
  newValue: string | null
  changedBy: string
  changedAt: string
}

export interface AdminNotificationLogDto {
  sentAt: string
  channel: string
  sourceName: string | null
  subject: string
  recipient: string
  status: string
  errorMessage: string | null
}

export interface AdminUserPushDeviceDto {
  id: string
  deviceName: string
  platform: string
  registeredAt: string
  lastSeenAt: string
}

export interface AdminUserPushSettingsDto {
  pushEnabled: boolean
  pushNyaHandelser: boolean
  pushNyVersion: boolean
  enheter: AdminUserPushDeviceDto[]
}

export interface AdminSavedEventDto {
  eventId: string
  title: string
  url: string
  sourceName: string
  publishedAt: string
  savedAt: string
}

export interface SavedByUser {
  id: string
  name: string
  email: string
}

export async function fetchAdminUsers(): Promise<AdminUserDto[]> {
  const res = await adminFetch('/api/admin/users')
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminUsers')
  return res.json()
}

export async function fetchUserNotifications(): Promise<UserNotisDto[]> {
  const res = await adminFetch('/api/admin/users/notifications')
  if (!res.ok) throw await felFranSvar(res, 'fetchUserNotifications')
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
  if (!res.ok) {
    // Servern svarar 400 med { error } vid t.ex. självspärr / sista administratören.
    throw await felFranSvar(res, 'setAdminUserStatus')
  }
}

export async function deleteAdminUser(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    throw await felFranSvar(res, 'deleteAdminUser')
  }
}

export async function cancelUserDeletion(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/cancel-deletion`, { method: 'POST' })
  if (!res.ok) {
    throw await felFranSvar(res, 'cancelUserDeletion')
  }
}

export async function sendAdminUserPasswordReset(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/send-password-reset`, { method: 'POST' })
  if (!res.ok) {
    throw await felFranSvar(res, 'sendAdminUserPasswordReset')
  }
}

export async function resendAdminUserVerification(id: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/resend-verification`, { method: 'POST' })
  if (!res.ok) {
    throw await felFranSvar(res, 'resendAdminUserVerification')
  }
}

export async function fetchAdminUserPolisenBevakningar(
  id: string,
): Promise<AdminPolisenBevakningDto[]> {
  const res = await adminFetch(`/api/admin/users/${id}/polisen-bevakningar`)
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminUserPolisenBevakningar')
  return res.json()
}

// Admin/support-skrivrätt på en användares bevakningar — löser att man
// annars måste slå på kallor_polisen_filter GLOBALT bara för att kunna
// hjälpa en enskild användare rätta sina inställningar.
export async function createAdminUserPolisenBevakning(
  id: string,
  req: BevakningRequestBody,
): Promise<AdminPolisenBevakningDto> {
  const res = await adminFetch(`/api/admin/users/${id}/polisen-bevakningar`, {
    method: 'POST',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw await felFranSvar(res, 'createAdminUserPolisenBevakning')
  return res.json()
}

export async function updateAdminUserPolisenBevakning(
  id: string,
  bevakningId: string,
  req: BevakningRequestBody,
): Promise<AdminPolisenBevakningDto> {
  const res = await adminFetch(`/api/admin/users/${id}/polisen-bevakningar/${bevakningId}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw await felFranSvar(res, 'updateAdminUserPolisenBevakning')
  return res.json()
}

export async function deleteAdminUserPolisenBevakning(
  id: string,
  bevakningId: string,
): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/polisen-bevakningar/${bevakningId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw await felFranSvar(res, 'deleteAdminUserPolisenBevakning')
}

export async function fetchAdminUserSources(id: string): Promise<AdminUserSourceDto[]> {
  const res = await adminFetch(`/api/admin/users/${id}/sources`)
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminUserSources')
  return res.json()
}

export async function setAdminUserSourceActive(
  id: string,
  sourceId: number,
  isActive: boolean,
): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/sources/${sourceId}`, {
    method: 'PUT',
    body: JSON.stringify({ isActive }),
  })
  if (!res.ok) throw await felFranSvar(res, 'setAdminUserSourceActive')
}

export async function fetchAdminUserSettingLog(id: string): Promise<AdminSettingLogDto[]> {
  const res = await adminFetch(`/api/admin/users/${id}/setting-log`)
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminUserSettingLog')
  return res.json()
}

export async function fetchAdminUserNotificationLog(
  id: string,
): Promise<AdminNotificationLogDto[]> {
  const res = await adminFetch(`/api/admin/users/${id}/notification-log`)
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminUserNotificationLog')
  return res.json()
}

export async function fetchAdminUserPushSettings(id: string): Promise<AdminUserPushSettingsDto> {
  const res = await adminFetch(`/api/admin/users/${id}/push-settings`)
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminUserPushSettings')
  return res.json()
}

export interface AdminExplainEventDto {
  visasIMittFlode: boolean
  anledning: string
}

// Svarar på "varför ser/ser inte den här användaren händelse X" — ett
// supportverktyg, inte något som ändrar något. Se
// AdminUserDetailsController.ExplainEvent.
export async function explainAdminUserEvent(
  id: string,
  eventId: string,
): Promise<AdminExplainEventDto> {
  const res = await adminFetch(`/api/admin/users/${id}/explain-event/${eventId}`)
  if (!res.ok) {
    throw await felFranSvar(res, 'explainAdminUserEvent')
  }
  return res.json()
}

// Bara PATCH-semantik (skicka bara det fält som ska ändras) — samma
// motivering som självbetjäningens PushController.SaveSettings, annars
// nollar en ensam ändring tyst de andra två fälten.
// Policy: används bara när användaren SJÄLV bett om ändringen (t.ex. via
// ett supportärende) — se Rutiner/Konto/Push-installningar.md.
export async function setAdminUserPushSettings(
  id: string,
  req: {
    pushEnabled?: boolean
    pushNyaHandelser?: boolean
    pushNyVersion?: boolean
  },
): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/push-settings`, {
    method: 'PUT',
    body: JSON.stringify(req),
  })
  if (!res.ok) throw await felFranSvar(res, 'setAdminUserPushSettings')
}

export async function fetchAdminUserSavedEvents(id: string): Promise<AdminSavedEventDto[]> {
  const res = await adminFetch(`/api/admin/users/${id}/saved-events`)
  if (!res.ok) throw await felFranSvar(res, 'fetchAdminUserSavedEvents')
  return res.json()
}

export async function saveAdminUserEvent(id: string, eventId: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/saved-events`, {
    method: 'POST',
    body: JSON.stringify({ eventId }),
  })
  if (!res.ok) throw await felFranSvar(res, 'saveAdminUserEvent')
}

export async function unsaveAdminUserEvent(id: string, eventId: string): Promise<void> {
  const res = await adminFetch(`/api/admin/users/${id}/saved-events/${eventId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw await felFranSvar(res, 'unsaveAdminUserEvent')
}

export async function fetchSavedEventsByEvent(
  eventIds: string[],
): Promise<Record<string, SavedByUser[]>> {
  if (eventIds.length === 0) return {}
  const qs = eventIds.map((id) => `eventIds=${encodeURIComponent(id)}`).join('&')
  const res = await adminFetch(`/api/admin/saved-events/by-event?${qs}`)
  if (!res.ok) throw await felFranSvar(res, 'fetchSavedEventsByEvent')
  return res.json()
}
