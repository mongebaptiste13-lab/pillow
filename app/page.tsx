"use client"

import { useEffect, useState, useRef } from "react"
import Auth from "@/components/auth"
import Onboarding from "@/components/onboarding"
import Dashboard from "@/components/dashboard"
import { Loader2 } from "lucide-react"

type AppState = "loading" | "auth" | "onboarding" | "app"

export default function Home() {
  const [appState, setAppState] = useState<AppState>("loading")
  const [userId, setUserId] = useState<string | null>(null)
  const supabaseRef = useRef<Awaited<ReturnType<typeof import("@/lib/supabase-client").createClient>> | null>(null)

  async function getSupabase() {
    if (supabaseRef.current) return supabaseRef.current
    const { createClient } = await import("@/lib/supabase-client")
    supabaseRef.current = createClient()
    return supabaseRef.current
  }

  async function checkProfileAndNavigate(uid: string) {
    try {
      const sb = await getSupabase()
      const { data: profile } = await sb
        .from("profiles")
        .select("name, pill_name, pill_time")
        .eq("id", uid)
        .maybeSingle()
      const complete = !!(profile?.name && profile?.pill_name && profile?.pill_time)
      setUserId(uid)
      setAppState(complete ? "app" : "onboarding")
    } catch {
      setUserId(uid)
      setAppState("onboarding")
    }
  }

  useEffect(() => {
    let mounted = true

    // Bail: never stay in loading > 7s
    const bail = setTimeout(() => {
      if (mounted) setAppState("auth")
    }, 7000)

    async function boot() {
      // Check env vars
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        clearTimeout(bail)
        if (mounted) setAppState("auth")
        return
      }

      try {
        const sb = await getSupabase()

        // Direct session check — simpler and more reliable than onAuthStateChange for initial load
        const { data: { session } } = await sb.auth.getSession()
        clearTimeout(bail)

        if (!mounted) return

        if (!session?.user) {
          setAppState("auth")
          return
        }

        await checkProfileAndNavigate(session.user.id)

        // Only listen for sign out after initial check
        sb.auth.onAuthStateChange((event) => {
          if (!mounted) return
          if (event === "SIGNED_OUT") {
            setAppState("auth")
            setUserId(null)
          }
        })
      } catch {
        clearTimeout(bail)
        if (mounted) setAppState("auth")
      }
    }

    boot()

    return () => {
      mounted = false
      clearTimeout(bail)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Called by Auth after successful sign in — no reload needed
  async function handleAuth(uid: string) {
    setAppState("loading")
    await checkProfileAndNavigate(uid)
  }

  if (appState === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pillow-logo.png" alt="Pillow" className="w-full h-full object-cover scale-[1.7]" />
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (appState === "auth") {
    return <Auth onAuth={handleAuth} />
  }

  if (appState === "onboarding" && userId) {
    return <Onboarding userId={userId} onComplete={() => setAppState("app")} />
  }

  if (appState === "app" && userId) {
    return <Dashboard userId={userId} onNeedsOnboarding={() => setAppState("onboarding")} />
  }

  return <Auth onAuth={handleAuth} />
}
