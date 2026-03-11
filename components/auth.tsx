"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export default function Auth({ onAuth }: { onAuth: (uid: string) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Detect missing config early
  const missingConfig = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (missingConfig) {
      setError("Configuration manquante. Les variables d'environnement Supabase ne sont pas définies sur ce déploiement.")
      return
    }

    setLoading(true)
    try {
      const { createClient } = await import("@/lib/supabase-client")
      const supabase = createClient()

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setError(
            error.message.includes("rate limit") ? "Trop d'essais, réessaie dans quelques minutes." :
            error.message.includes("already registered") ? "Cet email est déjà utilisé. Connecte-toi !" :
            error.message
          )
        } else if (data.user) {
          if (data.session) {
            // Email confirmation disabled → direct login
            onAuth(data.user.id)
          } else {
            setSuccess("Compte créé ! Vérifie tes emails pour confirmer puis reviens te connecter.")
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setError(
            error.message === "Invalid login credentials"
              ? "Email ou mot de passe incorrect."
              : error.message.includes("Email not confirmed")
              ? "Confirme d'abord ton email (vérifie ta boîte mail)."
              : error.message
          )
        } else if (data.user) {
          onAuth(data.user.id)
        }
      }
    } catch (err) {
      setError(`Impossible de contacter Supabase. Vérifie ta connexion internet.\n${err instanceof Error ? err.message : ""}`)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pillow-logo.png" alt="Pillow" className="w-full h-full object-cover scale-[1.7]" />
          </div>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-primary">Pillow 💊</CardTitle>
            <CardDescription>
              {mode === "signin" ? "Contente de te revoir !" : "Crée ton espace Pillow"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {missingConfig && (
              <div className="rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 px-3 py-2 text-xs mb-4">
                ⚠️ Variables Supabase manquantes sur ce déploiement — ajoute-les dans Netlify.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="toi@exemple.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm whitespace-pre-wrap">{error}</div>
              )}
              {success && (
                <div className="rounded-lg bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 px-3 py-2 text-sm">{success}</div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion…" : mode === "signin" ? "Se connecter" : "Créer le compte"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  Pas encore de compte ?{" "}
                  <button
                    onClick={() => { setMode("signup"); setError(null); setSuccess(null) }}
                    className="text-primary font-medium hover:underline"
                  >
                    S'inscrire
                  </button>
                </>
              ) : (
                <>
                  Déjà un compte ?{" "}
                  <button
                    onClick={() => { setMode("signin"); setError(null); setSuccess(null) }}
                    className="text-primary font-medium hover:underline"
                  >
                    Se connecter
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
