const CACHE_NAME = 'pillow-v3'
const STATIC = ['/', '/manifest.json', '/pillow-logo.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch (_) {}
  const title = data.title || 'Pillow 💊'
  const options = {
    body: data.body || 'Rappel Pillow',
    icon: '/pillow-logo.png',
    badge: '/pillow-logo.png',
    tag: data.tag || 'pillow-' + Date.now(),
    requireInteraction: true,
    silent: false,
    data: { url: data.url || '/', ...data },
    actions: [
      { action: 'open',    title: '✅ Ouvrir' },
      { action: 'dismiss', title: '✕ Fermer' },
    ],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url === url && 'focus' in c)
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
