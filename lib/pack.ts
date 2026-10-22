import { addDaysToKey, diffDays } from "@/lib/date"

/**
 * Calcul de la position dans la plaquette.
 *
 * - 21/7 : 21 jours de prise puis 7 jours de pause (cycle de 28 jours).
 * - Prise continue : toujours en phase "active".
 *
 * Sans date de début de plaquette, on considère qu'on est toujours en phase active
 * (c'est le comportement le plus sûr : on rappelle plutôt que de se taire).
 */
export type PackPhase = "active" | "pause"

export interface PackStatus {
  phase: PackPhase
  /** Jour dans la phase en cours (1-indexé) */
  day: number
  /** Nombre total de jours de la phase en cours */
  phaseLength: number
  /** Clé jour de la prochaine reprise (uniquement en pause) */
  resumeOn: string | null
  /** Clé jour du début de la pause (uniquement en phase active, 21/7) */
  pauseStartsOn: string | null
  /** true si demain est le premier jour d'une nouvelle plaquette */
  restartsTomorrow: boolean
}

export const ACTIVE_DAYS = 21
export const PAUSE_DAYS = 7
export const CYCLE_DAYS = ACTIVE_DAYS + PAUSE_DAYS

export function getPackStatus(
  pillType: "21_7" | "28_continu",
  packStartDate: string | null | undefined,
  todayKey: string,
): PackStatus {
  if (pillType !== "21_7" || !packStartDate) {
    return {
      phase: "active",
      day: 1,
      phaseLength: pillType === "21_7" ? ACTIVE_DAYS : 28,
      resumeOn: null,
      pauseStartsOn: null,
      restartsTomorrow: false,
    }
  }

  const elapsed = diffDays(packStartDate, todayKey)
  // Date de début dans le futur : la plaquette n'a pas commencé, on reste en phase active
  const index = elapsed < 0 ? 0 : ((elapsed % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS
  const cycleStart = addDaysToKey(todayKey, -index)

  if (index < ACTIVE_DAYS) {
    return {
      phase: "active",
      day: index + 1,
      phaseLength: ACTIVE_DAYS,
      resumeOn: null,
      pauseStartsOn: addDaysToKey(cycleStart, ACTIVE_DAYS),
      restartsTomorrow: false,
    }
  }

  return {
    phase: "pause",
    day: index - ACTIVE_DAYS + 1,
    phaseLength: PAUSE_DAYS,
    resumeOn: addDaysToKey(cycleStart, CYCLE_DAYS),
    pauseStartsOn: null,
    restartsTomorrow: index === CYCLE_DAYS - 1,
  }
}

/** Phase d'un jour quelconque (utile pour griser les jours de pause dans le calendrier). */
export function phaseOfDay(
  pillType: "21_7" | "28_continu",
  packStartDate: string | null | undefined,
  dayKey: string,
): PackPhase {
  return getPackStatus(pillType, packStartDate, dayKey).phase
}

export interface BlisterCell {
  dateKey: string
  phase: PackPhase
  /** Numéro du comprimé dans la plaquette (1-indexé) ; null pour les jours de pause */
  number: number | null
}

export interface BlisterLayout {
  cells: BlisterCell[]
  todayIndex: number
}

/**
 * Plaquette « vue de dessus » : une case par jour du cycle en cours.
 * 21/7 : 21 comprimés + 7 cases de pause. Continue : `perBox` comprimés.
 */
export function getBlisterLayout(
  pillType: "21_7" | "28_continu",
  perBox: number,
  packStartDate: string | null | undefined,
  todayKey: string,
): BlisterLayout {
  const length = pillType === "21_7" ? CYCLE_DAYS : Math.max(1, perBox)
  const start = packStartDate ?? todayKey
  const elapsed = diffDays(start, todayKey)
  const index = elapsed < 0 ? 0 : ((elapsed % length) + length) % length
  const cycleStart = addDaysToKey(todayKey, -index)

  const cells: BlisterCell[] = Array.from({ length }, (_, i) => {
    const pause = pillType === "21_7" && i >= ACTIVE_DAYS
    return { dateKey: addDaysToKey(cycleStart, i), phase: pause ? "pause" : "active", number: pause ? null : i + 1 }
  })
  return { cells, todayIndex: index }
}
