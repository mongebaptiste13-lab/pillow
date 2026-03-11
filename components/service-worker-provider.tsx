'use client'

import { useEffect } from 'react'

export function ServiceWorkerProvider() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .then((reg) => {
          console.log('[App] Service Worker registered successfully:', reg)
        })
        .catch((err) => {
          console.error('[App] Service Worker registration failed:', err)
        })

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[App] Message from Service Worker:', event.data)

        // Handle different message types
        if (event.data.type === 'PILL_REMINDER') {
          // Handle pill reminder notification
          console.log('[App] Pill reminder:', event.data)
        }

        if (event.data.type === 'SYNC_COMPLETE') {
          // Handle sync completion
          console.log('[App] Sync complete:', event.data)
        }
      })
    }

    // Request notification permission if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => {
        Notification.requestPermission().then((permission) => {
          console.log('[App] Notification permission:', permission)
        })
      }, 2000)
    }
  }, [])

  return null
}
