"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, FileText, Minus, PackagePlus, Pencil, Plus, RotateCw, ShoppingCart, X } from "lucide-react"
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

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`

export default function PackTab({ data, profile, todayKey, pillType, pack, pillInfo, trackingSince }: TabCommon) {
  const [boxes, setBoxes] = useState(1)

  /* correction de la progression */
  const [editing, setEditing] = useState(false)
  const [editMode, setEditMode] = useState<"active" | "pause">("active")
  const [editDay, setEditDay] = useState(1)
  const [editPauseDay, setEditPauseDay] = useState(1)
  const [savingStart, setSavingStart] = useState(false)

  /* ordonnance */
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
  const leftInPack = inPause ? 0 : packLength - dayInPack + (takenToday ? 0 : 1)
  const progressPct = inPause ? 100 : Math.round((dayInPack / packLength) * 100)

  let nextEvent: string
  if (inPause) {
    nextEvent = pack.resumeOn ? `Reprise le ${formatLongDate(pack.resumeOn)} (dans ${plural(diffDays(todayKey, pack.resumeOn), "jour")})` : "Reprise bientôt"
  } else if (is217 && pack.pauseStartsOn) {
    nextEvent = `Pause à partir du ${formatLongDate(pack.pauseStartsOn)} (dans ${plural(diffDays(todayKey, pack.pauseStartsOn), "jour")})`
  } else {
    const nextPack = addDaysToKey(todayKey, packLength - dayInPack + 1)
    nextEvent = `Nouvelle plaquette le ${formatLongDate(nextPack)} (dans ${plural(diffDays(todayKey, nextPack), "jour")})`
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
    await data.updateProfile({ prescription_end_date: value })
    setSavingRx(false)
  }

  const rxChanged = rxDate !== (profile.prescription_end_date ?? "")

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-semibold">Plaquette</h1>

      {/* ───────── Où j'en suis ───────── */}
      <section className="surface-lux rounded-3xl p-5" aria-label="Où j'en suis dans ma plaquette">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{profile.pill_name}</p>
            <p className="font-display text-3xl font-semibold leading-tight" data-testid="pack-position">
              {inPause ? `Pause : jour ${pack.day} sur ${PAUSE_DAYS}` : `Jour ${dayInPack} sur ${packLength}`}
            </p>
          </div>
          {!inPause && (
            <p className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              {leftInPack === 0 ? "Dernier comprimé pris" : `${plural(leftInPack, "comprimé")} à prendre`}
            </p>
          )}
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={packLength} aria-valuenow={inPause ? packLength : dayInPack} aria-label="Avancement de la plaquette">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5 shrink-0 text-gold" /> {nextEvent}
        </p>

        <div className="mt-4 grid grid-cols-7 gap-2 rounded-2xl bg-muted/60 p-3" role="img" aria-label="Plaquette de comprimés">
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
          {is217 && <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-dashed border-muted-foreground/50" /> Pause</span>}
        </div>

        <div className="hairline my-4" />

        {!editing ? (
          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={openEditor}>
              <Pencil /> Corriger ma progression
            </Button>
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
                    Aujourd'hui deviendra le jour 1. {is217 ? "Les 21 jours de prise puis les 7 jours de pause seront recalculés à partir d'aujourd'hui." : "Le compteur de la plaquette repart de zéro."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void data.startNewPack(todayKey)}>Confirmer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <div className="animate-fade-up space-y-4" aria-label="Corriger ma progression">
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
                    className={cn("rounded-xl border px-3 py-2.5 text-sm transition-colors", editMode === id ? "border-primary bg-primary/8 text-primary ring-1 ring-primary/40" : "hover:bg-muted")}
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

            <p className="rounded-xl bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
              Plaquette commencée le <strong className="text-foreground">{formatLongDate(editedStart)}</strong>
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={savingStart}>Annuler</Button>
              <Button variant="lux" className="flex-1" onClick={saveProgress} disabled={savingStart}>Enregistrer</Button>
            </div>
          </div>
        )}
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

        {/* Décomposition en plaquettes / boîtes */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-muted/60 p-3">
            <p className="font-display text-2xl font-semibold leading-none" data-testid="stock-current">{stock.currentPackLeft}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">comprimé{stock.currentPackLeft > 1 ? "s" : ""} dans la plaquette en cours</p>
          </div>
          <div className="rounded-2xl bg-muted/60 p-3">
            <p className="font-display text-2xl font-semibold leading-none" data-testid="stock-reserve">
              {stock.reserveBoxes}
              {stock.looseDays > 0 && <span className="text-sm font-normal text-muted-foreground"> + {stock.looseDays} j</span>}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">boîte{stock.reserveBoxes > 1 ? "s" : ""} en réserve</p>
          </div>
        </div>

        {stock.lastPillDate ? (
          <p className={cn("mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm", stockLevel === "ok" ? "bg-muted/60" : "bg-destructive/10")}>
            <CalendarClock className={cn("size-4 shrink-0", stockLevel === "ok" ? "text-gold" : "text-destructive")} />
            <span>
              Dernier comprimé vers le <strong className="capitalize">{formatLongDate(stock.lastPillDate)}</strong>
              {is217 && <span className="text-muted-foreground"> (pauses incluses)</span>}
              {stockLevel !== "ok" && <span className="block text-xs font-medium text-destructive">Il est temps de racheter ta pilule.</span>}
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
        <p className="mt-2 text-xs text-muted-foreground">Une notification à ce seuil, puis chaque matin dès qu'il reste 3 jours ou moins.</p>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          <span>
            Le stock baisse à chaque prise enregistrée. Une boîte de {profile.pill_name ?? "ta pilule"} contient {perBox} comprimés. Tu peux aussi corriger le total à la main dans les réglages si besoin.
          </span>
        </div>
      </section>

      {/* ───────── Ordonnance ───────── */}
      <section className="surface-lux rounded-3xl p-5" aria-label="Ordonnance">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Ordonnance</p>
            <p className="font-display text-2xl font-semibold leading-tight" data-testid="rx-status">
              {rx.level === "none"
                ? "Date de fin non renseignée"
                : rx.level === "expired"
                ? "Expirée"
                : rx.daysLeft === 0
                ? "Se termine aujourd'hui"
                : `${plural(rx.daysLeft ?? 0, "jour")} restant${(rx.daysLeft ?? 0) > 1 ? "s" : ""}`}
            </p>
          </div>
          {rx.level !== "none" && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                rx.level === "ok" && "bg-success/15 text-success",
                rx.level === "soon" && "bg-warning/20 text-warning",
                (rx.level === "urgent" || rx.level === "expired") && "bg-destructive/12 text-destructive",
              )}
            >
              {rx.level === "ok" ? "Valide" : rx.level === "soon" ? "Bientôt" : rx.level === "urgent" ? "Urgent" : "À renouveler"}
            </span>
          )}
        </div>

        {profile.prescription_end_date && (
          <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">
            Valable jusqu'au <strong className="capitalize">{formatLongDate(profile.prescription_end_date)}</strong>
            {rx.level === "expired" || rx.level === "urgent" ? (
              <span className="block text-xs text-muted-foreground">Prends rendez-vous avec ton médecin, ta sage-femme ou ton pharmacien pour la renouveler.</span>
            ) : null}
          </p>
        )}

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="rx-end" className="text-xs text-muted-foreground">Date de fin de l'ordonnance</Label>
          <div className="flex gap-2">
            <Input id="rx-end" type="date" value={rxDate} onChange={(e) => setRxDate(e.target.value)} className="h-11 rounded-xl" />
            <Button type="button" variant="secondary" className="h-11" onClick={() => void saveRx(rxDate || null)} disabled={!rxChanged || savingRx}>
              Enregistrer
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Valable à partir d'aujourd'hui :</span>
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setRxDate(addMonthsToKey(todayKey, m))}
                className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted"
              >
                {m === 12 ? "1 an" : `${m} mois`}
              </button>
            ))}
            {profile.prescription_end_date && (
              <button type="button" onClick={() => void saveRx(null)} className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Retirer
              </button>
            )}
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Je te préviens 30, 14, 7 et 3 jours avant la fin, puis le dernier jour{profile.notif_prescription ? "." : " (alerte désactivée dans les réglages)."}
        </p>
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
