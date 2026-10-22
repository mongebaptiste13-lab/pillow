import { addDaysToKey, diffDays } from "@/lib/date"
import { ACTIVE_DAYS, CYCLE_DAYS, phaseOfDay } from "@/lib/pack"

/**
 * Stock de pilules (boîtes / plaquettes) et validité de l'ordonnance.
 * Fonctions pures, partagées par l'interface et le dispatcher de notifications.
 */

type PillType = "21_7" | "28_continu"

/* ------------------------------------------------------------------ */
/* Stock                                                               */
/* ------------------------------------------------------------------ */

export interface StockInfo {
  /** Comprimés restants au total (jours de prise) */
  daysLeft: number
  /** Comprimés restants dans la plaquette en cours (aujourd'hui compris s'il n'est pas pris) */
  currentPackLeft: number
  /** Boîtes / plaquettes entières en réserve, sans la plaquette en cours */
  reserveBoxes: number
  /** Comprimés « libres » en plus des boîtes entières de réserve */
  looseDays: number
  /** Jour du dernier comprimé (pauses comprises), null si le stock est vide */
  lastPillDate: string | null
  /** Nombre de jours calendaires avant le dernier comprimé (0 = c'est aujourd'hui / demain…) */
  calendarDaysLeft: number | null
  empty: boolean
}

export function getStockInfo(params: {
  pillType: PillType
  packStartDate: string | null | undefined
  perBox: number
  daysLeft: number
  todayKey: string
  takenToday: boolean
}): StockInfo {
  const { pillType, packStartDate, todayKey, takenToday } = params
  const perBox = Math.max(1, params.perBox)
  const daysLeft = Math.max(0, Math.floor(params.daysLeft))

  /* Dans la plaquette en cours : combien de comprimés restent à prendre ? */
  let inPack = 0
  if (pillType === "21_7") {
    if (phaseOfDay(pillType, packStartDate, todayKey) === "active" && packStartDate) {
      const index = ((diffDays(packStartDate, todayKey) % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS
      inPack = Math.max(0, ACTIVE_DAYS - index - (takenToday ? 1 : 0))
    } else if (!packStartDate) {
      inPack = ACTIVE_DAYS
    }
  } else {
    const index = packStartDate ? ((diffDays(packStartDate, todayKey) % perBox) + perBox) % perBox : 0
    inPack = Math.max(0, perBox - index - (takenToday ? 1 : 0))
  }

  const currentPackLeft = Math.min(daysLeft, inPack)
  const afterPack = daysLeft - currentPackLeft
  const reserveBoxes = Math.floor(afterPack / perBox)
  const looseDays = afterPack % perBox

  /* Date du dernier comprimé : on avance jour par jour en sautant les pauses */
  let lastPillDate: string | null = null
  if (daysLeft > 0) {
    let remaining = daysLeft
    let cursor = takenToday ? addDaysToKey(todayKey, 1) : todayKey
    lastPillDate = cursor
    for (let i = 0; i < 3000 && remaining > 0; i++) {
      if (phaseOfDay(pillType, packStartDate, cursor) === "active") {
        remaining--
        lastPillDate = cursor
      }
      cursor = addDaysToKey(cursor, 1)
    }
  }

  return {
    daysLeft,
    currentPackLeft,
    reserveBoxes,
    looseDays,
    lastPillDate,
    calendarDaysLeft: lastPillDate ? Math.max(0, diffDays(todayKey, lastPillDate)) : null,
    empty: daysLeft <= 0,
  }
}

/** Sous ce nombre de jours restants, l'alerte de stock devient quotidienne. */
export const STOCK_URGENT_DAYS = 3

export type StockLevel = "ok" | "low" | "urgent" | "empty"

export function getStockLevel(daysLeft: number, threshold: number): StockLevel {
  if (daysLeft <= 0) return "empty"
  if (daysLeft <= STOCK_URGENT_DAYS) return "urgent"
  if (daysLeft <= threshold) return "low"
  return "ok"
}

/* ------------------------------------------------------------------ */
/* Ordonnance                                                          */
/* ------------------------------------------------------------------ */

/** Paliers de prévenance avant la fin de l'ordonnance (en jours). */
export const PRESCRIPTION_STEPS = [30, 14, 7, 3, 0] as const

export type PrescriptionLevel = "none" | "ok" | "soon" | "urgent" | "expired"

export interface PrescriptionInfo {
  /** Jours restants (négatif si expirée) ; null sans date */
  daysLeft: number | null
  level: PrescriptionLevel
  /** Palier atteint : 30, 14, 7, 3, 0 (dernier jour) ou -1 (expirée) ; null si trop tôt / pas de date */
  bucket: number | null
}

export function getPrescriptionInfo(endDate: string | null | undefined, todayKey: string): PrescriptionInfo {
  if (!endDate) return { daysLeft: null, level: "none", bucket: null }
  const daysLeft = diffDays(todayKey, endDate)
  if (daysLeft < 0) return { daysLeft, level: "expired", bucket: -1 }

  // Plus petit palier qui contient encore le nombre de jours restants
  let bucket: number | null = null
  for (const step of [...PRESCRIPTION_STEPS].reverse()) {
    if (daysLeft <= step) {
      bucket = step
      break
    }
  }
  const level: PrescriptionLevel = daysLeft <= 7 ? "urgent" : daysLeft <= 30 ? "soon" : "ok"
  return { daysLeft, level, bucket }
}

/** Date de fin proposée : même jour, `months` mois plus tard (ex. durée classique d'une ordonnance : 12 mois). */
export function addMonthsToKey(key: string, months: number): string {
  const [y, m, d] = key.split("-").map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}
