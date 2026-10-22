"use client"

import { useEffect, useMemo, useState } from "react"
import { Minus, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { addDaysToKey, diffDays, formatLongDate, formatShortDate } from "@/lib/date"
import { ACTIVE_DAYS, PAUSE_DAYS, getBlisterLayout } from "@/lib/pack"
import { addMonthsToKey, getPrescriptionInfo, getStockInfo, getStockLevel } from "@/lib/supply"
import { cn } from "@/lib/utils"
import type { TabCommon } from "@/components/dashboard/types"

function MiniStepper({ value, onChange, min, max, label, unit }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string; unit?: string }) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Moins">
        <Minus />
      </Button>
      <span className="min-w-14 text-center text-2xl font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </span>
      <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Plus">
        <Plus />
      </Button>
    </div>
  )
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {action}
    </div>
  )
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`

export default function PackTab({ data, profile, todayKey, pillType, pack, pillInfo, trackingSince }: TabCommon) {
  /* plaquette : correction */
  const [editing, setEditing] = useState(false)
  const [editMode, setEditMode] = useState<"active" | "pause">("active")
  const [editDay, setEditDay] = useState(1)
  const [editPauseDay, setEditPauseDay] = useState(1)
  const [savingStart, setSavingStart] = useState(false)

  /* stock : rachat */
  const [buying, setBuying] = useState(false)
  const [boxes, setBoxes] = useState(1)

  /* ordonnance */
  const [rxEditing, setRxEditing] = useState(false)
  const [rxDate, setRxDate] = useState(profile.prescription_end_date ?? "")
  const [savingRx, setSavingRx] = useState(false)
  useEffect(() => setRxDate(profile.prescription_end_date ?? ""), [profile.prescription_end_date])

  const perBox = pillInfo?.daysPerBox ?? 21
  const daysLeft = profile.days_remaining ?? 0
  const alertAt = profile.stock_alert_days ?? 7
  const takenToday = data.logs[todayKey]?.taken === true
  const is217 = pillType === "21_7"

  const blister = useMemo(
    () => getBlisterLayout(pillType, perBox, profile.pack_start_date, todayKey),
    [pillType, perBox, profile.pack_start_date, todayKey],
  )
  const stock = useMemo(
    () => getStockInfo({ pillType, packStartDate: profile.pack_start_date, perBox, daysLeft, todayKey, takenToday }),
    [pillType, profile.pack_start_date, perBox, daysLeft, todayKey, takenToday],
  )
  const stockLevel = getStockLevel(daysLeft, alertAt)
  const rx = useMemo(() => getPrescriptionInfo(profile.prescription_end_date, todayKey), [profile.prescription_end_date, todayKey])

  /* Où j'en suis dans la plaquette */
  const packLength = is217 ? ACTIVE_DAYS : perBox
  const inPause = pack.phase === "pause"
  const dayInPack = inPause ? packLength : is217 ? pack.day : blister.todayIndex + 1
  const progressPct = inPause ? 100 : Math.round((dayInPack / packLength) * 100)

  let nextEvent: string
  if (inPause) {
    nextEvent = pack.resumeOn ? `Reprise le ${formatShortDate(pack.resumeOn)}` : "Reprise bientôt"
  } else if (is217 && pack.pauseStartsOn) {
    nextEvent = `Pause à partir du ${formatShortDate(pack.pauseStartsOn)}`
  } else {
    nextEvent = `Nouvelle plaquette le ${formatShortDate(addDaysToKey(todayKey, packLength - dayInPack + 1))}`
  }

  function openEditor() {
    setEditMode(inPause ? "pause" : "active")
    setEditDay(inPause ? 1 : Math.min(dayInPack, packLength))
    setEditPauseDay(inPause ? pack.day : 1)
    setEditing(true)
  }
  const editedStart =
    editMode === "pause" ? addDaysToKey(todayKey, -(ACTIVE_DAYS + editPauseDay - 1)) : addDaysToKey(todayKey, -(editDay - 1))

  async function saveProgress() {
    setSavingStart(true)
    const ok = await data.startNewPack(editedStart)
    setSavingStart(false)
    if (ok) setEditing(false)
  }

  function cellState(dateKey: string, phase: "active" | "pause") {
    const log = data.logs[dateKey]
    if (log) return log.taken ? "taken" : "missed"
    if (phase === "pause") return "pause"
    if (dateKey > todayKey) return "upcoming"
    if (dateKey === todayKey) return "today"
    // Jours de la plaquette écoulés avant l'arrivée dans Pillow : déclarés comme pris à l'inscription
    if (dateKey < trackingSince) return "taken"
    return "missed"
  }

  async function saveRx(value: string | null) {
    setSavingRx(true)
    const ok = await data.updateProfile({ prescription_end_date: value })
    setSavingRx(false)
    if (ok) setRxEditing(false)
  }
  const rxChanged = rxDate !== (profile.prescription_end_date ?? "")

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Plaquette</h1>

      {/* ───────── Plaquette ───────── */}
      <section className="surface-lux rounded-2xl p-5" aria-label="Plaquette en cours">
        <CardHeader title={profile.pill_name ?? "Plaquette"} />
        <p className="text-3xl font-semibold leading-tight" data-testid="pack-position">
          {inPause ? `Pause : jour ${pack.day} sur ${PAUSE_DAYS}` : `Jour ${dayInPack} sur ${packLength}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{nextEvent}</p>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={packLength} aria-valuenow={inPause ? packLength : dayInPack} aria-label="Avancement de la plaquette">
          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2" role="img" aria-label="Plaquette de comprimés">
          {blister.cells.map((cell, i) => {
            const state = cellState(cell.dateKey, cell.phase)
            return (
              <div
                key={cell.dateKey}
                title={formatLongDate(cell.dateKey)}
                className={cn(
                  "grid aspect-square place-items-center rounded-full text-[10px] font-medium",
                  state === "taken" && "bg-primary text-primary-foreground",
                  state === "missed" && "bg-destructive/12 text-destructive ring-1 ring-destructive/30",
                  state === "today" && "bg-card text-foreground ring-2 ring-primary",
                  state === "upcoming" && "bg-muted text-muted-foreground",
                  state === "pause" && "border border-dashed border-muted-foreground/40 text-muted-foreground/60",
                  i === blister.todayIndex && state !== "today" && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                )}
              >
                {cell.number ?? ""}
              </div>
            )
          })}
        </div>

        {!editing ? (
          <button type="button" onClick={openEditor} className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline">
            Corriger ma progression
          </button>
        ) : (
          <div className="animate-fade-up mt-4 space-y-4 border-t pt-4" aria-label="Corriger ma progression">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Où en es-tu aujourd'hui ?</p>
              <button type="button" onClick={() => setEditing(false)} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            {is217 && (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Phase">
                {([["active", "Je prends ma pilule"], ["pause", "Je suis en pause"]] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={editMode === id}
                    onClick={() => setEditMode(id)}
                    className={cn("rounded-xl border px-3 py-2.5 text-sm transition-colors", editMode === id ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col items-center gap-1">
              {editMode === "pause" ? (
                <>
                  <p className="text-xs text-muted-foreground">Jour de pause (sur {PAUSE_DAYS})</p>
                  <MiniStepper value={editPauseDay} onChange={setEditPauseDay} min={1} max={PAUSE_DAYS} label="Jour de pause" />
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Jour de la plaquette (sur {packLength})</p>
                  <MiniStepper value={editDay} onChange={setEditDay} min={1} max={packLength} label="Jour de la plaquette" />
                </>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground">Début de plaquette : {formatLongDate(editedStart)}</p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={savingStart}>Annuler</Button>
              <Button variant="lux" className="flex-1" onClick={saveProgress} disabled={savingStart}>Enregistrer</Button>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button type="button" className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                  J'ouvre une nouvelle plaquette aujourd'hui
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl">Nouvelle plaquette ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Aujourd'hui deviendra le jour 1. {is217 ? "Les 21 jours de prise puis les 7 jours de pause seront recalculés à partir d'aujourd'hui." : "Le compteur de la plaquette repart de zéro."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { void data.startNewPack(todayKey); setEditing(false) }}>Confirmer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </section>

      {/* ───────── Stock ───────── */}
      <section className="surface-lux rounded-2xl p-5" aria-label="Stock">
        <CardHeader title="Stock" />
        <p className="text-3xl font-semibold leading-tight">
          {daysLeft} <span className="text-base font-normal text-muted-foreground">jour{daysLeft > 1 ? "s" : ""}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="stock-detail">
          {stock.currentPackLeft} dans la plaquette en cours · {stock.reserveBoxes} boîte{stock.reserveBoxes > 1 ? "s" : ""} en réserve
          {stock.looseDays > 0 && ` + ${stock.looseDays} j`}
        </p>
        {stock.lastPillDate ? (
          <p className={cn("mt-2 text-sm", stockLevel === "ok" ? "text-muted-foreground" : "font-medium text-destructive")}>
            {stockLevel === "ok" ? "Jusqu'au" : "Plus de pilules après le"} {formatLongDate(stock.lastPillDate)}
          </p>
        ) : (
          <p className="mt-2 text-sm font-medium text-destructive">Plus de pilules : passe à la pharmacie.</p>
        )}

        {!buying ? (
          <button type="button" onClick={() => setBuying(true)} className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline">
            J'ai racheté des boîtes
          </button>
        ) : (
          <div className="animate-fade-up mt-4 space-y-3 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <MiniStepper value={boxes} onChange={setBoxes} min={1} max={12} label="Nombre de boîtes rachetées" unit={boxes > 1 ? "boîtes" : "boîte"} />
              <span className="text-sm text-muted-foreground">+{boxes * perBox} jours</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setBuying(false)}>Annuler</Button>
              <Button
                variant="lux"
                className="flex-1"
                onClick={async () => {
                  const ok = await data.restock(boxes)
                  if (ok) {
                    setBoxes(1)
                    setBuying(false)
                  }
                }}
              >
                Ajouter
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ───────── Ordonnance ───────── */}
      <section className="surface-lux rounded-2xl p-5" aria-label="Ordonnance">
        <CardHeader title="Ordonnance" />
        <p
          className={cn("text-3xl font-semibold leading-tight", (rx.level === "urgent" || rx.level === "expired") && "text-destructive")}
          data-testid="rx-status"
        >
          {rx.level === "none"
            ? "Non renseignée"
            : rx.level === "expired"
            ? "Expirée"
            : rx.daysLeft === 0
            ? "Dernier jour"
            : `${plural(rx.daysLeft ?? 0, "jour")} restant${(rx.daysLeft ?? 0) > 1 ? "s" : ""}`}
        </p>
        {profile.prescription_end_date ? (
          <p className="mt-1 text-sm text-muted-foreground">Jusqu'au {formatLongDate(profile.prescription_end_date)}</p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Ajoute la date pour être prévenue à temps.</p>
        )}

        {!rxEditing ? (
          <button type="button" onClick={() => setRxEditing(true)} className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline">
            {profile.prescription_end_date ? "Modifier la date" : "Ajouter la date de fin"}
          </button>
        ) : (
          <div className="animate-fade-up mt-4 space-y-3 border-t pt-4">
            <Input id="rx-end" type="date" aria-label="Date de fin de l'ordonnance" value={rxDate} onChange={(e) => setRxDate(e.target.value)} className="h-11 rounded-xl" />
            <div className="flex flex-wrap gap-2">
              {[3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRxDate(addMonthsToKey(todayKey, m))}
                  className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted"
                >
                  dans {m === 12 ? "1 an" : `${m} mois`}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setRxEditing(false); setRxDate(profile.prescription_end_date ?? "") }} disabled={savingRx}>Annuler</Button>
              <Button variant="lux" className="flex-1" onClick={() => void saveRx(rxDate || null)} disabled={!rxChanged || savingRx}>Enregistrer</Button>
            </div>
            {profile.prescription_end_date && (
              <button type="button" onClick={() => void saveRx(null)} className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Retirer la date
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
