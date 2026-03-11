import { NextResponse } from "next/server"
import { getServerContext } from "@/lib/supabase-server"
import { sendPushNotification } from "@/lib/web-push-server"

export async function POST(req: Request) {
  const { user, supabase } = await getServerContext(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { title, body, tag, url } = await req.json()

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id)

  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const results = await Promise.all(
    subs.map(async (sub) => {
      const result = await sendPushNotification(sub, { title: title || "Pillow 💊", body: body || "", tag, url })
      if (!result.ok && result.gone) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
      }
      return result
    })
  )

  return NextResponse.json({ ok: true, sent: results.filter((r) => r.ok).length })
}
