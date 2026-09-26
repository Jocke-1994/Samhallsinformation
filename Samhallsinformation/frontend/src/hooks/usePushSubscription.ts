import { useCallback, useEffect, useState } from 'react'
import { fetchVapidPublicKey, subscribeDevice, unsubscribeDevice } from '../api/push'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export function usePushSubscription() {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isPushSupported()) {
      setLoading(false)
      return
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(setSubscription)
      .finally(() => setLoading(false))
  }, [])

  const subscribe = useCallback(async () => {
    if (!isPushSupported()) throw new Error('Push stöds inte i den här webbläsaren')

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Tillstånd nekades')

    const registration = await navigator.serviceWorker.ready
    const publicKey = await fetchVapidPublicKey()
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })

    await subscribeDevice(sub)
    setSubscription(sub)
    return sub
  }, [])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return
    const endpoint = subscription.endpoint
    // Webbläsarens prenumeration är borta efter första steget oavsett hur
    // serveranropet går, så lokalt läge uppdateras innan det kan kasta.
    await subscription.unsubscribe()
    setSubscription(null)
    await unsubscribeDevice(endpoint)
  }, [subscription])

  return {
    isSubscribed: subscription !== null,
    loading,
    subscribe,
    unsubscribe,
  }
}
