"use client"

import { useMemo, useState } from "react"
import { Check, ChevronLeft, ChevronRight, Clock, Flame, Moon, Percent, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MONTHS_FR, WEEKDAYS_FR_SHORT, formatLongDate } from "@/lib/date"
import { phaseOfDay } from "@/lib/pack"
import { cn } from "@/lib/utils"
import type { TabCommon } from "@/components/dashboard/types"

type CellStatus = "taken" | "missed" | "pause" | "pending" | "future" | "untracked"

export default function HistoryTab({ data, profile, todayKey, pillType, stats, trackingSince }: TabCommon) {
  const [ty, tm] = todayKey.split("-").map(Number)
  const [view, setView] = useState({ year: ty, month: tm - 1 })
  const [selected, setSelected] = useState<string | null>(null)

  const isCurrentMonth = view.year === ty && view.month === tm - 1
  const firstOfMonth = new Date(Date.UTC(view.year, view.month, 1))
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate()
  const leading = (firstOfMonth.getUTCDay() + 6) % 7 // lundi en premier

  const keyOf = (day: number) => `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

  function statusOf(dateKey: string): CellStatus {
    if (dateKey > todayKey) return "future"
    const log = data.logs[dateKey]
    if (log) return log.taken ? "taken" : "missed"
    if (phaseOfDay(pillType, profile.pack_start_date, dateKey) === "pause") return "pause"
    if (dateKey < trackingSince) return "untracked"
    if (dateKey === todayKey) return "pending"
    return "missed"
  }

  const monthSummary = useMemo(() => {
    let taken = 0
    let missed = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const s = statusOf(keyOf(d))
      if (s === "taken") taken++
      if (s === "missed") missed++
    }
    return { taken, missed }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, data.logs, todayKey, profile.pack_start_date, pillType, trackingSince])

  function shiftMonth(delta: number) {
    setSelected(null)
    setView((v) => {
      const d = new Date(Date.UTC(v.year, v.month + delta, 1))
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
    })
  }

  const selectedStatus = selected ? statusOf(selected) : null
  const selectedLog = selected ? data.logs[selected] : undefined
  const selectedTime = selectedLog?.taken_at
    ? new Date(selectedLog.taken_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null

  const tiles = [
    { icon: Flame, value: stats.currentStreak, label: "série en cours" },
    { icon: Trophy, value: stats.bestStreak, label: "meilleure série" },
    { icon: Percent, value: stats.adherence30 ?? "–", label: "observance 30 j" },
    { icon: Clock, value: stats.onTimePct === null ? "–" : `${stats.onTimePct}%`, label: "à ±1 h de l'heure" },
  ]

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-semibold">Historique</h1>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ icon: Icon, value, label }) => (
          <div key={label} className="surface-lux flex items-center gap-3 rounded-2xl p-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div>
              <p className="font-display text-3xl font-semibold leading-none">{value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="surface-lux rounded-2xl p-4" aria-label="Calendrier des prises">
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
            <ChevronLeft />
          </Button>
          <div className="text-center">
            <h2 className="font-display text-2xl font-semibold leading-none">{MONTHS_FR[view.month]}</h2>
            <p className="text-xs text-muted-foreground">{view.year}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} disabled={isCurrentMonth} aria-label="Mois suivant">
            <ChevronRight />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS_FR_SHORT.map((d, i) => (
            <div key={i} className="py-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">{d}</div>
          ))}
          {Array.from({ length: leading }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateKey = keyOf(day)
            const status = statusOf(dateKey)
            const isToday = dateKey === todayKey
            const isSelected = dateKey === selected
            const interactive = status !== "future"
            return (
              <button
                key={dateKey}
                type="button"
                disabled={!interactive}
                onClick={() => setSelected(isSelected ? null : dateKey)}
                aria-label={`${day} ${MONTHS_FR[view.month]} : ${
                  { taken: "pilule prise", missed: "oubliée", pause: "pause", pending: "à prendre", future: "à venir", untracked: "non suivi" }[status]
                }`}
                aria-pressed={isSelected}
                className={cn(
                  "relative grid aspect-square place-items-center rounded-full text-sm font-medium transition-all",
                  status === "taken" && "bg-primary text-primary-foreground shadow-sm",
                  status === "missed" && "bg-destructive/12 text-destructive ring-1 ring-destructive/30",
                  status === "pause" && "bg-muted text-muted-foreground",
                  status === "pending" && "bg-card text-foreground ring-1 ring-primary/40",
                  status === "future" && "text-foreground/30",
                  status === "untracked" && "text-foreground/40 hover:bg-muted",
                  isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  isSelected && "scale-110 ring-2 ring-foreground/70 ring-offset-2 ring-offset-card",
                  interactive && "active:scale-95",
                )}
              >
                {status === "taken" ? <Check className="size-4" strokeWidth={3} /> : status === "pause" ? <Moon className="size-3.5" /> : day}
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-primary" /> Prise</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-destructive/30 ring-1 ring-destructive/40" /> Oubliée</span>
          {pillType === "21_7" && <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-muted ring-1 ring-border" /> Pause</span>}
        </div>

        <div className="hairline my-4" />
        <p className="text-center text-sm text-muted-foreground">
          <strong className="text-foreground">{monthSummary.taken}</strong> prise{monthSummary.taken > 1 ? "s" : ""} ·{" "}
          <strong className="text-foreground">{monthSummary.missed}</strong> oubli{monthSummary.missed > 1 ? "s" : ""} ce mois-ci
        </p>
      </section>

      {/* Détail du jour sélectionné */}
      {selected && selectedStatus && (
        <section className="surface-lux animate-fade-up rounded-2xl p-4" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium capitalize">{formatLongDate(selected)}</p>
              <p className="text-xs text-muted-foreground">
                {selectedStatus === "taken" && (selectedTime ? `Pilule prise à ${selectedTime}` : "Pilule prise")}
                {selectedStatus === "missed" && "Pilule oubliée"}
                {selectedStatus === "pause" && "Jour de pause (pas de comprimé)"}
                {selectedStatus === "pending" && "À prendre aujourd'hui"}
                {selectedStatus === "untracked" && "Avant ton inscription"}
              </p>
            </div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Fermer" className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedStatus !== "taken" && (
              <Button size="sm" variant="lux" onClick={() => void data.setDayStatus(selected, "taken")}>
                <Check /> Marquer comme prise
              </Button>
            )}
            {selectedStatus !== "missed" && selected !== todayKey && (
              <Button size="sm" variant="outline" onClick={() => void data.setDayStatus(selected, "missed")}>
                Marquer comme oubliée
              </Button>
            )}
            {(selectedStatus === "taken" || selectedStatus === "missed") && (
              <Button size="sm" variant="ghost" onClick={() => void data.setDayStatus(selected, "none")}>
                Effacer
              </Button>
            )}
          </div>
        </section>
      )}

      <p className="px-2 text-center text-xs text-muted-foreground">
        Touche un jour pour corriger une prise oubliée d'enregistrer. Le stock s'ajuste automatiquement.
      </p>
    </div>
  )
}
