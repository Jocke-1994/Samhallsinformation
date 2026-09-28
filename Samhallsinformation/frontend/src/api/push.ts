import { adminFetch } from './adminFetch'
import { LANG_TIMEOUT_MS, felFranSvar, fetchMedTimeout } from './hamta'

export interface PushSettingsDto {
  pushEnabled: boolean
  pushNyaHandelser: boolean
  pushNyVersion: boolean
}

export async function fetchVapidPublicKey(): Promise<string> {
  const res = await adminFetch('/api/push/public-key')
  if (!res.ok) throw await felFranSvar(res, 'fetchVapidPublicKey')
  const data = (await res.json()) as { publicKey: string }
  return data.publicKey
}

export async function subscribeDevice(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  const res = await adminFetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      deviceName: navigator.platform || undefined,
      platform: navigator.userAgent,
    }),
  })
  if (!res.ok) throw await felFranSvar(res, 'subscribeDevice')
}

export async function unsubscribeDevice(endpoint: string): Promise<void> {
  const res = await adminFetch('/api/push/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  })
  if (!res.ok) throw await felFranSvar(res, 'unsubscribeDevice')
}

// Avregistrerar en enhet med en EXPLICIT token, utan adminFetch: används vid
// utloggning/sessionsslut, när sessionen redan är (eller just blivit) rensad
// och ett 401 inte ska trigga någon förnyelse. Kastar vid fel — anroparen
// avgör att det är best effort.
export async function unsubscribeDeviceMedToken(endpoint: string, token: string): Promise<void> {
  const res = await fetchMedTimeout(`${import.meta.env.VITE_API_URL ?? ''}/api/push/subscribe`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint }),
  })
  if (!res.ok) throw await felFranSvar(res, 'unsubscribeDeviceMedToken')
}

export async function fetchPushSettings(): Promise<PushSettingsDto> {
  const res = await adminFetch('/api/push/settings')
  if (!res.ok) throw await felFranSvar(res, 'fetchPushSettings')
  return res.json()
}

export async function savePushSettings(settings: Partial<PushSettingsDto>): Promise<void> {
  const res = await adminFetch('/api/push/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw await felFranSvar(res, 'savePushSettings')
}

export async function sendNewVersionNotice(version: string, message: string): Promise<{ sent: number }> {
  const res = await adminFetch('/api/push/new-version', {
    timeoutMs: LANG_TIMEOUT_MS,
    method: 'POST',
    body: JSON.stringify({ version, message }),
  })
  if (!res.ok) throw await felFranSvar(res, 'sendNewVersionNotice')
  return res.json()
}
