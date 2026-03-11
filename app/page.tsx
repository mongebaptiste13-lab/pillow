"use client"

import { useEffect, useState } from "react"
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

  useEffect(() => {
    const supabase = createClient()

    async function bootstrap() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) { setAppState("auth"); return }

        setUser(session.user)

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("id", session.user.id)
          .single()

        if (!profile?.name) {
          setAppState("onboarding")
        } else {
          setAppState("app")
        }
      } catch {
        setAppState("auth")
      }
    }

    bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) { setAppState("auth"); setUser(null); return }
      if (event === "SIGNED_IN" && session.user) {
        setUser(session.user)
        const { data: profile } = await supabase.from("profiles").select("id, name").eq("id", session.user.id).single()
        setAppState(profile?.name ? "app" : "onboarding")
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (appState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    return <Dashboard userId={user.id} />
  }

  return null
}
