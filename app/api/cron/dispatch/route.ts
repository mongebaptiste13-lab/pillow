import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { runDispatch } from "@/lib/dispatch"
import { isAdminConfigured } from "@/lib/supabase-admin"
import { isPushConfigured } from "@/lib/web-push-server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

function authorized(req: Request, secret: string): boolean {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  const header = req.headers.get("x-cron-secret")?.trim()
  return [bearer, header].some((candidate) => candidate && safeEqual(candidate, secret))
}

/**
 * Appelé chaque minute par le cron (Netlify scheduled function, pg_cron, cron-job.org…).
 * Protégé par CRON_SECRET : `Authorization: Bearer <secret>` ou en-tête `x-cron-secret`.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET n'est pas défini sur le serveur" }, { status: 500 })
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manquante" }, { status: 500 })
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Clés VAPID manquantes (lance `pnpm vapid`)" }, { status: 500 })
  }

  try {
    const summary = await runDispatch()
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error("[dispatch]", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur interne" }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
