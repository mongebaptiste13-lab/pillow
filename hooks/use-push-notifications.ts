"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { authFetch } from "@/lib/supabase-client"

export type PushStatus =
  | "idle"          // pas encore activées
  | "loading"
  | "subscribed"
  | "denied"        // refusées dans le navigateur
  | "unsupported"   // navigateur incompatible
  | "needs_install" // iPhone : il faut d'abord ajouter l'app à l'écran d'accueil
  | "error"

export interface PushTestResult {
  ok: boolean
  message: string
}

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false
  const av = new Uint8Array(a)
  if (av.length !== b.length) return false
  for (let i = 0; i < av.length; i++) if (av[i] !== b[i]) return false
  return true
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

async function getRegistration(timeoutMs = 10_000): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/")
  if (!existing) await navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
  ])
}

async function registerOnServer(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Abonnement incomplet")
  const res = await authFetch("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Serveur ${res.status}`)
  }
}

export function usePushNotifications(enabled = true) {
  const [status, setStatus] = useState<PushStatus>("idle")
  const [lastError, setLastError] = useState<string | null>(null)
  const syncing = useRef(false)

  /** Vérifie l'état réel et resynchronise l'abonnement avec le serveur (silencieux). */
  const sync = useCallback(async () => {
    if (syncing.current) return
    syncing.current = true
    try {
      if (!pushSupported()) {
        setStatus(isIosDevice() && !isStandalone() ? "needs_install" : "unsupported")
        return
      }
      if (isIosDevice() && !isStandalone()) {
        setStatus("needs_install")
        return
      }
      if (Notification.permission === "denied") {
        setStatus("denied")
        return
      }
      if (Notification.permission !== "granted") {
        setStatus("idle")
        return
      }

      const reg = await getRegistration()
      let sub = await reg.pushManager.getSubscription()

      // Permission accordée mais abonnement perdu (données effacées, rotation par le navigateur…) → on recrée
      if (!sub && VAPID_KEY) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_KEY) as BufferSource })
      }
      if (!sub) {
        setStatus("idle")
        return
      }

      // Garantit que l'abonnement est bien rattaché au compte connecté (idempotent)
      await registerOnServer(sub)
      setStatus("subscribed")
      setLastError(null)
    } catch (err) {
      console.warn("[Push] sync:", err)
      setStatus(Notification.permission === "granted" ? "idle" : "idle")
    } finally {
      syncing.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void sync()
    // Le service worker nous prévient si le navigateur a renouvelé l'abonnement
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_SUBSCRIPTION_CHANGED") void sync()
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", onMessage)
    return () => {
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", onMessage)
    }
  }, [enabled, sync])

  const subscribe = useCallback(async (): Promise<boolean> => {
    setLastError(null)
    if (!pushSupported()) {
      setStatus(isIosDevice() && !isStandalone() ? "needs_install" : "unsupported")
      return false
    }
    if (isIosDevice() && !isStandalone()) {
      setStatus("needs_install")
      return false
    }
    if (!VAPID_KEY) {
      setLastError("Le serveur n'a pas de clé VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY).")
      setStatus("error")
      return false
    }

    setStatus("loading")
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "idle")
        return false
      }

      const reg = await getRegistration()
      const key = urlB64ToUint8Array(VAPID_KEY)

      let sub = await reg.pushManager.getSubscription()
      // Abonnement créé avec une autre clé VAPID → inutilisable, on repart de zéro
      if (sub && !sameKey(sub.options?.applicationServerKey, key)) {
        await sub.unsubscribe()
        sub = null
      }
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource })
      }

      await registerOnServer(sub)
      setStatus("subscribed")
      return true
    } catch (err) {
      console.error("[Push] subscribe:", err)
      const message = err instanceof Error ? err.message : "Erreur inconnue"
      setLastError(message === "timeout" ? "Le service worker ne répond pas. Recharge la page puis réessaie." : message)
      setStatus("error")
      return false
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setLastError(null)
    try {
      const reg = await getRegistration(5_000)
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await authFetch("/api/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint }) })
      }
    } catch (err) {
      console.warn("[Push] unsubscribe:", err)
    }
    setStatus(typeof Notification !== "undefined" && Notification.permission === "denied" ? "denied" : "idle")
  }, [])

  /** Envoie une vraie notification push à tous mes appareils. */
  const sendTest = useCallback(async (): Promise<PushTestResult> => {
    try {
      const res = await authFetch("/api/push/send", { method: "POST", body: "{}" })
      const body = await res.json().catch(() => ({}))
      if (res.ok) return { ok: true, message: "Notification envoyée ! Elle arrive dans quelques secondes." }
      return { ok: false, message: body.error || `Échec de l'envoi (${res.status})` }
    } catch {
      return { ok: false, message: "Impossible de joindre le serveur. Vérifie ta connexion." }
    }
  }, [])

  return { status, lastError, subscribe, unsubscribe, sendTest, resync: sync }
}
