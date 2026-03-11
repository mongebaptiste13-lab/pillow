/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

const CACHE_NAME = 'luna-v1'
const RUNTIME_CACHE = 'luna-runtime'
const ASSETS_TO_CACHE = [
  '/',
  '/offline.json',
]

// Install event
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[ServiceWorker] Installing...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching assets')
      return cache.addAll(ASSETS_TO_CACHE)
    })
  )
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event: ExtendableEvent) => {
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
self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') {
    return
  }

  const { request } = event
  const url = new URL(request.url)

  // Don't cache chrome extensions or non-http requests
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses
        if (!response || response.status !== 200) {
          return response
        }

        const responseToCache = response.clone()
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseToCache)
        })

        return response
      })
      .catch(() => {
        // Fallback to cache
        return (
          caches.match(request).then((response) => {
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
        )
      })
  )
})

// Push notification event
self.addEventListener('push', (event: PushEvent) => {
  console.log('[ServiceWorker] Push notification received')

  const data = event.data?.json() || {}
  const options: NotificationOptions = {
    body: data.body || 'Luna - Rappel',
    icon: '/logo-192.png',
    badge: '/logo-96.png',
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
self.addEventListener('notificationclick', (event: NotificationEvent) => {
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
self.addEventListener('notificationclose', (event: NotificationEvent) => {
  console.log('[ServiceWorker] Notification closed')
})

// Background sync for offline pill logs
self.addEventListener('sync', (event: any) => {
  console.log('[ServiceWorker] Background sync:', event.tag)

  if (event.tag === 'sync-pill-logs') {
    event.waitUntil(
      // Sync pill logs to server
      fetch('/api/sync-pill-logs', {
        method: 'POST',
        credentials: 'include',
      }).catch((err) => {
        console.error('[ServiceWorker] Sync failed:', err)
        // Re-attempt later
        throw err
      })
    )
  }
})

export {}
