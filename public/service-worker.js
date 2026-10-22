/* Pillow — service worker
 * Rôles : (1) afficher les notifications push même app fermée,
 *         (2) permettre l'usage hors-ligne de l'interface.
 * Les appels /api et Supabase ne sont JAMAIS mis en cache.
 */
const VERSION = 'pillow-v6'
const STATIC_CACHE = `${VERSION}-static`
const PAGES_CACHE = `${VERSION}-pages`
const PRECACHE = ['/', '/offline.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) =>
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

/* ---------------------------- Cache / hors-ligne ---------------------------- */

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // Supabase & co : réseau direct
  if (url.pathname.startsWith('/api/')) return

  // Pages : réseau d'abord, repli sur le cache puis sur la page hors-ligne
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            caches.open(PAGES_CACHE).then((cache) => cache.put('/', copy)).catch(() => undefined)
          }
          return response
        })
        .catch(async () => (await caches.match('/')) || (await caches.match('/offline.html')) || Response.error()),
    )
    return
  }

  // Assets versionnés de Next.js, icônes, polices : cache d'abord
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(?:woff2?|png|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response && response.ok) {
              const copy = response.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
            }
            return response
          }),
      ),
    )
    return
  }

  // Le reste : stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})

/* ------------------------------- Notifications ------------------------------ */

function actionsFor(kind) {
  if (kind === 'reminder' || kind === 'nag' || kind === 'snooze') {
    return [
      { action: 'taken', title: '✅ Je l’ai prise' },
      { action: 'snooze', title: '⏰ Dans 15 min' },
    ]
  }
  return []
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' }
  }

  const kind = data.kind || 'info'
  const title = data.title || 'Pillow 💊'
  const options = {
    body: data.body || 'Rappel Pillow',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    // Même tag = la relance remplace le rappel précédent au lieu de les empiler
    tag: data.tag || `pillow-${kind}`,
    renotify: true,
    requireInteraction: kind === 'reminder' || kind === 'nag' || kind === 'snooze',
    data: { url: data.url || '/', kind },
    actions: actionsFor(kind),
    timestamp: Date.now(),
  }

  // Vibration sur Android pour les rappels de prise
  if (kind === 'reminder' || kind === 'nag' || kind === 'snooze') options.vibrate = [220, 110, 220, 110, 420]

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const base = (event.notification.data && event.notification.data.url) || '/'
  const action = event.action // 'taken' | 'snooze' | ''
  const target = action ? `${base}${base.includes('?') ? '&' : '?'}pillow_action=${action}` : base

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (existing) {
        // L'app est déjà ouverte : on la montre et on lui transmet l'action
        if (action) existing.postMessage({ type: 'PILLOW_ACTION', action })
        return 'focus' in existing ? existing.focus() : undefined
      }
      return self.clients.openWindow(target)
    }),
  )
})

// Le navigateur a renouvelé l'abonnement : on prévient l'app pour qu'elle le ré-enregistre
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      windows.forEach((w) => w.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }))
    }),
  )
})
