"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { CalendarDays, CloudOff, Package, Pill, RefreshCw, Settings2, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { PillLoader } from "@/components/pill-loader"
import TodayTab from "@/components/dashboard/today-tab"
import HistoryTab from "@/components/dashboard/history-tab"
import PackTab from "@/components/dashboard/pack-tab"
import SettingsTab from "@/components/dashboard/settings-tab"
import { usePillowData } from "@/hooks/use-pillow-data"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { useNow } from "@/hooks/use-today"
import { authFetch } from "@/lib/supabase-client"
import { findPill } from "@/lib/pill-data"
import { getPackStatus } from "@/lib/pack"
import { computeStats } from "@/lib/stats"
import { localDateKey } from "@/lib/date"
import { getSnoozeFeedbackMessage, getSnoozeReminderMessage, getTakenFeedbackMessage, showLocalNotification } from "@/lib/notifications"
import { cn } from "@/lib/utils"

type Tab = "today" | "history" | "pack" | "settings"

const TABS: Array<{ id: Tab; label: string; icon: typeof Pill }> = [
  { id: "today", label: "Aujourd'hui", icon: Pill },
  { id: "history", label: "Historique", icon: CalendarDays },
  { id: "pack", label: "Plaquette", icon: Package },
  { id: "settings", label: "Réglages", icon: Settings2 },
]

