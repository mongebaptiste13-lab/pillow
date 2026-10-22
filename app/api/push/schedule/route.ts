import { NextResponse } from "next/server"
import { getServerContext } from "@/lib/supabase-server"

const MAX_DELAY_MS = 24 * 60 * 60_000

/**
 * Programme un rappel ponctuel (« plus tard »). Seul le type "snooze" est
 * autorisé depuis le client : les autres rappels sont gérés par le dispatcher.
 */
export async function POST(req: Request) {
  const { user, supabase } = await getServerContext(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { title, body, scheduledAt } = await req.json().catch(() => ({}))
  const when = typeof scheduledAt === "string" ? new Date(scheduledAt) : null
  if (typeof title !== "string" || typeof body !== "string" || !when || Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: "Champs invalides" }, { status: 400 })
  }
  const delay = when.getTime() - Date.now()
  if (delay > MAX_DELAY_MS) return NextResponse.json({ error: "Délai trop long" }, { status: 400 })

  // Un seul « plus tard » actif à la fois
  await supabase.from("notification_schedules").delete().eq("user_id", user.id).eq("type", "snooze").is("sent_at", null)

  const { error } = await supabase.from("notification_schedules").insert({
    user_id: user.id,
    type: "snooze",
    title: title.slice(0, 80),
    body: body.slice(0, 240),
    scheduled_at: when.toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { user, supabase } = await getServerContext(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase
    .from("notification_schedules")
    .delete()
    .eq("user_id", user.id)
    .eq("type", "snooze")
    .is("sent_at", null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
