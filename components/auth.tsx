"use client"

import { useState } from "react"
import { Eye, EyeOff, Mail, Lock, ArrowLeft, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LogoMark } from "@/components/logo"
import { PillSpinner } from "@/components/pill-loader"
import { createClient, isSupabaseConfigured } from "@/lib/supabase-client"
import { cn } from "@/lib/utils"

type Mode = "signin" | "signup" | "forgot" | "reset"

function translateError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect."
  if (m.includes("email not confirmed")) return "Confirme d'abord ton email (regarde ta boîte de réception, et les spams)."
  if (m.includes("already registered") || m.includes("already been registered")) return "Cet email a déjà un compte. Connecte-toi !"
  if (m.includes("rate limit") || m.includes("too many")) return "Trop d'essais. Réessaie dans quelques minutes."
  if (m.includes("password should be at least")) return "Le mot de passe doit contenir au moins 8 caractères."
  if (m.includes("same password") || m.includes("different from the old")) return "Choisis un mot de passe différent de l'ancien."
  if (m.includes("failed to fetch") || m.includes("network")) return "Impossible de joindre le serveur. Vérifie ta connexion."
  if (m.includes("weak") || m.includes("pwned")) return "Ce mot de passe est trop faible ou trop courant. Choisis-en un autre."
  return message
}

export default function Auth({
  onAuth,
  initialMode = "signin",
}: {
  onAuth: (uid: string) => void
  initialMode?: Mode
}) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const missingConfig = !isSupabaseConfigured()

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (missingConfig) {
      setError("Configuration manquante : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY ne sont pas définies sur ce déploiement.")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const cleanEmail = email.trim().toLowerCase()

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) setError(translateError(error.message))
        else if (data.session && data.user) onAuth(data.user.id)
        else if (data.user && data.user.identities?.length === 0) setError("Cet email a déjà un compte. Connecte-toi !")
        else setSuccess("Compte créé ! Clique sur le lien reçu par email pour confirmer, puis reviens te connecter.")
      } else if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
        if (error) setError(translateError(error.message))
        else if (data.user) onAuth(data.user.id)
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: window.location.origin })
        if (error) setError(translateError(error.message))
        else setSuccess("Si un compte existe pour cet email, tu vas recevoir un lien pour choisir un nouveau mot de passe.")
      } else if (mode === "reset") {
        const { data, error } = await supabase.auth.updateUser({ password })
        if (error) setError(translateError(error.message))
        else if (data.user) onAuth(data.user.id)
      }
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : "Erreur inconnue"))
    } finally {
      setLoading(false)
    }
  }

  const title =
    mode === "signin" ? "Contente de te revoir" : mode === "signup" ? "Crée ton espace" : mode === "forgot" ? "Mot de passe oublié" : "Nouveau mot de passe"
  const subtitle =
    mode === "signin"
      ? "Connecte-toi pour retrouver tes rappels."
      : mode === "signup"
      ? "Une minute pour ne plus jamais oublier ta pilule."
      : mode === "forgot"
      ? "On t'envoie un lien pour en choisir un nouveau."
      : "Choisis un mot de passe d'au moins 8 caractères."

  const submitLabel =
    mode === "signin" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : mode === "forgot" ? "Envoyer le lien" : "Enregistrer"

  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-10 pt-safe pb-safe">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative">
            <LogoMark size={92} className="drop-shadow-[0_10px_20px_rgba(67,32,58,0.25)]" />
          </div>
          <h1 className="font-display mt-5 text-5xl font-semibold tracking-tight">Pillow</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ta pilule, sans y penser.</p>
        </div>

        <div className="surface-lux rounded-3xl p-6">
          {(mode === "signin" || mode === "signup") && (
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1" role="tablist">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={cn(
                    "rounded-xl py-2 text-sm font-medium transition-all",
                    mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "signin" ? "Connexion" : "Inscription"}
                </button>
              ))}
            </div>
          )}

          {(mode === "forgot" || mode === "reset") && (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Retour
            </button>
          )}

          <div className="mb-5">
            <h2 className="font-display text-2xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {missingConfig && (
            <div className="mb-4 rounded-xl bg-warning/15 px-3 py-2 text-xs text-foreground" role="alert">
              ⚠️ Variables Supabase manquantes sur ce déploiement : ajoute-les dans les réglages de ton hébergeur.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            {mode !== "reset" && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    placeholder="toi@exemple.fr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-12 rounded-xl pl-10"
                  />
                </div>
              </div>
            )}

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}</Label>
                  {mode === "signin" && (
                    <button type="button" onClick={() => switchMode("forgot")} className="text-xs font-medium text-primary hover:underline">
                      Oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === "signin" ? 6 : 8}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    className="h-12 rounded-xl pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <div role="status" className="rounded-xl bg-success/15 px-3 py-2.5 text-sm text-foreground">
                {success}
              </div>
            )}

            <Button type="submit" variant="lux" size="lg" className="h-12 w-full text-base" disabled={loading}>
              {loading && <PillSpinner className="size-5" />}
              {loading ? "Un instant…" : submitLabel}
            </Button>
          </form>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-gold" />
          Tes données ne sont visibles que par toi.
        </p>
      </div>
    </main>
  )
}
