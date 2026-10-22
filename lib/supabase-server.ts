import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error("Supabase n'est pas configuré (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)")
  return { url, anon }
}

function extractToken(request: Request): string | null {
  const header = request.headers.get("Authorization")
  if (!header) return null
  const token = header.replace(/^Bearer\s+/i, "").trim()
  return token || null
}

/**
 * Client Supabase côté serveur, authentifié avec le JWT de l'utilisatrice :
 * les requêtes respectent donc les policies RLS.
 */
export function createServerSupabaseClient(token?: string | null): SupabaseClient<Database> {
  const { url, anon } = config()
  return createClient<Database>(url, anon, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Valide le Bearer token (getUser(token) est la méthode de validation serveur correcte). */
export async function getServerUser(request: Request) {
  const token = extractToken(request)
  if (!token) return null
  const verifier = createServerSupabaseClient()
  const { data, error } = await verifier.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

/** Raccourci : l'utilisatrice + un client scopé à son JWT. */
export async function getServerContext(request: Request) {
  const token = extractToken(request)
  const user = await getServerUser(request)
  const supabase = createServerSupabaseClient(token)
  return { user, supabase, token }
}