export default function Dashboard({ userId, onNeedsOnboarding }: { userId: string; onNeedsOnboarding?: () => void }) {
  const [tab, setTab] = useState<Tab>("today")
  const [online, setOnline] = useState(true)
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null)
  const snoozeTimer = useRef<number | null>(null)

  const { now, todayKey } = useNow()
  const data = usePillowData(userId, todayKey, onNeedsOnboarding)
  const push = usePushNotifications(Boolean(data.profile))
  const { profile, logs } = data

  const pillInfo = findPill(profile?.pill_name)
  const pillType = pillInfo?.pillType ?? "21_7"
  const pack = useMemo(() => getPackStatus(pillType, profile?.pack_start_date, todayKey), [pillType, profile?.pack_start_date, todayKey])

  const trackingSince = useMemo(() => {
    const created = profile?.created_at ? localDateKey(new Date(profile.created_at)) : todayKey
    const earliestLog = Object.keys(logs).sort()[0]
    return earliestLog && earliestLog < created ? earliestLog : created
  }, [profile?.created_at, logs, todayKey])

  const stats = useMemo(
    () =>
      computeStats({
        logs,
        todayKey,
        pillType,
        packStartDate: profile?.pack_start_date ?? null,
        trackingSince,
        pillTime: profile?.pill_time ?? null,
      }),
    [logs, todayKey, pillType, profile?.pack_start_date, profile?.pill_time, trackingSince],
  )

  const takenToday = logs[todayKey]?.taken === true

  /* ------------------------------ réseau ------------------------------ */
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])

  /* ------------------------------ « plus tard » ------------------------------ */
  // Ref lue par le minuteur local sans le recréer
  const logsRefTaken = useRef(false)
  logsRefTaken.current = takenToday

  const snoozeKey = `pillow:snooze:${userId}`

  const clearSnoozeLocal = useCallback(() => {
    if (snoozeTimer.current) window.clearTimeout(snoozeTimer.current)
    snoozeTimer.current = null
    setSnoozeUntil(null)
    try {
      localStorage.removeItem(snoozeKey)
    } catch {}
  }, [snoozeKey])

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(snoozeKey))
      if (saved > Date.now()) setSnoozeUntil(saved)
    } catch {}
    return () => {
      if (snoozeTimer.current) window.clearTimeout(snoozeTimer.current)
    }
  }, [snoozeKey])

  // Rappel écoulé ou pilule prise → on efface l'état « plus tard »
  useEffect(() => {
    if (!snoozeUntil) return
    if (takenToday) {
      clearSnoozeLocal()
      return
    }
    const left = snoozeUntil - Date.now()
    if (left <= 0) {
      clearSnoozeLocal()
      return
    }
    const id = window.setTimeout(clearSnoozeLocal, left + 500)
    return () => window.clearTimeout(id)
  }, [snoozeUntil, takenToday, clearSnoozeLocal])

  const snooze = useCallback(
    async (minutes: number) => {
      const at = new Date(Date.now() + minutes * 60_000)
      let onServer = false
      if (push.status === "subscribed") {
        try {
          const res = await authFetch("/api/push/schedule", {
            method: "POST",
            body: JSON.stringify({ title: "Pillow 💊", body: getSnoozeReminderMessage(), scheduledAt: at.toISOString() }),
          })
          onServer = res.ok
        } catch {}
      }

      if (snoozeTimer.current) window.clearTimeout(snoozeTimer.current)
      if (!onServer) {
        // Repli : notification locale, valable tant que l'app reste ouverte
        snoozeTimer.current = window.setTimeout(() => {
          if (!logsRefTaken.current) void showLocalNotification("Pillow 💊", getSnoozeReminderMessage(), "pillow-snooze")
        }, minutes * 60_000)
      }

      setSnoozeUntil(at.getTime())
      try {
        localStorage.setItem(snoozeKey, String(at.getTime()))
      } catch {}

      const hhmm = at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      if (onServer) toast.success(`${getSnoozeFeedbackMessage()} Rappel à ${hhmm}.`)
      else toast.message(`Rappel à ${hhmm}`, { description: "Garde Pillow ouverte, ou active les notifications pour être relancée même app fermée." })
    },
    [push.status, snoozeKey],
  )

  const cancelSnooze = useCallback(async () => {
    clearSnoozeLocal()
    try {
      await authFetch("/api/push/schedule", { method: "DELETE" })
    } catch {}
    toast.message("Rappel annulé.")
  }, [clearSnoozeLocal])

  /* ------------------------------ prise du jour ------------------------------ */
  const takeToday = useCallback(async () => {
    if (logs[todayKey]?.taken) return
    const ok = await data.setDayStatus(todayKey, "taken")
    if (ok) {
      toast.success(getTakenFeedbackMessage())
      if ("vibrate" in navigator) navigator.vibrate?.(30)
    }
  }, [data, logs, todayKey])

  const undoToday = useCallback(async () => {
    const ok = await data.setDayStatus(todayKey, "none")
    if (ok) toast.message("Prise annulée.")
  }, [data, todayKey])

  /* ---------- Actions venant d'une notification (bouton « Je l'ai prise ») ---------- */
  const handleAction = useCallback(
    (action: string) => {
      if (action === "taken") {
        if (logs[todayKey]?.taken) toast.message("C'est déjà noté pour aujourd'hui ✅")
        else if (pack.phase === "pause") toast.message("Aujourd'hui, c'est un jour de pause.")
        else void takeToday()
      } else if (action === "snooze") {
        void snooze(15)
      }
    },
    [logs, todayKey, pack.phase, takeToday, snooze],
  )

  const handledUrlAction = useRef(false)
  useEffect(() => {
    if (!profile || handledUrlAction.current) return
    const params = new URLSearchParams(window.location.search)
    const action = params.get("pillow_action")
    if (!action) return
    handledUrlAction.current = true
    params.delete("pillow_action")
    params.delete("source")
    const qs = params.toString()
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""))
    handleAction(action)
  }, [profile, handleAction])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PILLOW_ACTION" && typeof event.data.action === "string") handleAction(event.data.action)
    }
    navigator.serviceWorker?.addEventListener("message", onMessage)
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage)
  }, [handleAction])

  /* ------------------------------ rendu ------------------------------ */
  if (data.loading && !profile) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <PillLoader label="Chargement de ton espace…" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-dvh grid place-items-center px-6 text-center">
        <div className="max-w-xs space-y-4">
          <CloudOff className="mx-auto size-10 text-muted-foreground" />
          <h1 className="font-display text-3xl font-semibold">
            {data.loadError === "offline" ? "Pas de connexion" : "Chargement impossible"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.loadError === "offline"
              ? "Vérifie ta connexion internet : tes données seront là dès que le réseau revient."
              : "Un souci est survenu en récupérant ton profil. Réessaie dans un instant."}
          </p>
          <Button variant="lux" size="lg" onClick={() => void data.reload()}>
            <RefreshCw /> Réessayer
          </Button>
        </div>
      </div>
    )
  }

  const common = { data, profile, now, todayKey, pillType, pack, stats, pillInfo, trackingSince }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background px-5 pb-3 pt-safe ">
        <div className="flex items-center justify-between pt-3">
          <Logo size={34} />
          <div className="flex items-center gap-2">
            {!online && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2.5 py-1 text-xs font-medium">
                <WifiOff className="size-3.5" /> Hors ligne
              </span>
            )}
            {data.pending > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground" title="Modifications en attente de synchronisation">
                <RefreshCw className="size-3.5" /> {data.pending}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-5 pb-32 pt-5" id="main">
        <div key={tab} className="animate-fade-up">
          {tab === "today" && (
            <TodayTab
              {...common}
              push={push}
              snoozeUntil={snoozeUntil}
              onTake={takeToday}
              onUndo={undoToday}
              onSnooze={snooze}
              onCancelSnooze={cancelSnooze}
              onGoTo={setTab}
            />
          )}
          {tab === "history" && <HistoryTab {...common} />}
          {tab === "pack" && <PackTab {...common} />}
          {tab === "settings" && <SettingsTab {...common} push={push} userId={userId} />}
        </div>
      </main>

      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto max-w-md px-4 pb-safe">
          <div className="surface-lux mb-3 grid grid-cols-4 rounded-2xl p-1.5 ">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTab(id)
                    window.scrollTo({ top: 0 })
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-medium transition-all",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-5 transition-transform", active && "scale-110")} strokeWidth={active ? 2.3 : 1.9} />
                  {label}
                  {active && <span className="absolute -bottom-0.5 h-0.5 w-5 rounded-full bg-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
