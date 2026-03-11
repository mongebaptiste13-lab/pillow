import { createClient as _create } from "@supabase/supabase-js"

// Singleton — one client for the whole browser session
let _instance: ReturnType<typeof _create> | null = null

export function createClient() {
  if (_instance) return _instance

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error("[Pillow] Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  _instance = _create(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "pillow-auth",
    },
  })

  return _instance
}
