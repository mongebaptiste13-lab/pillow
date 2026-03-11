"use client"

import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase-client"
import { FRENCH_PILLS, findPill } from "@/lib/pill-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronRight, ChevronLeft, Search } from "lucide-react"

interface OnboardingProps {
  userId: string
  onComplete: () => void
}

export default function Onboarding({ userId, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState("")
  const [pillSearch, setPillSearch] = useState("")
  const [selectedPill, setSelectedPill] = useState("")
  const [pillTime, setPillTime] = useState("08:00")
  const [boxesLeft, setBoxesLeft] = useState<number>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const filteredPills = useMemo(() => {
    const q = pillSearch.toLowerCase()
    return FRENCH_PILLS.filter((p) => p.name.toLowerCase().includes(q) || p.substance.toLowerCase().includes(q))
  }, [pillSearch])

  const resolvedPill = selectedPill ? findPill(selectedPill) : undefined

  const totalDays = resolvedPill ? resolvedPill.daysPerBox * boxesLeft : 0
  const daysRemaining = totalDays

  async function handleFinish() {
    if (!name || !selectedPill || !pillTime) return
    if (!resolvedPill) {
      setError("Sélectionne une pilule valide.")
      return
    }
    setSaving(true)
    setError(null)
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      name: name.trim(),
      pill_name: selectedPill,
      pill_time: pillTime,
      boxes_remaining: boxesLeft,
      days_remaining: daysRemaining,
      stock_alert_days: 7,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)

    if (error) {
      setError("Impossible de sauvegarder ton profil. Réessaie.")
      return
    }

    onComplete()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${step >= s ? "w-8 bg-primary" : "w-2 bg-muted"}`}
            />
          ))}
        </div>

        {/* Step 1 — Prénom */}
        {step === 1 && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-2">👋</div>
                <h2 className="text-xl font-bold">Bienvenue !</h2>
                <p className="text-muted-foreground text-sm mt-1">Comment tu t'appelles ?</p>
              </div>
              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input
                  placeholder="Ton prénom"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <Button className="w-full" onClick={() => setStep(2)} disabled={!name.trim()}>
                Continuer <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Pilule */}
        {step === 2 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="text-center">
                <div className="text-4xl mb-2">💊</div>
                <h2 className="text-xl font-bold">Quelle pilule ?</h2>
                <p className="text-muted-foreground text-sm mt-1">Cherche ta pilule ci-dessous</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ex : Cerazette, Leeloo…"
                  value={pillSearch}
                  onChange={(e) => setPillSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border bg-muted/30 p-1">
                {filteredPills.slice(0, 40).map((p) => (
                  <button
                    key={p.name}
                    onClick={() => { setSelectedPill(p.name); setPillSearch(p.name) }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-primary/10 ${
                      selectedPill === p.name ? "bg-primary/15 text-primary font-medium" : ""
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.isGeneric && (
                      <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                        générique
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground mt-0.5">{p.substance}</span>
                  </button>
                ))}
                {filteredPills.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">Aucun résultat</p>
                )}
              </div>
              {resolvedPill && (
                <div className="rounded-xl bg-primary/10 p-3 space-y-1">
                  <p className="text-sm font-semibold text-primary">{resolvedPill.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {resolvedPill.daysPerBox} comp. / boîte
                    </span>
                    <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                      {resolvedPill.pillType === "28_continu" ? "Prise continue" : "21j + 7j pause"}
                    </span>
                    {resolvedPill.category !== "micro-progestative" && (
                      <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                        {resolvedPill.generation === "4"
                          ? "4ᵉ gén."
                          : resolvedPill.generation === "3"
                          ? "3ᵉ gén."
                          : "2ᵉ gén."}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ChevronLeft className="mr-1 h-4 w-4" /> Retour
                </Button>
                <Button onClick={() => setStep(3)} disabled={!selectedPill} className="flex-1">
                  Continuer <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Heure */}
        {step === 3 && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-2">⏰</div>
                <h2 className="text-xl font-bold">À quelle heure ?</h2>
                <p className="text-muted-foreground text-sm mt-1">Je t'enverrai un rappel à cette heure.</p>
              </div>
              <div className="flex justify-center">
                <Input
                  type="time"
                  value={pillTime}
                  onChange={(e) => setPillTime(e.target.value)}
                  className="text-3xl font-bold text-center h-16 w-40 text-primary border-2 border-primary/30"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  <ChevronLeft className="mr-1 h-4 w-4" /> Retour
                </Button>
                <Button onClick={() => setStep(4)} className="flex-1">
                  Continuer <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4 — Stock */}
        {step === 4 && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="text-center">
                <div className="text-4xl mb-2">📦</div>
                <h2 className="text-xl font-bold">Ton stock</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Combien de boîtes il te reste ? Je te préviendrai avant la rupture.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Boîtes restantes</Label>
                <Input
                  type="number"
                  min={0}
                  max={12}
                  value={boxesLeft}
                  onChange={(e) => setBoxesLeft(parseInt(e.target.value) || 0)}
                  className="text-2xl text-center font-bold h-14"
                />
                {resolvedPill && boxesLeft > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    ≈ {resolvedPill.daysPerBox * boxesLeft} jours de pilule
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                  <ChevronLeft className="mr-1 h-4 w-4" /> Retour
                </Button>
                <Button onClick={handleFinish} disabled={saving || !name || !selectedPill} className="flex-1">
                  {saving ? "Sauvegarde…" : "C'est parti ! 🎉"}
                </Button>
              </div>
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
