'use client'

import { useEffect, useState } from 'react'

export function NotificationPermissionProvider() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if ('Notification' in window) {
      setPermission(Notification.permission)

      // Listen for permission changes
      const handlePermissionChange = () => {
        setPermission(Notification.permission)
      }

      // Some browsers may not support this event, but we'll try
      if (navigator.permissions) {
        navigator.permissions.query({ name: 'notifications' }).then((result) => {
          result.addEventListener('change', handlePermissionChange)
          return () => {
            result.removeEventListener('change', handlePermissionChange)
          }
        })
      }
    }
  }, [])

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Notifications not supported')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      return false
    }
  }

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (Notification.permission === 'granted') {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller?.postMessage({
          type: 'SEND_NOTIFICATION',
          payload: { title, options },
        })
      } else {
        return new Notification(title, options)
      }
    }
  }

  return {
    permission,
    requestPermission,
    sendNotification,
  }
}
