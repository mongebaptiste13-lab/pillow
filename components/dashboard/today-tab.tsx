"use client"

import { useState } from "react"
import { AlertTriangle, Bell, BellRing, Check, Clock, Flame, Moon, PackageOpen, Percent, RotateCcw, Smartphone, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PillSpinner } from "@/components/pill-loader"
import { addDaysToKey, formatLongDate, formatShortDate, formatTime, timeToMinutes } from "@/lib/date"
import { phaseOfDay } from "@/lib/pack"
import { cn } from "@/lib/utils"
import type { PushState, TabCommon, TabId } from "@/components/dashboard/types"

const SNOOZE_OPTIONS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 h", minutes: 60 },
  { label: "2 h", minutes: 120 },
]

interface Props extends TabCommon {
  push: PushState
  snoozeUntil: number | null
  onTake: () => Promise<void>
  onUndo: () => Promise<void>
  onSnooze: (minutes: number) => Promise<void>
  onCancelSnooze: () => Promise<void>
  onGoTo: (tab: TabId) => void
}

function greeting(now: Date) {
  const h = now.getHours()
  if (h < 5) return "Bonne nuit"
  if (h < 18) return "Bonjour"
  return "Bonsoir"
}

function countdownLabel(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m} min`
  return `${h} h ${String(m).padStart(2, "0")}`
}

export default function TodayTab({
  data, profile, now, todayKey, pillType, pack, stats, pillInfo, trackingSince, push, snoozeUntil, onTake, onUndo, onSnooze, onCancelSnooze, onGoTo,
}: Props) {
  const [showSnooze, setShowSnooze] = useState(false)
  const [busy, setBusy] = useState(false)

  const entry = data.logs[todayKey]
  const taken = entry?.taken === true
  const isPause = pack.phase === "pause"

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const target = timeToMinutes(profile.pill_time) ?? 8 * 60
  const minutesUntil = target - nowMin
  const lateBy = nowMin - target
  const isDue = !taken && !isPause && minutesUntil <= 0
  const isLate = !taken && !isPause && lateBy >= 60

  const yesterday = addDaysToKey(todayKey, -1)
  const yesterdayEntry = data.logs[yesterday]
  const showYesterday =
    !yesterdayEntry &&
    yesterday >= trackingSince &&
    phaseOfDay(pillType, profile.pack_start_date, yesterday) === "active"

  const daysLeft = profile.days_remaining ?? 0
  const alertAt = profile.stock_alert_days ?? 7
  const lowStock = daysLeft <= alertAt
  const perBox = pillInfo?.daysPerBox ?? 21
  const stockPct = Math.min(100, Math.round((daysLeft / Math.max(perBox * 2, alertAt * 2, 1)) * 100))

  async function handleTake() {
    setBusy(true)
    setShowSnooze(false)
    await onTake()
    setBusy(false)
  }

  const takenTime = entry?.taken_at
    ? new Date(entry.taken_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null

  const snoozeLabel = snoozeUntil
    ? new Date(snoozeUntil).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm capitalize text-muted-foreground">{formatLongDate(todayKey)}</p>
        <h1 className="font-display text-4xl font-semibold leading-tight">
          {greeting(now)}, <span className="text-primary">{profile.name}</span>
        </h1>
      </div>

      {/* ───────── Carte principale ───────── */}
      <section className="surface-hero relative overflow-hidden rounded-[2rem] p-6 text-center" aria-live="polite">
        <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-gold/15 blur-3xl" aria-hidden="true" />

        {isPause ? (
          <div className="space-y-3 py-2">
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
              <Moon className="size-9 text-gold" />
            </div>
            <h2 className="font-display text-3xl font-semibold">Jour de pause</h2>
            <p className="text-sm text-white/70">
              Jour {pack.day} sur {pack.phaseLength}. Pas de comprimé aujourd'hui.
              {pack.resumeOn && (<> Reprise le <strong className="text-white">{formatShortDate(pack.resumeOn)}</strong> à {formatTime(profile.pill_time)}.</>)}
            </p>
          </div>
        ) : taken ? (
          <div className="space-y-3 py-2">
            <div className="animate-pop mx-auto grid size-24 place-items-center rounded-full bg-gradient-to-br from-gold to-[oklch(0.62_0.12_75)] text-[oklch(0.25_0.06_60)] shadow-[0_0_0_8px_rgb(255_255_255/0.06)]">
              <Check className="size-12" strokeWidth={3} />
            </div>
            <h2 className="font-display text-3xl font-semibold">Pilule prise</h2>
            <p className="text-sm text-white/70">
              {takenTime ? `Enregistrée à ${takenTime}.` : "C'est noté pour aujourd'hui."} À demain à {formatTime(profile.pill_time)} ✨
            </p>
            <button type="button" onClick={() => void onUndo()} className="inline-flex items-center gap-1 text-xs text-white/55 underline-offset-4 hover:text-white hover:underline">
              <RotateCcw className="size-3" /> Annuler cette prise
            </button>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-sm text-white/70">
              {profile.pill_name} · {formatTime(profile.pill_time)}
            </p>
            <h2 className="font-display text-3xl font-semibold">{isDue ? "C'est l'heure de ta pilule" : "Prochaine prise"}</h2>

            {!isDue && (
              <p className="font-display text-6xl font-semibold tabular-nums text-gold">
                {minutesUntil > 0 ? countdownLabel(minutesUntil) : "maintenant"}
              </p>
            )}

            {!showSnooze ? (
              <div className="flex flex-col items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTake}
                  disabled={busy}
                  className={cn(
                    "btn-gold grid size-28 place-items-center rounded-full text-center font-semibold transition-transform active:scale-95 disabled:opacity-70",
                    isDue && "animate-ring-pulse",
                  )}
                  aria-label="Confirmer la prise de ma pilule"
                >
                  {busy ? <PillSpinner className="size-9" /> : (
                    <span className="flex flex-col items-center gap-0.5">
                      <Check className="size-9" strokeWidth={3} />
                      <span className="text-sm leading-tight">Je l'ai<br />prise</span>
                    </span>
                  )}
                </button>
                <Button type="button" variant="ghost" size="sm" className="text-white/75 hover:bg-white/10 hover:text-white" onClick={() => setShowSnooze(true)}>
                  <Clock /> Me le rappeler plus tard
                </Button>
              </div>
            ) : (
              <div className="animate-fade-up space-y-3">
                <p className="text-sm text-white/75">Me relancer dans…</p>
                <div className="grid grid-cols-4 gap-2">
                  {SNOOZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.minutes}
                      type="button"
                      onClick={() => { setShowSnooze(false); void onSnooze(opt.minutes) }}
                      className="rounded-xl bg-white/10 py-3 text-sm font-medium ring-1 ring-white/15 transition-colors hover:bg-white/20"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setShowSnooze(false)} className="text-xs text-white/60 hover:text-white">Annuler</button>
              </div>
            )}

            {snoozeLabel && !showSnooze && (
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs">
                <BellRing className="size-3.5 text-gold" /> Rappel prévu à {snoozeLabel}
                <button type="button" onClick={() => void onCancelSnooze()} aria-label="Annuler le rappel" className="text-white/60 hover:text-white">
                  <X className="size-3.5" />
                </button>
              </p>
            )}
          </div>
        )}
      </section>

      {isLate && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/12 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            Tu as <strong>{countdownLabel(lateBy)}</strong> de retard. Prends-la dès que possible.
            {lateBy >= 180 && " En cas d'oubli important, consulte la notice de ta pilule ou demande conseil à ton pharmacien."}
          </p>
        </div>
      )}

      {/* Hier oublié ? */}
      {showYesterday && (
        <div className="surface-lux rounded-2xl p-4">
          <p className="text-sm font-medium">Hier n'est pas enregistré</p>
          <p className="text-xs text-muted-foreground">Tu l'avais prise ?</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="lux" className="flex-1" onClick={() => void data.setDayStatus(yesterday, "taken")}>
              <Check /> Oui, prise
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => void data.setDayStatus(yesterday, "missed")}>
              Non, oubliée
            </Button>
          </div>
        </div>
      )}

      {/* ───────── Stats rapides ───────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="surface-lux rounded-2xl p-3 text-center">
          <Flame className="mx-auto mb-1 size-4 text-primary" />
          <p className="font-display text-3xl font-semibold leading-none">{stats.currentStreak}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">jour{stats.currentStreak > 1 ? "s" : ""} d'affilée</p>
        </div>
        <div className="surface-lux rounded-2xl p-3 text-center">
          <Percent className="mx-auto mb-1 size-4 text-primary" />
          <p className="font-display text-3xl font-semibold leading-none">{stats.adherence30 ?? "–"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">observance 30 j</p>
        </div>
        <div className="surface-lux rounded-2xl p-3 text-center">
          <Sparkles className="mx-auto mb-1 size-4 text-primary" />
          <p className="font-display text-3xl font-semibold leading-none">{isPause ? "–" : pack.day}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{isPause ? "en pause" : `jour / ${pack.phaseLength}`}</p>
        </div>
      </div>

      {/* ───────── Stock ───────── */}
      <section className="surface-lux rounded-2xl p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Stock restant</p>
            <p className="font-display text-4xl font-semibold leading-none">
              {daysLeft} <span className="text-base font-normal text-muted-foreground">jour{daysLeft > 1 ? "s" : ""}</span>
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onGoTo("pack")}>
            <PackageOpen /> Gérer
          </Button>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={daysLeft} aria-valuemin={0} aria-valuemax={perBox * 2} aria-label="Stock de pilules">
          <div className={cn("h-full rounded-full transition-all duration-700", lowStock ? "bg-destructive" : "bg-gradient-to-r from-primary to-gold")} style={{ width: `${stockPct}%` }} />
        </div>
        {lowStock && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertTriangle className="size-3.5" />
            {daysLeft <= 0 ? "Plus de pilules en stock : passe à la pharmacie !" : "Pense à racheter ta pilule bientôt."}
          </p>
        )}
      </section>

      {/* ───────── Notifications ───────── */}
      {push.status !== "subscribed" && push.status !== "unsupported" && (
        <section className="surface-lux rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              {push.status === "needs_install" ? <Smartphone className="size-5" /> : <Bell className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {push.status === "needs_install" ? "Installe Pillow pour être rappelée" : push.status === "denied" ? "Notifications bloquées" : "Active tes rappels"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {push.status === "needs_install"
                  ? "Sur iPhone : Partager → Sur l'écran d'accueil, puis ouvre l'app depuis l'icône."
                  : push.status === "denied"
                  ? "Autorise les notifications pour ce site dans les réglages de ton navigateur."
                  : "Reçois ta notification à l'heure prévue, même app fermée."}
              </p>
              {push.status === "error" && push.lastError && <p className="mt-1 text-xs text-destructive">{push.lastError}</p>}
              {(push.status === "idle" || push.status === "loading" || push.status === "error") && (
                <Button size="sm" variant="lux" className="mt-3" onClick={() => void push.subscribe()} disabled={push.status === "loading"}>
                  {push.status === "loading" ? <PillSpinner /> : <Bell />}
                  {push.status === "loading" ? "Activation…" : "Activer"}
                </Button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
