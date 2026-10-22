import { addDaysToKey, diffDays, timeToMinutes } from "@/lib/date"
import { phaseOfDay } from "@/lib/pack"

export interface LogEntry {
  date: string
  taken: boolean
  taken_at: string | null
}

export type LogMap = Record<string, LogEntry>

export interface PillStats {
  /** Jours consécutifs de prise (les jours de pause ne cassent pas la série) */
  currentStreak: number
  bestStreak: number
  /** Observance sur les 30 derniers jours (0-100), null s'il n'y a pas encore de recul */
  adherence30: number | null
  taken30: number
  missed30: number
  /** % de prises dans l'heure autour de l'heure prévue, null si moins de 3 mesures */
  onTimePct: number | null
  takenTotal: number
}

interface Params {
  logs: LogMap
  todayKey: string
  pillType: "21_7" | "28_continu"
  packStartDate: string | null
  /** Premier jour de suivi (création du compte) : avant, on ne compte pas de « manquées » */
  trackingSince: string
  pillTime: string | null
}

export function computeStats({ logs, todayKey, pillType, packStartDate, trackingSince, pillTime }: Params): PillStats {
  const isActive = (day: string) => phaseOfDay(pillType, packStartDate, day) === "active"
  const takenOn = (day: string) => logs[day]?.taken === true

  /* Série en cours : on part d'aujourd'hui s'il est pris, sinon d'hier (la journée n'est pas finie) */
  let cursor = takenOn(todayKey) ? todayKey : addDaysToKey(todayKey, -1)
  let currentStreak = 0
  for (let i = 0; i < 800; i++) {
    if (diffDays(trackingSince, cursor) < -1) break
    if (!isActive(cursor)) {
      cursor = addDaysToKey(cursor, -1)
      continue
    }
    if (!takenOn(cursor)) break
    currentStreak++
    cursor = addDaysToKey(cursor, -1)
  }

  /* Meilleure série sur tout l'historique chargé */
  const days = Object.keys(logs).sort()
  let bestStreak = 0
  if (days.length > 0) {
    let run = 0
    let day = days[0]
    while (diffDays(day, todayKey) >= 0) {
      if (isActive(day)) {
        if (takenOn(day)) {
          run++
          bestStreak = Math.max(bestStreak, run)
        } else if (day !== todayKey) {
          run = 0
        }
      }
      day = addDaysToKey(day, 1)
    }
  }
  bestStreak = Math.max(bestStreak, currentStreak)

  /* Observance sur 30 jours */
  const windowStart = addDaysToKey(todayKey, -29)
  const start = diffDays(windowStart, trackingSince) > 0 ? trackingSince : windowStart
  let expected = 0
  let taken30 = 0
  for (let day = start; diffDays(day, todayKey) >= 0; day = addDaysToKey(day, 1)) {
    if (!isActive(day)) continue
    if (day === todayKey && !takenOn(day)) continue // la journée n'est pas terminée
    expected++
    if (takenOn(day)) taken30++
  }

  /* Ponctualité */
  const target = timeToMinutes(pillTime)
  let onTime = 0
  let measured = 0
  if (target !== null) {
    for (const entry of Object.values(logs)) {
      if (!entry.taken || !entry.taken_at) continue
      const at = new Date(entry.taken_at)
      if (Number.isNaN(at.getTime())) continue
      const minutes = at.getHours() * 60 + at.getMinutes()
      measured++
      if (Math.abs(minutes - target) <= 60) onTime++
    }
  }

  return {
    currentStreak,
    bestStreak,
    adherence30: expected > 0 ? Math.round((taken30 / expected) * 100) : null,
    taken30,
    missed30: Math.max(0, expected - taken30),
    onTimePct: measured >= 3 ? Math.round((onTime / measured) * 100) : null,
    takenTotal: Object.values(logs).filter((l) => l.taken).length,
  }
}
