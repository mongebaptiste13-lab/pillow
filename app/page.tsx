"use client"

import { useEffect, useState } from "react"
import Auth from "@/components/auth"
import Onboarding from "@/components/onboarding"
import Dashboard from "@/components/dashboard"
import { Loader2 } from "lucide-react"
import type { User } from "@supabase/supabase-js"

type AppState = "loading" | "auth" | "onboarding" | "app"

export default function Home() {
  const [appState, setAppState] = useState<AppState>("loading")
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let mounted = true

    // Hard timeout — never stay in loading more than 5s
    const hardTimeout = setTimeout(() => {
      if (mounted && appState === "loading") setAppState("auth")
    }, 5000)

    // Verify env vars exist
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      clearTimeout(hardTimeout)
      setAppState("auth")
      return
    }

    async function init() {
      try {
        // Lazy import to avoid SSR issues
        const { createClient } = await import("@/lib/supabase-client")
        const supabase = createClient()

        // Race getSession against 4s timeout
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 4000)
          ),
        ])

        if (!mounted) return
        clearTimeout(hardTimeout)

        const session = result.data.session
        if (!session?.user) {
          setAppState("auth")
          return
        }

        setUser(session.user)

        // Profile check — race against 3s
        const profileResult = await Promise.race([
          supabase
            .from("profiles")
            .select("id, name, pill_name, pill_time")
            .eq("id", session.user.id)
            .maybeSingle(),
          new Promise<{ data: null }>((resolve) =>
            setTimeout(() => resolve({ data: null }), 3000)
          ),
        ])

        if (!mounted) return

        const profile = profileResult?.data
        const complete = !!(profile?.name && profile?.pill_name && profile?.pill_time)
        setAppState(complete ? "app" : "onboarding")

        // Listen for future auth changes
        supabase.auth.onAuthStateChange(async (event, sess) => {
          if (!mounted) return
          if (event === "SIGNED_OUT") {
            setAppState("auth")
            setUser(null)
          } else if (event === "SIGNED_IN" && sess?.user) {
            setUser(sess.user)
            const { data: p } = await supabase
              .from("profiles")
              .select("id, name, pill_name, pill_time")
              .eq("id", sess.user.id)
              .maybeSingle()
            const ok = !!(p?.name && p?.pill_name && p?.pill_time)
            setAppState(ok ? "app" : "onboarding")
          }
        })
      } catch {
        if (mounted) {
          clearTimeout(hardTimeout)
          setAppState("auth")
        }
      }
    }

    init()

    return () => {
      mounted = false
      clearTimeout(hardTimeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (appState === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pillow-logo.png" alt="Pillow" className="w-full h-full object-cover scale-[1.7]" />
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  if (appState === "auth") {
    return <Auth onAuth={() => {}} />
  }

  if (appState === "onboarding" && user) {
    return <Onboarding userId={user.id} onComplete={() => setAppState("app")} />
  }

  if (appState === "app" && user) {
    return <Dashboard userId={user.id} onNeedsOnboarding={() => setAppState("onboarding")} />
  }

  return <Auth onAuth={() => {}} />
}
