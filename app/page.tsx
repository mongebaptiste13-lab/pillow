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
    async function bootstrap() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) { setAppState("auth"); return }

        setUser(session.user)
        await checkProfile(session.user.id)
      } catch {
        setAppState("auth")
      }
    }

    async function checkProfile(uid: string) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name, pill_name, pill_time")
        .eq("id", uid)
        .single()

      // Go to onboarding if profile incomplete
      if (!profile?.name || !profile?.pill_name || !profile?.pill_time) {
        setAppState("onboarding")
      } else {
        setAppState("app")
      }
    }

    bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          setAppState("auth")
          setUser(null)
          return
        }
        if (event === "SIGNED_IN" && session.user) {
          setUser(session.user)
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, name, pill_name, pill_time")
            .eq("id", session.user.id)
            .single()
          setAppState(
            profile?.name && profile?.pill_name && profile?.pill_time ? "app" : "onboarding"
          )
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  if (appState === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center">
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
    return (
      <Onboarding
        userId={user.id}
        onComplete={() => setAppState("app")}
      />
    )
  }

  if (appState === "app" && user) {
    return (
      <Dashboard
        userId={user.id}
        onNeedsOnboarding={() => setAppState("onboarding")}
      />
    )
  }

  return null
}
