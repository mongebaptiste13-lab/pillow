"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase-client"
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

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setSuccess("Compte créé ! Vérifie tes emails pour confirmer.")
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : error.message)
      } else if (data.user) {
        onAuth(data.user.id)
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/pillow-logo.png"
              alt="Pillow"
              className="w-full h-full object-cover scale-[1.7]"
              style={{ objectPosition: "center" }}
            />
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
                <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">{error}</div>
              )}
              {success && (
                <div className="rounded-lg bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 px-3 py-2 text-sm">{success}</div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Chargement..." : mode === "signin" ? "Se connecter" : "Créer le compte"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  Pas encore de compte ?{" "}
                  <button onClick={() => { setMode("signup"); setError(null); setSuccess(null) }} className="text-primary font-medium hover:underline">
                    S'inscrire
                  </button>
                </>
              ) : (
                <>
                  Déjà un compte ?{" "}
                  <button onClick={() => { setMode("signin"); setError(null); setSuccess(null) }} className="text-primary font-medium hover:underline">
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
