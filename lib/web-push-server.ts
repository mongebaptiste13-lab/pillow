import webpush from "web-push"

/**
 * Envoi Web Push (serveur uniquement).
 * Génère tes clés VAPID avec : `pnpm vapid`
 */

let configured = false

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

function ensureConfigured() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error("Clés VAPID manquantes (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) — lance `pnpm vapid`")
  }
  const raw = process.env.VAPID_EMAIL?.trim()
  const subject = raw ? (/^(mailto:|https?:)/.test(raw) ? raw : `mailto:${raw}`) : "mailto:contact@pillow.app"
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export type PushKind = "reminder" | "nag" | "snooze" | "stock" | "restart" | "test" | "info"

export interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
  /** Détermine les boutons d'action affichés par le service worker */
  kind?: PushKind
}

export interface PushSubscriptionRecord {
  endpoint: string
  p256dh: string
  auth: string
}

export type PushResult = { ok: true } | { ok: false; gone: boolean; error: string }

export async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<PushResult> {
  try {
    ensureConfigured()
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      // TTL 2h : un rappel de pilule n'a plus de sens au-delà. Urgence haute pour réveiller le téléphone.
      { TTL: 2 * 60 * 60, urgency: "high" },
    )
    return { ok: true }
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 0
    return {
      ok: false,
      gone: statusCode === 404 || statusCode === 410,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
