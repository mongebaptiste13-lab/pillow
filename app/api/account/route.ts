import { NextResponse } from "next/server"
import { getServerUser } from "@/lib/supabase-server"
import { createAdminClient, isAdminConfigured } from "@/lib/supabase-admin"

/**
 * Suppression définitive du compte et de toutes les données associées
 * (profil, journal de prises, abonnements push — tout est en `on delete cascade`).
 */
export async function DELETE(req: Request) {
  const user = await getServerUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "La suppression de compte n'est pas configurée sur ce serveur (SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    )
  }

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
