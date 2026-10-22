import { NextResponse } from "next/server"
import { getServerContext } from "@/lib/supabase-server"

export async function POST(req: Request) {
  const { user, supabase } = await getServerContext(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { endpoint, p256dh, auth } = await req.json().catch(() => ({}))
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string" || !endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 })
  }

  // Un même appareil peut changer de compte : l'endpoint est unique, on le rattache à l'utilisatrice courante
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh, auth, updated_at: new Date().toISOString() },
    { onConflict: "endpoint" },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { user, supabase } = await getServerContext(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { endpoint } = await req.json().catch(() => ({}))
  if (typeof endpoint !== "string") return NextResponse.json({ error: "endpoint requis" }, { status: 400 })

  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
