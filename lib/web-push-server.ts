import webpush from "web-push"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!
const rawVapidEmail = process.env.VAPID_EMAIL?.trim()
const VAPID_EMAIL = rawVapidEmail
  ? (rawVapidEmail.startsWith("mailto:") ? rawVapidEmail : `mailto:${rawVapidEmail}`)
  : "mailto:contact@pillow.app"

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export interface PushPayload { title: string; body: string; tag?: string; url?: string }
export interface PushSubscriptionRecord { endpoint: string; p256dh: string; auth: string }

export async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; gone: boolean; error: string }> {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload)
    )
    return { ok: true }
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 0
    return { ok: false, gone: statusCode === 404 || statusCode === 410, error: err instanceof Error ? err.message : String(err) }
  }
}
