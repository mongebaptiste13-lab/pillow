import { NextResponse } from "next/server"
import { getServerContext } from "@/lib/supabase-server"
import { isPushConfigured, sendPushNotification } from "@/lib/web-push-server"
import { getTestNotificationMessage } from "@/lib/notifications"

/**
 * Envoie une notification de test à tous les appareils de l'utilisatrice connectée.
 * (Les vrais rappels partent du dispatcher, jamais d'ici.)
 */
export async function POST(req: Request) {
  const { user, supabase } = await getServerContext(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Le serveur n'a pas de clés VAPID (lance `pnpm vapid`).", code: "vapid_missing" }, { status: 503 })
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: "Aucun appareil abonné.", code: "no_subscription" }, { status: 409 })
  }

  const results = await Promise.all(
    subs.map(async (sub) => {
      const result = await sendPushNotification(sub, {
        title: "Pillow 💊",
        body: getTestNotificationMessage(),
        tag: "pillow-test",
        url: "/",
        kind: "test",
      })
      if (!result.ok && result.gone) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
      }
      return result
    }),
  )

  const sent = results.filter((r) => r.ok).length
  if (sent === 0) {
    const firstError = results.find((r) => !r.ok)
    return NextResponse.json(
      { error: "L'envoi a échoué. Réactive les notifications puis réessaie.", detail: firstError && !firstError.ok ? firstError.error : undefined, code: "send_failed" },
      { status: 502 },
    )
  }
  return NextResponse.json({ ok: true, sent })
}
