"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Auth from "@/components/auth"
import Onboarding from "@/components/onboarding"
import Dashboard from "@/components/dashboard"
import { PillLoader } from "@/components/pill-loader"
import { LogoMark } from "@/components/logo"
import { createClient, isSupabaseConfigured } from "@/lib/supabase-client"

type AppState = "loading" | "auth" | "recovery" | "onboarding" | "app"

function SplashScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-8">
      <LogoMark size={84} className="drop-shadow-[0_14px_28px_rgba(67,32,58,0.4)] animate-pop" />
      <PillLoader size={44} />
    </div>
  )
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("loading")
  const [userId, setUserId] = useState<string | null>(null)
  const mounted = useRef(true)

  const routeUser = useCallback(async (uid: string) => {
    try {
      const { data: profile, error } = await createClient()
        .from("profiles")
        .select("name, pill_name, pill_time")
        .eq("id", uid)
        .maybeSingle()
      if (!mounted.current) return
      if (error) throw error
      const complete = Boolean(profile?.name && profile?.pill_name && profile?.pill_time)
      setUserId(uid)
      setAppState(complete ? "app" : "onboarding")
    } catch {
      // Réseau coupé ou profil illisible : le tableau de bord gère le hors-ligne, l'onboarding sinon
      if (!mounted.current) return
      setUserId(uid)
      setAppState(typeof navigator !== "undefined" && navigator.onLine === false ? "app" : "onboarding")
    }
  }, [])

  useEffect(() => {
    mounted.current = true

    if (!isSupabaseConfigured()) {
      setAppState("auth")
      return
    }

    // Jamais plus de 8 s sur l'écran de chargement
    const bail = window.setTimeout(() => {
      if (mounted.current) setAppState((s) => (s === "loading" ? "auth" : s))
    }, 8000)

    const supabase = createClient()

    // Écouteur AVANT getSession : le lien « mot de passe oublié » déclenche PASSWORD_RECOVERY au chargement
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted.current) return
      if (event === "PASSWORD_RECOVERY") {
        window.clearTimeout(bail)
        setAppState("recovery")
      } else if (event === "SIGNED_OUT") {
        setUserId(null)
        setAppState("auth")
      }
    })

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        window.clearTimeout(bail)
        if (!mounted.current) return
        if (!session?.user) {
          setAppState((s) => (s === "recovery" ? s : "auth"))
          return
        }
        if (!window.location.hash.includes("type=recovery")) await routeUser(session.user.id)
      })
      .catch(() => {
        window.clearTimeout(bail)
        if (mounted.current) setAppState("auth")
      })

    return () => {
      mounted.current = false
      window.clearTimeout(bail)
      sub.subscription.unsubscribe()
    }
  }, [routeUser])

  const handleAuth = useCallback(
    async (uid: string) => {
      setAppState("loading")
      await routeUser(uid)
    },
    [routeUser],
  )

  if (appState === "loading") return <SplashScreen />
  if (appState === "recovery") return <Auth onAuth={handleAuth} initialMode="reset" />
  if (appState === "onboarding" && userId) return <Onboarding userId={userId} onComplete={() => setAppState("app")} />
  if (appState === "app" && userId) return <Dashboard userId={userId} onNeedsOnboarding={() => setAppState("onboarding")} />
  return <Auth onAuth={handleAuth} />
}
