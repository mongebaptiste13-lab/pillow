"use client"

import { useState, useEffect, useCallback } from "react"

export type PushStatus =
  | "idle"        // not subscribed
  | "loading"     // in progress
  | "subscribed"  // active
  | "denied"      // browser blocked
  | "unsupported" // browser/OS doesn't support it
  | "error"       // something failed

// SW ready with a timeout so it never hangs
async function swReady(timeoutMs = 8000): Promise<ServiceWorkerRegistration> {
  // Register if not already registered
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
    } catch {}
  }

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("SW ready timeout")), timeoutMs)
    ),
  ])
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("idle")

  // Detect support & initial state on mount
  useEffect(() => {
    if (typeof window === "undefined") return

    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window

    if (!isSupported) {
      setStatus("unsupported")
      return
    }

    if (Notification.permission === "denied") {
      setStatus("denied")
      return
    }

    // Check if already subscribed
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "subscribed" : "idle"))
      .catch(() => setStatus("idle"))
  }, [])

  const subscribe = useCallback(async () => {
    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window

    if (!isSupported) {
      setStatus("unsupported")
      return
    }

    setStatus("loading")

    try {
      // Request permission
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus("denied")
        return
      }

      // Get SW registration with timeout
      const reg = await swReady(10000)

      // Unsubscribe existing
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()

      // Check VAPID key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing")
        setStatus("error")
        return
      }

      // Subscribe
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapidKey),
      })

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }

      // Save to backend
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        }),
      })

      if (!res.ok) throw new Error(`Server error ${res.status}`)

      setStatus("subscribed")
    } catch (err) {
      console.error("[Push] subscribe error:", err)
      // Distinguish timeout vs other errors
      if (err instanceof Error && err.message.includes("timeout")) {
        setStatus("unsupported")
      } else {
        setStatus("error")
      }
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await swReady(5000)
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
      }
    } catch {}
    setStatus("idle")
  }, [])

  const sendPush = useCallback(async (title: string, body: string) => {
    return fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    })
  }, [])

  return { status, subscribe, unsubscribe, sendPush }
}

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}
