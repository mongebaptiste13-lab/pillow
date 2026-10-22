"use client"

import { useState } from "react"
import { AlertTriangle, Bell, Check, ChevronRight, Clock, FileText, Moon, PackageOpen, RotateCcw, Smartphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PillSpinner } from "@/components/pill-loader"
import { addDaysToKey, formatLongDate, formatShortDate, formatTime, timeToMinutes } from "@/lib/date"
import { ACTIVE_DAYS, phaseOfDay } from "@/lib/pack"
import { getPrescriptionInfo, getStockLevel } from "@/lib/supply"
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

/** Ligne d'alerte : une icône, une phrase, éventuellement une action. */
function Notice({
  icon: Icon, tone = "neutral", children, onClick, ariaLabel,
}: {
  icon: typeof Bell
  tone?: "neutral" | "warning" | "danger"
  children: React.ReactNode
  onClick?: () => void
  ariaLabel?: string
}) {
  const className = cn(
    "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm",
    tone === "warning" && "border-warning/40 bg-warning/10",
    tone === "danger" && "border-destructive/30 bg-destructive/8",
    tone === "neutral" && "bg-card",
  )
  const content = (
    <>
      <Icon className={cn("size-4 shrink-0", tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1">{children}</span>
      {onClick && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>{content}</button>
  ) : (
    <div className={className}>{content}</div>
  )
}

export default function TodayTab({
  data, profile, now, todayKey, pillType, pack, pillInfo, trackingSince, push, snoozeUntil, onTake, onUndo, onSnooze, onCancelSnooze, onGoTo,
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
  const showYesterday =
    !data.logs[yesterday] &&
    yesterday >= trackingSince &&
    phaseOfDay(pillType, profile.pack_start_date, yesterday) === "active"

  const daysLeft = profile.days_remaining ?? 0
  const stockLevel = getStockLevel(daysLeft, profile.stock_alert_days ?? 7)
  const rx = getPrescriptionInfo(profile.prescription_end_date, todayKey)
  const showRx = rx.level === "expired" || (rx.daysLeft !== null && rx.daysLeft <= 30)
  const perBox = pillInfo?.daysPerBox ?? 21
  const packLength = pillType === "21_7" ? ACTIVE_DAYS : perBox
  const packPct = isPause ? 100 : Math.min(100, Math.round((pack.day / packLength) * 100))
  const showPush = push.status !== "subscribed" && push.status !== "unsupported"

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
        <h1 className="text-3xl font-semibold leading-tight">
          {greeting(now)}, {profile.name}
        </h1>
      </div>

      {/* ───────── Prise du jour ───────── */}
      <section className="surface-hero rounded-2xl p-6 text-center" aria-live="polite">
        {isPause ? (
          <div className="space-y-2 py-3">
            <Moon className="mx-auto size-8 text-white/80" />
            <h2 className="text-2xl font-semibold">Jour de pause</h2>
            <p className="text-sm text-white/70">
              Pas de pilule aujourd'hui.
              {pack.resumeOn && <> Reprise le {formatShortDate(pack.resumeOn)}.</>}
            </p>
          </div>
        ) : taken ? (
          <div className="space-y-3 py-2">
            <div className="animate-pop mx-auto grid size-20 place-items-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-10" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-semibold">Pilule prise</h2>
            <p className="text-sm text-white/70">{takenTime ? `Enregistrée à ${takenTime}` : "C'est noté"}</p>
            <button type="button" onClick={() => void onUndo()} className="inline-flex items-center gap-1 text-xs text-white/60 underline-offset-4 hover:text-white hover:underline">
              <RotateCcw className="size-3" /> Annuler cette prise
            </button>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-sm text-white/70">{profile.pill_name} · {formatTime(profile.pill_time)}</p>

            {isDue ? (
              <h2 className="text-2xl font-semibold">C'est l'heure</h2>
            ) : (
              <p className="text-5xl font-semibold tabular-nums tracking-tight">{minutesUntil > 0 ? countdownLabel(minutesUntil) : "maintenant"}</p>
            )}

            {!showSnooze ? (
              <div className="flex flex-col items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTake}
                  disabled={busy}
                  className="btn-gold grid size-28 place-items-center rounded-full text-center font-semibold transition-transform active:scale-95 disabled:opacity-70"
                  aria-label="Confirmer la prise de ma pilule"
                >
                  {busy ? <PillSpinner className="size-9" /> : (
                    <span className="flex flex-col items-center gap-0.5">
                      <Check className="size-8" strokeWidth={3} />
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
                      className="rounded-xl bg-white/10 py-3 text-sm font-medium transition-colors hover:bg-white/20"
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
                Rappel prévu à {snoozeLabel}
                <button type="button" onClick={() => void onCancelSnooze()} aria-label="Annuler le rappel" className="text-white/60 hover:text-white">
                  <X className="size-3.5" />
                </button>
              </p>
            )}
          </div>
        )}
      </section>

      {/* ───────── À faire (uniquement quand il y a quelque chose) ───────── */}
      {(isLate || showYesterday || stockLevel !== "ok" || showRx || showPush) && (
        <div className="space-y-2">
          {isLate && (
            <Notice icon={AlertTriangle} tone="warning">
              <span role="alert">
                Tu as <strong>{countdownLabel(lateBy)}</strong> de retard : prends-la dès que possible.
                {lateBy >= 180 && " Si le retard est important, regarde la notice ou demande conseil à ton pharmacien."}
              </span>
            </Notice>
          )}

          {showYesterday && (
            <div className="rounded-xl border bg-card px-3.5 py-3">
              <p className="text-sm font-medium">Hier n'est pas enregistré</p>
              <p className="text-xs text-muted-foreground">Tu l'avais prise ?</p>
              <div className="mt-2.5 flex gap-2">
                <Button size="sm" variant="lux" className="flex-1" onClick={() => void data.setDayStatus(yesterday, "taken")}>
                  <Check /> Oui, prise
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => void data.setDayStatus(yesterday, "missed")}>
                  Non, oubliée
                </Button>
              </div>
            </div>
          )}

          {stockLevel !== "ok" && (
            <Notice icon={PackageOpen} tone={stockLevel === "low" ? "warning" : "danger"} onClick={() => onGoTo("pack")} ariaLabel="Voir mon stock">
              {daysLeft <= 0 ? "Plus de pilules : passe à la pharmacie" : `Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""} de pilules`}
            </Notice>
          )}

          {showRx && profile.prescription_end_date && (
            <Notice icon={FileText} tone={rx.level === "expired" || (rx.daysLeft ?? 99) <= 7 ? "danger" : "warning"} onClick={() => onGoTo("pack")} ariaLabel="Voir mon ordonnance">
              {rx.level === "expired"
                ? "Ordonnance expirée"
                : rx.daysLeft === 0
                ? "Ordonnance : dernier jour"
                : `Ordonnance : ${rx.daysLeft} jour${(rx.daysLeft ?? 0) > 1 ? "s" : ""} restant${(rx.daysLeft ?? 0) > 1 ? "s" : ""}`}
            </Notice>
          )}

          {showPush && (
            <Notice
              icon={push.status === "needs_install" ? Smartphone : Bell}
              onClick={push.status === "idle" || push.status === "error" ? () => void push.subscribe() : () => onGoTo("settings")}
              ariaLabel="Activer les rappels"
            >
              {push.status === "needs_install"
                ? "Ajoute Pillow à l'écran d'accueil pour recevoir les rappels"
                : push.status === "denied"
                ? "Notifications bloquées dans ton navigateur"
                : "Activer les rappels"}
            </Notice>
          )}
        </div>
      )}

      {/* ───────── Résumé ───────── */}
      <section className="surface-lux divide-y overflow-hidden rounded-2xl" aria-label="Résumé">
        <button type="button" onClick={() => onGoTo("pack")} className="block w-full px-4 py-3.5 text-left" aria-label="Voir ma plaquette">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Plaquette</span>
            <span className="text-sm font-medium">{isPause ? `Pause · jour ${pack.day} sur ${pack.phaseLength}` : `Jour ${pack.day} sur ${packLength}`}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${packPct}%` }} />
          </div>
        </button>
        <button type="button" onClick={() => onGoTo("pack")} className="flex w-full items-baseline justify-between px-4 py-3.5 text-left" aria-label="Voir mon stock">
          <span className="text-sm text-muted-foreground">Stock</span>
          <span className="text-sm font-medium">{daysLeft} jour{daysLeft > 1 ? "s" : ""}</span>
        </button>
      </section>
    </div>
  )
}
