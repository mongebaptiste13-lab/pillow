import { createClient } from "@supabase/supabase-js"

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function extractToken(request: Request): string | null {
  return request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null
}

/**
 * Returns an authenticated Supabase client scoped to the user's JWT.
 * Pass the token so DB queries respect RLS policies.
 */
export function createServerSupabaseClient(token?: string | null) {
  return createClient(URL, ANON, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Validates the Bearer token from the request and returns the user.
 * Uses supabase.auth.getUser(token) — the correct server-side validation method.
 */
export async function getServerUser(request: Request) {
  const token = extractToken(request)
  if (!token) return null
  // Dedicated client just for token validation (no auth state persistence)
  const verifier = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error } = await verifier.auth.getUser(token)
  if (error || !user) return null
  return user
}

/**
 * Convenience: get both user and authenticated client in one call.
 */
export async function getServerContext(request: Request) {
  const token = extractToken(request)
  const user  = await getServerUser(request)
  const supabase = createServerSupabaseClient(token)
  return { user, supabase, token }
}
