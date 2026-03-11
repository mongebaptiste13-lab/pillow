"use client"

import { useEffect, useState, useCallback } from "react"
import Auth from "@/components/auth"
import Onboarding from "@/components/onboarding"
import Dashboard from "@/components/dashboard"
import { Loader2 } from "lucide-react"
import type { User } from "@supabase/supabase-js"

type AppState = "loading" | "auth" | "onboarding" | "app"

const CACHE_KEY = "pillow:uid"

export default function Home() {
  // Fast path: if we know the user was logged in before, show spinner only briefly
  const [appState, setAppState] = useState<AppState>("loading")
  const [userId, setUserId] = useState<string | null>(null)

  const goTo = useCallback((state: AppState, uid?: string) => {
    if (uid) {
      setUserId(uid)
      localStorage.setItem(CACHE_KEY, uid)
    }
    setAppState(state)
  }, [])

  useEffect(() => {
    let mounted = true

    // If user was previously connected, skip straight to loading-then-app
    const cachedUid = localStorage.getItem(CACHE_KEY)

    // Hard bail: max 6s loading no matter what
    const bail = setTimeout(() => {
      if (mounted) {
        localStorage.removeItem(CACHE_KEY)
        setAppState("auth")
      }
    }, 6000)

    async function boot() {
      // Check env vars
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        clearTimeout(bail)
        if (mounted) setAppState("auth")
        return
      }

      let sb: ReturnType<typeof import("@/lib/supabase-client").createClient>
      try {
        const mod = await import("@/lib/supabase-client")
        sb = mod.createClient()
      } catch {
        clearTimeout(bail)
        if (mounted) { localStorage.removeItem(CACHE_KEY); setAppState("auth") }
        return
      }

      // If cached uid → optimistically show app while we verify
      if (cachedUid && mounted) setUserId(cachedUid)

      // Listen to auth state (fires INITIAL_SESSION on first call)
      const { data: { subscription } } = sb.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return
          clearTimeout(bail)

          if (!session?.user) {
            localStorage.removeItem(CACHE_KEY)
            setUserId(null)
            setAppState("auth")
            return
          }

          const uid = session.user.id
          setUserId(uid)
          localStorage.setItem(CACHE_KEY, uid)

          // Check profile completeness
          try {
            const { data: profile } = await sb
              .from("profiles")
              .select("name, pill_name, pill_time")
              .eq("id", uid)
              .maybeSingle()

            if (!mounted) return
            const complete = !!(profile?.name && profile?.pill_name && profile?.pill_time)
            setAppState(complete ? "app" : "onboarding")
          } catch {
            if (mounted) setAppState("onboarding")
          }
        }
      )

      return () => subscription.unsubscribe()
    }

    let cleanup: (() => void) | undefined
    boot().then((fn) => { cleanup = fn })

    return () => {
      mounted = false
      clearTimeout(bail)
      cleanup?.()
    }
  }, [])

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
    return (
      <Auth
        onAuth={(uid) => {
          setUserId(uid)
          localStorage.setItem(CACHE_KEY, uid)
          // After sign in, reload to re-run boot() cleanly
          window.location.reload()
        }}
      />
    )
  }

  if (appState === "onboarding" && userId) {
    return <Onboarding userId={userId} onComplete={() => setAppState("app")} />
  }

  if (appState === "app" && userId) {
    return <Dashboard userId={userId} onNeedsOnboarding={() => setAppState("onboarding")} />
  }

  return (
    <Auth
      onAuth={(uid) => {
        localStorage.setItem(CACHE_KEY, uid)
        window.location.reload()
      }}
    />
  )
}
