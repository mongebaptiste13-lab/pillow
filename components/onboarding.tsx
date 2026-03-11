"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Moon } from "lucide-react"

interface OnboardingProps {
  onComplete: (prefs: PillPreferences) => void
}

export interface PillPreferences {
  name: string
  pillType: "21_7" | "28_continu"
  pillTime: string
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [name, setName] = useState("")
  const [pillType, setPillType] = useState<"21_7" | "28_continu">("21_7")
  const [pillTime, setPillTime] = useState("21:00")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError("Veuillez entrer votre nom")
      return
    }

    if (!pillTime) {
      setError("Veuillez sélectionner une heure")
      return
    }

    onComplete({
      name: name.trim(),
      pillType,
      pillTime,
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-background via-background to-secondary/50">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="p-6 space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Moon className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Bienvenue à Luna</h1>
            <p className="text-sm text-muted-foreground">
              Ton app pour suivre ta pilule et ton cycle
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground block">
                Quel est ton nom ?
              </label>
              <input
                id="name"
                type="text"
                placeholder="Entrez votre nom"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError("")
                }}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Pill Type */}
            <div className="space-y-2">
              <label htmlFor="pillType" className="text-sm font-medium text-foreground block">
                Type de pilule
              </label>
              <select
                id="pillType"
                value={pillType}
                onChange={(e) => setPillType(e.target.value as "21_7" | "28_continu")}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="21_7">21/7 (21 jours pilule, 7 jours pause)</option>
                <option value="28_continu">28 jours (continu)</option>
              </select>
            </div>

            {/* Time Input */}
            <div className="space-y-2">
              <label htmlFor="pillTime" className="text-sm font-medium text-foreground block">
                À quelle heure prends-tu ta pilule ?
              </label>
              <input
                id="pillTime"
                type="time"
                value={pillTime}
                onChange={(e) => setPillTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5"
            >
              Commencer
            </Button>
          </form>

          {/* Footer */}
          <p className="text-xs text-center text-muted-foreground">
            Tes données sont stockées localement sur ton appareil. Tu peux les modifier à tout moment.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default Onboarding