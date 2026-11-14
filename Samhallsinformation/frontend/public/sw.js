// Statisk fil (public/) — Vite injicerar inga env-variabler hit. Samma URL
// som redan ligger inbakad i det byggda JS-bundlet (VITE_API_URL), inte
// hemlig i sig.
const API_BASE = 'https://samhallsinformation-production.up.railway.app'

importScripts('/sw-notisgrupp.js')

// Grupperade notiser visas en i taget: två pushar som kommer samtidigt skulle
// annars båda läsa "ingen notis visas än" och den ena summan gå förlorad.
let notisKo = Promise.resolve()

async function visaGrupperad(title, options, data) {
  const [befintlig] = await self.registration.getNotifications({ tag: data.grupp.tag })
  const notis = self.byggGrupperadNotis(data, befintlig ? befintlig.data : null, Date.now())
  await self.registration.showNotification(title, {
    ...options,
    tag: notis.tag,
    body: notis.body,
    renotify: notis.renotify,
    data: notis.data,
  })
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  const title = data.title || 'Samhällsinformation'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  }

  async function decideAndShow() {
    // claimId/deviceId saknas för t.ex. testpushar — visa alltid då.
    if (data.claimId && data.deviceId) {
      try {
        const res = await fetch(`${API_BASE}/api/push/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimId: data.claimId, deviceId: data.deviceId }),
        })
        if (res.ok) {
          const { claimed } = await res.json()
          // Redan visad på en annan av användarens enheter — visa inte igen.
          if (!claimed) return
        }
        // Icke-OK-svar: fail-open, visa hellre en extra notis än ingen alls.
      } catch {
        // Nätverksfel — fail-open, samma resonemang.
      }
    }
    if (data.grupp && data.grupp.tag) {
      const tur = notisKo.then(() => visaGrupperad(title, options, data))
      notisKo = tur.catch(() => {})
      // Fail-open som claim-steget ovan: hellre en ogrupperad notis än ingen.
      await tur.catch(() => self.registration.showNotification(title, options))
      return
    }
    await self.registration.showNotification(title, options)
  }

  event.waitUntil(decideAndShow())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
