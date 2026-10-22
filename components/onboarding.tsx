"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Bell, BellRing, Check, Clock, Minus, Package, Pill, Plus, Search, Sparkles, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PillSpinner } from "@/components/pill-loader"
import { createClient } from "@/lib/supabase-client"
import { FRENCH_PILLS, findPill } from "@/lib/pill-data"
import { ACTIVE_DAYS, PAUSE_DAYS } from "@/lib/pack"
import { addDaysToKey, detectTimezone, formatLongDate, localDateKey } from "@/lib/date"
import { addMonthsToKey } from "@/lib/supply"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { cn } from "@/lib/utils"

type StepId = "name" | "pill" | "time" | "pack" | "stock" | "notifications"
type PackState = "new" | "running" | "pause"

const TIME_PRESETS = ["07:00", "08:00", "09:00", "12:00", "20:00", "21:00", "22:00"]

function StepIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-gold-soft to-card text-primary shadow-sm ring-1 ring-primary/40">
      {children}
    </div>
  )
}

function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="flex items-center justify-center gap-4" role="group" aria-label={label}>
      <Button type="button" variant="outline" size="icon-lg" className="rounded-full" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Moins">
        <Minus />
      </Button>
      <span className="font-display w-16 text-center text-5xl font-semibold tabular-nums" aria-live="polite">{value}</span>
      <Button type="button" variant="outline" size="icon-lg" className="rounded-full" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Plus">
        <Plus />
      </Button>
    </div>
  )
}

