/**
 * Utilitaires de dates — tout fonctionne en "clés jour" (YYYY-MM-DD) calculées
 * dans le fuseau de l'utilisatrice, jamais en UTC (sinon le jour change à 2h du
 * matin en France l'été).
 */

export const DEFAULT_TIMEZONE = "Europe/Paris"

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
  } catch {
    return DEFAULT_TIMEZONE
  }
}

export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export interface ZonedParts {
  /** YYYY-MM-DD dans le fuseau demandé */
  dateKey: string
  /** minutes écoulées depuis minuit dans le fuseau demandé */
  minutes: number
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const tz = isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  const hour = Number(get("hour")) % 24
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + Number(get("minute")),
  }
}

/** Clé jour locale de l'appareil (YYYY-MM-DD). */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12))
}

export function addDaysToKey(key: string, days: number): string {
  const d = parseKey(key)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Nombre de jours entiers entre deux clés (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000)
}

export function parseTime(hhmm: string | null | undefined): { h: number; m: number } | null {
  if (!hhmm) return null
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return { h, m }
}

export function timeToMinutes(hhmm: string | null | undefined): number | null {
  const t = parseTime(hhmm)
  return t ? t.h * 60 + t.m : null
}

export function formatTime(hhmm: string | null | undefined): string {
  const t = parseTime(hhmm)
  if (!t) return "--:--"
  return `${String(t.h).padStart(2, "0")}h${String(t.m).padStart(2, "0")}`
}

export const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

export const WEEKDAYS_FR_SHORT = ["L", "M", "M", "J", "V", "S", "D"]

export function formatLongDate(key: string): string {
  const d = parseKey(key)
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d)
}

export function formatShortDate(key: string): string {
  const d = parseKey(key)
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(d)
}
