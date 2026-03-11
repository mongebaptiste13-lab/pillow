"use client"

import { useState, useEffect, useCallback } from "react"

export type PushStatus =
  | "idle"
  | "loading"
  | "subscribed"
  | "denied"
  | "unsupported"
  | "error"

// Get access token from the Supabase singleton stored in localStorage
async function getAccessToken(): Promise<string | null> {
  try {
    const { createClient } = await import("@/lib/supabase-client")
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    return session?.access_token ?? null
  } catch {
    return null
  }
}

// Authenticated fetch helper — adds Bearer token automatically
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
}

// Register SW and return ready registration (with timeout)
async function swReady(timeoutMs = 10000): Promise<ServiceWorkerRegistration> {
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

  useEffect(() => {
    if (typeof window === "undefined") return
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
    if (!ok) { setStatus("unsupported"); return }
    if (Notification.permission === "denied") { setStatus("denied"); return }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "subscribed" : "idle"))
      .catch(() => setStatus("idle"))
  }, [])

  const subscribe = useCallback(async () => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
    if (!ok) { setStatus("unsupported"); return }

    setStatus("loading")
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") { setStatus("denied"); return }

      const reg = await swReady(10000)

      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { console.error("[Push] VAPID key missing"); setStatus("error"); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapidKey),
      })

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }

      const res = await authFetch("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error("[Push] subscribe API error:", res.status, body)
        throw new Error(`Server ${res.status}`)
      }

      setStatus("subscribed")
    } catch (err) {
      console.error("[Push] subscribe error:", err)
      setStatus(err instanceof Error && err.message.includes("timeout") ? "unsupported" : "error")
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await swReady(5000)
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await authFetch("/api/push/subscribe", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
      }
    } catch {}
    setStatus("idle")
  }, [])

  const sendPush = useCallback(async (title: string, body: string) => {
    return authFetch("/api/push/send", {
      method: "POST",
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
