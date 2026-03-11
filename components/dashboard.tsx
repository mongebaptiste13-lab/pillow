"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase-client"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import {
  scheduleDailyNotifications,
  getTakenFeedbackMessage,
  getSnoozeFeedbackMessage,
  getFollowUpNotificationMessage,
  requestPermission,
} from "@/lib/notifications"
import { findPill } from "@/lib/pill-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { LogOut, Bell, BellOff, Loader2, Check, Clock, User, Calendar, Settings } from "lucide-react"

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
const TAKEN_KEY = "pillow:taken_date"

export default function Dashboard({
  userId,
  onNeedsOnboarding,
}: {
  userId: string
  onNeedsOnboarding?: () => void
}) {
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

  const supabase = useMemo(() => createClient(), [])
  const { status: pushStatus, subscribe, unsubscribe } = usePushNotifications()

  const today = useMemo(() => new Date().toISOString().split("T")[0], [])

  // Check localStorage immediately so pill stays "taken" after refresh
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TAKEN_KEY)
      if (saved === today) setTakenToday(true)
    }
  }, [today])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [profResult, logsResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase
          .from("pill_logs")
          .select("date, taken")
          .eq("user_id", userId)
          .order("date", { ascending: false })
          .limit(90),
      ])

      const profileData = profResult.data
      const isIncomplete = !profileData?.name || !profileData?.pill_name || !profileData?.pill_time

      if (!profileData || isIncomplete) {
        onNeedsOnboarding?.()
        return
      }

      setProfile(profileData)
      setEditProfile(profileData)

      if (logsResult.data) {
        setPillLogs(logsResult.data)
        // Sync takenToday from DB (source of truth)
        const dbTaken = logsResult.data.some((l: PillLog) => l.date === today && l.taken)
        setTakenToday(dbTaken)
        // Keep localStorage in sync
        if (dbTaken) localStorage.setItem(TAKEN_KEY, today)
        else if (localStorage.getItem(TAKEN_KEY) === today) {
          // localStorage says taken but DB doesn't — keep localStorage as fallback (pill saved locally)
          setTakenToday(true)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [supabase, userId, today, onNeedsOnboarding])

  useEffect(() => { loadData() }, [loadData])

  // Real-time: sync pill_logs and profiles automatically
  useEffect(() => {
    const channel = supabase
      .channel(`pillow-rt-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pill_logs", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const row = payload.new as PillLog
            setPillLogs((prev) => {
              const exists = prev.some((l) => l.date === row.date)
              if (exists) return prev.map((l) => l.date === row.date ? row : l)
              return [row, ...prev].sort((a, b) => b.date.localeCompare(a.date))
            })
            if (row.date === today && row.taken) {
              setTakenToday(true)
              localStorage.setItem(TAKEN_KEY, today)
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Profile
          setProfile(row)
          setEditProfile(row)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, userId, today])

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
      daysRemaining: profile.days_remaining ?? 0,
      stockAlertDays: profile.stock_alert_days ?? 7,
    })
    cleanupRef.current = fn
    return () => fn()
  }, [profile, pillLogs])

  async function handleTaken() {
    // Optimistic UI update immediately
    setTakenToday(true)
    setShowSnooze(false)
    setConfirmMsg(getTakenFeedbackMessage())

    // Persist in localStorage so refresh doesn't reset state
    localStorage.setItem(TAKEN_KEY, today)

    // Update calendar immediately (optimistic)
    setPillLogs((prev) => {
      const exists = prev.some((l) => l.date === today)
      if (exists) return prev.map((l) => l.date === today ? { ...l, taken: true } : l)
      return [{ date: today, taken: true }, ...prev]
    })

    // Save to Supabase directly via client (no API needed, more reliable on mobile)
    const { error } = await supabase
      .from("pill_logs")
      .upsert({ user_id: userId, date: today, taken: true }, { onConflict: "user_id,date" })

    if (!error) {
      // Decrement stock
      if (profile && (profile.days_remaining ?? 0) > 0) {
        const newDays = profile.days_remaining - 1
        await supabase.from("profiles").update({ days_remaining: newDays }).eq("id", userId)
        setProfile((p) => p ? { ...p, days_remaining: newDays } : p)
      }

      // Schedule follow-up notification (background push, non-blocking)
      fetch("/api/push/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "follow_up",
          title: "Pillow 💊",
          body: getFollowUpNotificationMessage(),
          scheduledAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        }),
      }).catch(() => {})
    }
  }

  async function handleSnooze(ms: number) {
    setShowSnooze(false)
    setConfirmMsg(getSnoozeFeedbackMessage())
    const scheduledAt = new Date(Date.now() + ms).toISOString()

    fetch("/api/push/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "snooze", title: "Pillow 💊", body: "C'est l'heure de ta pilule !", scheduledAt }),
    }).catch(() => {
      setTimeout(() => {
        if (Notification.permission === "granted") {
          new Notification("Pillow 💊", { body: "C'est l'heure de ta pilule !", icon: "/pillow-logo.png" })
        }
      }, ms)
    })
  }

  async function saveProfile() {
    setSaving(true)
    const { data } = await supabase.from("profiles").update(editProfile).eq("id", userId).select("*").single()
    if (data) setProfile(data)
    setSaving(false)
  }

  // Calendar
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7

  const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

  function dayStatus(day: number): "taken" | "missed" | "none" {
    const d = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const log = pillLogs.find((l) => l.date === d)
    if (!log) return "none"
    return log.taken ? "taken" : "missed"
  }

  const pillType = findPill(profile?.pill_name)?.pillType ?? "21_7"
  const takeDays = pillLogs.filter((l) => l.taken).length
  const totalTracked = pillLogs.length
  const adherenceRate = totalTracked > 0 ? Math.round((takeDays / totalTracked) * 100) : 0

  const [pillH, pillM] = (profile?.pill_time ?? "08:00").split(":").map(Number)
  const pillAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), pillH ?? 8, pillM ?? 0)
  const canTake = now.getTime() >= pillAt.getTime() - 30 * 60_000

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 flex items-center justify-between border-b bg-background/95 sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl overflow-hidden bg-primary/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pillow-logo.png" alt="Pillow" className="w-full h-full object-cover scale-[1.7]" />
          </div>
          <span className="font-bold text-primary text-lg">Pillow</span>
        </div>
        {profile?.name && <span className="text-sm text-muted-foreground">Bonjour {profile.name} 👋</span>}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 pb-28 pt-4">

        {/* ─── TAB PILL ─── */}
        {tab === "pill" && (
          <div className="space-y-4">
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background shadow-md">
              <CardContent className="pt-8 pb-6 text-center space-y-4">
                <div className="text-6xl">💊</div>
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

                {confirmMsg && (
                  <p className="text-sm bg-primary/10 text-primary rounded-xl px-4 py-3 italic">{confirmMsg}</p>
                )}

                {!takenToday && !canTake && countdown && (
                  <div>
                    <p className="text-xs text-muted-foreground">Prochaine prise dans</p>
                    <p className="text-3xl font-bold text-primary">{countdown}</p>
                  </div>
                )}

                {!takenToday && canTake && !showSnooze && (
                  <div className="flex gap-3 justify-center flex-wrap">
                    <Button onClick={handleTaken} size="lg" className="gap-2 px-6">
                      <Check className="h-5 w-5" /> Oui, prise !
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => setShowSnooze(true)} className="gap-2 px-6">
                      <Clock className="h-5 w-5" /> Plus tard
                    </Button>
                  </div>
                )}

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

            {profile && (
              <Card>
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Stock restant</p>
                    <p className="text-xl font-bold">
                      {profile.days_remaining ?? 0}{" "}
                      <span className="text-sm font-normal text-muted-foreground">jours</span>
                    </p>
                  </div>
                  <Badge variant="secondary">{pillType === "28_continu" ? "Continu" : "21j + 7j"}</Badge>
                </CardContent>
                {(profile.days_remaining ?? 0) <= (profile.stock_alert_days ?? 7) && (
                  <p className="text-xs text-destructive px-4 pb-3 font-medium">⚠️ Pense à racheter ta pilule !</p>
                )}
              </Card>
            )}

            {/* Notifications */}
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {pushStatus === "subscribed"
                    ? <Bell className="h-4 w-4 text-primary shrink-0" />
                    : <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Notifications</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {pushStatus === "subscribed"  ? "✅ Activées (background)" :
                       pushStatus === "loading"     ? "Activation en cours…" :
                       pushStatus === "denied"      ? "🚫 Bloquées — autoriser dans les réglages" :
                       pushStatus === "unsupported" ? "⚠️ Installe l'app sur l'écran d'accueil" :
                       pushStatus === "error"       ? "❌ Erreur — réessaie" :
                       "Désactivées"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={pushStatus === "subscribed"}
                  disabled={pushStatus === "loading" || pushStatus === "denied" || pushStatus === "unsupported"}
                  onCheckedChange={async (checked) => {
                    if (checked) {
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
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Suivi du cycle</h2>

            <Card>
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Observance (90 derniers jours)</p>
                  <p className="text-3xl font-bold text-primary">
                    {adherenceRate}<span className="text-lg">%</span>
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground space-y-0.5">
                  <p>✅ {takeDays} prise{takeDays > 1 ? "s" : ""}</p>
                  <p>❌ {totalTracked - takeDays} manquée{(totalTracked - takeDays) > 1 ? "s" : ""}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm font-semibold mb-3 text-center">{MONTHS[month]} {year}</p>
                <div className="grid grid-cols-7 gap-1">
                  {["L","M","M","J","V","S","D"].map((d, i) => (
                    <div key={i} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
                  ))}
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const status = dayStatus(day)
                    const isToday = day === now.getDate()
                    return (
                      <div
                        key={day}
                        className={[
                          "aspect-square rounded-full flex items-center justify-center text-xs font-medium",
                          status === "taken"  ? "bg-primary text-white" : "",
                          status === "missed" ? "bg-destructive/20 text-destructive" : "",
                          status === "none"   ? "text-foreground/50" : "",
                          isToday ? "ring-2 ring-primary ring-offset-1" : "",
                        ].join(" ")}
                      >
                        {day}
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-4 justify-center mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-primary inline-block" /> Prise
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-destructive/40 inline-block" /> Manquée
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── TAB ACCOUNT ─── */}
        {tab === "account" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Settings className="h-5 w-5" /> Mon compte
            </h2>
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
                  <Label>Pilule</Label>
                  <Input
                    value={editProfile.pill_name ?? ""}
                    onChange={(e) => setEditProfile((p) => ({ ...p, pill_name: e.target.value }))}
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
                  className="w-full text-destructive border-destructive/30 hover:text-destructive"
                  onClick={async () => {
                    localStorage.removeItem(TAKEN_KEY)
                    await supabase.auth.signOut()
                    window.location.reload()
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* ─── Bottom nav — aligné ─── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t z-20">
        <div className="max-w-md mx-auto relative flex items-end h-16">

          {/* Cycle */}
          <button
            onClick={() => setTab("cycle")}
            className={`flex-1 flex flex-col items-center justify-end pb-2 gap-0.5 text-xs transition-colors ${
              tab === "cycle" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Calendar className="h-5 w-5" />
            <span>Cycle</span>
          </button>

          {/* Pilule — bouton central flottant */}
          <div className="flex-1 flex flex-col items-center justify-end pb-1 relative">
            <button
              onClick={() => setTab("pill")}
              className="flex flex-col items-center gap-0"
              style={{ marginBottom: "-4px" }}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all -translate-y-4 ${
                  tab === "pill"
                    ? "bg-primary scale-110 shadow-primary/40"
                    : "bg-primary/80"
                }`}
              >
                <span className="text-2xl leading-none">💊</span>
              </div>
              <span
                className={`text-xs font-semibold -mt-1 ${
                  tab === "pill" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Pilule
              </span>
            </button>
          </div>

          {/* Compte */}
          <button
            onClick={() => setTab("account")}
            className={`flex-1 flex flex-col items-center justify-end pb-2 gap-0.5 text-xs transition-colors ${
              tab === "account" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <User className="h-5 w-5" />
            <span>Compte</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
