import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getFollowUpNotificationMessage } from "@/lib/notifications"

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { date, taken } = await req.json()
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 })

  const { error } = await supabase.from("pill_logs").upsert(
    { user_id: user.id, date, taken: taken ?? true },
    { onConflict: "user_id,date" }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (taken !== false) {
    const followUpAt = new Date(Date.now() + 60 * 60_000).toISOString()
    await supabase.from("notification_schedules").delete()
      .eq("user_id", user.id).eq("type", "follow_up").is("sent_at", null)
    await supabase.from("notification_schedules").insert({
      user_id: user.id,
      type: "follow_up",
      title: "Pillow 💊",
      body: getFollowUpNotificationMessage(),
      scheduled_at: followUpAt,
    })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")

  let query = supabase.from("pill_logs").select("date, taken").eq("user_id", user.id).order("date", { ascending: false })
  if (from) query = query.gte("date", from)
  if (to) query = query.lte("date", to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data })
}
