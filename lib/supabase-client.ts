import { createClient as _create, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

export type PillowClient = SupabaseClient<Database>

// Singleton — un seul client pour toute la session navigateur
let _instance: PillowClient | null = null

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function createClient(): PillowClient {
  if (_instance) return _instance

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error("[Pillow] Variables manquantes : NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  _instance = _create<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "pillow-auth",
    },
  })

  return _instance
}

/** Jeton d'accès courant, pour appeler nos routes API. */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/** fetch authentifié vers nos routes /api (ajoute le Bearer automatiquement). */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
}
