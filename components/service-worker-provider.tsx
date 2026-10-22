'use client'

import { useEffect } from 'react'

/**
 * Enregistre le service worker (hors-ligne + notifications push).
 * On ne demande PAS la permission de notification ici : les navigateurs la
 * bloquent si elle n'est pas déclenchée par un geste de l'utilisatrice.
 * Elle est demandée depuis l'onboarding et les réglages.
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // Pas de service worker en dev : il met en cache et masque les changements
    if (process.env.NODE_ENV !== 'production') return

    let refreshing = false
    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }

    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .then((reg) => {
        // Nouvelle version disponible : on l'active tout de suite
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
        // Vérifie les mises à jour à chaque retour sur l'app
        const check = () => reg.update().catch(() => undefined)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check()
        })
      })
      .catch((err) => console.warn('[Pillow] Service worker non enregistré :', err))

    // Ne recharge que lors d'un changement de version (pas à la toute première installation)
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    }
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])

  return null
}
