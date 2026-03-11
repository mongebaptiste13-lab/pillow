const CACHE_NAME = 'luna-v1'
const RUNTIME_CACHE = 'luna-runtime'
const ASSETS_TO_CACHE = [
  '/',
]

// Install event
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching assets')
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        console.warn('[ServiceWorker] Some assets could not be cached')
      })
    })
  )
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - Network first with fallback to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const url = new URL(event.request.url)

  // Don't cache chrome extensions or non-http requests
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses
        if (!response || response.status !== 200) {
          return response
        }

        const responseToCache = response.clone()
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(event.request, responseToCache)
        })

        return response
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response
          }

          // Return a basic offline response
          return new Response(JSON.stringify({ offline: true }), {
            status: 200,
            statusText: 'OK',
            headers: new Headers({
              'Content-Type': 'application/json',
            }),
          })
        })
      })
  )
})

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push notification received')

  const data = event.data?.json?.() || {}
  const options = {
    body: data.body || 'Luna - Rappel',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'luna-notification',
    requireInteraction: true,
    data: data,
    actions: [
      {
        action: 'confirm',
        title: 'Confirmer',
      },
      {
        action: 'snooze',
        title: 'Rappeler dans 15min',
      },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Luna', options)
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event.action)

  event.notification.close()

  const urlToOpen = '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }

      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[ServiceWorker] Notification closed')
})
