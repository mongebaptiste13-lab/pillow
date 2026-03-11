import { createClient } from "@supabase/supabase-js"

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Creates a Supabase client authenticated via Bearer token from the
 * Authorization header. Works regardless of whether the session is stored
 * in cookies or localStorage (avoids @supabase/ssr cookie dependency).
 */
export function createServerSupabaseClient(request?: Request) {
  const token = request?.headers.get("Authorization")?.replace("Bearer ", "")

  return createClient(URL, ANON, {
    global: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
    auth: { persistSession: false },
  })
}
