import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { type, title, body, scheduledAt } = await req.json()
  if (!type || !title || !body || !scheduledAt) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  await supabase.from("notification_schedules")
    .delete()
    .eq("user_id", user.id)
    .eq("type", type)
    .is("sent_at", null)

  const { error } = await supabase.from("notification_schedules").insert({
    user_id: user.id, type, title, body,
    scheduled_at: scheduledAt,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { type } = await req.json()
  await supabase.from("notification_schedules")
    .delete()
    .eq("user_id", user.id)
    .eq("type", type)
    .is("sent_at", null)

  return NextResponse.json({ ok: true })
}