export default function Onboarding({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const supabase = useMemo(() => createClient(), [])
  const push = usePushNotifications(true)

  const [index, setIndex] = useState(0)
  const [name, setName] = useState("")
  const [pillSearch, setPillSearch] = useState("")
  const [selectedPill, setSelectedPill] = useState("")
  const [pillTime, setPillTime] = useState("08:00")
  const [packState, setPackState] = useState<PackState>("new")
  const [packDay, setPackDay] = useState(1)
  const [pauseDay, setPauseDay] = useState(1)
  const [reserveBoxes, setReserveBoxes] = useState(1)
  const [rxEnd, setRxEnd] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pill = selectedPill ? findPill(selectedPill) : undefined
  const perBox = pill?.daysPerBox ?? 21
  const is217 = pill?.pillType === "21_7"

  const steps: StepId[] = ["name", "pill", "time", "pack", "stock", "notifications"]
  const step = steps[index]

  const filteredPills = useMemo(() => {
    const q = pillSearch.trim().toLowerCase()
    if (!q) return FRENCH_PILLS
    return FRENCH_PILLS.filter((p) => p.name.toLowerCase().includes(q) || p.substance.toLowerCase().includes(q))
  }, [pillSearch])

  /* Jours restants dans la plaquette en cours, selon ce que l'utilisatrice déclare */
  const remainingInCurrentPack = useMemo(() => {
    if (packState === "pause") return 0
    const day = packState === "new" ? 1 : Math.min(packDay, perBox)
    return Math.max(0, perBox - (day - 1))
  }, [packState, packDay, perBox])

  const daysRemaining = remainingInCurrentPack + reserveBoxes * perBox

  const packStartDate = useMemo(() => {
    const today = localDateKey()
    if (packState === "new") return today
    if (packState === "running") return addDaysToKey(today, -(Math.min(packDay, perBox) - 1))
    return addDaysToKey(today, -(ACTIVE_DAYS + pauseDay - 1))
  }, [packState, packDay, pauseDay, perBox])

  function next() {
    setError(null)
    setIndex((i) => Math.min(steps.length - 1, i + 1))
  }
  function back() {
    setError(null)
    setIndex((i) => Math.max(0, i - 1))
  }

  const canContinue =
    step === "name" ? name.trim().length > 0 : step === "pill" ? Boolean(pill) : step === "time" ? /^\d{2}:\d{2}$/.test(pillTime) : true

  async function handleFinish() {
    if (!name.trim() || !pill || !pillTime) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      name: name.trim(),
      pill_name: pill.name,
      pill_time: pillTime,
      boxes_remaining: reserveBoxes,
      days_remaining: daysRemaining,
      stock_alert_days: 7,
      timezone: detectTimezone(),
      pack_start_date: packStartDate,
      prescription_end_date: rxEnd || null,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) {
      setError(
        /fetch|network/i.test(error.message)
          ? "Pas de connexion. Vérifie ton réseau puis réessaie."
          : "Impossible de sauvegarder ton profil. Réessaie dans un instant.",
      )
      return
    }
    onComplete()
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-8 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        {/* Progression */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Étape {index + 1} sur {steps.length}</span>
            <span className="font-display text-sm font-semibold text-foreground">Pillow</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}>
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
          </div>
        </div>

        <div key={step} className="surface-lux animate-fade-up rounded-2xl p-6">
          {/* 1 — Prénom */}
          {step === "name" && (
            <div className="space-y-6">
              <div className="text-center">
                <StepIcon><User className="size-6" /></StepIcon>
                <h2 className="font-display text-3xl font-semibold">Enchantée !</h2>
                <p className="mt-1 text-sm text-muted-foreground">Comment dois-je t'appeler ?</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Prénom</Label>
                <Input
                  id="name"
                  placeholder="Ton prénom"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canContinue && next()}
                  autoFocus
                  autoComplete="given-name"
                  maxLength={40}
                  className="h-12 rounded-xl text-base"
                />
              </div>
            </div>
          )}

          {/* 2 — Pilule */}
          {step === "pill" && (
            <div className="space-y-4">
              <div className="text-center">
                <StepIcon><Pill className="size-6" /></StepIcon>
                <h2 className="font-display text-3xl font-semibold">Quelle pilule ?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Cherche son nom ou sa substance.</p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Ex : Cerazette, Leeloo, désogestrel…"
                  value={pillSearch}
                  onChange={(e) => setPillSearch(e.target.value)}
                  className="h-12 rounded-xl pl-10"
                  aria-label="Rechercher une pilule"
                />
              </div>
              <div className="max-h-60 space-y-1 overflow-y-auto rounded-2xl border bg-muted/40 p-1.5" role="listbox" aria-label="Pilules">
                {filteredPills.slice(0, 60).map((p) => {
                  const active = selectedPill === p.name
                  return (
                    <button
                      key={p.name}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => setSelectedPill(p.name)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        active ? "bg-primary/12 ring-1 ring-primary/40" : "hover:bg-card",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <span className="truncate">{p.name}</span>
                          {p.isGeneric && <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">générique</span>}
                        </span>
                        {p.substance && <span className="block truncate text-xs text-muted-foreground">{p.substance}</span>}
                      </span>
                      {active && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                  )
                })}
                {filteredPills.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucun résultat. Choisis « Autre pilule » en effaçant la recherche.</p>}
              </div>
              {pill && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{pill.daysPerBox} comprimés / boîte</span>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                    {pill.pillType === "28_continu" ? "Prise continue" : "21 jours + 7 de pause"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 3 — Heure */}
          {step === "time" && (
            <div className="space-y-6">
              <div className="text-center">
                <StepIcon><Clock className="size-6" /></StepIcon>
                <h2 className="font-display text-3xl font-semibold">À quelle heure ?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Je te rappellerai à cette heure, tous les jours.</p>
              </div>
              <div className="flex justify-center">
                <Input
                  type="time"
                  value={pillTime}
                  onChange={(e) => setPillTime(e.target.value)}
                  aria-label="Heure de prise"
                  className="font-display h-20 w-48 rounded-2xl border-2 border-primary/30 text-center text-5xl font-semibold text-primary"
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {TIME_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPillTime(t)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      pillTime === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {t.replace(":", "h")}
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Pour les pilules micro-progestatives, la régularité de l'heure est particulièrement importante.
              </p>
            </div>
          )}

          {/* 4 — Plaquette */}
          {step === "pack" && (
            <div className="space-y-5">
              <div className="text-center">
                <StepIcon><Sparkles className="size-6" /></StepIcon>
                <h2 className="font-display text-3xl font-semibold">Ta plaquette</h2>
                <p className="mt-1 text-sm text-muted-foreground">Où en es-tu aujourd'hui ?</p>
              </div>

              <div className="space-y-2" role="radiogroup" aria-label="Avancement de la plaquette">
                {([
                  { id: "new", label: "Je commence une nouvelle plaquette", hint: "Aujourd'hui est le jour 1" },
                  { id: "running", label: "J'ai déjà commencé la plaquette", hint: "Je choisis le jour en cours" },
                  ...(is217 ? [{ id: "pause", label: "Je suis en pause", hint: `Les ${PAUSE_DAYS} jours sans comprimé` }] : []),
                ] as Array<{ id: PackState; label: string; hint: string }>).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={packState === opt.id}
                    onClick={() => setPackState(opt.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all",
                      packState === opt.id ? "border-primary bg-primary/8 ring-1 ring-primary/40" : "hover:bg-muted/60",
                    )}
                  >
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", packState === opt.id ? "border-primary bg-primary" : "border-muted-foreground/40")}>
                      {packState === opt.id && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{opt.label}</span>
                      <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                    </span>
                  </button>
                ))}
              </div>

              {packState === "running" && (
                <div className="space-y-2 animate-fade-up">
                  <p className="text-center text-xs text-muted-foreground">Jour en cours (sur {perBox})</p>
                  <Stepper value={packDay} onChange={setPackDay} min={1} max={perBox} label="Jour de la plaquette" />
                </div>
              )}
              {packState === "pause" && (
                <div className="space-y-2 animate-fade-up">
                  <p className="text-center text-xs text-muted-foreground">Jour de pause (sur {PAUSE_DAYS})</p>
                  <Stepper value={pauseDay} onChange={setPauseDay} min={1} max={PAUSE_DAYS} label="Jour de pause" />
                </div>
              )}

              <p className="rounded-xl bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
                Plaquette commencée le <strong className="text-foreground">{formatLongDate(packStartDate)}</strong>
                {packState !== "pause" && remainingInCurrentPack > 0 && <> · encore {remainingInCurrentPack} comprimé{remainingInCurrentPack > 1 ? "s" : ""} à prendre</>}
              </p>
            </div>
          )}

          {/* 5 — Stock */}
          {step === "stock" && (
            <div className="space-y-6">
              <div className="text-center">
                <StepIcon><Package className="size-6" /></StepIcon>
                <h2 className="font-display text-3xl font-semibold">Ton stock</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Combien de boîtes de réserve as-tu, <strong className="font-semibold">sans compter celle en cours</strong> ?
                </p>
              </div>
              <Stepper value={reserveBoxes} onChange={setReserveBoxes} min={0} max={24} label="Boîtes de réserve" />
              <div className="rounded-2xl bg-muted/60 p-3 text-center text-sm">
                <span className="font-display text-2xl font-semibold text-primary">{daysRemaining}</span>{" "}
                <span className="text-muted-foreground">jour{daysRemaining > 1 ? "s" : ""} de pilule en tout</span>
                <p className="mt-0.5 text-xs text-muted-foreground">Je te préviens 7 jours avant la rupture (réglable ensuite).</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rx-end">Fin de ton ordonnance <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
                <Input id="rx-end" type="date" value={rxEnd} onChange={(e) => setRxEnd(e.target.value)} className="h-12 rounded-xl text-base" />
                <div className="flex flex-wrap gap-2">
                  {[3, 6, 12].map((m) => (
                    <button key={m} type="button" onClick={() => setRxEnd(addMonthsToKey(localDateKey(), m))} className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted">
                      dans {m === 12 ? "1 an" : `${m} mois`}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Je te rappelle de la renouveler 30, 14, 7 et 3 jours avant.</p>
              </div>
            </div>
          )}

          {/* 6 — Notifications */}
          {step === "notifications" && (
            <div className="space-y-5 text-center">
              <div>
                <StepIcon>{push.status === "subscribed" ? <BellRing className="size-6" /> : <Bell className="size-6" />}</StepIcon>
                <h2 className="font-display text-3xl font-semibold">Tes rappels</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pour que Pillow te prévienne à l'heure, même quand l'app est fermée.
                </p>
              </div>

              {push.status === "subscribed" ? (
                <div className="rounded-2xl bg-success/15 p-4 text-sm" role="status">
                  <Check className="mx-auto mb-1 size-5 text-success" />
                  Rappels activés sur cet appareil. Tu peux régler tout ça plus tard dans les paramètres.
                </div>
              ) : push.status === "needs_install" ? (
                <div className="rounded-2xl bg-muted/70 p-4 text-left text-sm">
                  <p className="mb-1.5 font-medium">Sur iPhone, une dernière étape :</p>
                  <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                    <li>Touche le bouton <strong>Partager</strong> de Safari</li>
                    <li>Choisis <strong>Sur l'écran d'accueil</strong></li>
                    <li>Ouvre Pillow depuis l'icône, puis active les rappels dans les paramètres</li>
                  </ol>
                </div>
              ) : push.status === "denied" ? (
                <p className="rounded-2xl bg-warning/15 p-4 text-sm">
                  Les notifications sont bloquées pour ce site. Autorise-les dans les réglages de ton navigateur, puis réessaie depuis les paramètres de Pillow.
                </p>
              ) : push.status === "unsupported" ? (
                <p className="rounded-2xl bg-muted/70 p-4 text-sm text-muted-foreground">
                  Ce navigateur ne gère pas les notifications. Essaie Chrome, Edge, Firefox ou Safari (iOS 16.4+, app installée).
                </p>
              ) : (
                <Button type="button" variant="lux" size="lg" className="h-12 w-full text-base" onClick={() => void push.subscribe()} disabled={push.status === "loading"}>
                  {push.status === "loading" ? <PillSpinner className="size-5" /> : <Bell />}
                  {push.status === "loading" ? "Activation…" : "Activer les rappels"}
                </Button>
              )}
              {push.lastError && <p className="text-xs text-destructive" role="alert">{push.lastError}</p>}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="mt-6 flex gap-2">
            {index > 0 && (
              <Button type="button" variant="outline" size="lg" onClick={back} className="flex-1" disabled={saving}>
                <ArrowLeft /> Retour
              </Button>
            )}
            {step !== "notifications" ? (
              <Button type="button" variant="lux" size="lg" onClick={next} disabled={!canContinue} className="flex-1">
                Continuer <ArrowRight />
              </Button>
            ) : (
              <Button type="button" variant="lux" size="lg" onClick={handleFinish} disabled={saving} className="flex-1">
                {saving && <PillSpinner className="size-5" />}
                {saving ? "Un instant…" : push.status === "subscribed" ? "C'est parti" : "Terminer"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
