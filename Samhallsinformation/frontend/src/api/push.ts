import { adminFetch } from './adminFetch'

export interface PushSettingsDto {
  pushEnabled: boolean
}

export async function fetchVapidPublicKey(): Promise<string> {
  const res = await adminFetch('/api/push/public-key')
  if (!res.ok) throw new Error(`fetchVapidPublicKey: ${res.status}`)
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
  if (!res.ok) throw new Error(`subscribeDevice: ${res.status}`)
}

export async function unsubscribeDevice(endpoint: string): Promise<void> {
  const res = await adminFetch('/api/push/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  })
  if (!res.ok) throw new Error(`unsubscribeDevice: ${res.status}`)
}

export async function fetchPushSettings(): Promise<PushSettingsDto> {
  const res = await adminFetch('/api/push/settings')
  if (!res.ok) throw new Error(`fetchPushSettings: ${res.status}`)
  return res.json()
}

export async function savePushSettings(settings: PushSettingsDto): Promise<void> {
  const res = await adminFetch('/api/push/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error(`savePushSettings: ${res.status}`)
}
