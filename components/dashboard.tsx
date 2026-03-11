"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { 
  Bell, 
  Calendar, 
  Check, 
  Clock, 
  Droplets,
  Heart,
  Home,
  Moon,
  Settings,
  Sun,
  Timer
} from "lucide-react"
import Onboarding from "./onboarding";

interface CycleData {
  lastPeriodStart: Date
  cycleLength: number
  periodLength: number
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<"home" | "cycle" | "pill" | "settings">("home")
  const [pillTaken, setPillTaken] = useState(false)
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false)
  
  // Mock data - in real app this would come from database
  const cycleData: CycleData = {
    lastPeriodStart: new Date(2026, 1, 20), // 20 février 2026
    cycleLength: 28,
    periodLength: 5
  }

  const pillTime = "21:00"
  
  // Calculate cycle info
  const today = new Date()
  const daysSinceLastPeriod = Math.floor(
    (today.getTime() - cycleData.lastPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
  )
  const currentCycleDay = (daysSinceLastPeriod % cycleData.cycleLength) + 1
  const daysUntilNextPeriod = cycleData.cycleLength - currentCycleDay
  const nextPeriodDate = new Date(today.getTime() + daysUntilNextPeriod * 24 * 60 * 60 * 1000)
  
  // Fertility window (simplified: days 10-16 of cycle)
  const isFertileWindow = currentCycleDay >= 10 && currentCycleDay <= 16
  const ovulationDay = 14
  const daysToOvulation = ovulationDay - currentCycleDay

  // Current phase
  const getPhase = () => {
    if (currentCycleDay <= cycleData.periodLength) return "Règles"
    if (currentCycleDay <= 13) return "Phase folliculaire"
    if (currentCycleDay <= 16) return "Ovulation"
    return "Phase lutéale"
  }

  const handlePillTaken = () => {
    setPillTaken(true)
    setShowSnoozeOptions(false)
  }

  const handleSnooze = (minutes: number) => {
    setShowSnoozeOptions(false)
    // In real app, this would schedule a new notification
    alert(`Rappel dans ${minutes} minutes`)
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Moon className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Luna</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {today.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 space-y-6">
        {activeTab === "home" && (
          <>
            {/* Hero Card - Cycle Overview */}
            <Card className="overflow-hidden border-0 shadow-lg bg-primary">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-primary-foreground/80 text-sm font-medium">Jour du cycle</p>
                    <p className="text-5xl font-bold text-primary-foreground mt-1">{currentCycleDay}</p>
                    <p className="text-primary-foreground/80 text-sm mt-2">{getPhase()}</p>
                  </div>
                  <div className="w-24 h-24 rounded-full border-4 border-primary-foreground/30 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary-foreground">{daysUntilNextPeriod}</p>
                      <p className="text-xs text-primary-foreground/80">jours</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-primary-foreground/80" />
                  <span className="text-sm text-primary-foreground/90">
                    Prochaines règles: {nextPeriodDate.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              {/* Fertility Status */}
              <Card className={cn(
                "border-0 shadow-md",
                isFertileWindow ? "bg-accent" : "bg-card"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className={cn(
                      "w-4 h-4",
                      isFertileWindow ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className="text-sm font-medium text-foreground">Fertilité</span>
                  </div>
                  <p className={cn(
                    "text-lg font-semibold",
                    isFertileWindow ? "text-primary" : "text-muted-foreground"
                  )}>
                    {isFertileWindow ? "Fertile" : "Faible"}
                  </p>
                  {daysToOvulation > 0 && daysToOvulation <= 7 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Ovulation dans {daysToOvulation} jours
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Pill Reminder Card */}
              <Card className={cn(
                "border-0 shadow-md",
                pillTaken ? "bg-secondary" : "bg-card"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Pilule</span>
                  </div>
                  <p className={cn(
                    "text-lg font-semibold",
                    pillTaken ? "text-primary" : "text-foreground"
                  )}>
                    {pillTaken ? "Prise ✓" : pillTime}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pillTaken ? "Aujourd'hui" : "Rappel prévu"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Pill Action Card */}
            {!pillTaken && (
              <Card className="border-2 border-primary/20 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bell className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{"N'oublie pas ta pilule"}</h3>
                      <p className="text-sm text-muted-foreground">Rappel quotidien à {pillTime}</p>
                    </div>
                  </div>
                  
                  {showSnoozeOptions ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Me rappeler dans:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[10, 30, 60].map((min) => (
                          <Button
                            key={min}
                            variant="outline"
                            size="sm"
                            onClick={() => handleSnooze(min)}
                            className="text-foreground"
                          >
                            {min} min
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSnoozeOptions(false)}
                        className="w-full text-muted-foreground"
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button 
                        onClick={handlePillTaken}
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Pris
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowSnoozeOptions(true)}
                        className="flex-1"
                      >
                        <Timer className="w-4 h-4 mr-2" />
                        Plus tard
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Cycle Progress */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground mb-4">Progression du cycle</h3>
                <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(currentCycleDay / cycleData.cycleLength) * 100}%` }}
                  />
                  {/* Fertility window indicator */}
                  <div 
                    className="absolute top-0 h-full bg-accent/50"
                    style={{ 
                      left: `${(10 / cycleData.cycleLength) * 100}%`,
                      width: `${(6 / cycleData.cycleLength) * 100}%`
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Jour 1</span>
                  <span>Jour {cycleData.cycleLength}</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "cycle" && <CycleTab cycleData={cycleData} />}
        {activeTab === "pill" && <PillTab pillTime={pillTime} />}
        {activeTab === "settings" && <SettingsTab />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
        <div className="flex justify-around py-2 px-4">
          {[
            { id: "home" as const, icon: Home, label: "Accueil" },
            { id: "cycle" as const, icon: Calendar, label: "Cycle" },
            { id: "pill" as const, icon: Bell, label: "Pilule" },
            { id: "settings" as const, icon: Settings, label: "Réglages" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[64px]",
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

function CycleTab({ cycleData }: { cycleData: CycleData }) {
  const today = new Date()
  const daysSinceLastPeriod = Math.floor(
    (today.getTime() - cycleData.lastPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
  )
  const currentCycleDay = (daysSinceLastPeriod % cycleData.cycleLength) + 1

  // Generate calendar days
  const generateCalendarDays = () => {
    const days = []
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const startDay = startOfMonth.getDay() === 0 ? 6 : startOfMonth.getDay() - 1 // Monday = 0
    
    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
      days.push({ day: null, type: "empty" })
    }
    
    // Days of month
    for (let i = 1; i <= endOfMonth.getDate(); i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), i)
      const daysSince = Math.floor(
        (date.getTime() - cycleData.lastPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
      )
      const cycleDay = (daysSince % cycleData.cycleLength) + 1
      
      let type = "normal"
      if (cycleDay <= cycleData.periodLength) type = "period"
      else if (cycleDay >= 10 && cycleDay <= 16) type = "fertile"
      if (i === today.getDate()) type = type + " today"
      
      days.push({ day: i, type, cycleDay })
    }
    
    return days
  }

  const calendarDays = generateCalendarDays()
  const weekDays = ["L", "M", "M", "J", "V", "S", "D"]

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">
              {today.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </h3>
          </div>
          
          {/* Week days header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day, i) => (
              <div key={i} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "aspect-square flex items-center justify-center text-sm rounded-lg",
                  item.day === null && "invisible",
                  item.type.includes("period") && "bg-primary/20 text-primary font-medium",
                  item.type.includes("fertile") && "bg-accent text-accent-foreground",
                  item.type.includes("today") && "ring-2 ring-primary font-bold"
                )}
              >
                {item.day}
              </div>
            ))}
          </div>
          
          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary/20" />
              <span className="text-xs text-muted-foreground">Règles</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent" />
              <span className="text-xs text-muted-foreground">Fertile</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cycle Info */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold text-foreground">Informations du cycle</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Durée du cycle</p>
              <p className="text-lg font-semibold text-foreground">{cycleData.cycleLength} jours</p>
            </div>
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Durée des règles</p>
              <p className="text-lg font-semibold text-foreground">{cycleData.periodLength} jours</p>
            </div>
          </div>

          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Dernières règles</p>
            <p className="text-lg font-semibold text-foreground">
              {cycleData.lastPeriodStart.toLocaleDateString("fr-FR", { 
                day: "numeric", 
                month: "long", 
                year: "numeric" 
              })}
            </p>
          </div>

          <Button variant="outline" className="w-full">
            <Calendar className="w-4 h-4 mr-2" />
            Enregistrer mes règles
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function PillTab({ pillTime }: { pillTime: string }) {
  const [weekHistory] = useState([
    { day: "Lun", taken: true },
    { day: "Mar", taken: true },
    { day: "Mer", taken: true },
    { day: "Jeu", taken: false },
    { day: "Ven", taken: true },
    { day: "Sam", taken: true },
    { day: "Dim", taken: null }, // Today
  ])

  return (
    <div className="space-y-6">
      {/* Current Settings */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground mb-4">Rappel quotidien</h3>
          
          <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{pillTime}</p>
                <p className="text-sm text-muted-foreground">Tous les jours</p>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              Modifier
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Week History */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground mb-4">Cette semaine</h3>
          
          <div className="flex justify-between">
            {weekHistory.map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground">{item.day}</span>
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  item.taken === true && "bg-primary/20 text-primary",
                  item.taken === false && "bg-destructive/20 text-destructive",
                  item.taken === null && "bg-secondary text-muted-foreground border-2 border-dashed border-border"
                )}>
                  {item.taken === true && <Check className="w-5 h-5" />}
                  {item.taken === false && <span className="text-lg">×</span>}
                  {item.taken === null && <Sun className="w-4 h-4" />}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taux de prise</span>
              <span className="font-semibold text-foreground">83%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pill Type */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground mb-4">Type de pilule</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border-2 border-primary">
              <span className="font-medium text-foreground">21 jours + 7 jours pause</span>
              <Check className="w-5 h-5 text-primary" />
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
              <span className="text-muted-foreground">28 jours en continu</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsTab() {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground mb-4">Notifications</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Rappel pilule</p>
                <p className="text-sm text-muted-foreground">Notification quotidienne</p>
              </div>
              <div className="w-12 h-6 bg-primary rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-primary-foreground rounded-full" />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Prédiction règles</p>
                <p className="text-sm text-muted-foreground">2 jours avant</p>
              </div>
              <div className="w-12 h-6 bg-primary rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-primary-foreground rounded-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground mb-4">Mon cycle</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Durée moyenne du cycle</span>
              <span className="text-muted-foreground">28 jours</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Durée des règles</span>
              <span className="text-muted-foreground">5 jours</span>
            </div>
          </div>
          
          <Button variant="outline" className="w-full mt-4">
            Modifier les paramètres
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground mb-4">Installation PWA</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {"Pour recevoir les notifications, ajoute l'app à ton écran d'accueil."}
          </p>
          <Button className="w-full bg-primary text-primary-foreground">
            {"Ajouter à l'écran d'accueil"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
