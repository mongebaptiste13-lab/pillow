"use client"

import { useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import {
  Bell, BellRing, Check, Download, LogOut, Monitor, Moon, Pill, Search, Send, Smartphone, Sun, Trash2, TriangleAlert, User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PillSpinner } from "@/components/pill-loader"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useInstallPrompt } from "@/hooks/use-install-prompt"
import { authFetch } from "@/lib/supabase-client"
import { FRENCH_PILLS } from "@/lib/pill-data"
import { formatTime } from "@/lib/date"
import { cn } from "@/lib/utils"
import type { PushState, TabCommon } from "@/components/dashboard/types"

interface ServerStatus {
  supabase: boolean
  push: boolean
  serviceRole: boolean
  cron: boolean
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <section className="surface-lux rounded-3xl p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold">
        <Icon className="size-5 text-primary" /> {title}
      </h2>
      {children}
    </section>
  )
}

function ToggleRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-4 py-2.5", disabled && "cursor-not-allowed opacity-60")}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  )
}

export default function SettingsTab({ data, profile, pillInfo, push, userId }: TabCommon & { push: PushState; userId: string }) {
  const { theme, setTheme } = useTheme()
  const install = useInstallPrompt()

  const [mounted, setMounted] = useState(false)
  const [name, setName] = useState(profile.name ?? "")
  const [pillName, setPillName] = useState(profile.pill_name ?? "")
  const [pillTime, setPillTime] = useState(profile.pill_time ?? "08:00")
  const [daysLeft, setDaysLeft] = useState(String(profile.days_remaining ?? 0))
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pillSearch, setPillSearch] = useState("")
  const [confirmText, setConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState<ServerStatus | null>(null)

  useEffect(() => setMounted(true), [])

  // Quand le profil change ailleurs (autre appareil), on resynchronise les champs
  useEffect(() => {
    setName(profile.name ?? "")
    setPillName(profile.pill_name ?? "")
    setPillTime(profile.pill_time ?? "08:00")
    setDaysLeft(String(profile.days_remaining ?? 0))
  }, [profile.name, profile.pill_name, profile.pill_time, profile.days_remaining])

  useEffect(() => {
    let cancelled = false
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => !cancelled && s && setStatus(s))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const dirty =
    name.trim() !== (profile.name ?? "") ||
    pillName !== (profile.pill_name ?? "") ||
    pillTime !== (profile.pill_time ?? "") ||
    Number(daysLeft) !== (profile.days_remaining ?? 0)

  const filteredPills = useMemo(() => {
    const q = pillSearch.trim().toLowerCase()
    return q ? FRENCH_PILLS.filter((p) => p.name.toLowerCase().includes(q) || p.substance.toLowerCase().includes(q)) : FRENCH_PILLS
  }, [pillSearch])

  async function save() {
    const days = Math.max(0, Math.floor(Number(daysLeft)) || 0)
    if (!name.trim() || !/^\d{2}:\d{2}$/.test(pillTime)) {
      toast.error("Renseigne ton prénom et une heure valide.")
      return
    }
    setSaving(true)
    const ok = await data.updateProfile({ name: name.trim(), pill_name: pillName, pill_time: pillTime, days_remaining: days })
    setSaving(false)
    if (ok) toast.success("Modifications enregistrées ✨")
  }

  async function togglePush(on: boolean) {
    if (on) {
      const ok = await push.subscribe()
      if (ok) toast.success("Rappels activés sur cet appareil 🔔")
    } else {
      await push.unsubscribe()
      toast.message("Rappels désactivés sur cet appareil.")
    }
  }

  async function sendTest() {
    setTesting(true)
    const result = await push.sendTest()
    setTesting(false)
    if (result.ok) toast.success(result.message)
    else toast.error(result.message)
  }

  function exportCsv() {
    const rows = Object.values(data.logs).sort((a, b) => a.date.localeCompare(b.date))
    const lines = ["date;statut;heure_de_prise"]
    for (const r of rows) {
      const time = r.taken_at ? new Date(r.taken_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""
      lines.push(`${r.date};${r.taken ? "prise" : "oubliée"};${time}`)
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pillow-historique-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success(`${rows.length} jour${rows.length > 1 ? "s" : ""} exporté${rows.length > 1 ? "s" : ""}.`)
  }

  async function signOut() {
    await push.unsubscribe().catch(() => undefined) // plus de notifications d'un compte déconnecté sur cet appareil
    await data.supabase.auth.signOut()
  }

  async function deleteAccount() {
    setDeleting(true)
    try {
      await push.unsubscribe().catch(() => undefined)
      const res = await authFetch("/api/account", { method: "DELETE" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || "La suppression a échoué.")
        setDeleting(false)
        return
      }
      Object.keys(localStorage)
        .filter((k) => k.startsWith("pillow"))
        .forEach((k) => localStorage.removeItem(k))
      await data.supabase.auth.signOut()
    } catch {
      toast.error("Impossible de joindre le serveur.")
      setDeleting(false)
    }
  }

  const pushSubscribed = push.status === "subscribed"
  const pushHint: Record<string, string> = {
    subscribed: "Actives sur cet appareil, même application fermée.",
    idle: "Désactivées sur cet appareil.",
    loading: "Activation en cours…",
    denied: "Bloquées : autorise les notifications pour ce site dans les réglages du navigateur.",
    unsupported: "Ce navigateur ne gère pas les notifications push.",
    needs_install: "Sur iPhone, ajoute d'abord Pillow à l'écran d'accueil (Partager → Sur l'écran d'accueil).",
    error: push.lastError ?? "Une erreur est survenue. Réessaie.",
  }

  const serverIssues: string[] = []
  if (status) {
    if (!status.push) serverIssues.push("clés VAPID absentes (lance « pnpm vapid » et ajoute-les aux variables d'environnement)")
    if (!status.serviceRole) serverIssues.push("SUPABASE_SERVICE_ROLE_KEY absente")
    if (!status.cron) serverIssues.push("CRON_SECRET absent")
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-semibold">Réglages</h1>

      {serverIssues.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/12 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">Rappels en arrière-plan : configuration serveur incomplète</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Manque : {serverIssues.join(" · ")}. Voir le README.</p>
          </div>
        </div>
      )}

      {/* ───────── Profil ───────── */}
      <Section title="Mon profil" icon={User}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Prénom</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-11 rounded-xl" autoComplete="given-name" />
          </div>

          <div className="space-y-1.5">
            <Label>Pilule</Label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex h-11 w-full items-center justify-between rounded-xl border bg-background px-3 text-left text-sm transition-colors hover:bg-muted"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Pill className="size-4 shrink-0 text-primary" />
                <span className="truncate">{pillName || "Choisir…"}</span>
              </span>
              <span className="text-xs text-primary">Changer</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-time">Heure de prise</Label>
            <Input id="s-time" type="time" value={pillTime} onChange={(e) => setPillTime(e.target.value)} className="h-11 rounded-xl" />
            <p className="text-xs text-muted-foreground">Rappel envoyé à {formatTime(pillTime)} (fuseau : {profile.timezone}).</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-days">Jours de pilule restants</Label>
            <Input id="s-days" type="number" inputMode="numeric" min={0} value={daysLeft} onChange={(e) => setDaysLeft(e.target.value)} className="h-11 rounded-xl" />
          </div>

          <Button variant="lux" size="lg" className="w-full" onClick={save} disabled={!dirty || saving}>
            {saving && <PillSpinner className="size-5" />}
            {saving ? "Enregistrement…" : dirty ? "Enregistrer" : "À jour"}
          </Button>
        </div>
      </Section>

      {/* ───────── Notifications ───────── */}
      <Section title="Notifications" icon={Bell}>
        <ToggleRow
          label="Rappels sur cet appareil"
          hint={pushHint[push.status]}
          checked={pushSubscribed}
          onChange={(v) => void togglePush(v)}
          disabled={push.status === "loading" || push.status === "unsupported" || push.status === "needs_install" || push.status === "denied"}
        />

        <div className="hairline my-2" />

        <ToggleRow label="Rappel à l'heure de prise" hint="Une notification chaque jour de prise" checked={profile.notif_reminder} onChange={(v) => void data.updateProfile({ notif_reminder: v })} />
        <ToggleRow label="Relances si oubli" hint="Jusqu'à 3 relances, toutes les 30 min" checked={profile.notif_nag} onChange={(v) => void data.updateProfile({ notif_nag: v })} disabled={!profile.notif_reminder} />
        <ToggleRow label="Alerte de stock" hint={`Chaque matin à 9 h sous ${profile.stock_alert_days ?? 7} jours restants`} checked={profile.notif_stock} onChange={(v) => void data.updateProfile({ notif_stock: v })} />
        {pillInfo?.pillType !== "28_continu" && (
          <ToggleRow label="Reprise de plaquette" hint="La veille à 18 h, à la fin de la pause" checked={profile.notif_restart} onChange={(v) => void data.updateProfile({ notif_restart: v })} />
        )}

        <Button variant="outline" className="mt-3 w-full" onClick={sendTest} disabled={!pushSubscribed || testing}>
          {testing ? <PillSpinner /> : <Send />}
          {testing ? "Envoi…" : "Envoyer une notification de test"}
        </Button>
        {!pushSubscribed && push.status !== "needs_install" && push.status !== "unsupported" && (
          <Button variant="lux" className="mt-2 w-full" onClick={() => void togglePush(true)} disabled={push.status === "loading" || push.status === "denied"}>
            <BellRing /> Activer les rappels
          </Button>
        )}
      </Section>

      {/* ───────── Apparence ───────── */}
      <Section title="Apparence" icon={Sun}>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thème">
          {([
            { id: "light", label: "Clair", icon: Sun },
            { id: "dark", label: "Sombre", icon: Moon },
            { id: "system", label: "Auto", icon: Monitor },
          ] as const).map(({ id, label, icon: Icon }) => {
            const active = mounted && theme === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-sm transition-all",
                  active ? "border-primary bg-primary/8 text-primary ring-1 ring-primary/40" : "hover:bg-muted",
                )}
              >
                <Icon className="size-5" />
                {label}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ───────── Installation ───────── */}
      {!install.installed && (
        <Section title="Application" icon={Smartphone}>
          {install.canInstall ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">Installe Pillow sur ton écran d'accueil pour y accéder en un geste et recevoir tes rappels.</p>
              <Button variant="lux" className="w-full" onClick={() => void install.install()}>
                <Download /> Installer Pillow
              </Button>
            </>
          ) : install.isIos ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Touche <strong className="text-foreground">Partager</strong> dans Safari</li>
              <li>Choisis <strong className="text-foreground">Sur l'écran d'accueil</strong></li>
              <li>Ouvre Pillow depuis son icône (indispensable pour les notifications)</li>
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Utilise le menu de ton navigateur → « Installer l'application » ou « Ajouter à l'écran d'accueil ».</p>
          )}
        </Section>
      )}

      {/* ───────── Données ───────── */}
      <Section title="Mes données" icon={Download}>
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={exportCsv}>
            <Download /> Exporter mon historique (CSV)
          </Button>

          <AlertDialog onOpenChange={(open) => !open && setConfirmText("")}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 /> Supprimer mon compte
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display text-2xl">Supprimer définitivement ton compte ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ton profil, ton historique de prises et tes rappels seront effacés pour toujours. Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-delete" className="text-xs">Écris <strong>SUPPRIMER</strong> pour confirmer</Label>
                <Input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className="h-11 rounded-xl" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={confirmText.trim().toUpperCase() !== "SUPPRIMER" || deleting}
                  onClick={(e) => {
                    e.preventDefault()
                    void deleteAccount()
                  }}
                >
                  {deleting ? "Suppression…" : "Supprimer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>

      <Button variant="outline" size="lg" className="w-full" onClick={() => void signOut()}>
        <LogOut /> Se déconnecter
      </Button>

      <p className="px-4 pb-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        Pillow t'aide à ne pas oublier ta pilule mais ne remplace pas l'avis d'un professionnel de santé.
        En cas d'oubli, de doute ou d'effets indésirables, parles-en à ton médecin, ta sage-femme ou ton pharmacien.
        <span className="mt-1 block opacity-60">Compte : {userId.slice(0, 8)}…</span>
      </p>

      {/* ───────── Sélecteur de pilule ───────── */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Changer de pilule</DialogTitle>
            <DialogDescription>Le suivi de plaquette s'adapte au type de pilule choisi.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher…" value={pillSearch} onChange={(e) => setPillSearch(e.target.value)} className="h-11 rounded-xl pl-10" autoFocus />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border bg-muted/40 p-1.5">
            {filteredPills.slice(0, 60).map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setPillName(p.name)
                  setPickerOpen(false)
                  setPillSearch("")
                }}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-card", pillName === p.name && "bg-primary/12 ring-1 ring-primary/40")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  {p.substance && <span className="block truncate text-xs text-muted-foreground">{p.substance}</span>}
                </span>
                {pillName === p.name && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            ))}
            {filteredPills.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucun résultat</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
