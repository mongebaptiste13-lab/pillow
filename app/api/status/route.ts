import { NextResponse } from "next/server"
import { isAdminConfigured } from "@/lib/supabase-admin"
import { isPushConfigured } from "@/lib/web-push-server"

export const dynamic = "force-dynamic"

/**
 * Diagnostic de configuration (aucun secret n'est exposé, uniquement des booléens).
 * Permet à l'écran Réglages d'expliquer précisément pourquoi une fonction ne marche pas.
 */
export async function GET() {
  return NextResponse.json({
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    push: isPushConfigured(),
    serviceRole: isAdminConfigured(),
    cron: Boolean(process.env.CRON_SECRET),
  })
}
