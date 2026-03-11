"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase-client"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { scheduleDailyNotifications, getTakenFeedbackMessage, getSnoozeFeedbackMessage, requestPermission } from "@/lib/notifications"
import { findPill } from "@/lib/pill-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { LogOut, Bell, BellOff, Loader2, Check, Clock, User, Calendar } from "lucide-react"

interface Profile {
  id: string
  name: string
  pill_name: string
  pill_time: string
  days_remaining: number
  boxes_remaining: number
  stock_alert_days: number
}

interface PillLog { date: string; taken: boolean }

const SNOOZE_OPTIONS = [
  { label: "15 min", ms: 15 * 60_000 },
  { label: "30 min", ms: 30 * 60_000 },
  { label: "1h",     ms: 60 * 60_000 },
  { label: "2h",     ms: 2 * 60 * 60_000 },
]

type Tab = "pill" | "cycle" | "account"

export default function Dashboard({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("pill")
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pillLogs, setPillLogs] = useState<PillLog[]>([])
  const [loading, setLoading] = useState(true)
  const [takenToday, setTakenToday] = useState(false)
  const [showSnooze, setShowSnooze] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState("")
  const [countdown, setCountdown] = useState<string | null>(null)
  const [editProfile, setEditProfile] = useState<Partial<Profile>>({})
  const [saving, setSaving] = useState(false)
  const cleanupRef = useRef<() => void>(() => {})

  const supabase = createClient()
  const { status: pushStatus, subscribe, unsubscribe } = usePushNotifications()

  const today = new Date().toISOString().split("T")[0]

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: prof }, { data: logs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("pill_logs").select("date, taken").eq("user_id", userId).order("date", { ascending: false }).limit(90),
    ])
    if (prof) { setProfile(prof); setEditProfile(prof) }
    if (logs) {
      setPillLogs(logs)
      setTakenToday(logs.some((l: PillLog) => l.date === today && l.taken))
    }
    setLoading(false)
  }, [userId, today, supabase])

  useEffect(() => { loadData() }, [loadData])

  // Countdown to pill time
  useEffect(() => {
    if (!profile?.pill_time) return
    const tick = () => {
      const now = new Date()
      const [h, m] = profile.pill_time.split(":").map(Number)
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
      let diff = target.getTime() - now.getTime()
      if (diff < 0) diff += 86_400_000
      const totalMin = Math.floor(diff / 60_000)
      const hrs = Math.floor(totalMin / 60)
      const mins = totalMin % 60
      setCountdown(hrs > 0 ? `${hrs}h${mins.toString().padStart(2, "0")}` : `${mins} min`)
    }
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [profile?.pill_time])

  // Schedule local notifications
  useEffect(() => {
    if (!profile) return
    cleanupRef.current()
    const fn = scheduleDailyNotifications({
      pillTime: profile.pill_time,
      pillType: findPill(profile.pill_name)?.pillType ?? "21_7",
      pillLogs: pillLogs.filter((l) => l.taken).map((l) => l.date),
      daysRemaining: profile.days_remaining,
      stockAlertDays: profile.stock_alert_days,
    })
    cleanupRef.current = fn
    return () => fn()
  }, [profile, pillLogs])

  async function handleTaken() {
    setTakenToday(true)
    setShowSnooze(false)
    setConfirmMsg(getTakenFeedbackMessage())
    await fetch("/api/pill-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, taken: true }),
    })
    if (profile) {
      await supabase.from("profiles").update({ days_remaining: Math.max(0, profile.days_remaining - 1) }).eq("id", userId)
    }
    loadData()
  }

  async function handleSnooze(ms: number) {
    setShowSnooze(false)
    setConfirmMsg(getSnoozeFeedbackMessage())
    const scheduledAt = new Date(Date.now() + ms).toISOString()
    await fetch("/api/push/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "snooze", title: "Pillow 💊", body: "C'est l'heure de ta pilule !", scheduledAt }),
    }).catch(() => {
      // Local fallback
      setTimeout(() => {
        if (Notification.permission === "granted") new Notification("Pillow 💊", { body: "C'est l'heure de ta pilule !", icon: "/pillow-logo.png" })
      }, ms)
    })
  }

  async function saveProfile() {
    setSaving(true)
    await supabase.from("profiles").update(editProfile).eq("id", userId)
    setSaving(false)
    loadData()
  }

  // Calendar helpers
  function getCalendarDays() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    return { year, month, daysInMonth, firstDay: (firstDay + 6) % 7 }
  }

  const { year, month, daysInMonth, firstDay } = getCalendarDays()
  const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

  function dayStatus(day: number) {
    const d = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const log = pillLogs.find((l) => l.date === d)
    if (!log) return "none"
    return log.taken ? "taken" : "missed"
  }

  const pillType = profile ? findPill(profile.pill_name)?.pillType ?? "21_7" : "21_7"
  const takeDays = pillLogs.filter((l) => l.taken).length
  const totalTracked = pillLogs.length
  const adherenceRate = totalTracked > 0 ? Math.round((takeDays / totalTracked) * 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const [pillH, pillM] = (profile?.pill_time ?? "08:00").split(":").map(Number)
  const now = new Date()
  const pillAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), pillH, pillM)
  const canTake = (now.getTime() >= pillAt.getTime() - 30 * 60_000)

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="px-4 pt-safe pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl overflow-hidden bg-primary/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pillow-logo.png" alt="Pillow" className="w-full h-full object-cover scale-[1.7]" />
          </div>
          <span className="font-bold text-primary text-lg">Pillow</span>
        </div>
        {profile && <span className="text-sm text-muted-foreground">Bonjour {profile.name} 👋</span>}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 pb-28">

        {/* ─── TAB PILL ─── */}
        {tab === "pill" && (
          <div className="space-y-4 py-4">
            {/* Big pill card */}
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background shadow-md">
              <CardContent className="pt-8 pb-6 text-center space-y-4">
                <div className="text-6xl mb-2">💊</div>
                <div>
                  <h2 className="text-2xl font-bold">
                    {takenToday ? "Pilule prise ✅" : "As-tu pris ta pilule ?"}
                  </h2>
                  {profile && (
                    <p className="text-muted-foreground text-sm mt-1">
                      {profile.pill_name} · {profile.pill_time}
                    </p>
                  )}
                </div>

                {/* Confirmation message */}
                {confirmMsg && (
                  <p className="text-sm bg-primary/10 text-primary rounded-xl px-4 py-3 italic">{confirmMsg}</p>
                )}

                {/* Countdown before pill time */}
                {!takenToday && !canTake && countdown && (
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground">Prochaine prise dans</span>
                    <p className="text-3xl font-bold text-primary">{countdown}</p>
                  </div>
                )}

                {/* Action buttons */}
                {!takenToday && canTake && !showSnooze && (
                  <div className="flex gap-3 justify-center">
                    <Button onClick={handleTaken} size="lg" className="gap-2 px-6">
                      <Check className="h-5 w-5" /> Oui, prise !
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => setShowSnooze(true)} className="gap-2 px-6">
                      <Clock className="h-5 w-5" /> Plus tard
                    </Button>
                  </div>
                )}

                {/* Snooze options */}
                {showSnooze && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Me rappeler dans…</p>
                    <div className="grid grid-cols-2 gap-2">
                      {SNOOZE_OPTIONS.map((opt) => (
                        <Button key={opt.label} variant="outline" onClick={() => handleSnooze(opt.ms)}>
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowSnooze(false)}>
                      Annuler
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stock card */}
            {profile && (
              <Card>
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Stock restant</p>
                    <p className="text-xl font-bold">
                      {profile.days_remaining} <span className="text-sm font-normal text-muted-foreground">jours</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <Badge variant="secondary" className="text-xs">
                      {pillType === "28_continu" ? "Continu" : "21j + 7j"}
                    </Badge>
                  </div>
                  {profile.days_remaining <= profile.stock_alert_days && (
                    <Badge variant="destructive" className="absolute top-2 right-2 text-xs">
                      Penser à racheter !
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Push notifications toggle */}
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {pushStatus === "subscribed" ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium">Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      {pushStatus === "subscribed"
                        ? "Activées (même quand l'app est fermée)"
                        : pushStatus === "denied"
                        ? "Bloquées par le navigateur"
                        : pushStatus === "unsupported"
                        ? "Non supportées sur cet appareil"
                        : "Désactivées"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={pushStatus === "subscribed"}
                  disabled={pushStatus === "loading" || pushStatus === "denied" || pushStatus === "unsupported"}
                  onCheckedChange={async (checked) => {
                    if (checked) {
                      await requestPermission()
                      await subscribe()
                    } else {
                      await unsubscribe()
                    }
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── TAB CYCLE ─── */}
        {tab === "cycle" && (
          <div className="space-y-4 py-4">
            <h2 className="text-lg font-bold">Suivi du cycle</h2>

            {/* Adherence ratio */}
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Observance (90 derniers jours)</p>
                  <p className="text-3xl font-bold text-primary">{adherenceRate}%</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{takeDays} prise{takeDays > 1 ? "s" : ""}</p>
                  <p>{totalTracked - takeDays} manquée{(totalTracked - takeDays) > 1 ? "s" : ""}</p>
                </div>
              </CardContent>
            </Card>

            {/* Calendar */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm font-semibold mb-3 text-center capitalize">
                  {MONTHS[month]} {year}
                </p>
                <div className="grid grid-cols-7 gap-1 text-xs">
                  {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                    <div key={i} className="text-center font-semibold text-muted-foreground py-1">{d}</div>
                  ))}
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const status = dayStatus(day)
                    const isToday = day === now.getDate()
                    return (
                      <div
                        key={day}
                        className={`aspect-square rounded-full flex items-center justify-center text-xs font-medium transition-colors
                          ${status === "taken" ? "bg-primary text-white" : ""}
                          ${status === "missed" ? "bg-destructive/20 text-destructive" : ""}
                          ${status === "none" ? "text-foreground/60" : ""}
                          ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}
                        `}
                      >
                        {day}
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-4 justify-center mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary inline-block" /> Prise</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-destructive/30 inline-block" /> Manquée</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── TAB ACCOUNT ─── */}
        {tab === "account" && (
          <div className="space-y-4 py-4">
            <h2 className="text-lg font-bold">Mon compte</h2>
            <Card>
              <CardContent className="pt-4 pb-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Prénom</Label>
                  <Input
                    value={editProfile.name ?? ""}
                    onChange={(e) => setEditProfile((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Heure de prise</Label>
                  <Input
                    type="time"
                    value={editProfile.pill_time ?? "08:00"}
                    onChange={(e) => setEditProfile((p) => ({ ...p, pill_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Jours restants</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editProfile.days_remaining ?? 0}
                    onChange={(e) => setEditProfile((p) => ({ ...p, days_remaining: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Alerte stock (jours avant rupture)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={editProfile.stock_alert_days ?? 7}
                    onChange={(e) => setEditProfile((p) => ({ ...p, stock_alert_days: parseInt(e.target.value) || 7 }))}
                  />
                </div>
                <Button onClick={saveProfile} disabled={saving} className="w-full">
                  {saving ? "Sauvegarde…" : "Enregistrer"}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={async () => { await createClient().auth.signOut(); window.location.reload() }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t pb-safe">
        <div className="max-w-md mx-auto flex">
          <button
            onClick={() => setTab("cycle")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${tab === "cycle" ? "text-primary" : "text-muted-foreground"}`}
          >
            <Calendar className="h-5 w-5" />
            Cycle
          </button>
          <button
            onClick={() => setTab("pill")}
            className={`flex-[2] flex flex-col items-center gap-0.5 py-3 text-sm font-semibold transition-colors relative ${tab === "pill" ? "text-primary" : "text-muted-foreground"}`}
          >
            <div className={`absolute -top-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${tab === "pill" ? "bg-primary scale-110" : "bg-primary/70"}`}>
              <span className="text-2xl">💊</span>
            </div>
            <span className="mt-7">Pilule</span>
          </button>
          <button
            onClick={() => setTab("account")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${tab === "account" ? "text-primary" : "text-muted-foreground"}`}
          >
            <User className="h-5 w-5" />
            Compte
          </button>
        </div>
      </nav>
    </div>
  )
}
