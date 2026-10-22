"use client"

import { useMemo, useState } from "react"
import { CalendarClock, Minus, PackagePlus, Plus, RotateCw, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { addDaysToKey, formatLongDate, formatShortDate } from "@/lib/date"
import { getBlisterLayout, phaseOfDay } from "@/lib/pack"
import { cn } from "@/lib/utils"
import type { TabCommon } from "@/components/dashboard/types"

function MiniStepper({ value, onChange, min, max, label, unit }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string; unit?: string }) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Moins">
        <Minus />
      </Button>
      <span className="font-display min-w-14 text-center text-3xl font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </span>
      <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Plus">
        <Plus />
      </Button>
    </div>
  )
}

export default function PackTab({ data, profile, todayKey, pillType, pack, pillInfo, trackingSince }: TabCommon) {
  const [boxes, setBoxes] = useState(1)
  const [startDate, setStartDate] = useState(profile.pack_start_date ?? todayKey)
  const [savingStart, setSavingStart] = useState(false)

  const perBox = pillInfo?.daysPerBox ?? 21
  const daysLeft = profile.days_remaining ?? 0
  const alertAt = profile.stock_alert_days ?? 7
  const takenToday = data.logs[todayKey]?.taken === true

  const blister = useMemo(
    () => getBlisterLayout(pillType, perBox, profile.pack_start_date, todayKey),
    [pillType, perBox, profile.pack_start_date, todayKey],
  )

  /* Date du dernier comprimé : on simule jour par jour en sautant les pauses */
  const lastPillDate = useMemo(() => {
    if (daysLeft <= 0) return null
    let remaining = daysLeft
    let cursor = takenToday ? addDaysToKey(todayKey, 1) : todayKey
    let last = cursor
    for (let i = 0; i < 2000 && remaining > 0; i++) {
      if (phaseOfDay(pillType, profile.pack_start_date, cursor) === "active") {
        remaining--
        last = cursor
      }
      cursor = addDaysToKey(cursor, 1)
    }
    return last
  }, [daysLeft, takenToday, todayKey, pillType, profile.pack_start_date])

  function cellState(dateKey: string, phase: "active" | "pause") {
    const log = data.logs[dateKey]
    if (log) return log.taken ? "taken" : "missed"
    if (phase === "pause") return "pause"
    if (dateKey > todayKey) return "upcoming"
    if (dateKey === todayKey) return "today"
    if (dateKey < trackingSince) return "upcoming"
    return "missed"
  }

  async function saveStartDate() {
    setSavingStart(true)
    await data.startNewPack(startDate > todayKey ? todayKey : startDate)
    setSavingStart(false)
  }

  const startChanged = startDate !== (profile.pack_start_date ?? todayKey)

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-semibold">Plaquette</h1>

      {/* ───────── Plaquette ───────── */}
      <section className="surface-lux rounded-3xl p-5" aria-label="Plaquette en cours">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{profile.pill_name}</p>
            <p className="font-display text-3xl font-semibold leading-tight">
              {pack.phase === "pause" ? `Pause : jour ${pack.day}/${pack.phaseLength}` : pillType === "21_7" ? `Jour ${pack.day} sur 21` : `Jour ${blister.todayIndex + 1} sur ${blister.cells.length}`}
            </p>
          </div>
          {pack.phase === "pause" && pack.resumeOn && (
            <p className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">Reprise {formatShortDate(pack.resumeOn)}</p>
          )}
        </div>

        <div className="grid grid-cols-7 gap-2 rounded-2xl bg-muted/60 p-3" role="img" aria-label="Plaquette de comprimés">
          {blister.cells.map((cell, i) => {
            const state = cellState(cell.dateKey, cell.phase)
            return (
              <div
                key={cell.dateKey}
                title={formatLongDate(cell.dateKey)}
                className={cn(
                  "relative grid aspect-square place-items-center rounded-full text-[10px] font-semibold",
                  state === "taken" && "bg-gradient-to-br from-primary to-[oklch(0.45_0.15_352)] text-primary-foreground shadow-sm",
                  state === "missed" && "bg-destructive/15 text-destructive ring-1 ring-destructive/40",
                  state === "today" && "bg-card text-primary ring-2 ring-primary",
                  state === "upcoming" && "bg-card text-muted-foreground ring-1 ring-border",
                  state === "pause" && "border border-dashed border-muted-foreground/40 text-muted-foreground/60",
                  i === blister.todayIndex && "ring-2 ring-gold ring-offset-2 ring-offset-muted",
                )}
              >
                {cell.number ?? "·"}
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" /> Prise</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-card ring-1 ring-border" /> À venir</span>
          {pillType === "21_7" && <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-dashed border-muted-foreground/50" /> Pause</span>}
        </div>

        <div className="hairline my-4" />

        <div className="space-y-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <RotateCw /> J'ouvre une nouvelle plaquette aujourd'hui
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display text-2xl">Nouvelle plaquette ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Aujourd'hui deviendra le jour 1. {pillType === "21_7" ? "Les 21 jours de prise puis les 7 jours de pause seront recalculés à partir d'aujourd'hui." : "Le compteur de la plaquette repart de zéro."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => void data.startNewPack(todayKey)}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="space-y-1.5">
            <Label htmlFor="pack-start" className="text-xs text-muted-foreground">Date du jour 1 de la plaquette</Label>
            <div className="flex gap-2">
              <Input id="pack-start" type="date" max={todayKey} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 rounded-xl" />
              <Button type="button" variant="secondary" className="h-11" onClick={saveStartDate} disabled={!startChanged || savingStart || !startDate}>
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Stock ───────── */}
      <section className="surface-lux rounded-3xl p-5" aria-label="Stock">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShoppingCart className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stock restant</p>
            <p className="font-display text-4xl font-semibold leading-none">
              {daysLeft} <span className="text-base font-normal text-muted-foreground">jour{daysLeft > 1 ? "s" : ""}</span>
            </p>
          </div>
        </div>

        {lastPillDate ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
            <CalendarClock className="size-4 shrink-0 text-gold" />
            <span>
              Dernier comprimé vers le <strong className="capitalize">{formatLongDate(lastPillDate)}</strong>
              {pillType === "21_7" && <span className="text-muted-foreground"> (pauses incluses)</span>}
            </span>
          </p>
        ) : (
          <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">Plus de pilules en stock : passe à la pharmacie.</p>
        )}

        <div className="hairline my-4" />

        <p className="mb-2 text-sm font-medium">J'ai racheté des boîtes</p>
        <div className="flex items-center justify-between gap-3">
          <MiniStepper value={boxes} onChange={setBoxes} min={1} max={12} label="Nombre de boîtes rachetées" unit={boxes > 1 ? "boîtes" : "boîte"} />
          <Button
            variant="lux"
            onClick={async () => {
              const ok = await data.restock(boxes)
              if (ok) setBoxes(1)
            }}
          >
            <PackagePlus /> +{boxes * perBox} j
          </Button>
        </div>

        <div className="hairline my-4" />

        <p className="mb-1 text-sm font-medium">M'alerter quand il reste…</p>
        <div className="flex items-center justify-between">
          <MiniStepper value={alertAt} onChange={(n) => void data.updateProfile({ stock_alert_days: n })} min={1} max={30} label="Seuil d'alerte du stock" unit="jours" />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          <span>
            Le stock baisse à chaque prise enregistrée. Une boîte de {profile.pill_name ?? "ta pilule"} contient {perBox} comprimés. Tu peux aussi corriger le total à la main dans les réglages si besoin.
          </span>
        </div>
      </section>

      {pillInfo && pillInfo.substance && (
        <section className="surface-lux rounded-3xl p-5">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Ma pilule</p>
          <p className="font-display text-2xl font-semibold">{pillInfo.name}</p>
          <p className="text-sm text-muted-foreground">{pillInfo.substance}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs capitalize">{pillInfo.category}</span>
            {pillInfo.category !== "micro-progestative" && <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">{pillInfo.generation}ᵉ génération</span>}
            {pillInfo.isGeneric && <span className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">générique</span>}
          </div>
        </section>
      )}
    </div>
  )
}
