"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase-client"
import Auth from "@/components/auth"
import Onboarding from "@/components/onboarding"
import Dashboard from "@/components/dashboard"
import { Loader2 } from "lucide-react"
import type { User } from "@supabase/supabase-js"

type AppState = "loading" | "auth" | "onboarding" | "app"

export default function Home() {
  const [appState, setAppState] = useState<AppState>("loading")
  const [user, setUser] = useState<User | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    // Safety net: if nothing fires in 6s, go to auth page
    const timeout = setTimeout(() => {
      setAppState((s) => s === "loading" ? "auth" : s)
    }, 6000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // INITIAL_SESSION fires on page load with current auth state
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
          if (!session?.user) {
            setAppState("auth")
            setUser(null)
            clearTimeout(timeout)
            return
          }

          setUser(session.user)

          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, name, pill_name, pill_time")
              .eq("id", session.user.id)
              .maybeSingle()

            const complete = profile?.name && profile?.pill_name && profile?.pill_time
            setAppState(complete ? "app" : "onboarding")
          } catch {
            // Profile fetch failed — send to onboarding to be safe
            setAppState("onboarding")
          }

          clearTimeout(timeout)
        } else if (event === "SIGNED_OUT") {
          setAppState("auth")
          setUser(null)
          clearTimeout(timeout)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [supabase])

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
    return <Auth onAuth={() => {}} />
  }

  if (appState === "onboarding" && user) {
    return <Onboarding userId={user.id} onComplete={() => setAppState("app")} />
  }

  if (appState === "app" && user) {
    return <Dashboard userId={user.id} onNeedsOnboarding={() => setAppState("onboarding")} />
  }

  // Fallback si user est null mais état = onboarding ou app
  return <Auth onAuth={() => {}} />
}
